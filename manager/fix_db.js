
const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgresql://edumanager:EduManager2026!Seguro@postgres:5432/edumanager' });
async function run() {
  try {
    await pool.query("ALTER TABLE provas ADD COLUMN IF NOT EXISTS allow_retake BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE provas ADD COLUMN IF NOT EXISTS evaluation_type TEXT DEFAULT 'exam'");
    await pool.query("ALTER TABLE provas ADD COLUMN IF NOT EXISTS max_score NUMERIC(5,2) DEFAULT 10.0");
    console.log('✅ Banco de dados atualizado!');
  } catch (e) { console.error(e); } finally { await pool.end(); }
}
run();
