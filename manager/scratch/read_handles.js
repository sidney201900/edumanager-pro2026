import fs from 'fs';
const content = fs.readFileSync('manager/components/Students.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const handle')) {
    console.log(i, lines[i]);
  }
}
