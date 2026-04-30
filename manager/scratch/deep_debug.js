import pg from 'pg';
const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@127.0.0.1:5432/edumanager';
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function debug() {
  try {
    const { rows: schoolRows } = await pool.query('SELECT data FROM school_data WHERE id = 1');
    const data = schoolRows[0]?.data || {};
    const sidney = (data.students || []).find(s => s.name && s.name.includes('Sidney'));
    
    if (!sidney) {
      console.log('Sidney não encontrado no JSON.');
    } else {
      console.log('ID do Sidney:', sidney.id);
      const { rows: notas } = await pool.query('SELECT * FROM notas_boletim WHERE aluno_id = $1', [sidney.id]);
      console.log('Notas na tabela SQL:', notas.length);
      console.log(JSON.stringify(notas, null, 2));
    }

    const { rows: allNotas } = await pool.query('SELECT count(*) FROM notas_boletim');
    console.log('Total de notas na tabela SQL:', allNotas[0].count);

  } catch (err) {
    console.error('ERRO:', err.message);
  } finally {
    await pool.end();
  }
}
debug();
