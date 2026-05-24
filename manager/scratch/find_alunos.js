import fs from 'fs';
const content = fs.readFileSync('manager/components/Students.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('Alunos')) {
    console.log(`[${i+1}] ${l.trim()}`);
  }
});
