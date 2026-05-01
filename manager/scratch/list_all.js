
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/edumanager'
});

async function check() {
  try {
    console.log('--- SUBMISSÕES NO BANCO ---');
    const { rows: subs } = await pool.query('SELECT aluno_id, prova_id, acertos, erros FROM provas_submissoes');
    console.log(JSON.stringify(subs, null, 2));

    console.log('\n--- NOTAS NO BOLETIM ---');
    const { rows: notas } = await pool.query('SELECT aluno_id, disciplina_id, periodo_id, prova_id, valor FROM notas_boletim');
    console.log(JSON.stringify(notas, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
