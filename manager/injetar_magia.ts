import fs from 'fs';

async function migrarPelaWeb() {
  console.log('🚀 Preparando o envio de dados via Injeção Web (Driblando Firewall)...');

  // 1. Lendo os arquivos
  const sql = fs.readFileSync('../schema.sql', 'utf8');
  
  // Pegue o seu arquivo que já foi salvo!
  const arquivos = fs.readdirSync('.');
  const arquivoBackup = arquivos.find(a => a.startsWith('backup_supabase_') && a.endsWith('.json'));
  
  if (!arquivoBackup) {
    console.log('❌ O JSON de backup não foi encontrado na pasta manager!');
    return;
  }

  const jsonData = JSON.parse(fs.readFileSync(arquivoBackup, 'utf8'));

  // 2. Fazendo o Disparo para a WEB!!!
  console.log('🔥 Disparando os dados para a sua nuvem através da porta 443 liberada!');
  try {
    const payloadLength = JSON.stringify({ senha: 'magia2026', sql, jsonData }).length;
    console.log(`📦 Tamanho da carga: ${(payloadLength / 1024 / 1024).toFixed(2)} MB`);

    const response = await fetch('https://edumanager.microtecinformaticacurso.com.br/api/migracao-remota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senha: 'magia2026',
        sql: sql,
        jsonData: jsonData
      })
    });

    const resultado = await response.json();
    if (response.ok) {
      console.log('✅ SUCESSO ABSOLUTO:', resultado.message);
      console.log('O seu banco de dados na VPS está criado e populado! Pode abrir o sistema.');
    } else {
      console.log('⚠️ ALERTA:', resultado.error || resultado);
    }
  } catch (err) {
    console.error('❌ Falha na conexão HTTP:', err.message);
  }
}

migrarPelaWeb();
