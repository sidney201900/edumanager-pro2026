
import pkg from 'pg';
const { Pool } = pkg;

const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@localhost:5432/edumanager';
const pool = new Pool({ connectionString: DATABASE_URL });

async function runDiag() {
  try {
    const { rows } = await pool.query('SELECT data FROM school_data WHERE id = 1');
    const data = rows[0]?.data || {};
    
    console.log('--- DIAGNÓSTICO DE SINCRONIZAÇÃO ---');
    
    // 1. Verificar Alunos
    const jsonStudents = data.students || [];
    const { rows: dbStudents } = await pool.query('SELECT id, nome FROM alunos');
    console.log(`JSON: ${jsonStudents.length} alunos | DB: ${dbStudents.length} alunos`);
    
    if (jsonStudents.length > 0) {
       const sample = jsonStudents[0];
       const inDb = dbStudents.find(s => s.id === sample.id);
       console.log(`Exemplo Aluno [${sample.name}]: ${inDb ? '✅ No DB' : '❌ NÃO ESTÁ NO DB'}`);
       
       // Verificar campos específicos do primeiro aluno
       if (inDb) {
          const { rows: fullStudent } = await pool.query('SELECT * FROM alunos WHERE id = $1', [sample.id]);
          const dbS = fullStudent[0];
          console.log('--- Comparação de Campos (Exemplo) ---');
          console.log(`CPF: JSON[${sample.cpf || '?'}] vs DB[${dbS.cpf || '?'}]`);
          console.log(`Telefone: JSON[${sample.phone || '?'}] vs DB[${dbS.telefone || '?'}]`);
          console.log(`Status: JSON[${sample.status || '?'}] vs DB[${dbS.status || '?'}]`);
       }
    }

    // 2. Verificar Turmas
    const jsonClasses = data.classes || [];
    const { rows: dbClasses } = await pool.query('SELECT COUNT(*) FROM turmas');
    console.log(`JSON: ${jsonClasses.length} turmas | DB: ${dbClasses[0].count} turmas`);

    // 3. Verificar Provas
    const jsonExams = data.exams || [];
    const { rows: dbExams } = await pool.query('SELECT COUNT(*) FROM provas');
    console.log(`JSON: ${jsonExams.length} provas | DB: ${dbExams[0].count} provas`);

  } catch (err) {
    console.error('Erro no diagnóstico:', err.message);
  } finally {
    await pool.end();
  }
}

runDiag();
