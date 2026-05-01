
import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@postgres:5432/edumanager';
const pool = new Pool({
  connectionString: DATABASE_URL
});

async function test() {
  try {
    console.log('--- TESTANDO CONEXÃO ---');
    const { rows: tables } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tabelas encontradas:', tables.map(t => t.table_name).join(', '));

    console.log('\n--- CONTAGEM DE REGISTROS ---');
    const { rows: countSub } = await pool.query('SELECT COUNT(*) FROM provas_submissoes');
    console.log('Total em provas_submissoes:', countSub[0].count);

    const { rows: countNot } = await pool.query('SELECT COUNT(*) FROM notas_boletim');
    console.log('Total em notas_boletim:', countNot[0].count);

    if (countSub[0].count > 0) {
        const { rows: samples } = await pool.query('SELECT * FROM provas_submissoes LIMIT 1');
        console.log('\nExemplo de submissão:', samples[0]);
    }

  } catch (err) {
    console.error('ERRO NO TESTE:', err.message);
  } finally {
    await pool.end();
  }
}

test();
