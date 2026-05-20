const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgresql://edumanager:EduManager2026!Seguro@150.230.87.131:5432/edumanager' });

async function fix() {
  // 1. Corrigir parcelas PAGAS: valor=170, amount_original=170, valor_pago=150
  const r1 = await pool.query(
    "UPDATE alunos_cobrancas SET valor = 170, amount_original = 170, valor_pago = 150 WHERE status = 'PAGO' AND discount = 20"
  );
  console.log('Parcelas PAGAS corrigidas:', r1.rowCount);

  // 2. Corrigir parcelas PENDENTES que tenham valor inflado
  const r2 = await pool.query(
    "UPDATE alunos_cobrancas SET amount_original = valor WHERE amount_original != valor AND discount = 20"
  );
  console.log('Amount_original alinhado:', r2.rowCount);

  // 3. Verificar resultado
  const { rows } = await pool.query(
    "SELECT status, count(*), sum(valor) as total_valor, sum(valor_pago) as total_pago, sum(discount) as total_desconto FROM alunos_cobrancas GROUP BY status"
  );
  console.table(rows);

  await pool.end();
}

fix().catch(e => { console.error(e); pool.end(); });
