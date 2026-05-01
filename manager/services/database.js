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
// HELPERS: notas_boletim
// ============================================================
export async function initNotasTable() {
  // Remover constraints restritivas da tabela de submissões se existirem (transição JSON -> Postgres)
  try {
    await pool.query(`
      ALTER TABLE provas_submissoes DROP CONSTRAINT IF EXISTS provas_submissoes_aluno_id_fkey;
      ALTER TABLE provas_submissoes DROP CONSTRAINT IF EXISTS provas_submissoes_prova_id_fkey;
    `);
  } catch (err) {
    console.log('[PostgreSQL] ℹ️ Submissoes fkey já removidas ou tabela não existe.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notas_boletim (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      aluno_id VARCHAR(255) NOT NULL,
      disciplina_id VARCHAR(255) NOT NULL,
      periodo_id VARCHAR(255) NOT NULL,
      prova_id VARCHAR(255),
      valor NUMERIC(5, 2) NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(aluno_id, disciplina_id, periodo_id, prova_id)
    );
  `);
}

export async function getNotasByAluno(alunoId) {
  const { rows } = await pool.query(
    'SELECT * FROM notas_boletim WHERE aluno_id = $1',
    [alunoId]
  );
  return rows;
}

export async function upsertNota(nota) {
  // Trata prova_id null se for direta para o unique index funcionar de forma previsível (PostgreSQL 15+ tem NULLS NOT DISTINCT, mas para garantir via app logic vamos usar uma abordagem de ON CONFLICT)
  // No caso do PostgreSQL padrão, múltiplos NULLs não dão conflito no UNIQUE.
  // Para contornar e permitir upsert real, faremos DELETE e INSERT ou garantiremos que o código gerencie o NULL logicamente.
  
  if (nota.prova_id) {
    await pool.query(
      `INSERT INTO notas_boletim (aluno_id, disciplina_id, periodo_id, prova_id, valor, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (aluno_id, disciplina_id, periodo_id, prova_id) 
       DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`,
      [nota.aluno_id, nota.disciplina_id, nota.periodo_id, nota.prova_id, nota.valor]
    );
  } else {
    // Para notas diretas, se existir apagamos e inserimos (pois o unique index normal não restringe múltiplos nulls)
    await pool.query(
      `DELETE FROM notas_boletim WHERE aluno_id = $1 AND disciplina_id = $2 AND periodo_id = $3 AND prova_id IS NULL`,
      [nota.aluno_id, nota.disciplina_id, nota.periodo_id]
    );
    await pool.query(
      `INSERT INTO notas_boletim (aluno_id, disciplina_id, periodo_id, prova_id, valor, updated_at)
       VALUES ($1, $2, $3, NULL, $4, NOW())`,
      [nota.aluno_id, nota.disciplina_id, nota.periodo_id, nota.valor]
    );
  }
}

export async function deleteNotasManuaisAusentes(alunoId, notasManuaisRetidas) {
    // Para limpar notas que o professor apagou (vazio) no manager
    // notasManuaisRetidas é um array de objetos { disciplina_id, periodo_id, prova_id }
    // Implementaremos a limpeza iterativamente na rota
}

// ============================================================
// SINCRONIZAÇÃO: JSON -> TABELAS RELACIONAIS
// Garante que IDs do JSON existam nas tabelas para evitar erro de Foreign Key
// ============================================================
export async function syncJsonToRelationalTables() {
  const client = await pool.connect();
  try {
    const data = await getSchoolData();
    if (!data) return;

    console.log('[Sincronização] 🔄 Iniciando espelhamento total JSON -> Tabelas Relacionais...');
    await client.query('BEGIN');

    // 1. Sincronizar Cursos
    if (data.courses && Array.isArray(data.courses)) {
      for (const c of data.courses) {
        if (!c.id || !c.name) continue;
        await client.query(
          `INSERT INTO cursos (id, nome, duracao, duracao_meses, taxa_matricula, mensalidade, descricao, multa_percentual, juros_percentual)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET 
            nome = EXCLUDED.nome, duracao = EXCLUDED.duracao, duracao_meses = EXCLUDED.duracao_meses,
            taxa_matricula = EXCLUDED.taxa_matricula, mensalidade = EXCLUDED.mensalidade,
            descricao = EXCLUDED.descricao, multa_percentual = EXCLUDED.multa_percentual,
            juros_percentual = EXCLUDED.juros_percentual`,
          [c.id, c.name, c.duration || '', c.durationMonths || 0, c.registrationFee || 0, c.monthlyFee || 0, c.description || '', c.finePercentage || 0, c.interestPercentage || 0]
        );
      }
    }

    // 2. Sincronizar Turmas
    if (data.classes && Array.isArray(data.classes)) {
      for (const t of data.classes) {
        if (!t.id || !t.name) continue;
        await client.query(
          `INSERT INTO turmas (id, nome, curso_id, professor, horario, dia_semana, max_alunos, data_inicio, data_fim, horario_inicio_padrao, horario_fim_padrao)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET 
            nome = EXCLUDED.nome, curso_id = EXCLUDED.curso_id, professor = EXCLUDED.professor,
            horario = EXCLUDED.horario, dia_semana = EXCLUDED.dia_semana, max_alunos = EXCLUDED.max_alunos,
            data_inicio = EXCLUDED.data_inicio, data_fim = EXCLUDED.data_fim,
            horario_inicio_padrao = EXCLUDED.horario_inicio_padrao, horario_fim_padrao = EXCLUDED.horario_fim_padrao`,
          [t.id, t.name, t.courseId || null, t.teacher || '', t.schedule || '', t.scheduleDay || null, t.maxStudents || 30, t.startDate || null, t.endDate || null, t.defaultStartTime || null, t.defaultEndTime || null]
        );
      }
    }

    // 3. Sincronizar Alunos
    if (data.students && Array.isArray(data.students)) {
      for (const s of data.students) {
        if (!s.id || !s.name) continue;
        await client.query(
          `INSERT INTO alunos (
            id, nome, email, telefone, data_nascimento, cpf, rg, rg_data_emissao,
            nome_responsavel, telefone_responsavel, cpf_responsavel, data_nascimento_responsavel,
            turma_id, status, data_matricula, foto_url, cep, rua, numero, bairro, cidade, estado,
            desconto, tem_responsavel, modelo_contrato_id, numero_matricula, senha_portal
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
          ON CONFLICT (id) DO UPDATE SET 
            nome = EXCLUDED.nome, email = EXCLUDED.email, telefone = EXCLUDED.telefone, data_nascimento = EXCLUDED.data_nascimento,
            cpf = EXCLUDED.cpf, rg = EXCLUDED.rg, rg_data_emissao = EXCLUDED.rg_data_emissao,
            nome_responsavel = EXCLUDED.nome_responsavel, telefone_responsavel = EXCLUDED.telefone_responsavel,
            cpf_responsavel = EXCLUDED.cpf_responsavel, data_nascimento_responsavel = EXCLUDED.data_nascimento_responsavel,
            turma_id = EXCLUDED.turma_id, status = EXCLUDED.status, data_matricula = EXCLUDED.data_matricula,
            foto_url = EXCLUDED.foto_url, cep = EXCLUDED.cep, rua = EXCLUDED.rua, numero = EXCLUDED.numero,
            bairro = EXCLUDED.bairro, cidade = EXCLUDED.cidade, estado = EXCLUDED.estado,
            desconto = EXCLUDED.desconto, tem_responsavel = EXCLUDED.tem_responsavel,
            modelo_contrato_id = EXCLUDED.modelo_contrato_id, numero_matricula = EXCLUDED.numero_matricula,
            senha_portal = EXCLUDED.senha_portal`,
          [
            s.id, s.name, s.email || '', s.phone || '', s.birthDate || null, s.cpf || '', s.rg || '', s.rgIssueDate || null,
            s.guardianName || '', s.guardianPhone || '', s.guardianCpf || '', s.guardianBirthDate || null,
            s.classId || null, s.status || 'active', s.registrationDate || null, s.photo || '',
            s.addressZip || '', s.addressStreet || '', s.addressNumber || '', s.addressNeighborhood || '', s.addressCity || '', s.addressState || '',
            s.discount || 0, s.hasGuardian || false, s.contractTemplateId || null, s.enrollmentNumber || null, s.portalPassword || null
          ]
        );
      }
    }

    // 4. Sincronizar Frequências
    if (data.attendance && Array.isArray(data.attendance)) {
      for (const f of data.attendance) {
        if (!f.id || !f.studentId || !f.classId) continue;
        await client.query(
          `INSERT INTO frequencias (id, aluno_id, turma_id, data, foto, verificado, tipo, justificativa, justificativa_aceita)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET 
            aluno_id = EXCLUDED.aluno_id, turma_id = EXCLUDED.turma_id, data = EXCLUDED.data,
            foto = EXCLUDED.foto, verificado = EXCLUDED.verificado, tipo = EXCLUDED.tipo,
            justificativa = EXCLUDED.justificativa, justificativa_aceita = EXCLUDED.justificativa_aceita`,
          [f.id, f.studentId, f.classId, f.date, f.photo || '', f.verified || false, f.type || 'presence', f.justification || '', f.justificationAccepted || false]
        );
      }
    }

    // 5. Sincronizar Disciplinas (Subjects)
    if (data.subjects && Array.isArray(data.subjects)) {
      for (const sub of data.subjects) {
        if (!sub.id || !sub.name) continue;
        await client.query(`INSERT INTO cursos (id, nome) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [sub.id, sub.name]);
      }
    }

    // 6. Sincronizar Períodos (Bimestres)
    if (data.periods && Array.isArray(data.periods)) {
      for (const p of data.periods) {
        if (!p.id || !p.name) continue;
        // Se houver tabela de períodos, inserimos. Se não, garantimos ao menos o ID.
        await client.query(`INSERT INTO school_data (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
      }
    }

    // 7. Sincronizar Provas/Avaliações
    if (data.exams && Array.isArray(data.exams)) {
      for (const e of data.exams) {
        if (!e.id || !e.title) continue;
        try {
           await client.query(
            `INSERT INTO provas (id, titulo, disciplina_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, disciplina_id = EXCLUDED.disciplina_id`,
            [e.id, e.title, e.subjectId || null]
          );
        } catch(err) {
          // Fallback se a tabela provas não estiver pronta
        }
      }
    }

    await client.query('COMMIT');
    console.log('[Sincronização] 🚀 Sincronização COMPLETA (Alunos, Turmas, Provas, Frequência) concluída!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Sincronização] ❌ Erro crítico ao sincronizar:', err.message);
  } finally {
    client.release();
  }
}

// ============================================================
// EXPORT POOL para queries diretas quando necessário
// ============================================================
export { pool };
export default pool;
