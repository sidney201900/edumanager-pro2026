const { Pool } = require('pg');

const pool = new Pool({
  host: '150.230.87.131',
  port: 5432,
  database: 'edumanager',
  user: 'edumanager',
  password: 'EduManager2026!Seguro',
  ssl: false
});

async function runAlter() {
  try {
    await pool.query("ALTER TABLE provas ADD COLUMN is_deleted BOOLEAN DEFAULT false");
    await pool.query("ALTER TABLE provas ADD COLUMN evaluation_type TEXT DEFAULT 'exam'");
    console.log("Colunas adicionadas!");
  } catch(e) {
    console.log(e.message);
  } finally {
    await pool.end();
  }
}
runAlter();
