import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../components/Exams.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Injetar estado
const stateHook = `  const [dbSubjects, setDbSubjects] = useState<any[]>(data?.subjects || []);`;
const newState = `  const [dbSubjects, setDbSubjects] = useState<any[]>(data?.subjects || []);
  const [dbExams, setDbExams] = useState<Exam[]>(data.exams || []);

  const loadExams = async () => {
    try {
      const res = await fetch('/api/provas');
      if (res.ok) {
        const { provas } = await res.json();
        setDbExams(provas.map((p: any) => ({
          id: p.id,
          classId: p.turma_id,
          subjectId: p.disciplina_id,
          periodId: p.periodo_id,
          title: p.titulo,
          durationMinutes: p.duracao_minutos,
          status: p.status,
          allowRetake: p.permitir_refacao,
          isDeleted: p.is_deleted,
          evaluationType: p.evaluation_type || 'exam',
          questions: [] // questoes carregadas sob demanda
        })));
      }
    } catch(e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    loadExams();
  }, []);`;
content = content.replace(stateHook, newState);

// 2. Substituir \`const exams = data.exams || [];\`
content = content.replace('const exams = data.exams || [];', 'const exams = dbExams || [];');

// 3. Substituir \`handleEditExam\`
const oldEdit = `  const handleEditExam = (exam: Exam) => {
    setEditingExam({ ...exam });
    setCurrentView('builder');
  };`;
const newEdit = `  const handleEditExam = async (exam: Exam) => {
    try {
      showAlert('Carregando...', 'Buscando questões da avaliação.', 'info');
      const res = await fetch(\`/api/provas/\${exam.id}/questoes\`);
      if (res.ok) {
        const { questoes } = await res.json();
        const mappedQuestions = (questoes || []).map((q: any) => ({
          id: q.id,
          text: q.texto,
          options: typeof q.opcoes === 'string' ? JSON.parse(q.opcoes) : q.opcoes,
          correctOptionIndex: q.indice_correto,
          imageUrl: q.imagem_url
        }));
        setEditingExam({ ...exam, questions: mappedQuestions });
        setCurrentView('builder');
      } else {
        showAlert('Erro', 'Não foi possível carregar as questões desta prova.', 'error');
      }
    } catch(e) {
      showAlert('Erro', 'Erro de conexão.', 'error');
    }
  };`;
content = content.replace(oldEdit, newEdit);

// 4. Substituir funções de save/delete
content = content.replace(
  `  const handleToggleRetake = (examId: string) => {
    const updatedExams = exams.map(e => {
      if (e.id === examId) {
        return { ...e, allowRetake: !e.allowRetake };
      }
      return e;
    });
    updateData({ exams: updatedExams });
    dbService.saveData({ ...data, exams: updatedExams });
  };`,
  `  const handleToggleRetake = async (examId: string) => {
    const exam = exams.find(e => e.id === examId);
    if(!exam) return;
    try {
      const updated = { ...exam, allowRetake: !exam.allowRetake };
      await fetch(\`/api/provas/\${examId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      await loadExams();
    } catch(e) { console.error(e); }
  };`
);

content = content.replace(
  `  const handleDeleteExam = (examId: string) => {
    showConfirm(
      'Mover para Lixeira',
      'Tem certeza que deseja mover esta avaliação para a lixeira? Ela será ocultada para os alunos, mas as notas no boletim continuarão intactas.',
      () => {
        const updatedExams = exams.map(e => e.id === examId ? { ...e, isDeleted: true } : e);
        updateData({ exams: updatedExams });
        dbService.saveData({ ...data, exams: updatedExams });
        showAlert('Sucesso', 'Avaliação movida para a lixeira.', 'success');
      }
    );
  };`,
  `  const handleDeleteExam = (examId: string) => {
    showConfirm(
      'Mover para Lixeira',
      'Tem certeza que deseja mover esta avaliação para a lixeira? Ela será ocultada para os alunos, mas as notas no boletim continuarão intactas.',
      async () => {
        const exam = exams.find(e => e.id === examId);
        if(!exam) return;
        try {
          await fetch(\`/api/provas/\${examId}\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...exam, isDeleted: true })
          });
          await loadExams();
          showAlert('Sucesso', 'Avaliação movida para a lixeira.', 'success');
        } catch(e) {}
      }
    );
  };`
);

content = content.replace(
  `  const handleRestoreExam = (examId: string) => {
    const updatedExams = exams.map(e => e.id === examId ? { ...e, isDeleted: false } : e);
    updateData({ exams: updatedExams });
    dbService.saveData({ ...data, exams: updatedExams });
    showAlert('Sucesso', 'Avaliação reativada.', 'success');
  };`,
  `  const handleRestoreExam = async (examId: string) => {
    const exam = exams.find(e => e.id === examId);
    if(!exam) return;
    try {
      await fetch(\`/api/provas/\${examId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...exam, isDeleted: false })
      });
      await loadExams();
      showAlert('Sucesso', 'Avaliação reativada.', 'success');
    } catch(e) {}
  };`
);

const oldSave = `  const handleSave = (status: 'draft' | 'published') => {
    if (!editingExam) return;

    if (!editingExam.title || !editingExam.classId) {
      showAlert('Atenção', 'Preencha o título e a turma antes de salvar.', 'warning');
      return;
    }

    if (status === 'published' && (!editingExam.subjectId || !editingExam.periodId)) {
      showAlert(
        'Vínculo Obrigatório',
        'Para PUBLICAR a avaliação e permitir que as notas entrem no Boletim Escolar, você precisa vincular uma Disciplina e um Período.',
        'warning'
      );
      return;
    }

    const finalExam = { ...editingExam, status };
    const currentExams = data.exams || [];
    const existingIndex = currentExams.findIndex(e => e.id === finalExam.id);

    let newExams;
    if (existingIndex >= 0) {
      newExams = [...currentExams];
      newExams[existingIndex] = finalExam;
    } else {
      newExams = [...currentExams, finalExam];
    }

    updateData({ exams: newExams });
    setCurrentView('list');
    setEditingExam(null);
  };`;
const newSave = `  const handleSave = async (status: 'draft' | 'published') => {
    if (!editingExam) return;

    if (!editingExam.title || !editingExam.classId) {
      showAlert('Atenção', 'Preencha o título e a turma antes de salvar.', 'warning');
      return;
    }

    if (status === 'published' && (!editingExam.subjectId || !editingExam.periodId)) {
      showAlert(
        'Vínculo Obrigatório',
        'Para PUBLICAR a avaliação e permitir que as notas entrem no Boletim Escolar, você precisa vincular uma Disciplina e um Período.',
        'warning'
      );
      return;
    }

    const finalExam = { ...editingExam, status };
    const isNew = !exams.find(e => e.id === finalExam.id);

    try {
      showAlert('Aguarde', 'Salvando avaliação...', 'info');
      // 1. Salva prova
      await fetch(isNew ? '/api/provas' : \`/api/provas/\${finalExam.id}\`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalExam)
      });

      // 2. Salva questoes
      await fetch(\`/api/provas/\${finalExam.id}/questoes\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questoes: finalExam.questions })
      });

      await loadExams();
      setCurrentView('list');
      setEditingExam(null);
      showAlert('Sucesso', 'Avaliação salva com sucesso!', 'success');
    } catch(e) {
      showAlert('Erro', 'Falha ao salvar avaliação.', 'error');
    }
  };`;
content = content.replace(oldSave, newSave);

const oldDup = `  const handleDuplicateExam = () => {
    if (!duplicatingExam || !targetClassId) return;

    const newExam: Exam = {
      ...duplicatingExam,
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      classId: targetClassId,
      status: 'draft', // Sempre começa como rascunho para segurança
      title: \`\${duplicatingExam.title} (Cópia)\`
    };

    const updatedExams = [...exams, newExam];
    updateData({ exams: updatedExams });
    dbService.saveData({ ...data, exams: updatedExams });
    
    setDuplicatingExam(null);
    setTargetClassId('');
    showAlert('Sucesso', 'Avaliação duplicada com sucesso!', 'success');
  };`;
const newDup = `  const handleDuplicateExam = async () => {
    if (!duplicatingExam || !targetClassId) return;

    try {
      // 1. Busca questoes originais
      const res = await fetch(\`/api/provas/\${duplicatingExam.id}/questoes\`);
      const { questoes } = await res.json();
      
      const newExam: Exam = {
        ...duplicatingExam,
        id: crypto.randomUUID(),
        classId: targetClassId,
        status: 'draft',
        title: \`\${duplicatingExam.title} (Cópia)\`
      };

      await fetch('/api/provas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExam)
      });
      
      // 2. Sincroniza as questões no novo id
      await fetch(\`/api/provas/\${newExam.id}/questoes\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questoes: questoes || [] }) 
      });
      
      await loadExams();
      setDuplicatingExam(null);
      setTargetClassId('');
      showAlert('Sucesso', 'Avaliação duplicada com sucesso!', 'success');
    } catch(e) {
      showAlert('Erro', 'Falha ao duplicar prova.', 'error');
    }
  };`;
content = content.replace(oldDup, newDup);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Exams.tsx atualizado com sucesso.');
