import pg from 'pg';
const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@localhost:5432/edumanager';
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function checkKeys() {
  const { rows } = await pool.query('SELECT data FROM school_data WHERE id = 1');
  if (rows[0]) {
    const data = rows[0].data;
    console.log('Keys in school_data.json:', Object.keys(data));
    if (data.students && Array.isArray(data.students)) {
      const studentWithPayments = data.students.find(s => s.payments && s.payments.length > 0);
      if (studentWithPayments) {
          console.log('Student found with payments. Student ID:', studentWithPayments.id);
          console.log('First payment keys:', Object.keys(studentWithPayments.payments[0]));
          console.log('First payment sample:', studentWithPayments.payments[0]);
      } else {
          console.log('No students found with payments array.');
      }
    }
  }
  await pool.end();
}
checkKeys();
