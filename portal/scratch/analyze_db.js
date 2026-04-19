import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeDB() {
  console.log('--- Analisando Banco de Dados Supabase ---');
  
  // 1. Check school_data table
  const { data: schoolData, error: schoolError } = await supabase
    .from('school_data')
    .select('*');

  if (schoolError) {
    console.error('❌ Erro ao ler tabela school_data:', schoolError.message);
  } else {
    console.log(`✅ Tabela school_data: ${schoolData.length} registros encontrados.`);
    if (schoolData.length > 0) {
      const firstRow = schoolData[0];
      const data = firstRow.data || {};
      console.log('\n--- Estrutura do JSON school_data (Campos Principais) ---');
      console.log('Students:', data.students?.length || 0);
      console.log('Lessons:', data.lessons?.length || 0);
      console.log('Attendance:', data.attendance?.length || 0);
      console.log('Payments:', data.payments?.length || 0);
      console.log('Notifications:', data.notifications?.length || 0);
    }
  }

  // 2. Check boletos table
  const { data: boletos, error: boletosError } = await supabase
    .from('boletos')
    .select('count', { count: 'exact' });

  if (boletosError) {
    console.error('❌ Tabela boletos não encontrada ou erro:', boletosError.message);
  } else {
    console.log(`✅ Tabela boletos: ${boletos.length > 0 ? 'Exite' : 'Vazia'}`);
  }

  process.exit(0);
}

analyzeDB();
