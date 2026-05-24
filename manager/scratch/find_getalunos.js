import fs from 'fs';
const content = fs.readFileSync('manager/services/database.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('getalunos')) {
    console.log(`[${i+1}] ${l.trim()}`);
  }
});
