const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/Students.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Adicionar os states
const stateCode = `  const [isSaving, setIsSaving] = useState(false);

  const [dbClasses, setDbClasses] = useState<any[]>(data.classes || []);
  const [dbCourses, setDbCourses] = useState<any[]>(data.courses || []);

  useEffect(() => {
    Promise.all([
      fetch('/api/turmas'),
      fetch('/api/cursos')
    ]).then(async ([resT, resC]) => {
      if(resT.ok && resC.ok) {
        const jsonT = await resT.json();
        const jsonC = await resC.json();
        if (jsonT.turmas) setDbClasses(jsonT.turmas.map((t: any) => ({
          id: t.id, name: t.nome, courseId: t.curso_id, maxStudents: Number(t.max_alunos || 0)
        })));
        if (jsonC.cursos) setDbCourses(jsonC.cursos.map((c: any) => ({
          id: c.id, name: c.nome
        })));
      }
    }).catch(console.error);
  }, []);`;

content = content.replace('  const [isSaving, setIsSaving] = useState(false);', stateCode);

// Substituições seguras
content = content.replace(/data\.classes/g, 'dbClasses');
content = content.replace(/data\.courses/g, 'dbCourses');

// E arrumar uma possível falha caso haja "dbClasses" onde deveria ser data.classes no destructuring ou useEffect dependencias
// Por exemplo: se ele usava deepLinkClassId dependendo de data.classes
content = content.replace(/dbClasses, dbCourses, data\.students/g, 'dbClasses, dbCourses, data.students');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Students.tsx atualizado com sucesso.');
