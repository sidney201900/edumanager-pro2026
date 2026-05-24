import { syncJsonToRelationalTables } from '../services/database.js';

async function run() {
  console.log("Forcing sync of Employees...");
  try {
    await syncJsonToRelationalTables();
    console.log("Sync complete.");
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
