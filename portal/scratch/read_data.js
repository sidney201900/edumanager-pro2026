import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpData() {
  console.log('--- Lendo Dados Reais do Supabase ---');
  
  const { data, error } = await supabase
    .from('school_data')
    .select('data')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }

  // Salvar em um arquivo temporário para análise
  fs.writeFileSync('scratch/db_dump.json', JSON.stringify(data.data, null, 2));
  console.log('✅ Dados salvos em scratch/db_dump.json para análise.');
  
  // Resumo para o log
  const d = data.data;
  console.log('Students:', d.students?.length);
  console.log('Lessons:', d.lessons?.length);
  console.log('Attendance:', d.attendance?.length);
  
  // Mostrar os últimos registros de attendance para ver o formato
  console.log('\nÚltimos 3 registros de Attendance:');
  console.log(JSON.stringify(d.attendance?.slice(-3), null, 2));
  
  // Mostrar uma aula de hoje se houver
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLesson = d.lessons?.find(l => l.date.includes(todayStr));
  if (todayLesson) {
    console.log('\nAula de hoje encontrada:', todayLesson);
  } else {
    console.log('\nNenhuma aula hoje no formato ISO:', todayStr);
    // Tentar formato BR
    const brDate = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const brLesson = d.lessons?.find(l => l.date.includes(brDate));
    if (brLesson) console.log('Aula de hoje encontrada (BR):', brLesson);
  }

  process.exit(0);
}

dumpData();
