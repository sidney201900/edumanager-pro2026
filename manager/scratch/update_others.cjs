const fs = require('fs');
const path = require('path');

function processFile(filename, replaceSubjects = false) {
  const filePath = path.join(__dirname, '../components', filename);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Inject states and fetch
  // Find a good place to inject. Usually after `const [isModalOpen, setIsModalOpen] = useState(false);` or similar.
  // We'll just look for a known pattern or add it at the top of the component.
  
  // We will find `const { showAlert, showConfirm } = useDialog();` and inject right after it
  const hookDecl = `const { showAlert, showConfirm } = useDialog();`;
  
  let fetchBlock = `
  const [dbClasses, setDbClasses] = useState<any[]>(data?.classes || []);
  const [dbCourses, setDbCourses] = useState<any[]>(data?.courses || []);
  ${replaceSubjects ? 'const [dbSubjects, setDbSubjects] = useState<any[]>(data?.subjects || []);' : ''}

  React.useEffect(() => {
    Promise.all([
      fetch('/api/turmas').catch(() => ({ ok: false, json: async () => ({}) })),
      fetch('/api/cursos').catch(() => ({ ok: false, json: async () => ({}) })),
      ${replaceSubjects ? "fetch('/api/disciplinas').catch(() => ({ ok: false, json: async () => ({}) }))" : ''}
    ]).then(async (responses) => {
      const [resT, resC${replaceSubjects ? ', resS' : ''}] = responses;
      if (resT && resT.ok) {
        const jsonT = await resT.json();
        if (jsonT.turmas) setDbClasses(jsonT.turmas.map((t: any) => ({
          id: t.id, name: t.nome, courseId: t.curso_id, maxStudents: Number(t.max_alunos || 0)
        })));
      }
      if (resC && resC.ok) {
        const jsonC = await resC.json();
        if (jsonC.cursos) setDbCourses(jsonC.cursos.map((c: any) => ({
          id: c.id, name: c.nome, monthlyFee: Number(c.mensalidade || 0), registrationFee: Number(c.taxa_matricula || 0)
        })));
      }
      ${replaceSubjects ? `
      if (resS && resS.ok) {
        const jsonS = await resS.json();
        if (jsonS.disciplinas) setDbSubjects(jsonS.disciplinas.map((d: any) => ({
          id: d.id, name: d.nome
        })));
      }
      ` : ''}
    }).catch(console.error);
  }, []);
  `;

  if (content.includes(hookDecl) && !content.includes('const [dbClasses')) {
    content = content.replace(hookDecl, hookDecl + '\n' + fetchBlock);
    
    // Replace usages
    content = content.replace(/data\.classes/g, 'dbClasses');
    content = content.replace(/data\.courses/g, 'dbCourses');
    if (replaceSubjects) {
      content = content.replace(/data\.subjects/g, 'dbSubjects');
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(filename + ' atualizado.');
  }
}

processFile('Finance.tsx', false);
processFile('Exams.tsx', true);
processFile('Contracts.tsx', false);
processFile('LessonSchedule.tsx', false);
processFile('AttendanceQuery.tsx', false);
processFile('Certificates.tsx', true);
processFile('Messages.tsx', false);
