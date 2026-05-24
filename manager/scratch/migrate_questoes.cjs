const { Pool } = require('pg');

const pool = new Pool({
  host: '150.230.87.131',
  port: 5432,
  database: 'edumanager',
  user: 'edumanager',
  password: 'EduManager2026!Seguro',
  ssl: false
});

async function migrateQuestoes() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT data FROM school_data LIMIT 1');
    if (!rows.length) { console.log('school_data vazio!'); return; }
    
    const exams = rows[0].data.exams || [];
    console.log(`\n📄 Verificando ${exams.length} provas no JSON...`);
    
    let totalQuestions = 0;
    let questionsMigrated = 0;

    for (const exam of exams) {
      if (!exam.questions || exam.questions.length === 0) continue;
      
      const pId = exam.id;
      // Verificar se a prova já existe no banco
      const checkProva = await client.query('SELECT id FROM provas WHERE id = $1', [pId]);
      if (checkProva.rows.length === 0) {
         console.warn(`Prova ${pId} não encontrada no BD SQL. Ignorando questoes.`);
         continue;
      }

      for (let i = 0; i < exam.questions.length; i++) {
        const q = exam.questions[i];
        totalQuestions++;
        try {
          await client.query(
            `INSERT INTO questoes_provas (id, prova_id, texto, opcoes, indice_correto, ordem, imagem_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [
              q.id || `q-${pId}-${i}`,
              pId,
              q.text || '',
              JSON.stringify(q.options || []),
              q.correctAnswer !== undefined ? parseInt(q.correctAnswer) : 0,
              i,
              q.imageUrl || null
            ]
          );
          questionsMigrated++;
        } catch (e) {
          console.warn(`Erro na questão ${q.id}: ${e.message}`);
        }
      }
    }
    
    console.log(`\n✅ Migração concluída: ${questionsMigrated}/${totalQuestions} questões migradas!`);

  } catch (err) {
    console.error('❌ ERRO:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateQuestoes();
