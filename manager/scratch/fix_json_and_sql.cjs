const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgresql://edumanager:EduManager2026!Seguro@150.230.87.131:5432/edumanager' });

// Import the sync function from database.js
// Since database.js uses ES modules (import/export), we can simulate or run it, 
// or write a quick sync block here to ensure the SQL table matches our corrected JSON.
async function runFix() {
  try {
    console.log('--- Iniciando correção dos dados ---');

    // 1. Buscar o JSON legado da tabela school_data
    const { rows } = await pool.query('SELECT data FROM school_data WHERE id = 1');
    if (rows.length === 0) {
      console.error('Tabela school_data vazia!');
      await pool.end();
      return;
    }

    const schoolData = rows[0].data;
    let modifiedPaymentsCount = 0;

    // 2. Corrigir os pagamentos no JSON
    if (schoolData.payments && Array.isArray(schoolData.payments)) {
      for (const p of schoolData.payments) {
        if (p.status === 'paid' && p.amount === 190 && p.discount === 20) {
          p.amount = 170;
          p.valor_pago = 150;
          modifiedPaymentsCount++;
        }
      }
    }

    if (modifiedPaymentsCount > 0) {
      // Salvar de volta na tabela school_data
      await pool.query('UPDATE school_data SET data = $1 WHERE id = 1', [JSON.stringify(schoolData)]);
      console.log(`JSON corrigido: ${modifiedPaymentsCount} pagamentos atualizados de 190/170 para 170/150.`);
    } else {
      console.log('Nenhum pagamento pago de R$ 190 com desconto de R$ 20 encontrado no JSON.');
    }

    // 3. Atualizar diretamente a tabela alunos_cobrancas no SQL para refletir a correção
    const sqlResult = await pool.query(
      "UPDATE alunos_cobrancas SET valor = 170, amount_original = 170, valor_pago = 150 WHERE status = 'PAGO' AND discount = 20"
    );
    console.log(`Tabela SQL alunos_cobrancas corrigida diretamente: ${sqlResult.rowCount} linhas.`);

    // 4. Exibir o estado atualizado das duas fontes para auditoria
    const statusQuery = await pool.query(
      `SELECT status, valor, discount, valor_pago, amount_original, count(*) 
       FROM alunos_cobrancas 
       GROUP BY status, valor, discount, valor_pago, amount_original`
    );
    console.log('\n--- Estado Atual no PostgreSQL (alunos_cobrancas) ---');
    console.table(statusQuery.rows);

  } catch (error) {
    console.error('Erro ao executar correção:', error);
  } finally {
    await pool.end();
  }
}

runFix();
