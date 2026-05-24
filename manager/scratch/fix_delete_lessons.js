import fs from 'fs';
const file = 'manager/components/LessonSchedule.tsx';
let content = fs.readFileSync(file, 'utf8');

const match = content.match(/const handleDeleteAllSchedule = \(\) => \{.*?\n  \};/s);
if (match) {
    const original = match[0];
    const novo = `const handleDeleteAllSchedule = () => {
    showConfirm('Excluir Cronograma Completo', '⚠️ Tem certeza? Isso removerá TODAS as aulas desta turma permanentemente (agendadas, canceladas e reposições). Esta ação NÃO pode ser desfeita.', async () => {
      // Deletar do PostgreSQL
      const idsToDelete = dbLessons.map(l => l.id);
      if (idsToDelete.length > 0) {
        await fetch('/api/aulas/lote', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsToDelete })
        });
      }
      
      const updatedLessons = (data.lessons || []).filter(l => l.classId !== classObj.id);
      updateData({ lessons: updatedLessons });
      await dbService.saveData({ ...data, lessons: updatedLessons });
      await loadLessons();
      showAlert('Sucesso', 'Cronograma completo excluído.', 'success');
    });
  };`;
    content = content.replace(original, novo);
    fs.writeFileSync(file, content, 'utf8');
    console.log('handleDeleteAllSchedule atualizado!');
} else {
    console.log('handleDeleteAllSchedule não encontrado.');
}
