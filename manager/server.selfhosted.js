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

// === Novos módulos Self-Hosted (substituem Supabase) ===
import {
  getSchoolData, saveSchoolData, pool,
  insertCobrancas, updateCobranca, deleteCobranca,
  getCobrancaByPaymentId, getCobrancasByOrQuery,
  getCobrancasByAlunoId, getCobrancasAtrasadas,
  getCobrancasByInstallmentId, updateCobrancaLinkCarne,
  updateCobrancaByField
} from './services/database.js';
import { uploadLogo as uploadLogoToStorage, uploadCarne as uploadCarneToStorage } from './services/storage.js';

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

const upload = multer({ storage: multer.memoryStorage() });

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

    schoolData.lastUpdated = new Date().toISOString();
    await saveSchoolData(schoolData);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar school_data:', error);
    res.status(500).json({ success: false, reason: 'error' });
  }
});

app.get('/api/system-stats', async (req, res) => {
  try {
    const dbResult = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as db_size,
             (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') as table_count
    `);
    
    const { getMinioStats } = await import('./services/storage.js');
    const minioStats = await getMinioStats();
    
    res.json({
      postgres: {
        dbSize: dbResult.rows[0].db_size,
        tableCount: dbResult.rows[0].table_count
      },
      minio: minioStats
    });
  } catch(e) {
    console.error('System Stats Error:', e);
    res.status(500).json({ error: e.message });
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

    const fbGerado = 'Olá {nome}, sua cobrança referente a {descricao} no valor de R$ {valor} foi gerada. Vencimento: {vencimento}.';
    const fbPago = 'Olá {nome}, confirmamos o pagamento de R$ {valor} referente a {descricao}. Muito obrigado!';
    const fbAtrasado = 'Olá {nome}, o boleto referente a {descricao} de R$ {valor} venceu em {vencimento}. Segue o PDF da 2ª via atualizada abaixo:';
    const fbCancelado = 'Olá {nome}, a cobrança referente a {descricao} foi cancelada.';
    const fbAtualizado = 'Olá {nome}, o boleto de {descricao} foi atualizado. Segue a nova versão:';

    let templateText = '';
    if (eventType === 'PAYMENT_CREATED') templateText = templates?.boletoGerado || fbGerado;
    else if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') templateText = templates?.pagamentoConfirmado || fbPago;
    else if (eventType === 'PAYMENT_OVERDUE') templateText = templates?.boletoVencido || fbAtrasado;
    else if (eventType === 'PAYMENT_DELETED') templateText = templates?.cobrancaCancelada || fbCancelado;
    else if (eventType === 'PAYMENT_UPDATED') templateText = templates?.cobrancaAtualizada || fbAtualizado;
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
        if (payload.event === 'PAYMENT_OVERDUE') sendEvolutionMessage(asaasPaymentId, 'PAYMENT_OVERDUE');
        else if (payload.event === 'PAYMENT_UPDATED') sendEvolutionMessage(asaasPaymentId, 'PAYMENT_UPDATED');
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
async function startServer() {
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => req.path.startsWith('/api') ? next() : res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const vite = await import('vite').then(m => m.createServer({ server: { middlewareMode: true }, appType: 'spa' }));
    app.use(vite.middlewares);
  }

  // Disparo Manual de Inadimplência
  app.post('/api/disparar_cobrancas', async (req, res) => {
    try {
      const atrasados = await getCobrancasAtrasadas();
      if (atrasados.length === 0) return res.status(200).json({ message: 'Nenhuma atrasada.' });
      let enviadas = 0;
      for (const cob of atrasados) {
        if (cob.asaas_payment_id) { await sendEvolutionMessage(cob.asaas_payment_id, 'PAYMENT_OVERDUE'); enviadas++; }
      }
      return res.status(200).json({ message: `${enviadas} mensagens processadas.` });
    } catch (error) { return res.status(500).json({ error: 'Erro interno.' }); }
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

  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 EduManager Self-Hosted na porta ${PORT}`));
}

startServer();
