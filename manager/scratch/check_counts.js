import pg from 'pg';
const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@127.0.0.1:5432/edumanager';
const pool = new pg.Pool({ connectionString: DATABASE_URL });
async function check() {
  try {
    const { rows } = await pool.query(\"SELECT (data->'grades') as grades FROM school_data WHERE id = 1\");
    console.log('GRADES_JSON_COUNT:' + (rows[0]?.grades?.length || 0));
    const { rows: n } = await pool.query(\"SELECT count(*) FROM notas_boletim\");
    console.log('NOTAS_TABLE_COUNT:' + n[0].count);
  } catch (err) { console.log('ERROR:' + err.message); }
  finally { await pool.end(); }
}
check();
