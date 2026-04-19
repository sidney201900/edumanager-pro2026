// Script para criar a tabela provas_submissoes no Supabase
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ekbuvcjsfcczviqqlfit.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYnV2Y2pzZmNjenZpcXFsZml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTU0MzIsImV4cCI6MjA4NjU3MTQzMn0.oIzBeGF-PjaviZejYb1TeOOEzMm-Jjth1XzvJrjD6us'
);

async function createTable() {
  // Tenta inserir e ver o erro para confirmar que a tabela não existe
  const { data, error } = await supabase
    .from('provas_submissoes')
    .select('*')
    .limit(1);

  if (error) {
    console.log('❌ Tabela provas_submissoes NÃO existe.');
    console.log('Erro:', error.message);
    console.log('\n📋 Execute o seguinte SQL no painel do Supabase (SQL Editor):');
    console.log('='.repeat(60));
    console.log(`
CREATE TABLE provas_submissoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  wrong_count INTEGER NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  final_score NUMERIC(4,2) NOT NULL,
  answers_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permitir acesso via anon key
ALTER TABLE provas_submissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON provas_submissoes
  FOR ALL USING (true) WITH CHECK (true);
    `);
    console.log('='.repeat(60));
  } else {
    console.log('✅ Tabela provas_submissoes JÁ existe!');
    console.log('Dados:', data);
  }
}

createTable();
