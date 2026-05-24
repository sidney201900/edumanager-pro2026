const { Pool } = require('pg');

const pool = new Pool({
  host: '150.230.87.131',
  port: 5432,
  database: 'edumanager',
  user: 'edumanager',
  password: 'EduManager2026!Seguro',
  ssl: false
});

async function migrateFuncionarios() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT data FROM school_data LIMIT 1');
    if (!rows.length) { console.log('school_data vazio!'); return; }
    const schoolData = rows[0].data;

    const categories = schoolData.employeeCategories || [];
    console.log(`\n📄 Migrando ${categories.length} categorias...`);
    let catOk = 0;
    for (const c of categories) {
      try {
        await client.query(
          `INSERT INTO categorias_funcionarios (id, nome) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          [c.id, c.name]
        );
        catOk++;
      } catch (e) {
        console.warn(`  ⚠️ Categoria ${c.id}: ${e.message}`);
      }
    }
    console.log(`  ✅ ${catOk}/${categories.length} categorias migradas!`);

    const employees = schoolData.employees || [];
    console.log(`\n👥 Migrando ${employees.length} funcionarios...`);
    let empOk = 0;
    for (const e of employees) {
      try {
        await client.query(
          `INSERT INTO funcionarios (id, nome, email, telefone, data_admissao, cpf, categoria_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [e.id, e.name, e.email || '', e.phone || '', e.hireDate || null, e.cpf || '', e.categoryId || null]
        );
        empOk++;
      } catch (err) {
        console.warn(`  ⚠️ Funcionario ${e.id}: ${err.message}`);
      }
    }
    console.log(`  ✅ ${empOk}/${employees.length} funcionarios migrados!`);

  } catch (err) {
    console.error('❌ ERRO:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateFuncionarios();
