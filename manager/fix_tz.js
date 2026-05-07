import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'school_data.json');
if (fs.existsSync(file)) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let fixed = 0;
  if (data.attendance) {
    data.attendance.forEach(a => {
      // Se tiver .000Z ou terminar com Z
      if (a.date && typeof a.date === 'string' && a.date.endsWith('Z')) {
        // Ajuste brusco: remove o .000Z e ajusta o horário subtraindo 3h (fuso BRT)
        // Isso é apenas para limpar dados de teste que ficaram bugados hoje.
        try {
           const d = new Date(a.date);
           const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('.')[0];
           a.date = localIso;
           fixed++;
        } catch(e) {}
      }
    });
  }
  if (fixed > 0) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`Corrigidos ${fixed} registros com timezone bugado no JSON!`);
  } else {
    console.log('Nenhum registro bugado encontrado no JSON.');
  }
}
