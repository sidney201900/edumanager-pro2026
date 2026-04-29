import pg from 'pg';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://edumanager:EduManager2026!Seguro@postgres:5432/edumanager';
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function check() {
  try {
    const { rows } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'alunos_cobrancas'");
    console.log(rows.map(r => r.column_name).join(', '));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
    process.exit();
  }
}
check();
