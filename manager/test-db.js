import { pool } from './services/database.js';
pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) as db_size").then(console.log).catch(console.log).finally(() => pool.end());
