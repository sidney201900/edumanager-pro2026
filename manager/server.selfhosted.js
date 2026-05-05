/**
 * ============================================================
 * EDUMANAGER — SERVER SELF-HOSTED
 * ============================================================
 * SUBSTITUIÇÃO CIRÚRGICA:
 *   - @supabase/supabase-js → pg (PostgreSQL direto)
 *   - Supabase Storage      → MinIO (S3-compatible)
 * 
 * TODAS AS ROTAS mantêm a mesma assinatura e resposta.
 * O frontend NÃO percebe a diferença.
 * ============================================================
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import sharp from 'sharp';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';

// === Novos módulos Self-Hosted (substituem Supabase) ===
import {
  getSchoolData, saveSchoolData, pool,
  insertCobrancas, updateCobranca, deleteCobranca,
  getCobrancaByPaymentId, getCobrancasByOrQuery,
  getCobrancasByAlunoId, getCobrancasAtrasadas, getCobrancasPendentes,
  getCobrancasByInstallmentId, updateCobrancaLinkCarne,
  updateCobrancaByField,
  initNotasTable, getNotasByAluno, upsertNota,
  syncJsonToRelationalTables
} from './services/database.js';
import { uploadLogo as uploadLogoToStorage, uploadCarne as uploadCarneToStorage, getMinioStats, s3Client, getBucketObjects, deleteMinioObject } from './services/storage.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'EduManager-JWT-Secret-2026!';

// === ASAAS: URL base dinâmica inteligente ===
const ASAAS_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_BASE_URL = process.env.ASAAS_API_URL || (ASAAS_KEY.startsWith('$a') ? 'https://api.asaas.com' : 'https://sandbox.asaas.com/api');

app.use(express.json({ limit: '50mb' }));
app.use(cors());

const cancelCache = new Set();
const sentCache = new Set();
const lockCache = new Set();
let activeCronJob = null; // Referência global para o agendamento preventivo
let activeCronJobOverdue = null; // Referência global para o agendamento de inadimplência

// ============================================================
// Proxy de Imagens do MinIO (acesso público via backend)
// ============================================================
app.get(/^\/storage\/([^\/]+)\/(.+)$/, async (req, res) => {
  try {
    const bucket = req.params[0];
    const key = req.params[1]; // Captura tudo que vem após o bucket (incluindo barras)
    
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const data = await s3Client.send(command);
    
    res.set('Content-Type', data.ContentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    data.Body.pipe(res);
  } catch (e) {
    console.error(`[Storage Proxy] Erro ao buscar: ${req.params.bucket}/${req.params[0]}`, e.message);
    res.status(404).send('Arquivo não encontrado');
  }
});

const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ============================================================
// ROTA NOVA: Login Administrativo (JWT)
// ============================================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE username = $1',
      [username]
    );

    const user = rows[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, name: user.display_name || user.username, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ============================================================
// ROTA NOVA: API para o dbService.ts do Frontend
// GET  /api/school-data → fetchFromCloud()
// PUT  /api/school-data → saveToCloud()
// ============================================================
app.get('/api/school-data', async (req, res) => {
  try {
    const data = await getSchoolData();
    
    // Normalizar URLs do MinIO para proxy relativo
    // Converte URLs como https://storageedu.xxx/bucket/file para /storage/bucket/file
    const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || '';
    const normalizeUrl = (url) => {
      if (!url || typeof url !== 'string') return url;
      // Se já é uma URL relativa de proxy, manter
      if (url.startsWith('/storage/')) return url;
      // Se é a URL pública do MinIO, converter para proxy
      if (MINIO_PUBLIC_URL && url.startsWith(MINIO_PUBLIC_URL)) {
        return url.replace(MINIO_PUBLIC_URL, '/storage');
      }
      // Fallback: URL com http://localhost:9000 ou http://minio:9000
      const match = url.match(/^https?:\/\/[^\/]+\/(.+)$/);
      if (match && (url.includes('minio') || url.includes('storageedu') || url.includes(':9000'))) {
        return `/storage/${match[1]}`;
      }
      return url;
    };
    
    // Normalizar fotos de alunos
    if (data.students) {
      data.students.forEach(s => { if (s.photo) s.photo = normalizeUrl(s.photo); });
    }
    // Normalizar logo
    if (data.logo) data.logo = normalizeUrl(data.logo);
    if (data.profile?.logo) data.profile.logo = normalizeUrl(data.profile.logo);
    // Normalizar fotos nos registros de presença
    if (data.attendance) {
      data.attendance.forEach(a => { if (a.photo) a.photo = normalizeUrl(a.photo); });
    }
    // Normalizar imagens de exames
    if (data.exams) {
      data.exams.forEach(e => {
        if (e.questions) e.questions.forEach(q => { if (q.image) q.image = normalizeUrl(q.image); });
      });
    }
    
    res.json({ data });
  } catch (error) {
    console.error('Erro ao buscar school_data:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.put('/api/school-data', async (req, res) => {
  try {
    const schoolData = req.body;
    if (!schoolData) return res.status(400).json({ error: 'Dados não fornecidos' });

    // Verificação de timestamp para evitar regressão
    const current = await getSchoolData();
    const cloudTimestamp = current.lastUpdated ? new Date(current.lastUpdated).getTime() : 0;
    const localTimestamp = schoolData.lastUpdated ? new Date(schoolData.lastUpdated).getTime() : 0;

    if (cloudTimestamp > localTimestamp) {
      return res.status(409).json({ success: false, reason: 'newer_version' });
    }

    // Inicialização de colunas necessárias para automação
    pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alunos_cobrancas' AND column_name='pre_warnings_count') THEN
          ALTER TABLE alunos_cobrancas ADD COLUMN pre_warnings_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alunos_cobrancas' AND column_name='last_pre_warning_at') THEN
          ALTER TABLE alunos_cobrancas ADD COLUMN last_pre_warning_at TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alunos_cobrancas' AND column_name='overdue_warnings_count') THEN
          ALTER TABLE alunos_cobrancas ADD COLUMN overdue_warnings_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alunos_cobrancas' AND column_name='last_overdue_warning_at') THEN
          ALTER TABLE alunos_cobrancas ADD COLUMN last_overdue_warning_at TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `).catch(err => console.error('[PostgreSQL] Erro ao inicializar colunas de automação:', err));

    schoolData.lastUpdated = new Date().toISOString();
    await saveSchoolData(schoolData);
    
    // Sincronização em tempo real (JSON -> Relacional)
    syncJsonToRelationalTables().catch(err => console.error('[Real-time Sync] Erro:', err.message));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar school_data:', error);
    res.status(500).json({ success: false, reason: 'error' });
  }
});

app.get('/api/system-stats', async (req, res) => {
  let postgresStats = { dbSize: 'N/A', tableCount: '0' };
  try {
    const dbResult = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as db_size,
             (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') as table_count
    `);
    postgresStats = {
      dbSize: dbResult.rows[0].db_size,
      tableCount: dbResult.rows[0].table_count
    };
  } catch(e) {
    console.error('System Stats (Postgres) Error:', e);
  }
  
  let minioStats = { error: true, message: 'Not initialized' };
  try {
    minioStats = await getMinioStats();
  } catch(e) {
    console.error('System Stats (MinIO) Error:', e);
    minioStats = { error: true, message: e.message };
  }
  
  res.json({
    postgres: postgresStats,
    minio: minioStats
  });
});

// ============================================================
// Database Explorer
// ============================================================
app.get('/api/database/tables', async (req, res) => {
  try {
    const query = `
      SELECT 
        relname as table_name,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_total_relation_size(relid) as raw_size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY raw_size DESC;
    `;
    const result = await pool.query(query);
    res.json({ tables: result.rows });
  } catch (error) {
    console.error('Erro ao listar tabelas:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/database/tables/:tableName/data', async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Basic validation to prevent SQL injection on table name
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ error: 'Nome de tabela inválido' });
    }

    const query = `SELECT * FROM "${tableName}" LIMIT 100;`;
    const result = await pool.query(query);
    res.json({ rows: result.rows, fields: result.fields.map(f => f.name) });
  } catch (error) {
    console.error(`Erro ao buscar dados da tabela ${req.params.tableName}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// MinIO Explorer
// ============================================================
app.get('/api/storage/buckets/:bucketName/objects', async (req, res) => {
  try {
    const { bucketName } = req.params;
    const objects = await getBucketObjects(bucketName);
    res.json({ objects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/storage/buckets/:bucketName/objects', async (req, res) => {
  try {
    const { bucketName } = req.params;
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });
    
    await deleteMinioObject(bucketName, key);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Rota para buscar submissões (acertos/erros) do aluno
// ============================================================
app.get('/api/student-submissions/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { rows } = await pool.query(
      'SELECT prova_id as "prova_id", acertos, erros FROM provas_submissoes WHERE TRIM(aluno_id) = TRIM($1)',
      [String(studentId).trim()]
    );
    res.json({ submissions: rows });
  } catch (err) {
    console.error('Erro ao buscar submissões do aluno:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ============================================================
// ROTAS DE NOTAS (NOVA TABELA)
// ============================================================
app.get('/api/notas/:alunoId', async (req, res) => {
  try {
    const { rows: dbNotas } = await pool.query(
      'SELECT id, aluno_id as "aluno_id", disciplina_id as "disciplina_id", periodo_id as "periodo_id", prova_id as "prova_id", valor as "valor" FROM notas_boletim WHERE TRIM(aluno_id) = TRIM($1)',
      [String(req.params.alunoId).trim()]
    );
    // Garantir cast numérico para evitar erro de .toFixed no frontend
    const notas = dbNotas.map(n => ({ ...n, valor: Number(n.valor) }));
    res.json({ notas });
  } catch (err) {
    console.error('Erro ao buscar notas do aluno:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/notas', async (req, res) => {
  try {
    const { notas } = req.body;
    if (!Array.isArray(notas)) return res.status(400).json({ error: 'Formato inválido' });
    
    for (const nota of notas) {
      if (nota.valor !== null && nota.valor !== '' && !isNaN(Number(nota.valor))) {
        await upsertNota({
          aluno_id: String(nota.aluno_id),
          disciplina_id: String(nota.disciplina_id),
          periodo_id: String(nota.periodo_id),
          prova_id: nota.prova_id ? String(nota.prova_id) : null,
          valor: Number(nota.valor)
        });
      }
    }
    
    // Opcionalmente implementar delete para notas que o professor limpou (vazio)
    
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar notas manuais:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ============================================================
// Upload de Logo (MinIO em vez de Supabase Storage)
// ============================================================
app.post('/api/upload/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const compressedBuffer = await sharp(req.file.buffer)
      .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer();

    const url = await uploadLogoToStorage(compressedBuffer, 'image/webp');
    return res.status(200).json({ url });
  } catch (error) {
    console.error('Erro ao processar logo:', error);
    return res.status(500).json({ error: 'Erro interno ao processar a imagem.' });
  }
});

// ============================================================
// Upload de Foto de Aluno (MinIO)
// ============================================================
app.post('/api/upload/student-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { uploadStudentPhoto } = await import('./services/storage.js');
    const url = await uploadStudentPhoto(req.file.buffer, req.file.mimetype);
    return res.status(200).json({ url });
  } catch (error) {
    console.error('Erro ao processar foto:', error);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ============================================================
// Upload de Logo da Escola (MinIO)
// ============================================================
app.post('/api/upload/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { uploadLogo } = await import('./services/storage.js');
    const url = await uploadLogo(req.file.buffer, req.file.mimetype);
    return res.status(200).json({ url });
  } catch (error) {
    console.error('Erro ao processar logo:', error);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ============================================================
// Upload de Imagem de Avaliação (MinIO)
// ============================================================
app.post('/api/upload/exam-image', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { uploadExamImage } = await import('./services/storage.js');
    const url = await uploadExamImage(req.file.buffer, req.file.mimetype);
    return res.status(200).json({ url });
  } catch (error) {
    console.error('Erro ao processar imagem de avaliação:', error);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ============================================================
// Formatação de Data
// ============================================================
function formatCobrancaDate(dateStr) {
  if (!dateStr) return '';
  const [Ano, Mes, Dia] = dateStr.split('-');
  if (!Dia) return dateStr;
  return `${Dia}/${Mes}/${Ano}`;
}

// ============================================================
// Integração WhatsApp Evolution API
// (Mesma lógica, trocando supabase por database.js)
// ============================================================
async function sendEvolutionMessage(asaasPaymentId, eventType, paymentPayload = null) {
  try {
    let cob = null;
    for (let i = 0; i < 3; i++) {
      cob = await getCobrancaByPaymentId(asaasPaymentId);
      if (cob) break;
      if (i < 2) await new Promise(r => setTimeout(r, 1000));
    }

    if (!cob) return console.log(`[Evolution] Cobrança não encontrada: ${asaasPaymentId}`);

    let fallbackValor = cob.valor;
    let fallbackVencimento = cob.vencimento;
    let fallbackDescricao = paymentPayload?.description || 'serviços educacionais';

    const appData = await getSchoolData();
    if (!appData) return console.log('[WhatsApp] school_data não encontrado');

    const evoConfig = appData.evolutionConfig;
    const templates = appData.messageTemplates;

    if (!evoConfig || !evoConfig.apiUrl || !evoConfig.apiKey || !evoConfig.instanceName) {
      return console.log('[WhatsApp] Credenciais Evolution não configuradas.');
    }

    const normalizedEvent = (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') ? 'PAYMENT_RECEIVED' : eventType;
    const cacheKey = `${asaasPaymentId}_${normalizedEvent}`;
    if (sentCache.has(cacheKey)) return;
    sentCache.add(cacheKey);
    setTimeout(() => sentCache.delete(cacheKey), 30000);

    const aluno = appData.students?.find(s => s.id === cob.aluno_id);
    if (!aluno) return console.log('[WhatsApp] Aluno não encontrado.');

    const birthDateStr = aluno.data_nascimento || aluno.birthDate || '';
    let age = 18;
    if (birthDateStr && birthDateStr.includes('-')) {
      const parts = birthDateStr.split('T')[0].split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const birthDate = new Date(year, month - 1, day);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    }

    const isMinor = age < 18;
    const targetPhone = (isMinor && (aluno.telefone_responsavel || aluno.guardianPhone)) ? (aluno.telefone_responsavel || aluno.guardianPhone) : (aluno.telefone || aluno.phone);
    const targetName = (isMinor && (aluno.nome_responsavel || aluno.guardianName)) ? (aluno.nome_responsavel || aluno.guardianName) : (aluno.nome || aluno.name);
    if (!targetPhone) return console.log('[WhatsApp] Sem telefone.');

    let cleanPhone = targetPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = '55' + cleanPhone;

    let descricao = fallbackDescricao;
    let pdfUrl = cob.link_carne || cob.link_boleto || '';
    let isCarneCompleto = false;

    const pResp = await fetch(`${ASAAS_BASE_URL}/v3/payments/${asaasPaymentId}`, {
      headers: { 'access_token': process.env.ASAAS_API_KEY }
    });

    if (pResp.ok) {
      const pData = await pResp.json();
      if (pData.description) descricao = pData.description;
      if (pData.value) fallbackValor = pData.value;
      if (pData.dueDate) fallbackVencimento = pData.dueDate;

      if (descricao.includes('Parcela')) {
        if (eventType === 'PAYMENT_CREATED') descricao = descricao.replace(' de ', ' a ');
        else if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_UPDATED'].includes(eventType)) {
          descricao = descricao.replace(/Parcela (\d+) a (\d+)/g, 'Parcela $1 de $2');
        }
      }

      if (pData.installment && eventType === 'PAYMENT_CREATED') {
        if (pData.installmentNumber > 1) return;
        isCarneCompleto = true;
        pdfUrl = `${ASAAS_BASE_URL}/v3/installments/${pData.installment}/paymentBook`;
      } else {
        pdfUrl = pData.transactionReceiptUrl || pData.bankSlipUrl || pData.invoiceUrl || pdfUrl;
      }
    }

    const fbAVencer = 'Olá {nome}, lembramos que sua cobrança referente a {descricao} no valor de R$ {valor} vencerá em {vencimento}. Segue o PDF abaixo:';

    let templateText = '';
    if (eventType === 'PAYMENT_CREATED') templateText = templates?.boletoGerado || fbGerado;
    else if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') templateText = templates?.pagamentoConfirmado || fbPago;
    else if (eventType === 'PAYMENT_OVERDUE') templateText = templates?.boletoVencido || fbAtrasado;
    else if (eventType === 'PAYMENT_DELETED') templateText = templates?.cobrancaCancelada || fbCancelado;
    else if (eventType === 'PAYMENT_UPDATED') templateText = templates?.cobrancaAtualizada || fbAtualizado;
    else if (eventType === 'PAYMENT_UPCOMING') templateText = templates?.boletoAVencer || fbAVencer;

    if (!templateText) return;

    let msgFinal = templateText
      .replace(/{nome}/g, targetName)
      .replace(/{nome_aluno}/g, aluno.name)
      .replace(/{matricula}/g, aluno.enrollmentNumber || aluno.matricula || '—')
      .replace(/{valor}/g, parseFloat(fallbackValor).toFixed(2).replace('.', ','))
      .replace(/{vencimento}/g, formatCobrancaDate(typeof fallbackVencimento === 'string' ? fallbackVencimento : ''))
      .replace(/{link_boleto}/g, pdfUrl)
      .replace(/{descricao}/g, descricao);

    const isTextOnlyEvent = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_DELETED'].includes(eventType);
    const isPaymentConfirmation = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(eventType);
    const isCreationEvent = eventType === 'PAYMENT_CREATED';

    if (isPaymentConfirmation && pdfUrl && !templateText.includes('{link_boleto}')) {
      msgFinal += `\n\n📄 Acesse seu comprovante aqui:\n${pdfUrl}`;
    }

    let base64Pdf = null;
    if (pdfUrl && !isTextOnlyEvent) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const fetchOptions = { headers: { 'Accept': 'application/pdf' } };
          if (pdfUrl.includes('asaas.com')) fetchOptions.headers['access_token'] = process.env.ASAAS_API_KEY;
          const pdfResp = await fetch(pdfUrl, fetchOptions);
          if (pdfResp.ok && pdfResp.headers.get('content-type')?.includes('pdf')) {
            const arrayBuffer = await pdfResp.arrayBuffer();
            base64Pdf = Buffer.from(arrayBuffer).toString('base64');
            break;
          }
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
        } catch (err) {
          if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    if ((isCreationEvent || isPaymentConfirmation || eventType === 'PAYMENT_UPDATED') && !base64Pdf && pdfUrl) {
      msgFinal += `\n\n📄 Acesse aqui sua cobrança:\n${pdfUrl}`;
    }

    let endpoint = 'sendText';
    let payload = {};

    if (base64Pdf) {
      endpoint = 'sendMedia';
      let fileName = `Boleto-${targetName.replace(/\s+/g, '')}.pdf`;
      if (isCarneCompleto) fileName = `Carne-${targetName.replace(/\s+/g, '')}.pdf`;
      if (isPaymentConfirmation) fileName = `Comprovante-${targetName.replace(/\s+/g, '')}.pdf`;
      payload = { number: cleanPhone, options: { delay: 1200, presence: "composing" }, mediatype: "document", mimetype: "application/pdf", fileName, media: base64Pdf, caption: msgFinal };
    } else {
      payload = { number: cleanPhone, text: msgFinal };
    }

    const url = `${evoConfig.apiUrl.replace(/\/$/, '')}/message/${endpoint}/${evoConfig.instanceName}`;
    const sendResp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoConfig.apiKey }, body: JSON.stringify(payload) });

    if (sendResp.ok) console.log(`[WhatsApp] ✅ Enviado para ${cleanPhone}`);
    else console.error(`[WhatsApp] ❌ Erro:`, sendResp.status);
  } catch (error) {
    console.error('[WhatsApp] Erro interno:', error.message);
  }
}

// ============================================================
// Webhook Asaas (Substituídas chamadas supabase por database.js)
// ============================================================
app.post('/api/webhook_asaas', async (req, res) => {
  const tokenRecebido = req.headers['asaas-access-token'];
  if (tokenRecebido !== process.env.ASAAS_WEBHOOK_TOKEN) {
    addLog('Webhook', 'Auth Negada', 'Token inválido');
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const payload = req.body;
    if (payload.dateCreated) {
      const diffHours = (Date.now() - new Date(payload.dateCreated).getTime()) / (1000 * 60 * 60);
      if (diffHours > 24) return res.status(200).send('OK');
    }

    const asaasPaymentId = payload.payment.id;
    let updateData = {};

    switch (payload.event) {
      case 'PAYMENT_CREATED':
        setTimeout(() => sendEvolutionMessage(asaasPaymentId, 'PAYMENT_CREATED'), 2000);
        return res.status(200).json({ message: 'OK' });

      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        updateData = {
          status: 'PAGO',
          valor: payload.payment.value,
          data_pagamento: payload.payment.confirmedDate || payload.payment.paymentDate || new Date().toISOString().split('T')[0]
        };
        if (payload.payment.transactionReceiptUrl) {
          updateData.transaction_receipt_url = payload.payment.transactionReceiptUrl;
        }
        sendEvolutionMessage(asaasPaymentId, 'PAYMENT_RECEIVED');
        break;

      case 'PAYMENT_OVERDUE':
      case 'PAYMENT_UPDATED':
      case 'PAYMENT_RESTORED':
        const statusMap = { 'PENDING': 'PENDENTE', 'OVERDUE': 'ATRASADO', 'RECEIVED': 'PAGO', 'CONFIRMED': 'PAGO', 'RECEIVED_IN_CASH': 'PAGO', 'REFUNDED': 'CANCELADO', 'DELETED': 'CANCELADO' };
        updateData = { valor: payload.payment.value, vencimento: payload.payment.dueDate, status: statusMap[payload.payment.status] || undefined };
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
        // Ocultado PAYMENT_OVERDUE aqui para ser enviado apenas pela rotina/cron (conforme regras)
        // if (payload.event === 'PAYMENT_OVERDUE') sendEvolutionMessage(asaasPaymentId, 'PAYMENT_OVERDUE');
        if (payload.event === 'PAYMENT_UPDATED') sendEvolutionMessage(asaasPaymentId, 'PAYMENT_UPDATED');
        break;

      case 'PAYMENT_DELETED':
      case 'PAYMENT_CANCELED':
        const installmentId = payload.payment.installment;
        if (installmentId) {
          if (cancelCache.has(installmentId)) {
            await deleteCobranca(asaasPaymentId);
            return res.status(200).send('OK');
          }
          cancelCache.add(installmentId);
          setTimeout(() => cancelCache.delete(installmentId), 60000);
        }
        await sendEvolutionMessage(asaasPaymentId, 'PAYMENT_DELETED');
        await deleteCobranca(asaasPaymentId);
        addLog('Webhook', 'PAYMENT_DELETED', { asaasPaymentId });
        return res.status(200).send('OK');

      default:
        return res.status(200).json({ message: 'Evento ignorado' });
    }

    await updateCobranca(asaasPaymentId, updateData);
    addLog('Webhook', `Sucesso ${payload.event}`, { asaasPaymentId });
    return res.status(200).json({ message: 'OK' });
  } catch (error) {
    console.error('Webhook erro:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// Admin Raw Cobrancas para a Aba Financeiro
app.get('/api/admin/cobrancas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alunos_cobrancas ORDER BY vencimento DESC');
    res.json(result.rows);
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/admin/cobrancas', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).end();
    await pool.query('DELETE FROM alunos_cobrancas WHERE asaas_payment_id = ANY($1)', [ids]);
    res.json({ success: true });
  } catch(e) {
     res.status(500).json({error: e.message});
  }
});

app.delete('/api/admin/cobrancas/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM alunos_cobrancas WHERE asaas_payment_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

// Webhook Evolution
app.post('/api/webhooks/evolution', (req, res) => {
  try {
    const payload = req.body;
    let messageData = payload.data || payload;
    if (messageData.status === 'READ') {
      const phone = messageData.key?.remoteJid || 'Desconhecido';
      console.log(`👀 [WhatsApp STATUS] Mensagem LIDA: ${phone.split('@')[0]}`);
    }
    res.status(200).send('OK');
  } catch (err) {
    res.status(500).send('Erro');
  }
});

// ============================================================
// Gerar Cobrança
// ============================================================
app.post('/api/gerar_cobranca', async (req, res) => {
  try {
    const { aluno_id, nome, cpf, email, valor, vencimento, multa, juros, desconto, telefone, cep, endereco, numero, bairro, descricao, parcelas, nascimento } = req.body;

    let customerId = '';
    const searchRes = await fetch(`${ASAAS_BASE_URL}/v3/customers?cpfCnpj=${cpf}`, { method: 'GET', headers: { 'access_token': process.env.ASAAS_API_KEY } });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data?.length > 0) customerId = searchData.data[0].id;
    }

    if (!customerId) {
      const customerRes = await fetch(`${ASAAS_BASE_URL}/v3/customers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'access_token': process.env.ASAAS_API_KEY },
        body: JSON.stringify({ name: nome, cpfCnpj: cpf, email, mobilePhone: telefone, postalCode: cep, address: endereco, addressNumber: numero, province: bairro, birthDate: nascimento })
      });
      if (!customerRes.ok) {
        const errorData = await customerRes.json();
        throw new Error(errorData.errors?.[0]?.description || 'Falha ao criar cliente');
      }
      customerId = (await customerRes.json()).id;
    }

    const asaasPayload = { customer: customerId, billingType: 'BOLETO', dueDate: vencimento, description: descricao ? `${descricao} - Microtec Informática Cursos` : 'Mensalidade - Microtec Informática Cursos' };
    const isInstallment = parcelas && parseInt(parcelas) > 1;
    if (isInstallment) { asaasPayload.installmentCount = parseInt(parcelas); asaasPayload.installmentValue = parseFloat(valor); }
    else { asaasPayload.value = parseFloat(valor); }

    const fineValue = parseFloat(multa); const interestValue = parseFloat(juros); const discountValue = parseFloat(desconto);
    if (!isNaN(fineValue) && fineValue > 0) asaasPayload.fine = { value: fineValue, type: 'PERCENTAGE' };
    if (!isNaN(interestValue) && interestValue > 0) asaasPayload.interest = { value: interestValue, type: 'PERCENTAGE' };
    if (!isNaN(discountValue) && discountValue > 0) asaasPayload.discount = { value: discountValue, dueDateLimitDays: 0, type: 'FIXED' };

    const paymentRes = await fetch(`${ASAAS_BASE_URL}/v3/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'access_token': process.env.ASAAS_API_KEY }, body: JSON.stringify(asaasPayload) });
    if (!paymentRes.ok) { const e = await paymentRes.json(); throw new Error(e.errors?.[0]?.description || 'Falha Asaas'); }

    const paymentData = await paymentRes.json();
    let paymentsToSave = [];
    const instId = formatInstallmentId(paymentData.installment);

    if (isInstallment && instId) {
      const installmentsRes = await fetch(`${ASAAS_BASE_URL}/v3/payments?installment=${instId}&limit=100`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
      if (installmentsRes.ok) {
        const installmentsData = await installmentsRes.json();
        paymentsToSave = installmentsData.data.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).map(p => ({
          aluno_id, asaas_customer_id: customerId, asaas_payment_id: p.id, asaas_installment_id: instId, installment: instId, valor: p.value, vencimento: p.dueDate, link_boleto: p.bankSlipUrl
        }));
      } else throw new Error('Falha ao buscar parcelas');
    } else {
      paymentsToSave = [{ aluno_id, asaas_customer_id: customerId, asaas_payment_id: paymentData.id, installment: null, valor: paymentData.value || valor, vencimento: paymentData.dueDate || vencimento, link_boleto: paymentData.bankSlipUrl }];
    }

    await insertCobrancas(paymentsToSave);

    if (paymentsToSave.length > 0) {
      sendEvolutionMessage(paymentsToSave[0].asaas_payment_id, 'PAYMENT_CREATED').catch(e => console.error('Erro disparo:', e));
    }

    return res.status(200).json({ success: true, installment: instId || null, payments: paymentsToSave, bankSlipUrl: paymentsToSave[0]?.link_boleto, paymentId: paymentsToSave[0]?.asaas_payment_id });
  } catch (error) {
    console.error('Erro gerar cobrança:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Notificar Alunos sobre Avaliação
// ============================================================
app.post('/api/exames/notificar', async (req, res) => {
  const { examId } = req.body;
  if (!examId) return res.status(400).json({ error: 'ID do exame obrigatório.' });

  try {
    const appData = await getSchoolData();
    const exam = (appData.exams || []).find(e => e.id === examId);
    if (!exam) return res.status(404).json({ error: 'Exame não encontrado.' });

    const classObj = (appData.classes || []).find(c => c.id === exam.classId);
    if (!classObj) return res.status(404).json({ error: 'Turma não encontrada.' });

    const subjectObj = (appData.subjects || []).find(s => s.id === exam.subjectId);
    const materia = subjectObj ? subjectObj.name : 'sua disciplina';

    const alunos = (appData.students || []).filter(s => s.classId === classObj.id && s.status === 'active');
    if (alunos.length === 0) return res.status(400).json({ error: 'Nenhum aluno ativo nesta turma.' });

    const evoConfig = appData.evolutionConfig;
    const msgTemplate = (appData.messageTemplates?.novaAvaliacao) || "Olá {nome}, uma nova {tipo_avaliacao} ({titulo_avaliacao}) de {materia} foi publicada no portal do aluno. Acesse e realize o mais breve possível!";

    const tipoAvaliacao = exam.evaluationType === 'activity' ? 'atividade' : 'prova';

    // 1. Inserir notificações no PostgreSQL (Sino do Portal)
    for (const aluno of alunos) {
      await pool.query(
        `INSERT INTO notificacoes (aluno_id, titulo, mensagem, lida) VALUES ($1, $2, $3, false)`,
        [aluno.id, "Nova Avaliação Disponível!", `A ${tipoAvaliacao} "${exam.title}" já está disponível no seu portal.`]
      );
    }

    // 2. Disparo de WhatsApp em Background
    if (evoConfig?.apiUrl && evoConfig?.apiKey && evoConfig?.instanceName) {
      // Background async function
      (async () => {
        for (let i = 0; i < alunos.length; i++) {
          const aluno = alunos[i];
          const telefone = aluno.phone || aluno.guardianPhone;
          if (!telefone) continue;

          let cleanPhone = telefone.replace(/\D/g, '');
          if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = '55' + cleanPhone;

          const msg = msgTemplate
            .replace(/{nome}/g, aluno.name.split(' ')[0])
            .replace(/{matricula}/g, aluno.enrollmentNumber || '—')
            .replace(/{tipo_avaliacao}/g, tipoAvaliacao)
            .replace(/{titulo_avaliacao}/g, exam.title)
            .replace(/{materia}/g, materia)
            .replace(/{escola}/g, appData.profile?.name || 'nossa escola');

          try {
            const url = `${evoConfig.apiUrl.replace(/\/$/, '')}/message/sendText/${evoConfig.instanceName}`;
            await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoConfig.apiKey }, body: JSON.stringify({ number: cleanPhone, text: msg }) });
          } catch (error) { 
            console.error(`[Notificar Avaliação] Erro ${aluno.name}:`, error.message); 
          }
          if (i < alunos.length - 1) await new Promise(r => setTimeout(r, Math.floor(Math.random() * 30000) + 15000));
        }
      })();
    }

    return res.status(200).json({ success: true, message: 'Notificações criadas e disparos iniciados.' });
  } catch (error) {
    console.error('Erro ao notificar exames:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Notificações do Sistema (Painel Admin)
// ============================================================
app.get('/api/notificacoes/admin', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, aluno_id as "studentId", titulo as title, mensagem as message, lida as read, anexo as attachment, created_at as "createdAt" FROM notificacoes WHERE aluno_id = $1 ORDER BY created_at DESC',
      ['admin']
    );
    res.json({ notifications: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notificacoes/ler/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE notificacoes SET lida = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notificacoes/limpar-lidas', async (req, res) => {
  try {
    await pool.query('DELETE FROM notificacoes WHERE aluno_id = $1 AND lida = true', ['admin']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notificacoes/remover-anexo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE notificacoes SET anexo = NULL WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Disparo em Massa
// ============================================================
app.post('/api/enviar-massa', (req, res) => {
  const { alunos, mensagem } = req.body;
  if (!alunos || !Array.isArray(alunos) || alunos.length === 0) return res.status(400).json({ error: 'Nenhum aluno.' });
  res.status(200).json({ success: true, message: 'Background iniciado.' });
  processarFilaWhatsApp(alunos, mensagem);
});

async function processarFilaWhatsApp(alunos, mensagemTemplate) {
  const appData = await getSchoolData();
  const evoConfig = appData?.evolutionConfig;
  if (!evoConfig?.apiUrl || !evoConfig?.apiKey || !evoConfig?.instanceName) return;

  for (let i = 0; i < alunos.length; i++) {
    const aluno = alunos[i];
    const msg = mensagemTemplate.replace(/{nome}/g, aluno.nome).replace(/{matricula}/g, aluno.matricula || '—');
    try {
      let cleanPhone = aluno.telefone.replace(/\D/g, '');
      if (cleanPhone.length === 10 || cleanPhone.length === 11) cleanPhone = '55' + cleanPhone;
      const url = `${evoConfig.apiUrl.replace(/\/$/, '')}/message/sendText/${evoConfig.instanceName}`;
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': evoConfig.apiKey }, body: JSON.stringify({ number: cleanPhone, text: msg }) });
    } catch (error) { console.error(`[Massa] Erro ${aluno.nome}:`, error.message); }
    if (i < alunos.length - 1) await new Promise(r => setTimeout(r, Math.floor(Math.random() * 120000) + 60000));
  }
}

// ============================================================
// Logs
// ============================================================
const apiLogs = [];
function addLog(service, action, details) {
  apiLogs.unshift({ date: new Date().toISOString(), service, action, details });
  if (apiLogs.length > 200) apiLogs.pop();
}
app.get('/api/logs', (req, res) => res.json(apiLogs));

const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
const formatInstallmentId = (id) => { if (!id) return id; if (id.startsWith('inst_')) return id.replace('inst_', 'ins_'); return id; };

// ============================================================
// Exclusão de Cobrança
// ============================================================
app.post('/api/excluir_cobranca', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID não fornecido' });

    const parcelas = await getCobrancasByOrQuery(id);
    let isSinglePayment = id.startsWith('pay_');

    if (!isSinglePayment) {
      const asaasTargetId = formatInstallmentId(id);
      const resp = await fetch(`${ASAAS_BASE_URL}/v3/installments/${asaasTargetId}`, { method: 'DELETE', headers: { 'access_token': process.env.ASAAS_API_KEY } });
      if (resp.ok) addLog('Asaas', 'Exclusão Parcelamento OK', { id });
    } else {
      const resp = await fetch(`${ASAAS_BASE_URL}/v3/payments/${id}`, { method: 'DELETE', headers: { 'access_token': process.env.ASAAS_API_KEY } });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); return res.status(400).json({ error: e.errors?.[0]?.description || 'Falha Asaas' }); }
    }

    return res.status(200).json({ message: 'Excluído no Asaas (Aguardando Webhook)' });
  } catch (error) {
    console.error('[Exclusão] Erro:', error);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// ============================================================
// Carnês e Links
// ============================================================
app.get('/api/parcelamentos/:id/carne', async (req, res) => {
  try {
    const id = req.params.id;
    const parcelas = await getCobrancasByOrQuery(id);
    let instId = (!id.startsWith('pay_')) ? id : null;
    if (!instId && parcelas?.length > 0) { const p = parcelas.find(x => x.asaas_installment_id); if (p) instId = p.asaas_installment_id; }

    if (instId) {
      const asaasTargetInstId = formatInstallmentId(instId);
      const pSaved = parcelas?.find(x => x.link_carne);
      if (pSaved?.link_carne) return res.status(200).json({ status: 'success', type: 'pdf', url: pSaved.link_carne });

      const ar = await fetch(`${ASAAS_BASE_URL}/v3/installments/${asaasTargetInstId}/paymentBook`, { headers: { 'access_token': process.env.ASAAS_API_KEY, 'Accept': 'application/pdf' } });
      if (ar.ok && ar.headers.get('content-type')?.includes('pdf')) {
        const buffer = Buffer.from(await ar.arrayBuffer());
        const fileName = `carne_${asaasTargetInstId}.pdf`;
        const publicUrl = await uploadCarneToStorage(fileName, buffer);
        await updateCobrancaLinkCarne(instId, publicUrl);
        return res.status(200).json({ status: 'success', type: 'pdf', url: publicUrl });
      }
    }

    const boletos = parcelas ? parcelas.map((c, i) => ({ id: c.id, numero: i + 1, vencimento: c.vencimento, valor: c.valor, linkBoleto: c.link_boleto, status: c.status, asaasPaymentId: c.asaas_payment_id })) : [];
    return res.status(200).json({ status: 'success', type: 'fallback', boletos });
  } catch (error) { return res.status(500).json({ error: 'Erro interno.' }); }
});

app.get('/api/cobrancas/:id/link', async (req, res) => {
  try {
    const p = await fetch(`${ASAAS_BASE_URL}/v3/payments/${req.params.id}`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
    if (!p.ok) return res.status(404).json({ error: 'Não encontrada.' });
    const d = await p.json();
    return res.status(200).json({ bankSlipUrl: d.bankSlipUrl || d.invoiceUrl, transactionReceiptUrl: d.transactionReceiptUrl });
  } catch (error) { return res.status(500).json({ error: 'Erro interno.' }); }
});

app.patch('/api/alunos/:id/rematricular', async (req, res) => res.json({ success: true }));

app.put('/api/cobrancas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { valor, vencimento } = req.body;
    let targetAsaasId = id;

    if (isUUID(id)) {
      const parcelas = await getCobrancasByOrQuery(id);
      if (parcelas.length > 0 && parcelas[0].asaas_payment_id) targetAsaasId = parcelas[0].asaas_payment_id;
    }

    const aResp = await fetch(`${ASAAS_BASE_URL}/v3/payments/${targetAsaasId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'access_token': process.env.ASAAS_API_KEY },
      body: JSON.stringify({ value: valor, dueDate: vencimento })
    });
    if (!aResp.ok) { const err = await aResp.json().catch(() => ({})); return res.status(400).json({ error: err.errors?.[0]?.description || 'Erro Asaas' }); }

    const queryField = isUUID(id) ? 'id' : 'asaas_payment_id';
    await updateCobrancaByField(queryField, id, { valor, vencimento });

    res.json({ message: 'Editado com sucesso' });
  } catch (e) { res.status(500).json({ error: 'Erro interno.' }); }
});

app.get('/api/alunos/:id/carne', async (req, res) => {
  try {
    const cobrancas = await getCobrancasByAlunoId(req.params.id);
    const withInstallment = cobrancas.filter(c => c.asaas_installment_id);
    if (withInstallment.length === 0) return res.status(404).json({ error: 'Nenhum carnê.' });

    const latestInstId = withInstallment[withInstallment.length - 1].asaas_installment_id;
    const asaasTargetInstId = formatInstallmentId(latestInstId);

    const binResp = await fetch(`${ASAAS_BASE_URL}/v3/installments/${asaasTargetInstId}/paymentBook`, { headers: { 'access_token': process.env.ASAAS_API_KEY, 'Accept': 'application/pdf' } });
    if (binResp.ok && binResp.headers.get('content-type')?.includes('pdf')) {
      const buffer = Buffer.from(await binResp.arrayBuffer());
      const fileName = `carne_${asaasTargetInstId}.pdf`;
      const publicUrl = await uploadCarneToStorage(fileName, buffer);
      await updateCobrancaLinkCarne(latestInstId, publicUrl);
      return res.status(200).json({ status: 'success', type: 'pdf', url: publicUrl });
    }

    const allCobs = await getCobrancasByInstallmentId(latestInstId);
    const boletos = allCobs.map((c, i) => ({ id: c.id, numero: i + 1, vencimento: c.vencimento, valor: c.valor, linkBoleto: c.link_boleto, status: c.status, asaasPaymentId: c.asaas_payment_id }));
    return res.status(200).json({ status: 'success', type: 'fallback', boletos });
  } catch (error) { return res.status(500).json({ error: 'Erro interno.' }); }
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================
// ============================================================
// LÓGICA REUTILIZÁVEL DE DISPARO DE COBRANÇAS
// ============================================================
async function executarRotinaCobrancas(tipo = 'ambos') {
  const appData = await getSchoolData();
  const rules = appData?.messageTemplates?.automationRules || {};
  const sendDaysBefore = parseInt(rules.sendDaysBefore) || 3;
  const maxPreWarnings = parseInt(rules.maxPreWarnings) || 1;
  const sendDaysAfter = parseInt(rules.sendDaysAfter) || 1;
  const repeatEveryDays = parseInt(rules.repeatEveryDays) || 3;

  let enviadasAtraso = 0;
  let enviadasAviso = 0;

  // 1. Processar Atrasados
  if (tipo === 'atrasado' || tipo === 'ambos') {
    const atrasados = await getCobrancasAtrasadas();
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    for (const cob of atrasados) {
      if (!cob.asaas_payment_id || !cob.vencimento) continue;
      
      const vencimento = new Date(cob.vencimento);
      vencimento.setHours(0,0,0,0);
      const diffDiasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDiasAtraso >= sendDaysAfter) {
        const lastWarn = cob.last_overdue_warning_at ? new Date(cob.last_overdue_warning_at) : null;
        if (lastWarn) lastWarn.setHours(0,0,0,0);
        
        const diasDesdeUltimoAviso = lastWarn 
            ? Math.floor((hoje.getTime() - lastWarn.getTime()) / (1000 * 60 * 60 * 24)) 
            : null;

        const jaEnviadoHoje = lastWarn && lastWarn.getTime() === hoje.getTime();

        if (!jaEnviadoHoje && (diasDesdeUltimoAviso === null || diasDesdeUltimoAviso >= repeatEveryDays)) {
          await sendEvolutionMessage(cob.asaas_payment_id, 'PAYMENT_OVERDUE');
          
          const currentCount = parseInt(cob.overdue_warnings_count) || 0;
          await pool.query(
            'UPDATE alunos_cobrancas SET overdue_warnings_count = $1, last_overdue_warning_at = NOW() WHERE asaas_payment_id = $2',
            [currentCount + 1, cob.asaas_payment_id]
          );
          
          enviadasAtraso++; 
        }
      }
    }
  }

  // 2. Processar A Vencer (Lembretes Preventivos)
  if (tipo === 'preventivo' || tipo === 'ambos') {
    const pendentes = await getCobrancasPendentes();
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    for (const cob of pendentes) {
      if (!cob.asaas_payment_id || !cob.vencimento) continue;
      
      const vencimento = new Date(cob.vencimento);
      vencimento.setHours(0,0,0,0);
      
      const diffDias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias > 0 && diffDias <= sendDaysBefore) {
        const currentCount = parseInt(cob.pre_warnings_count) || 0;
        
        if (currentCount < maxPreWarnings) {
          const lastWarn = cob.last_pre_warning_at ? new Date(cob.last_pre_warning_at) : null;
          const jaEnviadoHoje = lastWarn && lastWarn.toDateString() === hoje.toDateString();

          if (!jaEnviadoHoje) {
            await sendEvolutionMessage(cob.asaas_payment_id, 'PAYMENT_UPCOMING');
            
            await pool.query(
              'UPDATE alunos_cobrancas SET pre_warnings_count = $1, last_pre_warning_at = NOW() WHERE asaas_payment_id = $2',
              [currentCount + 1, cob.asaas_payment_id]
            );
            enviadasAviso++;
          }
        }
      }
    }
  }

  return { enviadasAtraso, enviadasAviso };
}

// ============================================================
// AGENDADOR AUTOMÁTICO (node-cron) — Suporte a múltiplos tipos
// ============================================================
function agendarRotina(tipo, hora, minuto) {
  const isPreventivo = tipo === 'preventivo';
  const label = isPreventivo ? 'Preventivo' : 'Inadimplência';

  // Cancela job anterior do mesmo tipo
  if (isPreventivo && activeCronJob) {
    activeCronJob.stop();
    activeCronJob = null;
    console.log(`[Cron:${label}] ⏹ Rotina anterior cancelada.`);
  } else if (!isPreventivo && activeCronJobOverdue) {
    activeCronJobOverdue.stop();
    activeCronJobOverdue = null;
    console.log(`[Cron:${label}] ⏹ Rotina anterior cancelada.`);
  }

  const h = parseInt(hora);
  const m = parseInt(minuto);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    console.error(`[Cron:${label}] Horário inválido:`, hora, minuto);
    return;
  }

  const cronTipo = isPreventivo ? 'preventivo' : 'atrasado';
  const cronExpression = `${m} ${h} * * *`;
  const job = cron.schedule(cronExpression, async () => {
    console.log(`[Cron:${label}] ⏰ Rotina automática iniciada às ${new Date().toLocaleTimeString('pt-BR')}`);
    try {
      const resultado = await executarRotinaCobrancas(cronTipo);
      const count = isPreventivo ? resultado.enviadasAviso : resultado.enviadasAtraso;
      console.log(`[Cron:${label}] ✅ Concluído: ${count} mensagens processadas.`);
    } catch (error) {
      console.error(`[Cron:${label}] ❌ Erro na rotina automática:`, error.message);
    }
  }, { timezone: 'America/Sao_Paulo' });

  if (isPreventivo) activeCronJob = job;
  else activeCronJobOverdue = job;

  console.log(`[Cron:${label}] ✅ Rotina agendada para ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} (America/Sao_Paulo)`);
}

async function inicializarAgendamento() {
  try {
    // Inicialização DB para colunas de automação (garantir no boot)
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alunos_cobrancas' AND column_name='pre_warnings_count') THEN
          ALTER TABLE alunos_cobrancas ADD COLUMN pre_warnings_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alunos_cobrancas' AND column_name='last_pre_warning_at') THEN
          ALTER TABLE alunos_cobrancas ADD COLUMN last_pre_warning_at TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alunos_cobrancas' AND column_name='overdue_warnings_count') THEN
          ALTER TABLE alunos_cobrancas ADD COLUMN overdue_warnings_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alunos_cobrancas' AND column_name='last_overdue_warning_at') THEN
          ALTER TABLE alunos_cobrancas ADD COLUMN last_overdue_warning_at TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `).catch(err => console.error('[PostgreSQL] Erro boot automação:', err));

    // Inicialização da Tabela de Notas e Migração Automática
    await initNotasTable();
    
    // Sincronização de Integridade (JSON -> Tabelas Relacionais)
    await syncJsonToRelationalTables();

    const appData = await getSchoolData();
    
    // Migração: Se existirem notas no JSON, movemos para a tabela e removemos do JSON
    if (appData.grades && appData.grades.length > 0) {
      console.log(`[Migração] Migrando ${appData.grades.length} notas do JSON para o PostgreSQL...`);
      for (const grade of appData.grades) {
        try {
          await upsertNota({
            aluno_id: String(grade.studentId),
            disciplina_id: String(grade.subjectId),
            periodo_id: String(grade.period),
            prova_id: grade.examId ? String(grade.examId) : null,
            valor: Number(grade.value)
          });
        } catch(err) {
          console.error('[Migração] Erro ao migrar nota:', err);
        }
      }
      appData.grades = []; // Limpa o JSON após migrar
      appData.lastUpdated = new Date().toISOString();
      await saveSchoolData(appData);
      console.log('[Migração] Migração de notas concluída com sucesso!');
    }
    const rules = appData?.messageTemplates?.automationRules || {};
    
    // Preventivo
    if (rules.autoScheduleEnabled && rules.autoScheduleTime) {
      const [h, m] = rules.autoScheduleTime.split(':');
      agendarRotina('preventivo', h, m);
    } else {
      console.log('[Cron:Preventivo] ℹ Agendamento desativado.');
    }

    // Inadimplência
    if (rules.autoScheduleOverdueEnabled && rules.autoScheduleOverdueTime) {
      const [h, m] = rules.autoScheduleOverdueTime.split(':');
      agendarRotina('atrasado', h, m);
    } else {
      console.log('[Cron:Inadimplência] ℹ Agendamento desativado.');
    }
  } catch (e) {
    console.error('[Cron] Erro ao inicializar agendamento:', e.message);
  }
}

async function startServer() {

  // Disparo Manual de Inadimplência e Lembretes
  app.post('/api/disparar_cobrancas', async (req, res) => {
    try {
      const tipo = req.query.tipo || 'ambos';
      const resultado = await executarRotinaCobrancas(tipo);

      let msg = '';
      if (tipo === 'atrasado') msg = `${resultado.enviadasAtraso} mensagens de atraso processadas.`;
      else if (tipo === 'preventivo') msg = `${resultado.enviadasAviso} lembretes preventivos processados.`;
      else msg = `${resultado.enviadasAtraso} mensagens de atraso e ${resultado.enviadasAviso} lembretes preventivos processados.`;

      return res.status(200).json({ message: msg });
    } catch (error) { 
      console.error('[Disparo] Erro:', error);
      return res.status(500).json({ error: 'Erro interno.' }); 
    }
  });

  // API para gerenciar o agendamento (suporte a preventivo e atrasado)
  app.get('/api/cron/status', (req, res) => {
    res.json({ 
      preventive: !!activeCronJob, 
      overdue: !!activeCronJobOverdue 
    });
  });

  app.post('/api/cron/schedule', async (req, res) => {
    try {
      const { enabled, time, tipo } = req.body;
      const isOverdue = tipo === 'atrasado';
      const appData = await getSchoolData();
      if (!appData.messageTemplates) appData.messageTemplates = {};
      if (!appData.messageTemplates.automationRules) appData.messageTemplates.automationRules = {};
      
      if (isOverdue) {
        appData.messageTemplates.automationRules.autoScheduleOverdueEnabled = !!enabled;
        appData.messageTemplates.automationRules.autoScheduleOverdueTime = time || '09:00';
      } else {
        appData.messageTemplates.automationRules.autoScheduleEnabled = !!enabled;
        appData.messageTemplates.automationRules.autoScheduleTime = time || '09:00';
      }

      appData.lastUpdated = new Date().toISOString();
      await saveSchoolData(appData);

      if (enabled && time) {
        const [h, m] = time.split(':');
        agendarRotina(isOverdue ? 'atrasado' : 'preventivo', h, m);
      } else {
        if (isOverdue) {
          if (activeCronJobOverdue) { activeCronJobOverdue.stop(); activeCronJobOverdue = null; }
        } else {
          if (activeCronJob) { activeCronJob.stop(); activeCronJob = null; }
        }
      }

      res.json({ 
        success: true, 
        preventive: !!activeCronJob, 
        overdue: !!activeCronJobOverdue 
      });
    } catch (error) {
      console.error('[Cron] Erro ao salvar agendamento:', error);
      res.status(500).json({ error: 'Erro interno.' });
    }
  });

  // Imprimir Carnê
  app.get('/api/imprimir-carne/:installmentId', async (req, res) => {
    try {
      const { installmentId } = req.params;
      const parcelas = await getCobrancasByOrQuery(installmentId);
      let instId = (!installmentId.startsWith('pay_')) ? installmentId : null;
      if (!instId && parcelas?.length > 0) { const p = parcelas.find(x => x.asaas_installment_id); if (p) instId = p.asaas_installment_id; }

      const asaasTargetInstId = formatInstallmentId(instId || installmentId);
      const pSaved = parcelas?.find(x => x.link_carne);
      if (pSaved?.link_carne) return res.redirect(pSaved.link_carne);

      let asaasUrl = `${ASAAS_BASE_URL}/v3/installments/${asaasTargetInstId}/paymentBook`;
      const { sort, order } = req.query;
      const params = new URLSearchParams();
      if (sort) params.append('sort', sort);
      if (order) params.append('order', order);
      if (params.toString()) asaasUrl += `?${params.toString()}`;

      const response = await fetch(asaasUrl, { headers: { 'access_token': process.env.ASAAS_API_KEY, 'Accept': 'application/pdf' } });
      if (response.ok && response.headers.get('content-type')?.includes('pdf')) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const fileName = `carne_${asaasTargetInstId}.pdf`;

        // Upload assíncrono para MinIO
        uploadCarneToStorage(fileName, buffer).then(publicUrl => {
          updateCobrancaLinkCarne(instId, publicUrl).catch(() => {});
        }).catch(() => {});

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="carne.pdf"');
        return res.send(buffer);
      } else {
        return res.status(response.status).send('Falha Asaas');
      }
    } catch (error) { return res.status(500).json({ error: 'Erro interno.' }); }
  });

  // ===================================================
  // SERVE FRONTEND (Final Catch-all)
  // ===================================================
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/storage')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const vite = await import('vite').then(m => m.createServer({ 
        server: { middlewareMode: true }, 
        appType: 'spa' 
      }));
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('Vite dev server not available and dist folder missing.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 EduManager Self-Hosted na porta ${PORT}`);
    // Inicializa agendamento automático após servidor subir
    inicializarAgendamento();
  });
}

startServer();
