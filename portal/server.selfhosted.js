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

    const schoolData = await getSchoolData();
    const students = schoolData.students || [];

    const student = students.find(
      (s) => s.enrollmentNumber && s.enrollmentNumber.toLowerCase() === enrollmentNumber.toLowerCase()
    );

    if (!student) {
      return res.status(401).json({ error: 'Matrícula não encontrada' });
    }

    // Check password — COPIADA EXATAMENTE como está no JSON
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

    const studentClass = (schoolData.classes || []).find((c) => c.id === student.classId) || null;
    const course = studentClass
      ? (schoolData.courses || []).find((c) => c.id === studentClass.courseId) || null
      : null;

    // Normalizar foto do aluno
    if (student.photo) student.photo = normalizeStorageUrl(student.photo);

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
    const schoolData = await getSchoolData();
    const student = (schoolData.students || []).find((s) => s.id === req.user.studentId);
    if (!student) return res.status(404).json({ error: 'Aluno não encontrado' });

    const studentClass = (schoolData.classes || []).find((c) => c.id === student.classId) || null;
    const course = studentClass
      ? (schoolData.courses || []).find((c) => c.id === studentClass.courseId) || null
      : null;

    // Normalizar foto
    if (student.photo) student.photo = normalizeStorageUrl(student.photo);

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

// GET /api/portal/financeiro
app.get('/api/portal/financeiro', authMiddleware, async (req, res) => {
  try {
    const schoolData = await getSchoolData();
    const payments = (schoolData.payments || []).filter((p) => p.studentId === req.user.studentId);
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/portal/boletos (PostgreSQL direto)
app.get('/api/portal/boletos', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM alunos_cobrancas WHERE aluno_id = $1 ORDER BY vencimento ASC',
      [req.user.studentId]
    );
    res.json({ boletos: rows || [] });
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
    const grades = (schoolData.grades || []).filter((g) => g.studentId === req.user.studentId);
    const subjects = schoolData.subjects || [];
    const courseSubjects = subjects.filter(s => !s.classId || s.classId === student?.classId);
    
    // Buscar submissões para pegar acertos e erros
    const { rows: submissions } = await pool.query(
      'SELECT prova_id, acertos, erros FROM provas_submissoes WHERE aluno_id = $1',
      [req.user.studentId]
    );

    const enrichedGrades = grades.map((g) => {
      const subject = subjects.find((s) => s.id === g.subjectId);
      const exam = g.examId ? (schoolData.exams || []).find(e => e.id === g.examId) : null;
      const periodObj = (schoolData.periods || []).find(p => p.id === g.period);
      
      const submission = g.examId ? submissions.find(s => s.prova_id === g.examId) : null;

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

// GET /api/portal/frequencia
app.get('/api/portal/frequencia', authMiddleware, async (req, res) => {
  try {
    const schoolData = await getSchoolData();
    const attendance = (schoolData.attendance || []).filter((a) => a.studentId === req.user.studentId);
    res.json({ attendance });
  } catch (err) {
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

    let recordIndex = attendance.findIndex(a => a.studentId === req.user.studentId && a.date === fullDateStr);

    if (recordIndex !== -1) {
      const existing = attendance[recordIndex];
      if (existing.type === 'presence') return res.status(400).json({ error: 'Não é possível justificar uma presença' });
      attendance[recordIndex] = { ...existing, justification: justificationPayload };
    } else {
      const newRecord = {
        id: `att-just-${Date.now()}`, studentId: req.user.studentId, classId: student?.classId || '',
        date: fullDateStr, verified: false, type: 'absence', justification: justificationPayload,
      };
      attendance.push(newRecord);
      recordIndex = attendance.length - 1;
    }

    notifications.push({
      id: `notif-${Date.now()}`,
      studentId: 'admin',
      fromStudentId: req.user.studentId, // Identificador para navegação no Manager
      title: 'Nova Justificativa de Falta',
      message: JSON.stringify({
        text: `${student?.name || 'Aluno'} enviou uma justificativa para a aula de ${date}.`,
        motivo: motivo.trim()
      }),
      attachment: publicUrl,
      read: false,
      createdAt: new Date().toISOString(),
    });

    schoolData.attendance = attendance;
    schoolData.notifications = notifications;
    schoolData.lastUpdated = new Date().toISOString();
    await saveSchoolData(schoolData);

    res.json({ message: 'Justificativa enviada com sucesso', record: attendance[recordIndex] });
  } catch (err) {
    console.error('Justificativa error:', err);
    res.status(500).json({ error: 'Erro interno ao salvar justificativa' });
  }
});

// GET /api/portal/contratos
app.get('/api/portal/contratos', authMiddleware, async (req, res) => {
  try {
    const schoolData = await getSchoolData();
    const contracts = (schoolData.contracts || []).filter((c) => c.studentId === req.user.studentId);
    res.json({ contracts });
  } catch (err) {
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

// GET /api/portal/aulas
app.get('/api/portal/aulas', authMiddleware, async (req, res) => {
  try {
    const schoolData = await getSchoolData();
    const student = (schoolData.students || []).find(s => s.id === req.user.studentId);
    if (!student) return res.json({ lessons: [] });

    const parseDateHelper = (dStr) => {
      if (!dStr) return 0;
      const parts = dStr.substring(0, 10).split(/[-/]/);
      if (parts.length < 3) return 0;
      if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    };

    const lessons = (schoolData.lessons || [])
      .filter(l => l.classId === student.classId)
      .sort((a, b) => parseDateHelper(a.date) - parseDateHelper(b.date));

    res.json({ lessons });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/portal/notificacoes
app.get('/api/portal/notificacoes', authMiddleware, async (req, res) => {
  try {
    const schoolData = await getSchoolData();
    const notifications = (schoolData.notifications || [])
      .filter(n => n.studentId === req.user.studentId)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/portal/notificacoes/ler/:id
app.put('/api/portal/notificacoes/ler/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolData = await getSchoolData();
    const notifications = schoolData.notifications || [];
    const idx = notifications.findIndex(n => n.id === id && n.studentId === req.user.studentId);
    if (idx === -1) return res.status(404).json({ error: 'Notificação não encontrada' });
    notifications[idx] = { ...notifications[idx], read: true };
    schoolData.notifications = notifications;
    schoolData.lastUpdated = new Date().toISOString();
    await saveSchoolData(schoolData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/portal/notificacoes/:id
app.delete('/api/portal/notificacoes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolData = await getSchoolData();
    schoolData.notifications = (schoolData.notifications || []).filter(
      n => !(n.id === id && n.studentId === req.user.studentId)
    );
    schoolData.lastUpdated = new Date().toISOString();
    await saveSchoolData(schoolData);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/portal/alterar-senha
app.put('/api/portal/alterar-senha', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Campos obrigatórios' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Mínimo 4 caracteres' });

    const schoolData = await getSchoolData();
    const students = schoolData.students || [];
    const studentIndex = students.findIndex((s) => s.id === req.user.studentId);
    if (studentIndex === -1) return res.status(404).json({ error: 'Aluno não encontrado' });

    const student = students[studentIndex];
    const expectedPassword = student.portalPassword || (student.cpf ? student.cpf.replace(/\D/g, '').substring(0, 6) : '');
    if (currentPassword !== expectedPassword) return res.status(401).json({ error: 'Senha atual incorreta' });

    students[studentIndex] = { ...student, portalPassword: newPassword };
    schoolData.students = students;
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

    const exams = (schoolData.exams || [])
      .filter(e => e.status === 'published' && e.classId === student.classId)
      .map(e => ({
        ...e,
        questions: e.questions.map(q => ({
          id: q.id,
          text: q.text,
          options: q.options,
          imageUrl: normalizeStorageUrl(q.imageUrl)
        }))
      }));

    const { rows: submissions } = await pool.query(
      'SELECT * FROM provas_submissoes WHERE aluno_id = $1',
      [req.user.studentId]
    );

    // Mapear nomes de colunas do banco para o formato esperado pelo frontend
    const mappedSubmissions = (submissions || []).map(s => ({
      ...s,
      exam_id: s.prova_id || s.exam_id,
      total_questions: s.total_questoes || s.total_questions,
      correct_count: s.acertos || s.correct_count,
      wrong_count: s.erros || s.wrong_count,
      percentage: s.percentual || s.percentage,
      final_score: s.nota_final || s.final_score,
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

    const schoolData = await getSchoolData();
    const exam = (schoolData.exams || []).find(e => e.id === examId);
    if (!exam) return res.status(404).json({ error: 'Prova não encontrada.' });

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

    // Integrar com grades no school_data
    if (exam.subjectId && exam.periodId) {
      const grades = schoolData.grades || [];
      const existingGradeIndex = grades.findIndex(g => g.studentId === req.user.studentId && g.subjectId === exam.subjectId && g.period === exam.periodId && g.examId === examId);
      if (existingGradeIndex >= 0) {
        grades[existingGradeIndex].value = finalScore;
      } else {
        grades.push({
          id: `grade-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          studentId: req.user.studentId,
          subjectId: exam.subjectId,
          period: exam.periodId,
          value: finalScore,
          examId: examId
        });
      }
      schoolData.grades = grades;
      schoolData.lastUpdated = new Date().toISOString(); // Garante que o Manager detecte a mudança
      await saveSchoolData(schoolData);
    }

    res.json({ success: true, result: { total_questions: totalQuestions, correct_count: correctCount, wrong_count: wrongCount, percentage, final_score: finalScore } });
  } catch (err) {
    console.error('Submissao error:', err);
    res.status(500).json({ error: 'Erro interno.' });
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
