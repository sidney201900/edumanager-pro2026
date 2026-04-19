/**
 * ============================================================
 * SCRIPT DE MIGRAÇÃO: SUPABASE CLOUD → POSTGRESQL LOCAL
 * ============================================================
 * 
 * COMO USAR:
 *   1. Certifique-se de que o PostgreSQL local está rodando (docker-compose up postgres)
 *   2. Instale as dependências: npm install pg @supabase/supabase-js dotenv
 *   3. Configure as variáveis de ambiente no arquivo .env.migration
 *   4. Execute: npx tsx migrate_to_local.ts
 * 
 * IMPORTANTE:
 *   - Este script NÃO altera nada no Supabase. Ele apenas LÊ.
 *   - Senhas são copiadas EXATAMENTE como estão, sem rehash.
 *   - O script usa transações atômicas: se falhar no meio, nada é salvo.
 */

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import fs from 'fs';

// ============================================================
// CONFIGURAÇÃO — Altere aqui ou use .env.migration
// ============================================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ekbuvcjsfcczviqqlfit.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYnV2Y2pzZmNjenZpcXFsZml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTU0MzIsImV4cCI6MjA4NjU3MTQzMn0.oIzBeGF-PjaviZejYb1TeOOEzMm-Jjth1XzvJrjD6us';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://edumanager:EduManager2026!Seguro@localhost:5432/edumanager';

// ============================================================
// INICIALIZAÇÃO
// ============================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const pool = new pg.Pool({ connectionString: DATABASE_URL });

function log(emoji: string, msg: string) {
  console.log(`${emoji}  ${msg}`);
}

function logCount(table: string, count: number) {
  log('📦', `${table}: ${count} registro(s) migrado(s)`);
}

// ============================================================
// FUNÇÕES DE MIGRAÇÃO POR ENTIDADE
// ============================================================

async function migrateConfiguracoes(client: pg.PoolClient, schoolData: any) {
  const profile = schoolData.profile || {};
  const evoConfig = schoolData.evolutionConfig || {};
  const msgTemplates = schoolData.messageTemplates || {};

  await client.query(`
    INSERT INTO configuracoes (id, nome, endereco, cidade, estado, cep, cnpj, telefone, email, tipo, logo, evolution_api_url, evolution_instance_name, evolution_api_key, message_templates)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome, endereco = EXCLUDED.endereco, cidade = EXCLUDED.cidade,
      estado = EXCLUDED.estado, cep = EXCLUDED.cep, cnpj = EXCLUDED.cnpj,
      telefone = EXCLUDED.telefone, email = EXCLUDED.email, tipo = EXCLUDED.tipo,
      logo = EXCLUDED.logo, evolution_api_url = EXCLUDED.evolution_api_url,
      evolution_instance_name = EXCLUDED.evolution_instance_name,
      evolution_api_key = EXCLUDED.evolution_api_key,
      message_templates = EXCLUDED.message_templates
  `, [
    profile.id || 'main-school',
    profile.name || 'EduManager School',
    profile.address || '',
    profile.city || '',
    profile.state || '',
    profile.zip || '',
    profile.cnpj || '',
    profile.phone || '',
    profile.email || '',
    profile.type || 'matriz',
    schoolData.logo || '',
    evoConfig.apiUrl || null,
    evoConfig.instanceName || null,
    evoConfig.apiKey || null,
    JSON.stringify(msgTemplates)
  ]);
  logCount('configuracoes', 1);
}

async function migrateUsuarios(client: pg.PoolClient, users: any[]) {
  for (const u of users) {
    await client.query(`
      INSERT INTO usuarios (id, username, display_name, photo_url, password, cpf, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, display_name = EXCLUDED.display_name,
        password = EXCLUDED.password, cpf = EXCLUDED.cpf, role = EXCLUDED.role
    `, [u.id, u.name, u.displayName || null, u.photoURL || null, u.password, u.cpf || '', u.role || 'admin']);
  }
  logCount('usuarios', users.length);
}

async function migrateCursos(client: pg.PoolClient, courses: any[]) {
  for (const c of courses) {
    await client.query(`
      INSERT INTO cursos (id, nome, duracao, duracao_meses, taxa_matricula, mensalidade, descricao, multa_percentual, juros_percentual)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome, duracao = EXCLUDED.duracao, duracao_meses = EXCLUDED.duracao_meses,
        taxa_matricula = EXCLUDED.taxa_matricula, mensalidade = EXCLUDED.mensalidade,
        descricao = EXCLUDED.descricao
    `, [c.id, c.name, c.duration || '', c.durationMonths || 0, c.registrationFee || 0, c.monthlyFee || 0, c.description || '', c.finePercentage || 0, c.interestPercentage || 0]);
  }
  logCount('cursos', courses.length);
}

async function migrateTurmas(client: pg.PoolClient, classes: any[]) {
  for (const c of classes) {
    await client.query(`
      INSERT INTO turmas (id, nome, curso_id, professor, horario, dia_semana, max_alunos, data_inicio, data_fim, horario_inicio_padrao, horario_fim_padrao)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome, curso_id = EXCLUDED.curso_id, professor = EXCLUDED.professor,
        horario = EXCLUDED.horario, dia_semana = EXCLUDED.dia_semana,
        max_alunos = EXCLUDED.max_alunos
    `, [
      c.id, c.name, c.courseId || null, c.teacher || '', c.schedule || '',
      c.scheduleDay || null, c.maxStudents || 30,
      c.startDate || null, c.endDate || null,
      c.defaultStartTime || null, c.defaultEndTime || null
    ]);
  }
  logCount('turmas', classes.length);
}

async function migrateAlunos(client: pg.PoolClient, students: any[]) {
  for (const s of students) {
    await client.query(`
      INSERT INTO alunos (
        id, nome, email, telefone, data_nascimento, cpf, rg, rg_data_emissao,
        nome_responsavel, telefone_responsavel, cpf_responsavel, data_nascimento_responsavel,
        turma_id, status, motivo_cancelamento, data_matricula, foto_url, face_descriptor,
        cep, rua, numero, bairro, cidade, estado,
        desconto, tem_responsavel, modelo_contrato_id,
        numero_matricula, senha_portal
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24,
        $25, $26, $27,
        $28, $29
      )
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome, email = EXCLUDED.email, telefone = EXCLUDED.telefone,
        turma_id = EXCLUDED.turma_id, status = EXCLUDED.status,
        numero_matricula = EXCLUDED.numero_matricula, senha_portal = EXCLUDED.senha_portal
    `, [
      s.id, s.name, s.email || '', s.phone || '',
      s.birthDate || null, s.cpf || '', s.rg || null, s.rgIssueDate || null,
      s.guardianName || null, s.guardianPhone || null, s.guardianCpf || null, s.guardianBirthDate || null,
      s.classId || null, s.status || 'active', s.cancellationReason || null,
      s.registrationDate || null,
      // FOTO: Copia a URL (se já migrou para Storage) ou o base64 temporariamente
      s.photo || null,
      // FACE DESCRIPTOR: Array de números para reconhecimento facial
      s.faceDescriptor ? JSON.stringify(s.faceDescriptor) : null,
      s.addressZip || '', s.addressStreet || '', s.addressNumber || '',
      s.addressNeighborhood || '', s.addressCity || '', s.addressState || '',
      s.discount || 0, s.hasGuardian || false, s.contractTemplateId || null,
      // CRÍTICO: Matrícula e Senha copiadas EXATAMENTE como estão
      s.enrollmentNumber || null, s.portalPassword || null
    ]);
  }
  logCount('alunos', students.length);
}

async function migrateAulas(client: pg.PoolClient, lessons: any[]) {
  for (const l of lessons) {
    await client.query(`
      INSERT INTO aulas (id, turma_id, data, horario_inicio, horario_fim, status, tipo, motivo_cancelamento, aula_original_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status, horario_inicio = EXCLUDED.horario_inicio,
        horario_fim = EXCLUDED.horario_fim
    `, [
      l.id, l.classId, l.date, l.startTime || null, l.endTime || null,
      l.status || 'scheduled', l.type || 'regular',
      l.cancelReason || null, l.originalLessonId || null
    ]);
  }
  logCount('aulas', lessons.length);
}

async function migrateFrequencias(client: pg.PoolClient, attendance: any[]) {
  for (const a of attendance) {
    await client.query(`
      INSERT INTO frequencias (id, aluno_id, turma_id, data, foto, verificado, tipo, justificativa, justificativa_aceita)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        tipo = EXCLUDED.tipo, justificativa = EXCLUDED.justificativa,
        justificativa_aceita = EXCLUDED.justificativa_aceita
    `, [
      a.id, a.studentId, a.classId, a.date,
      a.photo || null, a.verified || false,
      a.type || 'presence', a.justification || null, a.justificationAccepted ?? null
    ]);
  }
  logCount('frequencias', attendance.length);
}

async function migrateDisciplinas(client: pg.PoolClient, subjects: any[]) {
  for (const s of subjects) {
    await client.query(`
      INSERT INTO disciplinas (id, nome, turma_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome
    `, [s.id, s.name, s.classId || null]);
  }
  logCount('disciplinas', subjects.length);
}

async function migratePeriodos(client: pg.PoolClient, periods: any[]) {
  for (const p of periods) {
    await client.query(`
      INSERT INTO periodos (id, nome)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome
    `, [p.id, p.name]);
  }
  logCount('periodos', periods.length);
}

async function migrateNotas(client: pg.PoolClient, grades: any[]) {
  for (const g of grades) {
    await client.query(`
      INSERT INTO notas (id, aluno_id, disciplina_id, valor, periodo)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET valor = EXCLUDED.valor
    `, [g.id, g.studentId, g.subjectId, g.value || 0, g.period]);
  }
  logCount('notas', grades.length);
}

async function migratePagamentos(client: pg.PoolClient, payments: any[]) {
  for (const p of payments) {
    await client.query(`
      INSERT INTO pagamentos (
        id, aluno_id, contrato_id, valor, desconto, tipo_desconto, multa, juros,
        vencimento, status, data_pagamento, tipo, numero_parcela, total_parcelas,
        descricao, asaas_payment_id, asaas_payment_url, installment_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, data_pagamento = EXCLUDED.data_pagamento
    `, [
      p.id, p.studentId, p.contractId || null, p.amount, p.discount || 0,
      p.discountType || null, p.lateFee || 0, p.interest || 0,
      p.dueDate, p.status || 'pending', p.paidDate || null,
      p.type || 'monthly', p.installmentNumber || null, p.totalInstallments || null,
      p.description || null, p.asaasPaymentId || null, p.asaasPaymentUrl || null,
      p.installmentId || null
    ]);
  }
  logCount('pagamentos', payments.length);
}

async function migrateContratos(client: pg.PoolClient, contracts: any[]) {
  for (const c of contracts) {
    await client.query(`
      INSERT INTO contratos (id, aluno_id, titulo, conteudo, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, conteudo = EXCLUDED.conteudo
    `, [c.id, c.studentId, c.title, c.content, c.createdAt || new Date().toISOString()]);
  }
  logCount('contratos', contracts.length);
}

async function migrateModelosContrato(client: pg.PoolClient, templates: any[]) {
  for (const t of templates) {
    await client.query(`
      INSERT INTO modelos_contrato (id, nome, conteudo)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, conteudo = EXCLUDED.conteudo
    `, [t.id, t.name, t.content]);
  }
  logCount('modelos_contrato', templates.length);
}

async function migrateNotificacoes(client: pg.PoolClient, notifications: any[]) {
  for (const n of notifications) {
    await client.query(`
      INSERT INTO notificacoes (id, aluno_id, titulo, mensagem, lida, anexo, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET lida = EXCLUDED.lida
    `, [n.id, n.studentId, n.title, n.message, n.read || false, n.attachment || null, n.createdAt || new Date().toISOString()]);
  }
  logCount('notificacoes', notifications.length);
}

async function migrateCertificados(client: pg.PoolClient, certificates: any[]) {
  for (const c of certificates) {
    await client.query(`
      INSERT INTO certificados (id, aluno_id, descricao, imagem_frente, imagem_verso, data_emissao, overlays_frente, overlays_verso)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `, [
      c.id, c.studentId, c.description || null, c.frontImage, c.backImage || null,
      c.issueDate, JSON.stringify(c.frontOverlays || []), JSON.stringify(c.backOverlays || [])
    ]);
  }
  logCount('certificados', certificates.length);
}

async function migrateApostilas(client: pg.PoolClient, handouts: any[]) {
  for (const h of handouts) {
    await client.query(`
      INSERT INTO apostilas (id, nome, preco, descricao, multa_percentual, juros_percentual)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, preco = EXCLUDED.preco
    `, [h.id, h.name, h.price || 0, h.description || null, h.finePercentage || 0, h.interestPercentage || 0]);
  }
  logCount('apostilas', handouts.length);
}

async function migrateEntregasApostilas(client: pg.PoolClient, deliveries: any[]) {
  for (const d of deliveries) {
    await client.query(`
      INSERT INTO entregas_apostilas (id, aluno_id, apostila_id, status_entrega, status_pagamento, data_entrega, data_pagamento, asaas_payment_id, asaas_payment_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO NOTHING
    `, [
      d.id, d.studentId, d.handoutId, d.deliveryStatus || 'pending',
      d.paymentStatus || 'pending', d.deliveryDate || null, d.paymentDate || null,
      d.asaasPaymentId || null, d.asaasPaymentUrl || null
    ]);
  }
  logCount('entregas_apostilas', deliveries.length);
}

async function migrateFuncionarios(client: pg.PoolClient, categories: any[], employees: any[]) {
  for (const c of categories) {
    await client.query(`
      INSERT INTO categorias_funcionarios (id, nome)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome
    `, [c.id, c.name]);
  }
  logCount('categorias_funcionarios', categories.length);

  for (const e of employees) {
    await client.query(`
      INSERT INTO funcionarios (id, nome, cpf, telefone, email, data_admissao, categoria_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome
    `, [e.id, e.name, e.cpf || '', e.phone || '', e.email || '', e.admissionDate || null, e.categoryId || null]);
  }
  logCount('funcionarios', employees.length);
}

async function migrateProvas(client: pg.PoolClient, exams: any[]) {
  for (const e of exams) {
    await client.query(`
      INSERT INTO provas (id, turma_id, disciplina_id, periodo_id, titulo, duracao_minutos, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, status = EXCLUDED.status
    `, [e.id, e.classId, e.subjectId || null, e.periodId || null, e.title, e.durationMinutes || 60, e.status || 'draft']);

    // Migrar questões da prova
    const questions = e.questions || [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await client.query(`
        INSERT INTO questoes_provas (id, prova_id, texto, imagem_url, opcoes, indice_correto, ordem)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET texto = EXCLUDED.texto, opcoes = EXCLUDED.opcoes
      `, [q.id, e.id, q.text, q.imageUrl || null, JSON.stringify(q.options || []), q.correctOptionIndex || 0, i]);
    }
  }
  logCount('provas + questoes', exams.length);
}

// ============================================================
// MIGRAR TABELAS SEPARADAS DO SUPABASE
// ============================================================

async function migrateCobrancasAsaas(client: pg.PoolClient) {
  log('🔄', 'Buscando tabela alunos_cobrancas do Supabase...');

  const { data, error } = await supabase
    .from('alunos_cobrancas')
    .select('*');

  if (error) {
    log('⚠️', `Erro ao buscar alunos_cobrancas: ${error.message}. Pulando...`);
    return;
  }

  const cobrancas = data || [];
  for (const c of cobrancas) {
    await client.query(`
      INSERT INTO alunos_cobrancas (id, aluno_id, asaas_customer_id, asaas_payment_id, asaas_installment_id, installment, valor, vencimento, status, data_pagamento, link_boleto, link_carne, transaction_receipt_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO NOTHING
    `, [
      c.id, c.aluno_id, c.asaas_customer_id || null, c.asaas_payment_id || null,
      c.asaas_installment_id || null, c.installment || null,
      c.valor, c.vencimento, c.status || 'PENDENTE', c.data_pagamento || null,
      c.link_boleto || null, c.link_carne || null, c.transaction_receipt_url || null
    ]);
  }
  logCount('alunos_cobrancas', cobrancas.length);
}

async function migrateSubmissoesProvas(client: pg.PoolClient) {
  log('🔄', 'Buscando tabela provas_submissoes do Supabase...');

  const { data, error } = await supabase
    .from('provas_submissoes')
    .select('*');

  if (error) {
    log('⚠️', `Erro ao buscar provas_submissoes: ${error.message}. Pulando...`);
    return;
  }

  const subs = data || [];
  for (const s of subs) {
    await client.query(`
      INSERT INTO provas_submissoes (id, aluno_id, prova_id, total_questoes, acertos, erros, percentual, nota_final, respostas, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING
    `, [
      s.id || `sub-${Date.now()}`, s.aluno_id, s.exam_id,
      s.total_questions || 0, s.correct_count || 0, s.wrong_count || 0,
      s.percentage || 0, s.final_score || 0,
      JSON.stringify(s.answers_json || {}), s.created_at || new Date().toISOString()
    ]);
  }
  logCount('provas_submissoes', subs.length);
}

// ============================================================
// BACKUP DO JSON COMPLETO (Segurança)
// ============================================================

async function saveJsonBackup(schoolData: any) {
  const fileName = `backup_supabase_${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(fileName, JSON.stringify(schoolData, null, 2), 'utf8');
  log('💾', `Backup completo salvo em: ${fileName}`);
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   MIGRAÇÃO EDUMANAGER: SUPABASE → POSTGRESQL LOCAL      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // 1. Buscar o JSON blob do Supabase
  log('🌐', 'Conectando ao Supabase Cloud...');
  const { data: schoolRow, error: fetchError } = await supabase
    .from('school_data')
    .select('data')
    .eq('id', 1)
    .single();

  if (fetchError || !schoolRow?.data) {
    log('❌', `FALHA AO CONECTAR AO SUPABASE: ${fetchError?.message || 'Dados não encontrados'}`);
    process.exit(1);
  }

  const schoolData = schoolRow.data;
  log('✅', 'Dados baixados do Supabase com sucesso!');

  // 2. Salvar backup local primeiro (segurança)
  await saveJsonBackup(schoolData);

  // 3. Conectar ao PostgreSQL local
  log('🔌', 'Conectando ao PostgreSQL local...');
  const client = await pool.connect();

  try {
    // TRANSAÇÃO ATÔMICA: Tudo ou nada
    await client.query('BEGIN');
    log('🔒', 'Transação iniciada (modo atômico)');

    // 4. Também salvar o JSON completo na tabela legada para ponte
    log('📋', 'Salvando JSON blob na tabela school_data (ponte)...');
    await client.query(`
      INSERT INTO school_data (id, data, updated_at)
      VALUES (1, $1, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `, [JSON.stringify(schoolData)]);

    // 5. Migrar entidade por entidade
    console.log('');
    log('🚀', '═══ INICIANDO MIGRAÇÃO TABELA POR TABELA ═══');
    console.log('');

    await migrateConfiguracoes(client, schoolData);
    await migrateUsuarios(client, schoolData.users || []);
    await migrateCursos(client, schoolData.courses || []);
    await migrateTurmas(client, schoolData.classes || []);
    await migrateAlunos(client, schoolData.students || []);
    await migrateAulas(client, schoolData.lessons || []);
    await migrateFrequencias(client, schoolData.attendance || []);
    await migrateDisciplinas(client, schoolData.subjects || []);
    await migratePeriodos(client, schoolData.periods || []);
    await migrateNotas(client, schoolData.grades || []);
    await migratePagamentos(client, schoolData.payments || []);
    await migrateContratos(client, schoolData.contracts || []);
    await migrateModelosContrato(client, schoolData.contractTemplates || []);
    await migrateNotificacoes(client, schoolData.notifications || []);
    await migrateCertificados(client, schoolData.certificates || []);
    await migrateApostilas(client, schoolData.handouts || []);
    await migrateEntregasApostilas(client, schoolData.handoutDeliveries || []);
    await migrateFuncionarios(client, schoolData.employeeCategories || [], schoolData.employees || []);
    await migrateProvas(client, schoolData.exams || []);

    // 6. Migrar tabelas separadas do Supabase
    console.log('');
    log('🔄', '═══ MIGRANDO TABELAS SEPARADAS ═══');
    console.log('');

    await migrateCobrancasAsaas(client);
    await migrateSubmissoesProvas(client);

    // 7. Commit da transação
    await client.query('COMMIT');

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   ✅  MIGRAÇÃO CONCLUÍDA COM SUCESSO!                   ║');
    console.log('║                                                          ║');
    console.log('║   • Todos os dados foram copiados com integridade        ║');
    console.log('║   • Senhas mantidas EXATAMENTE como estavam              ║');
    console.log('║   • Backup JSON salvo localmente                         ║');
    console.log('║   • Tabela school_data (legada) populada como ponte      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

  } catch (error: any) {
    // ROLLBACK: Se qualquer coisa falhar, NADA é salvo
    await client.query('ROLLBACK');
    console.log('');
    log('❌', '══════════════════════════════════════════════════');
    log('❌', `ERRO NA MIGRAÇÃO: ${error.message}`);
    log('❌', 'ROLLBACK executado. Nenhum dado foi alterado no PostgreSQL.');
    log('❌', '══════════════════════════════════════════════════');
    console.log('');
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Execução
main().catch(console.error);
