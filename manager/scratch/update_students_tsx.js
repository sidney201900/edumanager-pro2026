import fs from 'fs';
import path from 'path';

const filePath = 'manager/components/Students.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. ADICIONAR ESTADO dbStudents E LOAD
const stateAnchor = "  const [dbClasses, setDbClasses] = useState<any[]>(dbClasses || []);";
if(content.includes(stateAnchor) && !content.includes("const [dbStudents, setDbStudents]")) {
  const injection = `  const [dbStudents, setDbStudents] = useState<any[]>([]);

  const loadStudents = async () => {
    try {
      const res = await fetch('/api/alunos');
      if (res.ok) {
        const json = await res.json();
        setDbStudents(json.alunos || []);
      }
    } catch(e) { console.error(e); }
  };

  useEffect(() => { loadStudents(); }, []);

` + stateAnchor;
  content = content.replace(stateAnchor, injection);
}

// 2. SUBSTITUIR data.students POR dbStudents EM LEITURAS (menos nas props)
// cuidado para nao substituir data.students.find no deepLink se nao carregar dbStudents antes
content = content.replace(/data\.students\.find/g, 'dbStudents.find');
content = content.replace(/data\.students\.filter/g, 'dbStudents.filter');
content = content.replace(/data\.students\.reduce/g, 'dbStudents.reduce');
content = content.replace(/data\.students\.length/g, 'dbStudents.length');
content = content.replace(/data\.students\.map/g, 'dbStudents.map');

// 3. ATUALIZAR handleSave PARA USAR API
const saveAnchor1 = `    if (editingStudent) {
      updatedStudents = data.students.map(s => 
        s.id === editingStudent.id ? studentToSave : s
      );
    } else {
      updatedStudents = [...data.students, studentToSave];
    }`;

const saveReplace1 = `    // Salvar no Backend via API (Fase 4)
    try {
      const isNew = !editingStudent;
      const endpoint = isNew ? '/api/alunos' : \`/api/alunos/\${studentToSave.id}\`;
      const method = isNew ? 'POST' : 'PUT';
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentToSave)
      });
      
      if (!response.ok) throw new Error('Erro ao salvar no backend');
      
      await loadStudents(); // Recarrega lista
    } catch(e) {
      console.error(e);
      showAlert('Erro', 'Falha ao salvar aluno no banco de dados.', 'error');
      return;
    }
    
    // Fallback retrocompatibilidade - remover depois que tudo for SQL
    if (editingStudent) {
      updatedStudents = data.students.map(s => s.id === editingStudent.id ? studentToSave : s);
    } else {
      updatedStudents = [...data.students, studentToSave];
    }`;
content = content.replace(saveAnchor1, saveReplace1);

// 4. ATUALIZAR handleDelete PARA USAR API (linha 968)
const delAnchor1 = `  const handleDelete = (student: Student) => {
    showConfirm(
      'Mover para Inativos',
      \`Tem certeza que deseja inativar o(a) aluno(a) \${student.name}?\`,
      () => {
        const updatedStudents = data.students.map(s =>
          s.id === student.id ? { ...s, status: 'cancelled', cancellationReason: cancellationReason || 'Cancelado pelo administrador' } : s
        );
        updateData({ students: updatedStudents });
        dbService.saveData({ ...data, students: updatedStudents });
        closeDeleteModal();
        showAlert('Sucesso', 'Aluno(a) inativado(a) com sucesso!', 'success');
      }
    );
  };`;

const delReplace1 = `  const handleDelete = (student: Student) => {
    showConfirm(
      'Mover para Inativos',
      \`Tem certeza que deseja inativar o(a) aluno(a) \${student.name}?\`,
      async () => {
        try {
          // Atualiza status via PUT
          const updated = { ...student, status: 'cancelled', cancellationReason: cancellationReason || 'Cancelado pelo administrador' };
          await fetch(\`/api/alunos/\${student.id}\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          });
          await loadStudents();
          
          // Legacy update
          const updatedStudents = data.students.map(s => s.id === student.id ? updated : s);
          updateData({ students: updatedStudents });
          dbService.saveData({ ...data, students: updatedStudents });
          
          closeDeleteModal();
          showAlert('Sucesso', 'Aluno(a) inativado(a) com sucesso!', 'success');
        } catch(e) {
          showAlert('Erro', 'Falha ao inativar aluno.', 'error');
        }
      }
    );
  };`;
content = content.replace(delAnchor1, delReplace1);

// 5. ATUALIZAR handleDeletePermanently PARA USAR API (linha 1029)
const delPermAnchor = `  const handleDeletePermanently = (student: Student) => {
    showConfirm(
      'Exclusão Permanente',
      \`Tem certeza que deseja excluir \${student.name} DEFINITIVAMENTE?\`,
      () => {
        const updatedStudents = data.students.filter(s => s.id !== student.id);
        updateData({ students: updatedStudents });
        dbService.saveData({ ...data, students: updatedStudents });
        
        closeDeleteModal();
        showAlert('Sucesso', 'Aluno(a) excluído(a) com sucesso!', 'success');
      }
    );
  };`;
  
const delPermReplace = `  const handleDeletePermanently = (student: Student) => {
    showConfirm(
      'Exclusão Permanente',
      \`Tem certeza que deseja excluir \${student.name} DEFINITIVAMENTE?\`,
      async () => {
        try {
          await fetch(\`/api/alunos/\${student.id}\`, { method: 'DELETE' });
          await loadStudents();
          
          const updatedStudents = data.students.filter(s => s.id !== student.id);
          updateData({ students: updatedStudents });
          dbService.saveData({ ...data, students: updatedStudents });
          
          closeDeleteModal();
          showAlert('Sucesso', 'Aluno(a) excluído(a) com sucesso!', 'success');
        } catch(e) {
          showAlert('Erro', 'Falha ao excluir permanentemente.', 'error');
        }
      }
    );
  };`;
content = content.replace(delPermAnchor, delPermReplace);

// 6. ATUALIZAR handleRematricular PARA USAR API
const rematAnchor = `  const handleRematricular = async (student: Student) => {
    showConfirm(
      'Reativar Matrícula',
      \`Tem certeza que deseja reativar a matrícula de \${student.name}?\`,
      async () => {
        const updatedStudents = data.students.map(s =>
          s.id === student.id ? { ...s, status: 'active', cancellationReason: undefined } : s
        );
        updateData({ students: updatedStudents });
        await dbService.saveData({ ...data, students: updatedStudents });
        showAlert('Sucesso', 'Matrícula reativada com sucesso!', 'success');
      }
    );
  };`;
const rematReplace = `  const handleRematricular = async (student: Student) => {
    showConfirm(
      'Reativar Matrícula',
      \`Tem certeza que deseja reativar a matrícula de \${student.name}?\`,
      async () => {
        try {
          const updated = { ...student, status: 'active', cancellationReason: undefined };
          await fetch(\`/api/alunos/\${student.id}\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          });
          await loadStudents();
          
          const updatedStudents = data.students.map(s => s.id === student.id ? updated : s);
          updateData({ students: updatedStudents });
          await dbService.saveData({ ...data, students: updatedStudents });
          showAlert('Sucesso', 'Matrícula reativada com sucesso!', 'success');
        } catch(e) {
          showAlert('Erro', 'Erro ao reativar', 'error');
        }
      }
    );
  };`;
content = content.replace(rematAnchor, rematReplace);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Students.tsx atualizado com sucesso.');
