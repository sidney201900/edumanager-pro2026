import pg from 'pg';
const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@localhost:5432/edumanager';
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function check() {
  try {
    const { rows: notas } = await pool.query('SELECT count(*) FROM notas_boletim');
    console.log('Notas count in table:', notas[0].count);

    const { rows: sd } = await pool.query('SELECT data FROM school_data WHERE id = 1');
    const data = sd[0]?.data || {};
    console.log('Grades count in JSON:', data.grades?.length || 0);

  } catch (err) {
    console.error('Error during check:', err.message);
  } finally {
    await pool.end();
  }
}
check();
