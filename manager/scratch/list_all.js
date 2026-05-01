import pg from 'pg';
const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@127.0.0.1:5432/edumanager';
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function listAll() {
  try {
    const { rows: notas } = await pool.query('SELECT * FROM notas_boletim LIMIT 20');
    console.log('--- NOTAS NA TABELA ---');
    console.log(JSON.stringify(notas, null, 2));

    const { rows: subs } = await pool.query('SELECT * FROM provas_submissoes LIMIT 10');
    console.log('--- SUBMISSÕES NA TABELA ---');
    console.log(JSON.stringify(subs, null, 2));
  } catch (err) { console.log('ERROR:' + err.message); }
  finally { await pool.end(); }
}
listAll();
