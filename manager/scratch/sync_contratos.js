import fs from 'fs';
const file = 'manager/services/database.js';
let content = fs.readFileSync(file, 'utf8');

const anchor = "    // --- SYNC AULAS ---";
const inject = `
    // --- SYNC MODELOS CONTRATO ---
    if (schoolData.contractTemplates && schoolData.contractTemplates.length > 0) {
      for (const t of schoolData.contractTemplates) {
        await client.query(
          \`INSERT INTO modelos_contrato (id, nome, conteudo) VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET nome=EXCLUDED.nome, conteudo=EXCLUDED.conteudo\`,
          [t.id, t.name, t.content]
        ).catch(err => console.warn(\`[Sync:Modelos] Erro \${t.id}:\`, err.message));
      }
    }

    // --- SYNC CONTRATOS ---
    if (schoolData.contracts && schoolData.contracts.length > 0) {
      for (const c of schoolData.contracts) {
        await client.query(
          \`INSERT INTO contratos (id, aluno_id, titulo, conteudo, created_at) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET titulo=EXCLUDED.titulo, conteudo=EXCLUDED.conteudo\`,
          [c.id, c.studentId, c.title, c.content, c.createdAt]
        ).catch(err => console.warn(\`[Sync:Contratos] Erro \${c.id}:\`, err.message));
      }
    }
` + "\n" + anchor;

if (content.includes(anchor) && !content.includes('SYNC MODELOS CONTRATO')) {
    content = content.replace(anchor, inject);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Sync Contratos adicionado!");
} else {
    console.log("Falhou ou já existe.");
}
