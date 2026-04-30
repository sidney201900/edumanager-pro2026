import pg from 'pg';
const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@localhost:5432/edumanager';
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function checkExams() {
  try {
    const { rows } = await pool.query('SELECT data FROM school_data WHERE id = 1');
    const data = rows[0]?.data || {};
    const exams = data.exams || [];
    
    const pastaExam = exams.find(e => e.title && e.title.includes('Pastas'));
    
    if (pastaExam) {
      console.log('--- Atividade Encontrada ---');
      console.log('Título:', pastaExam.title);
      console.log('ID:', pastaExam.id);
      console.log('subjectId:', pastaExam.subjectId);
      console.log('periodId:', pastaExam.periodId);
      console.log('Status:', pastaExam.status);
      
      if (!pastaExam.subjectId || !pastaExam.periodId) {
        console.log('❌ ALERTA: Esta atividade está DESCONECTADA (sem subjectId ou periodId).');
      } else {
        console.log('✅ OK: Esta atividade está vinculada corretamente.');
      }
    } else {
      console.log('❌ Atividade "Pastas" não encontrada no school_data.');
      console.log('Títulos disponíveis:', exams.map(e => e.title));
    }

  } catch (err) {
    console.error('Erro na verificação:', err.message);
  } finally {
    await pool.end();
  }
}
checkExams();
