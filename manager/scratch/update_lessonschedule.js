import fs from 'fs';
const file = 'manager/components/LessonSchedule.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Injetar estado dbLessons
if (!content.includes('dbLessons')) {
  content = content.replace(
    "const [dbClasses, setDbClasses] = useState<any[]>(data?.classes || []);",
    `const [dbLessons, setDbLessons] = useState<Lesson[]>([]);
  const loadLessons = async () => {
    try {
      const res = await fetch(\`/api/aulas?turma_id=\${classObj.id}\`);
      if (res.ok) {
        const json = await res.json();
        setDbLessons(json.aulas || []);
      }
    } catch(e) { console.error(e); }
  };
  React.useEffect(() => { loadLessons(); }, [classObj.id]);
  const [dbClasses, setDbClasses] = useState<any[]>(data?.classes || []);`
  );
}

// 2. Substituir leituras locais: 
// No componente LessonSchedule.tsx, "classLessons" lia de data.lessons.
// "const classLessons = (data.lessons || [])" 
// vamos alterar para usar dbLessons.
content = content.replace(/const classLessons = \(data\.lessons \|\| \[\]\)/g, "const classLessons = dbLessons");
content = content.replace(/\(data\.lessons \|\| \[\]\)\.find/g, "dbLessons.find");

// 3. Substituir no Generate
content = content.replace(
  "const updatedLessons = [...(data.lessons || []), ...newLessons];",
  `// Salvar no Banco
    fetch('/api/aulas/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aulas: newLessons })
    }).then(() => loadLessons());
    
    const updatedLessons = [...(data.lessons || []), ...newLessons];`
);

// 4. Substituir nos Cancelamentos
content = content.replace(
  "const updatedLessons: Lesson[] = (data.lessons || []).map(l =>",
  `const updatedLessons: Lesson[] = dbLessons.map(l =>`
);
content = content.replace(
  "updateData({ lessons: updatedLessons, notifications: updatedNotifications });\n    await dbService.saveData({ ...data, lessons: updatedLessons, notifications: updatedNotifications });",
  `fetch('/api/aulas/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aulas: updatedLessons })
    }).then(() => loadLessons());
    updateData({ lessons: [...(data.lessons || []).filter(dl => dl.classId !== classObj.id), ...updatedLessons], notifications: updatedNotifications });
    await dbService.saveData({ ...data, lessons: [...(data.lessons || []).filter(dl => dl.classId !== classObj.id), ...updatedLessons], notifications: updatedNotifications });`
);

content = content.replace(
  "updateData({ lessons: updatedLessons });\n    await dbService.saveData({ ...data, lessons: updatedLessons });",
  `fetch('/api/aulas/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aulas: updatedLessons })
    }).then(() => loadLessons());
    updateData({ lessons: [...(data.lessons || []).filter(dl => dl.classId !== classObj.id), ...updatedLessons] });
    await dbService.saveData({ ...data, lessons: [...(data.lessons || []).filter(dl => dl.classId !== classObj.id), ...updatedLessons] });`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Script aplicado ao LessonSchedule.tsx');
