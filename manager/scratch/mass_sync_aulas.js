import { getSchoolData, syncJsonToRelationalTables } from '../services/database.js';

async function run() {
  console.log("Iniciando sync de tudo pro DB (Aulas/Frequencias incluídas)...");
  await syncJsonToRelationalTables();
  console.log("Pronto!");
  process.exit(0);
}
run();
