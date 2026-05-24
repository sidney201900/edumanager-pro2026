import fs from 'fs';
const content = fs.readFileSync('manager/components/ReportCard.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('exam') || l.toLowerCase().includes('prova')) {
    console.log(`[${i+1}] ${l.trim()}`);
  }
});
