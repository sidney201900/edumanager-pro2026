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
    // 1. Fix frequencias table
    const { rows } = await pool.query("SELECT id, data FROM frequencias WHERE justificativa IS NOT NULL");
    let fixedFrequencias = 0;
    for (const row of rows) {
      // row.data might be a Date object or string depending on pg.
      const d = new Date(row.data);
      // If the hour is wrong, maybe we can just identify if it's not a round number or something?
      // Wait, we can't easily tell if it's wrong just by looking at it, because we don't know the original lesson time.
      console.log('Frequencia:', row.id, d.toISOString(), d.toLocaleTimeString());
    }
    
    // 2. Fix school_data JSON
    const { rows: sdRows } = await pool.query("SELECT data FROM school_data WHERE id = 1");
    if (sdRows.length > 0) {
      const data = sdRows[0].data;
      let fixed = 0;
      if (data.attendance) {
        data.attendance.forEach(a => {
          if (a.date && typeof a.date === 'string' && a.date.endsWith('Z')) {
            const d = new Date(a.date);
            const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('.')[0];
            a.date = localIso;
            fixed++;
            console.log('Fixed JSON date to:', localIso);
          }
        });
      }
      if (fixed > 0) {
         await pool.query("UPDATE school_data SET data = $1 WHERE id = 1", [data]);
         console.log(`Corrigidos ${fixed} registros no JSON school_data!`);
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
