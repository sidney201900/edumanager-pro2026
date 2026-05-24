const { Pool } = require('pg');

const pool = new Pool({
  host: '150.230.87.131',
  port: 5432,
  database: 'edumanager',
  user: 'edumanager',
  password: 'EduManager2026!Seguro',
  ssl: false
});

async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Ler school_data
    const { rows } = await client.query('SELECT data FROM school_data LIMIT 1');
    if (!rows.length) { console.log('school_data vazio!'); return; }
    const schoolData = rows[0].data;

    // Buscar turmas existentes para filtrar aulas órfãs
    const { rows: turmasRows } = await client.query('SELECT id FROM turmas');
    const turmaIds = new Set(turmasRows.map(r => r.id));
    console.log(`Turmas no banco: ${turmaIds.size} → ${[...turmaIds].join(', ')}`);

    // 2. Migrar Aulas (filtrando só as que têm turma válida)
    const lessons = schoolData.lessons || [];
    const validLessons = lessons.filter(a => turmaIds.has(a.classId));
    const orphanLessons = lessons.filter(a => !turmaIds.has(a.classId));
    console.log(`\n📅 Aulas totais: ${lessons.length} | Válidas: ${validLessons.length} | Órfãs (turma deletada): ${orphanLessons.length}`);
    
    if (orphanLessons.length > 0) {
      const orphanClasses = [...new Set(orphanLessons.map(l => l.classId))];
      console.log(`  ⚠️ IDs de turmas deletadas: ${orphanClasses.join(', ')}`);
    }

    let aulasOk = 0;
    for (const a of validLessons) {
      try {
        await client.query(
          `INSERT INTO aulas (id, turma_id, data, horario_inicio, horario_fim, status, tipo, motivo_cancelamento, aula_original_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [a.id, a.classId, a.date, a.startTime || null, a.endTime || null, a.status || 'scheduled', a.type || 'regular', a.cancelReason || null, a.originalLessonId || null]
        );
        aulasOk++;
      } catch (e) {
        console.warn(`  ⚠️ Aula ${a.id}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${aulasOk}/${validLessons.length} aulas migradas!`);

    // 3. Migrar Contratos
    const contracts = schoolData.contracts || [];
    console.log(`\n📝 Migrando ${contracts.length} contratos...`);
    let contratosOk = 0;
    for (const c of contracts) {
      try {
        await client.query(
          `INSERT INTO contratos (id, aluno_id, titulo, conteudo, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [c.id, c.studentId, c.title, c.content, c.createdAt || new Date().toISOString()]
        );
        contratosOk++;
      } catch (e) {
        console.warn(`  ⚠️ Contrato ${c.id}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${contratosOk}/${contracts.length} contratos migrados!`);

    // 4. Migrar Modelos de Contrato
    const templates = schoolData.contractTemplates || [];
    console.log(`\n📄 Migrando ${templates.length} modelos de contrato...`);
    let templatesOk = 0;
    for (const t of templates) {
      try {
        await client.query(
          `INSERT INTO modelos_contrato (id, nome, conteudo)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, conteudo=EXCLUDED.conteudo`,
          [t.id, t.name, t.content]
        );
        templatesOk++;
      } catch (e) {
        console.warn(`  ⚠️ Modelo ${t.id}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${templatesOk}/${templates.length} modelos migrados!`);

    // 5. Migrar Frequências
    const attendance = schoolData.attendance || [];
    console.log(`\n📋 Migrando ${attendance.length} registros de frequência...`);
    let freqOk = 0, freqSkip = 0;
    for (const f of attendance) {
      try {
        await client.query(
          `INSERT INTO frequencias (id, aula_id, turma_id, aluno_id, tipo, data_registro, url_anexo, justificado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [f.id, f.lessonId || null, f.classId || null, f.studentId, f.type, f.date, f.attachment || null, f.justified || false]
        );
        freqOk++;
      } catch (e) {
        freqSkip++;
      }
    }
    console.log(`  ✅ ${freqOk}/${attendance.length} frequências migradas! (${freqSkip} ignoradas)`);

    // Verificação Final
    const checkAulas = await client.query('SELECT COUNT(*) as c FROM aulas');
    const checkContratos = await client.query('SELECT COUNT(*) as c FROM contratos');
    const checkModelos = await client.query('SELECT COUNT(*) as c FROM modelos_contrato');
    const checkFreq = await client.query('SELECT COUNT(*) as c FROM frequencias');
    
    console.log('\n🎯 VERIFICAÇÃO FINAL:');
    console.log(`   Aulas no banco: ${checkAulas.rows[0].c}`);
    console.log(`   Contratos no banco: ${checkContratos.rows[0].c}`);
    console.log(`   Modelos no banco: ${checkModelos.rows[0].c}`);
    console.log(`   Frequências no banco: ${checkFreq.rows[0].c}`);
    console.log('\n✅ Migração completa!');

  } catch (err) {
    console.error('❌ ERRO FATAL:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
