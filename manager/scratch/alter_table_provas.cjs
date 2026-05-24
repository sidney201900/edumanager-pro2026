const { pool } = require('./../services/database.js');

async function run() {
  try {
    await pool.query("ALTER TABLE provas ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE provas ADD COLUMN IF NOT EXISTS evaluation_type VARCHAR(50) DEFAULT 'exam'");
    console.log("Colunas is_deleted e evaluation_type adicionadas na tabela provas.");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
