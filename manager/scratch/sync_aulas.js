import fs from 'fs';
const file = 'manager/services/database.js';
let content = fs.readFileSync(file, 'utf8');

const anchor = "    await client.query('COMMIT');";
const inject = `
    // --- SYNC AULAS ---
    if (schoolData.lessons && schoolData.lessons.length > 0) {
      for (const a of schoolData.lessons) {
        await client.query(
          \`INSERT INTO aulas (
            id, turma_id, data, horario_inicio, horario_fim, status, tipo, motivo_cancelamento, aula_original_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            turma_id = EXCLUDED.turma_id,
            data = EXCLUDED.data,
            horario_inicio = COALESCE(EXCLUDED.horario_inicio, aulas.horario_inicio),
            horario_fim = COALESCE(EXCLUDED.horario_fim, aulas.horario_fim),
            status = EXCLUDED.status,
            tipo = EXCLUDED.tipo,
            motivo_cancelamento = EXCLUDED.motivo_cancelamento,
            aula_original_id = COALESCE(EXCLUDED.aula_original_id, aulas.aula_original_id)\`,
          [
            a.id, a.classId, a.date, a.startTime || null, a.endTime || null, a.status || 'scheduled', a.type || 'regular',
            a.cancelReason || null, a.originalLessonId || null
          ]
        ).catch(err => console.warn(\`[Sync:Aulas] Erro na aula \${a.id}:\`, err.message));
      }
    }

    // --- SYNC FREQUENCIAS ---
    if (schoolData.attendance && schoolData.attendance.length > 0) {
      for (const f of schoolData.attendance) {
        await client.query(
          \`INSERT INTO frequencias (
            id, aula_id, turma_id, aluno_id, tipo, data_registro, url_anexo, justificado
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            tipo = EXCLUDED.tipo,
            url_anexo = COALESCE(EXCLUDED.url_anexo, frequencias.url_anexo),
            justificado = EXCLUDED.justificado\`,
          [
            f.id, f.lessonId, f.classId, f.studentId, f.type, f.date, f.attachment || null, f.justified || false
          ]
        ).catch(err => console.warn(\`[Sync:Freq] Erro na freq \${f.id}:\`, err.message));
      }
    }
` + "\n" + anchor;

if (content.includes(anchor) && !content.includes('SYNC AULAS')) {
    content = content.replace(anchor, inject);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Sync Aulas/Freq adicionado!");
} else {
    console.log("Falhou na busca da âncora ou já existe.");
}
