const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ekbuvcjsfcczviqqlfit.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYnV2Y2pzZmNjenZpcXFsZml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTU0MzIsImV4cCI6MjA4NjU3MTQzMn0.oIzBeGF-PjaviZejYb1TeOOEzMm-Jjth1XzvJrjD6us'
);

async function checkStructure() {
  console.log('--- Analisando Supabase ---');
  
  // Tenta ler as colunas usando a API do PostgREST
  const { data, error } = await supabase
    .from('provas_submissoes')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Erro ao acessar tabela:', error.message);
    if (error.message.includes('column')) {
        console.log('Dica: Alguma coluna solicitada não existe.');
    }
  } else {
    console.log('✅ Tabela acessível!');
    if (data.length > 0) {
        console.log('Colunas encontradas no primeiro registro:', Object.keys(data[0]));
    } else {
        console.log('Tabela está vazia, mas existe.');
    }
  }
}

checkStructure();
