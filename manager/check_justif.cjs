const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'edumanager',
  password: 'admin',
  port: 5432,
});

async function run() {
  try {
    const res = await pool.query("SELECT id, aluno_id, data, tipo, justificativa, justificativa_aceita FROM frequencias WHERE justificativa IS NOT NULL LIMIT 5;");
    console.log(JSON.stringify(res.rows, null, 2));
    
    // Check all attendance for a student with justification
    const res2 = await pool.query("SELECT * FROM frequencias WHERE aluno_id = (SELECT aluno_id FROM frequencias WHERE justificativa IS NOT NULL LIMIT 1) ORDER BY data DESC LIMIT 5");
    console.log("Student Recent:", JSON.stringify(res2.rows, null, 2));

  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
