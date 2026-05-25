/**
 * ============================================================
 * PORTAL DO ALUNO — SERVER SELF-HOSTED
 * ============================================================
 * SUBSTITUIÇÃO CIRÚRGICA:
 *   - @supabase/supabase-js → pg (PostgreSQL direto)
 * 
 * TODAS AS ROTAS mantêm a mesma assinatura e resposta.
 * O frontend React NÃO percebe a diferença.
 * ============================================================
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pg from 'pg';

// Registrar parser global para tipo NUMERIC (OID 1700) para retornar como Number
pg.types.setTypeParser(1700, (val) => val === null ? null : parseFloat(val));

import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { uploadAtestado, s3Client } from './services/storage.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const upload = multer({ storage: multer.memoryStorage() });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'EduManager-JWT-Secret-2026!';

// === PostgreSQL (substitui Supabase) ===
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://edumanager:EduManager2026!Seguro@postgres:5432/edumanager';
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================================
// Proxy de Imagens do MinIO (acesso público via backend)
// ============================================================
app.get(/^\/storage\/([^\/]+)\/(.+)$/, async (req, res) => {
  try {
    const bucket = req.params[0];
    const key = req.params[1];
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const data = await s3Client.send(command);

    res.set('Content-Type', data.ContentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    data.Body.pipe(res);
  } catch (e) {
    res.status(404).send('Arquivo não encontrado');
  }
});

// ===== Helper: Get school data (PostgreSQL) =====
async function getSchoolData() {
  const { rows } = await pool.query(
    'SELECT data FROM school_data WHERE id = 1'
  );
  return rows[0]?.data || {};
}

// ===== Helper: Normalizar URLs do MinIO para proxy relativo =====
function normalizeStorageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/storage/')) return url;
  const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || '';
  if (MINIO_PUBLIC_URL && url.startsWith(MINIO_PUBLIC_URL)) {
    return url.replace(MINIO_PUBLIC_URL, '/storage');
  }
  const match = url.match(/^https?:\/\/[^\/]+\/(.+)$/);
  if (match && (url.includes('minio') || url.includes('storageedu') || url.includes(':9000'))) {
    return `/storage/${match[1]}`;
  }
  return url;
}

// ===== Helper: Save school data (PostgreSQL) =====
async function saveSchoolData(data) {
  await pool.query(
    `INSERT INTO school_data (id, data, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
    [JSON.stringify(data)]
  );
}

// ===== Auth Middleware =====
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ===================================================
// PUBLIC ROUTES
// ===================================================

// POST /api/portal/login
app.post('/api/portal/login', async (req, res) => {
  try {
    const { enrollmentNumber, password } = req.body;
    if (!enrollmentNumber || !password) {
      return res.status(400).json({ error: 'Matrícula e senha são obrigatórios' });
    }

    const { rows: dbStudents } = await pool.query(
      'SELECT * FROM alunos WHERE numero_matricula ILIKE $1',
      [enrollmentNumber]
    );

    let student;
    if (dbStudents.length > 0) {
      const s = dbStudents[0];
      student = {
        id: s.id,
        enrollmentNumber: s.numero_matricula,
        name: s.nome,
        status: s.status,
        portalPassword: s.senha_portal,
        cpf: s.cpf,
        rg: s.rg,
        birthDate: s.data_nascimento,
        phone: s.telefone,
        email: s.email,
        addressStreet: s.rua,
        addressNumber: s.numero,
        addressNeighborhood: s.bairro,
        addressCity: s.cidade,
        addressState: s.estado,
        addressZip: s.cep,
        guardianName: s.nome_responsavel,
        guardianCpf: s.cpf_responsavel,
        guardianPhone: s.telefone_responsavel,
        classId: s.turma_id,
        photo: normalizeStorageUrl(s.foto_url)
      };
    } else {
      // Fallback para arquivo JSON caso não tenha sido migrado (segurança)
      const schoolData = await getSchoolData();
      const students = schoolData.students || [];
      const s = students.find((x) => x.enrollmentNumber && x.enrollmentNumber.toLowerCase() === enrollmentNumber.toLowerCase());
      if (s) student = { ...s, photo: normalizeStorageUrl(s.photo) };
    }

    if (!student) {
      return res.status(401).json({ error: 'Matrícula não encontrada' });
    }

    const expectedPassword = student.portalPassword || (student.cpf ? student.cpf.replace(/\D/g, '').substring(0, 6) : '');
    if (password !== expectedPassword) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    if (student.status !== 'active') {
      return res.status(403).json({ error: 'Sua matrícula está inativa. Entre em contato com a secretaria.' });
    }

    const tokenPayload = {
      studentId: student.id,
      enrollmentNumber: student.enrollmentNumber,
      name: student.name,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    // Buscar Turma e Curso no PostgreSQL
    let studentClass = null;
    let course = null;
    
    if (student.classId) {
       const { rows: tRows } = await pool.query('SELECT * FROM turmas WHERE id = $1', [student.classId]);
       if (tRows.length > 0) {
          studentClass = { id: tRows[0].id, name: tRows[0].nome, courseId: tRows[0].curso_id };
          if (studentClass.courseId) {
             const { rows: cRows } = await pool.query('SELECT * FROM cursos WHERE id = $1', [studentClass.courseId]);
             if (cRows.length > 0) course = { id: cRows[0].id, name: cRows[0].nome };
          }
       }
    }

    // Fallback JSON se não achou as entidades relacionais (turma/curso)
    if (!studentClass) {
       const schoolData = await getSchoolData();
       studentClass = (schoolData.classes || []).find((c) => c.id === student.classId) || null;
       course = studentClass ? (schoolData.courses || []).find((c) => c.id === studentClass.courseId) || null : null;
    }

    res.json({
      token,
      user: tokenPayload,
      student: { ...student, portalPassword: undefined },
      class: studentClass,
      course,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/portal/escola
app.get('/api/portal/escola', async (req, res) => {
  try {
    const schoolData = await getSchoolData();
    res.json({
      name: schoolData.profile?.name || 'Escola',
      logo: normalizeStorageUrl(schoolData.logo) || null,
      profile: schoolData.profile || null,
    });
  } catch (err) {
    console.error('Escola error:', err);
    res.status(500).json({ error: 'Erro ao buscar dados da escola' });
  }
});

// ===================================================
// PROTECTED ROUTES
// ===================================================

// GET /api/portal/me
app.get('/api/portal/me', authMiddleware, async (req, res) => {
  try {
    const { rows: dbStudents } = await pool.query(
      'SELECT * FROM alunos WHERE id = $1',
      [req.user.studentId]
    );

    let student;
    if (dbStudents.length > 0) {
      const s = dbStudents[0];
      student = {
        id: s.id,
        enrollmentNumber: s.numero_matricula,
        name: s.nome,
        status: s.status,
        portalPassword: s.senha_portal,
        cpf: s.cpf,
        rg: s.rg,
        birthDate: s.data_nascimento,
        phone: s.telefone,
        email: s.email,
        addressStreet: s.rua,
        addressNumber: s.numero,
        addressNeighborhood: s.bairro,
        addressCity: s.cidade,
        addressState: s.estado,
        addressZip: s.cep,
        guardianName: s.nome_responsavel,
        guardianCpf: s.cpf_responsavel,
        guardianPhone: s.telefone_responsavel,
        classId: s.turma_id,
        photo: normalizeStorageUrl(s.foto_url)
      };
    } else {
      const schoolData = await getSchoolData();
      const s = (schoolData.students || []).find((x) => x.id === req.user.studentId);
      if (s) student = { ...s, photo: normalizeStorageUrl(s.photo) };
    }

    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    let studentClass = null;
    let course = null;
    
    if (student.classId) {
       const { rows: tRows } = await pool.query('SELECT * FROM turmas WHERE id = $1', [student.classId]);
       if (tRows.length > 0) {
          studentClass = { id: tRows[0].id, name: tRows[0].nome, courseId: tRows[0].curso_id };
          if (studentClass.courseId) {
             const { rows: cRows } = await pool.query('SELECT * FROM cursos WHERE id = $1', [studentClass.courseId]);
             if (cRows.length > 0) course = { id: cRows[0].id, name: cRows[0].nome };
          }
       }
    }

    if (!studentClass) {
       const schoolData = await getSchoolData();
       studentClass = (schoolData.classes || []).find((c) => c.id === student.classId) || null;
       course = studentClass ? (schoolData.courses || []).find((c) => c.id === studentClass.courseId) || null : null;
    }

    res.json({
      student: { ...student, portalPassword: undefined },
      class: studentClass,
      course,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/portal/financeiro (PostgreSQL como fonte primária — SQL-First)
app.get('/api/portal/financeiro', authMiddleware, async (req, res) => {
  try {
    const statusMap = {
      'pago': 'paid', 'paid': 'paid', 'received': 'paid', 'confirmed': 'paid', 'received_in_cash': 'paid',
      'atrasado': 'overdue', 'overdue': 'overdue', 'vencido': 'overdue',
      'pendente': 'pending', 'pending': 'pending',
      'cancelado': 'cancelled', 'cancelled': 'cancelled', 'refunded': 'cancelled', 'deleted': 'cancelled'
    };

    // 1. FONTE PRIMÁRIA: PostgreSQL (alunos_cobrancas) — contém TODOS os pagamentos criados
    let dbRows = [];
    try {
      const { rows } = await pool.query(
        `SELECT *, 
                TO_CHAR(vencimento, 'YYYY-MM-DD') as vencimento, 
                TO_CHAR(data_pagamento, 'YYYY-MM-DD') as data_pagamento
         FROM alunos_cobrancas 
         WHERE aluno_id = $1 
         ORDER BY vencimento ASC`,
        [req.user.studentId]
      );
      dbRows = rows || [];
    } catch (dbErr) {
      console.error('Financeiro: erro ao buscar do PostgreSQL -', dbErr.message);
    }

    // 2. FONTE SECUNDÁRIA: JSON (school_data.payments) — fallback para dados que ainda não migraram
    const schoolData = await getSchoolData();
    const jsonPayments = (schoolData.payments || []).filter((p) => p.studentId === req.user.studentId);

    // Criar mapa rápido do JSON por asaasPaymentId para lookup
    const jsonMap = {};
    const jsonLocalMap = {}; // Novo mapa por ID local do JSON
    for (const jp of jsonPayments) {
      const key = jp.asaasPaymentId || jp.asaas_payment_id;
      if (key) jsonMap[key] = jp;
      if (jp.id) jsonLocalMap[jp.id] = jp;
    }
 
    // 3. CONSTRUIR LISTA FINAL: SQL como base, enriquecido com JSON quando SQL não tem o campo
    const seenAsaasIds = new Set();
    const seenLocalIds = new Set(); // Evitar duplicar itens adicionados por local_id
    const finalPayments = [];
 
    // 3a. Iterar sobre registros do SQL (fonte da verdade)
    for (const db of dbRows) {
      const asaasId = db.asaas_payment_id;
      const localId = db.local_id;
      if (asaasId) seenAsaasIds.add(asaasId);
      if (localId) seenLocalIds.add(localId);
 
      const jsonP = (asaasId ? jsonMap[asaasId] : null) || (localId ? jsonLocalMap[localId] : null) || {};
      const dbStatus = (db.status || '').toLowerCase().trim();
      const normalizedStatus = statusMap[dbStatus] || 'pending';
 
      // Parcela: SQL tem prioridade, depois JSON, depois inferência por grupo
      let installmentNumber = db.installment_number || jsonP.installmentNumber || null;
      let totalInstallments = db.total_installments || jsonP.totalInstallments || null;
 
      if (!installmentNumber && db.asaas_installment_id) {
        const siblings = dbRows.filter(r => r.asaas_installment_id === db.asaas_installment_id);
        if (siblings.length > 1) {
          totalInstallments = siblings.length;
          installmentNumber = siblings.indexOf(db) + 1;
        }
      }
 
      // [Bugfix Crítico]: Recuperar valor bruto se o Asaas/Webhook salvou apenas o líquido
      const discount = jsonP.discount !== undefined ? Number(jsonP.discount) : (Number(db.discount) || 0);
      const isPaid = ['paid', 'pago', 'received', 'confirmed'].includes(normalizedStatus);
      const valorPagoNoSQL = Number(db.valor_pago || 0);
      
      // [NOVA LÓGICA]: Pegar o MAIOR valor entre todas as fontes para garantir que seja o BRUTO
      let amountBruto = Math.max(
        Number(db.amount_original || 0), 
        Number(db.valor || 0), 
        Number(jsonP.amount || 0)
      );
 
      // Se o valor bruto encontrado é igual ao que foi pago, e existe desconto,
      // então o que encontramos era na verdade o valor líquido. Recuperamos o bruto somando o desconto.
      if (isPaid && discount > 0 && amountBruto > 0) {
        if (valorPagoNoSQL > 0 && amountBruto <= valorPagoNoSQL) {
           amountBruto = valorPagoNoSQL + discount;
        } else if (amountBruto < (amountBruto + discount) && amountBruto === (jsonP.amount || 0)) {
           // Se veio do JSON e parece ser o líquido
           amountBruto = Number(jsonP.amount) + discount;
        }
      }
 
      finalPayments.push({
        id: localId || jsonP.id || asaasId,
        studentId: req.user.studentId,
        asaasPaymentId: asaasId || null,
        asaasPaymentUrl: db.asaas_payment_url || jsonP.asaasPaymentUrl || null,
        amount: amountBruto,
        discount: discount,
        valor_pago: valorPagoNoSQL > 0 ? valorPagoNoSQL : (isPaid ? (amountBruto - discount) : 0),
        dueDate: db.vencimento || jsonP.dueDate,
        status: normalizedStatus,
        paidDate: db.data_pagamento || jsonP.paidDate || null,
        type: db.type || jsonP.type || 'monthly',
        description: db.description || jsonP.description || null,
        installmentNumber,
        totalInstallments,
        link_boleto: db.link_boleto || jsonP.bankSlipUrl || null,
        transactionReceiptUrl: db.transaction_receipt_url || jsonP.transactionReceiptUrl || null,
      });
    }
 
    // 3b. Adicionar pagamentos que existem APENAS no JSON (cobranças manuais/legadas sem asaas)
    for (const jp of jsonPayments) {
      const key = jp.asaasPaymentId || jp.asaas_payment_id;
      if (key && seenAsaasIds.has(key)) continue; // já processado
      if (jp.id && seenLocalIds.has(jp.id)) continue; // já processado via local_id
      if (!key && !jp.id) continue; // registro inválido
 
      const jpStatus = (jp.status || '').toLowerCase().trim();
      const normalizedStatus = statusMap[jpStatus] || 'pending';
 
      finalPayments.push({
        ...jp,
        status: normalizedStatus,
        amount: Number(jp.amount) || 0,
      });
    }

    res.json({ payments: finalPayments });
  } catch (err) {
    console.error('Financeiro error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/portal/boletos (PostgreSQL direto)
app.get('/api/portal/boletos', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *, TO_CHAR(vencimento, 'YYYY-MM-DD') as vencimento, TO_CHAR(data_pagamento, 'YYYY-MM-DD') as data_pagamento FROM alunos_cobrancas WHERE aluno_id = $1 ORDER BY vencimento ASC`,
      [req.user.studentId]
    );

    // [Bugfix Crítico]: Recuperar valor bruto original e valor efetivamente pago
    const boletos = (rows || []).map(b => {
      const valorOriginal = Number(b.amount_original || b.valor || 0);
      const discount = Number(b.discount || 0);
      const valorPago = Number(b.valor_pago || 0);
      const status = (b.status || '').toLowerCase();
      const isPaid = ['paid', 'pago', 'received', 'confirmed', 'recebido'].includes(status);

      // O valor principal exibido deve ser sempre o BRUTO original
      let valorExibido = valorOriginal;
      
      // Se por algum motivo o valorOriginal ainda for o líquido, tentamos recompor
      if (valorOriginal > 0 && isPaid && valorPago > 0 && valorOriginal === valorPago && discount > 0) {
        valorExibido = valorOriginal + discount;
      }

      return {
        ...b,
        valor: valorExibido,
        valor_pago: valorPago
      };
    });

    res.json({ boletos });
  } catch (err) {
    console.error('Boletos error:', err);
    res.json({ boletos: [] });
  }
});

// GET /api/portal/notas
app.get('/api/portal/notas', authMiddleware, async (req, res) => {
  try {
    const schoolData = await getSchoolData();
    const student = (schoolData.students || []).find(s => s.id === req.user.studentId);
    
    // Buscar notas direto da nova tabela
    const { rows: dbGrades } = await pool.query(
      'SELECT id, aluno_id as "studentId", disciplina_id as "subjectId", periodo_id as "period", prova_id as "examId", valor as "value" FROM notas_boletim WHERE aluno_id = $1',
      [req.user.studentId]
    );
    // Converter valor numérico
    const grades = dbGrades.map(g => ({ ...g, value: Number(g.value) }));

    const subjects = schoolData.subjects || [];
    const courseSubjects = subjects.filter(s => !s.classId || s.classId === student?.classId);
    
    // Buscar submissões para pegar acertos e erros
    const { rows: submissions } = await pool.query(
      'SELECT prova_id, acertos, erros FROM provas_submissoes WHERE aluno_id = $1',
      [req.user.studentId]
    );

    const enrichedGrades = grades.map((g) => {
      const subject = subjects.find((s) => String(s.id).trim() === String(g.subjectId).trim());
      const exam = g.examId ? (schoolData.exams || []).find(e => String(e.id).trim() === String(g.examId).trim()) : null;
      const periodObj = (schoolData.periods || []).find(p => String(p.id).trim() === String(g.period).trim());
      
      const submission = g.examId ? submissions.find(s => String(s.prova_id) === String(g.examId)) : null;

      return { 
        ...g, 
        subjectName: subject?.name || 'Disciplina desconhecida',
        examTitle: exam?.title,
        evaluationType: exam?.evaluationType || 'exam',
        maxScore: exam?.maxScore,
        periodName: periodObj ? periodObj.name : g.period,
        correctCount: submission?.acertos,
        wrongCount: submission?.erros
      };
    });
    const periods = [...new Set(enrichedGrades.map((g) => g.periodName))];
    if (periods.length === 0) periods.push('1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre');
    periods.sort();
    res.json({ grades: enrichedGrades, periods, allSubjects: courseSubjects });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/portal/frequencia (SQL-First — Leitura direta do PostgreSQL)
app.get('/api/portal/frequencia', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *, TO_CHAR(data, 'YYYY-MM-DD"T"HH24:MI:SS') as formatted_data 
       FROM frequencias WHERE aluno_id = $1 ORDER BY data DESC`,
      [req.user.studentId]
    );
    
    const attendance = rows.map(r => ({
      id: r.id,
      studentId: r.aluno_id,
      classId: r.turma_id,
      lessonId: r.aula_id,
      date: r.formatted_data || r.data,
      photo: r.foto_url || r.foto,
      verified: r.verificado,
      type: r.tipo,
      justification: r.justificativa,
      justificationAccepted: r.justificativa_aceita,
      createdAt: r.created_at
    }));

    // Fallback Híbrido: Se não achou no SQL, tenta pegar do JSON (caso haja registros antigos não sincronizados)
    if (attendance.length === 0) {
       const schoolData = await getSchoolData();
       const fallbackAttendance = (schoolData.attendance || []).filter(a => a.studentId === req.user.studentId);
       return res.json({ attendance: fallbackAttendance });
    }

    res.json({ attendance });
  } catch (err) {
    console.error('Frequencia error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/portal/frequencia/justificar
app.post('/api/portal/frequencia/justificar', authMiddleware, upload.single('arquivo'), async (req, res) => {
  try {
    const { date, motivo } = req.body;
    if (!date) return res.status(400).json({ error: 'A data da aula é obrigatória' });
    if (!motivo || motivo.trim() === '') return res.status(400).json({ error: 'A justificativa (motivo) é obrigatória' });

    let publicUrl = null;
    if (req.file) {
      publicUrl = await uploadAtestado(req.file.buffer, req.file.mimetype);
    }

    const schoolData = await getSchoolData();
    const attendance = schoolData.attendance || [];
    const notifications = schoolData.notifications || [];
    const student = (schoolData.students || []).find(s => s.id === req.user.studentId);

    const fullDateStr = date;
    const justificationPayload = JSON.stringify({ motivo: motivo.trim(), arquivo: publicUrl });

    const submittedAt = new Date().toISOString();

    if (recordIndex !== -1) {
      const existing = attendance[recordIndex];
      if (existing.type === 'presence') return res.status(400).json({ error: 'Não é possível justificar uma presença' });
      attendance[recordIndex] = { ...existing, justification: justificationPayload, submittedAt };
    } else {
      const newRecord = {
        id: `att-just-${Date.now()}`, studentId: req.user.studentId, classId: student?.classId || '',
        date: fullDateStr, verified: false, type: 'absence', justification: justificationPayload,
        submittedAt
      };
      attendance.push(newRecord);
      recordIndex = attendance.length - 1;
    }

    // Inserir notificação para o ADMIN na tabela SQL
    try {
      await pool.query(
        `INSERT INTO notificacoes (aluno_id, titulo, mensagem, anexo, lida, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          'admin', 
          'Nova Justificativa de Falta', 
          JSON.stringify({
            text: `${student?.name || 'Aluno'} enviou uma justificativa para a aula de ${date}.`,
            motivo: motivo.trim(),
            fromStudentId: req.user.studentId
          }),
          publicUrl,
          false
        ]
      );
    } catch (notifErr) {
      console.error('[Portal:Justificação] Erro ao salvar notificação SQL:', notifErr.message);
    }

    schoolData.attendance = attendance;
    schoolData.lastUpdated = new Date().toISOString();
    await saveSchoolData(schoolData);

    // Sincronização Imediata com Tabela Relacional
    try {
      await pool.query(
        `INSERT INTO frequencias (id, aluno_id, turma_id, data, verificado, tipo, justificativa, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET justificativa = EXCLUDED.justificativa, justificativa_aceita = FALSE, created_at = EXCLUDED.created_at`,
        [attendance[recordIndex].id, req.user.studentId, student?.classId || '', fullDateStr, false, 'absence', justificationPayload, submittedAt]
      );
    } catch (dbErr) {
      console.error('[Portal:Justificação] Erro ao sincronizar tabela relacional:', dbErr.message);
    }

    res.json({ message: 'Justificativa enviada com sucesso', record: attendance[recordIndex] });
  } catch (err) {
    console.error('Justificativa error:', err);
    res.status(500).json({ error: 'Erro interno ao salvar justificativa' });
  }
});

// GET /api/portal/contratos (SQL-First)
app.get('/api/portal/contratos', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, aluno_id as "studentId", titulo as title, conteudo as content, TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt"
       FROM contratos 
       WHERE aluno_id = $1 
       ORDER BY created_at DESC`,
      [req.user.studentId]
    );

    // Fallback de segurança para JSON legado caso não tenha sincronizado
    if (rows.length === 0) {
      const schoolData = await getSchoolData();
      const fallbackContracts = (schoolData.contracts || []).filter((c) => c.studentId === req.user.studentId);
      return res.json({ contracts: fallbackContracts });
    }

    res.json({ contracts: rows });
  } catch (err) {
    console.error('Erro contratos portal:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/portal/certificados
app.get('/api/portal/certificados', authMiddleware, async (req, res) => {
  try {
    const schoolData = await getSchoolData();
    const certificates = (schoolData.certificates || []).filter((c) => c.studentId === req.user.studentId);
    res.json({ certificates });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/portal/config — Agora retorna dados do PostgreSQL, não mais Supabase
app.get('/api/portal/config', (req, res) => {
  // O frontend usava isso para Supabase Realtime.
  // No self-hosted, o frontend usará polling ou SSE.
  res.json({
    supabaseUrl: null,
    supabaseAnonKey: null,
    selfHosted: true,
  });
});

// GET /api/portal/aulas (SQL-First — Leitura direta do PostgreSQL)
app.get('/api/portal/aulas', authMiddleware, async (req, res) => {
  try {
    const { rows: dbStudents } = await pool.query('SELECT turma_id FROM alunos WHERE id = $1', [req.user.studentId]);
    if (dbStudents.length === 0) return res.json({ lessons: [] });

    // Obter turmas do aluno a partir da turma atual e presenças históricas
    const { rows: freqRows } = await pool.query('SELECT DISTINCT turma_id FROM frequencias WHERE aluno_id = $1', [req.user.studentId]);
    
    const studentClassIds = new Set([
      dbStudents[0].turma_id,
      ...freqRows.map(f => f.turma_id)
    ].filter(Boolean));

    if (studentClassIds.size === 0) return res.json({ lessons: [] });

    const classIdsArray = Array.from(studentClassIds);
    const { rows: aulasRows } = await pool.query(`
      SELECT a.*, TO_CHAR(a.data, 'YYYY-MM-DD') as data_formatada, t.nome as class_name
      FROM aulas a
      LEFT JOIN turmas t ON a.turma_id = t.id
      WHERE a.turma_id = ANY($1)
      ORDER BY a.data ASC, a.horario_inicio ASC
    `, [classIdsArray]);

    const lessons = aulasRows.map(row => ({
      id: row.id,
      classId: row.turma_id,
      date: row.data_formatada,
      startTime: row.horario_inicio,
      endTime: row.horario_fim,
      status: row.status,
      type: row.tipo,
      cancellationReason: row.motivo_cancelamento,
      originalLessonId: row.aula_original_id,
      className: row.class_name || 'Turma'
    }));

    // Se por acaso as aulas não foram migradas ainda, faz um fallback
    if (lessons.length === 0) {
      const schoolData = await getSchoolData();
      const fallbackLessons = (schoolData.lessons || [])
        .filter(l => studentClassIds.has(l.classId))
        .map(l => {
           const classObj = (schoolData.classes || []).find(c => c.id === l.classId);
           return { ...l, className: classObj ? classObj.name : 'Turma' };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return res.json({ lessons: fallbackLessons });
    }

    res.json({ lessons });
  } catch (err) {
    console.error('Erro ao buscar aulas:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/portal/notificacoes
app.get('/api/portal/notificacoes', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, titulo as title, mensagem as message, lida as read, anexo as attachment, created_at as "createdAt"
       FROM notificacoes 
       WHERE aluno_id = $1 
       ORDER BY created_at DESC`,
      [req.user.studentId]
    );
    res.json({ notifications: rows });
  } catch (err) {
    console.error('Erro ao buscar notificações:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/portal/notificacoes/ler/:id
app.put('/api/portal/notificacoes/ler/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE notificacoes SET lida = true WHERE id = $1 AND aluno_id = $2',
      [id, req.user.studentId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao marcar notificação como lida:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/portal/notificacoes/:id
app.delete('/api/portal/notificacoes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'DELETE FROM notificacoes WHERE id = $1 AND aluno_id = $2',
      [id, req.user.studentId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar notificação:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/portal/alterar-senha
app.put('/api/portal/alterar-senha', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Campos obrigatórios' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Mínimo 4 caracteres' });

    const { rows: dbStudents } = await pool.query('SELECT * FROM alunos WHERE id = $1', [req.user.studentId]);
    let student, isDb = false, studentIndex = -1;
    const schoolData = await getSchoolData();
    const students = schoolData.students || [];

    if (dbStudents.length > 0) {
      const s = dbStudents[0];
      student = { id: s.id, portalPassword: s.senha_portal, cpf: s.cpf };
      isDb = true;
      studentIndex = students.findIndex((s) => s.id === req.user.studentId);
    } else {
      studentIndex = students.findIndex((s) => s.id === req.user.studentId);
      if (studentIndex !== -1) student = students[studentIndex];
    }

    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    const expectedPassword = student.portalPassword || (student.cpf ? student.cpf.replace(/\D/g, '').substring(0, 6) : '');
    if (currentPassword !== expectedPassword) return res.status(401).json({ error: 'Senha atual incorreta' });

    // 1. Atualizar no PostgreSQL se existir
    if (isDb) {
      await pool.query('UPDATE alunos SET senha_portal = $1 WHERE id = $2', [newPassword, req.user.studentId]);
    }

    // 2. Atualizar no JSON legado (Retrocompatibilidade e Segurança de Sincronia)
    if (studentIndex !== -1) {
       students[studentIndex] = { ...students[studentIndex], portalPassword: newPassword };
       schoolData.students = students;
    }
    schoolData.lastUpdated = new Date().toISOString();
    await saveSchoolData(schoolData);

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// ===================================================
// AVALIAÇÕES (Exams) — PostgreSQL direto para submissões
// ===================================================

app.get('/api/portal/avaliacoes', authMiddleware, async (req, res) => {
  try {
    const schoolData = await getSchoolData();
    const student = (schoolData.students || []).find(s => s.id === req.user.studentId);
    if (!student) return res.json({ exams: [], submissions: [] });

    const { rows: dbExams } = await pool.query(
      `SELECT * FROM provas WHERE turma_id = $1 AND status = 'published' AND is_deleted = false`,
      [student.classId]
    );

    const exams = [];
    for (const row of dbExams) {
      const { rows: questoes } = await pool.query(
        `SELECT * FROM questoes_provas WHERE prova_id = $1 ORDER BY ordem ASC`,
        [row.id]
      );
      
      exams.push({
        id: row.id,
        classId: row.turma_id,
        subjectId: row.disciplina_id,
        periodId: row.periodo_id,
        title: row.titulo,
        durationMinutes: row.duracao_minutos,
        status: row.status,
        allowRetake: row.permitir_refacao,
        isDeleted: row.is_deleted,
        evaluationType: row.evaluation_type,
        maxScore: 10,
        questions: questoes.map(q => ({
          id: q.id,
          text: q.texto,
          options: typeof q.opcoes === 'string' ? JSON.parse(q.opcoes) : q.opcoes,
          correctOptionIndex: q.indice_correto,
          imageUrl: normalizeStorageUrl(q.imagem_url)
        }))
      });
    }

    const { rows: submissions } = await pool.query(
      'SELECT * FROM provas_submissoes WHERE aluno_id = $1',
      [req.user.studentId]
    );

    // Mapear nomes de colunas do banco para o formato esperado pelo frontend
    // IMPORTANTE: NUMERIC(5,2) retorna como string do pg, precisa de Number()
    const mappedSubmissions = (submissions || []).map(s => ({
      ...s,
      exam_id: s.prova_id || s.exam_id,
      total_questions: s.total_questoes || s.total_questions,
      correct_count: s.acertos || s.correct_count,
      wrong_count: s.erros || s.wrong_count,
      percentage: Number(s.percentual || s.percentage || 0),
      final_score: Number(s.nota_final || s.final_score || 0),
      answers_json: s.respostas || s.answers_json,
    }));

    res.json({ exams, submissions: mappedSubmissions });
  } catch (err) {
    console.error('Avaliacoes error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/portal/avaliacoes/submeter', authMiddleware, async (req, res) => {
  try {
    const { examId, answers } = req.body;
    if (!examId || !answers) return res.status(400).json({ error: 'Dados obrigatórios' });

    const { rows: examRows } = await pool.query('SELECT * FROM provas WHERE id = $1', [examId]);
    if (examRows.length === 0) return res.status(404).json({ error: 'Prova não encontrada.' });
    const examData = examRows[0];
    
    const { rows: questoes } = await pool.query('SELECT * FROM questoes_provas WHERE prova_id = $1 ORDER BY ordem ASC', [examId]);
    
    const exam = {
      id: examData.id,
      title: examData.titulo,
      allowRetake: examData.permitir_refacao,
      subjectId: examData.disciplina_id,
      periodId: examData.periodo_id,
      evaluationType: examData.evaluation_type,
      maxScore: 10,
      questions: questoes.map(q => ({
        id: q.id,
        correctOptionIndex: q.indice_correto
      }))
    };

    // Verificar se já submeteu
    const { rows: existing } = await pool.query(
      'SELECT * FROM provas_submissoes WHERE aluno_id = $1 AND prova_id = $2 LIMIT 1',
      [req.user.studentId, examId]
    );

    if (existing.length > 0) {
      if (!exam.allowRetake) {
        return res.status(409).json({ error: 'Você já realizou esta avaliação e ela não permite refação.' });
      }
      // Se permite refazer, deleta a anterior
      await pool.query(
        'DELETE FROM provas_submissoes WHERE aluno_id = $1 AND prova_id = $2',
        [req.user.studentId, examId]
      );
    }

    const totalQuestions = exam.questions.length;
    let correctCount = 0;
    for (const q of exam.questions) {
      if (answers[q.id] !== undefined && answers[q.id] === q.correctOptionIndex) correctCount++;
    }

    const wrongCount = totalQuestions - correctCount;
    const percentage = totalQuestions > 0 ? parseFloat(((correctCount / totalQuestions) * 100).toFixed(2)) : 0;
    const maxScore = exam.maxScore != null ? Number(exam.maxScore) : 10;
    const finalScore = totalQuestions > 0 ? parseFloat(((correctCount / totalQuestions) * maxScore).toFixed(2)) : 0;

    // Salvar no PostgreSQL
    await pool.query(
      `INSERT INTO provas_submissoes (aluno_id, prova_id, total_questoes, acertos, erros, percentual, nota_final, respostas, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [req.user.studentId, examId, totalQuestions, correctCount, wrongCount, percentage, finalScore, JSON.stringify(answers), new Date().toISOString()]
    );

    // Integrar com notas_boletim (Nova Tabela) em vez de school_data
    if (exam.subjectId && exam.periodId) {
      try {
        await pool.query(
          `INSERT INTO notas_boletim (aluno_id, disciplina_id, periodo_id, prova_id, valor, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (aluno_id, disciplina_id, periodo_id, prova_id) 
           DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`,
          [req.user.studentId, exam.subjectId, exam.periodId, examId, finalScore]
        );
      } catch (gradeErr) {
        console.error('[Portal:Submissão] Erro ao salvar nota no boletim:', gradeErr.message);
      }
    }

    // Inserir notificação para o ADMIN no Sino
    try {
      const { rows: info } = await pool.query(
        `SELECT a.nome as student_name, t.nome as class_name 
         FROM alunos a 
         LEFT JOIN turmas t ON a.turma_id = t.id 
         WHERE a.id = $1`,
        [req.user.studentId]
      );
      
      const studentName = info[0]?.student_name || req.user.name || 'Aluno';
      const className = info[0]?.class_name || 'Turma não identificada';
      const typeLabel = exam.evaluationType === 'activity' ? 'Atividade' : 'Prova';

      await pool.query(
        `INSERT INTO notificacoes (aluno_id, titulo, mensagem, anexo, lida, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          'admin', 
          `📝 ${typeLabel} Finalizada`, 
          `${studentName} (${className}) finalizou a ${typeLabel.toLowerCase()} "${exam.title}" com nota ${finalScore}.`,
          JSON.stringify({ type: 'exam', studentId: req.user.studentId, examId, grade: finalScore }),
          false
        ]
      );
    } catch (notifErr) {
      console.error('[Portal:Submissão] Erro ao disparar notificação admin:', notifErr.message);
    }

    res.json({ success: true, result: { total_questions: totalQuestions, correct_count: correctCount, wrong_count: wrongCount, percentage, final_score: finalScore } });
  } catch (err) {
    console.error('❌ [Portal:Submissão] Erro crítico ao salvar:', err.message, err.stack);
    res.status(500).json({ 
      error: 'Erro interno ao processar nota', 
      details: err.message,
      code: 'DB_SAVE_ERROR'
    });
  }
});

// ===================================================
// SERVE FRONTEND
// ===================================================
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ===================================================
// START SERVER
// ===================================================
app.listen(PORT, () => {
  console.log(`🚀 Portal do Aluno Self-Hosted na porta ${PORT}`);
  console.log(`📡 PostgreSQL: ${DATABASE_URL.split('@')[1] || 'local'}`);
});
