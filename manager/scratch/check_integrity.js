
import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@localhost:5432/edumanager';
const pool = new Pool({
  connectionString: DATABASE_URL
});

async function test() {
  try {
    console.log('--- TESTANDO INTEGRIDADE ---');
    const { rows: countAlunos } = await pool.query('SELECT COUNT(*) FROM alunos');
    console.log('Total em alunos:', countAlunos[0].count);

    const { rows: countProvas } = await pool.query('SELECT COUNT(*) FROM provas');
    console.log('Total em provas:', countProvas[0].count);

    const { rows: countSub } = await pool.query('SELECT COUNT(*) FROM provas_submissoes');
    console.log('Total em provas_submissoes:', countSub[0].count);

  } catch (err) {
    console.error('ERRO NO TESTE:', err.message);
  } finally {
    await pool.end();
  }
}

test();
