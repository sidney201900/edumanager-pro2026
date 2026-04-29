/**
 * ============================================================
 * SERVIÇO DE BANCO DE DADOS — PostgreSQL (Self-Hosted)
 * Substitui todas as chamadas supabase.from(...) do sistema
 * ============================================================
 */
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://edumanager:EduManager2026!Seguro@postgres:5432/edumanager';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Erro inesperado no pool:', err);
});

// ============================================================
// HELPER: Buscar school_data JSON blob (compatibilidade legada)
// ============================================================
export async function getSchoolData() {
  const { rows } = await pool.query(
    'SELECT data FROM school_data WHERE id = 1'
  );
  return rows[0]?.data || {};
}

export async function saveSchoolData(data) {
  await pool.query(
    `INSERT INTO school_data (id, data, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
    [JSON.stringify(data)]
  );
}

// ============================================================
// HELPERS: alunos_cobrancas
// ============================================================
export async function insertCobrancas(cobrancas) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of cobrancas) {
      await client.query(
        `INSERT INTO alunos_cobrancas 
         (aluno_id, asaas_customer_id, asaas_payment_id, asaas_installment_id, installment, valor, vencimento, link_boleto)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [c.aluno_id, c.asaas_customer_id, c.asaas_payment_id, c.asaas_installment_id || c.installment, c.installment, c.valor, c.vencimento, c.link_boleto]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function updateCobranca(asaasPaymentId, updateData) {
  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(updateData)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
  }

  if (setClauses.length === 0) return;

  values.push(asaasPaymentId);
  await pool.query(
    `UPDATE alunos_cobrancas SET ${setClauses.join(', ')} WHERE asaas_payment_id = $${i}`,
    values
  );
}

export async function deleteCobranca(asaasPaymentId) {
  await pool.query(
    'DELETE FROM alunos_cobrancas WHERE asaas_payment_id = $1',
    [asaasPaymentId]
  );
}

export async function getCobrancaByPaymentId(asaasPaymentId) {
  const { rows } = await pool.query(
    'SELECT * FROM alunos_cobrancas WHERE asaas_payment_id = $1',
    [asaasPaymentId]
  );
  return rows[0] || null;
}

export async function getCobrancasByOrQuery(id) {
  // Replicates: supabase.from('alunos_cobrancas').select('*').or(...)
  const { rows } = await pool.query(
    `SELECT * FROM alunos_cobrancas 
     WHERE installment = $1 
        OR asaas_installment_id = $1 
        OR asaas_payment_id = $1 
        OR id::text = $1
     ORDER BY vencimento ASC`,
    [id]
  );
  return rows;
}

export async function getCobrancasByAlunoId(alunoId) {
  const { rows } = await pool.query(
    'SELECT * FROM alunos_cobrancas WHERE aluno_id = $1 ORDER BY vencimento ASC',
    [alunoId]
  );
  return rows;
}

export async function getCobrancasPendentes() {
  const { rows } = await pool.query(
    "SELECT * FROM alunos_cobrancas WHERE status = 'PENDENTE'"
  );
  return rows;
}

export async function getCobrancasAtrasadas() {
  const { rows } = await pool.query(
    "SELECT * FROM alunos_cobrancas WHERE status = 'ATRASADO'"
  );
  return rows;
}

export async function getCobrancasByInstallmentId(installmentId) {
  const { rows } = await pool.query(
    'SELECT * FROM alunos_cobrancas WHERE asaas_installment_id = $1 ORDER BY vencimento ASC',
    [installmentId]
  );
  return rows;
}

export async function updateCobrancaLinkCarne(installmentId, linkCarne) {
  await pool.query(
    'UPDATE alunos_cobrancas SET link_carne = $1 WHERE asaas_installment_id = $2',
    [linkCarne, installmentId]
  );
}

export async function updateCobrancaByField(field, id, updateData) {
  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(updateData)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
  }

  if (setClauses.length === 0) return;

  values.push(id);
  await pool.query(
    `UPDATE alunos_cobrancas SET ${setClauses.join(', ')} WHERE ${field} = $${i}`,
    values
  );
}

// ============================================================
// HELPERS: provas_submissoes
// ============================================================
export async function getSubmissoesByAluno(alunoId) {
  const { rows } = await pool.query(
    'SELECT * FROM provas_submissoes WHERE aluno_id = $1',
    [alunoId]
  );
  return rows;
}

export async function getSubmissaoByAlunoAndExam(alunoId, examId) {
  const { rows } = await pool.query(
    'SELECT id FROM provas_submissoes WHERE aluno_id = $1 AND prova_id = $2 LIMIT 1',
    [alunoId, examId]
  );
  return rows;
}

export async function insertSubmissao(submission) {
  await pool.query(
    `INSERT INTO provas_submissoes (aluno_id, prova_id, total_questoes, acertos, erros, percentual, nota_final, respostas, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      submission.aluno_id, submission.exam_id,
      submission.total_questions, submission.correct_count, submission.wrong_count,
      submission.percentage, submission.final_score,
      JSON.stringify(submission.answers_json), submission.created_at
    ]
  );
}

// ============================================================
// EXPORT POOL para queries diretas quando necessário
// ============================================================
export { pool };
export default pool;
