
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://edumanager:EduManager2026!Seguro@localhost:5432/edumanager'
});

async function massSync() {
  console.log('--- Iniciando Sincronização em Massa (SQL -> JSON) ---');
  
  try {
    const { rows: dbPayments } = await pool.query('SELECT asaas_payment_id, valor_pago FROM alunos_cobrancas WHERE valor_pago > 0');
    console.log(`Encontrados ${dbPayments.length} pagamentos com valor_pago no SQL.`);

    const jsonPath = 'C:/Users/Professor/Downloads/remix_-edumanager---sistema-de-gestão-escolar-para-porteiner/school_data.json';
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    let updatedCount = 0;

    dbPayments.forEach(dbP => {
      const pIdx = data.payments.findIndex(p => p.asaasPaymentId === dbP.asaas_payment_id);
      if (pIdx !== -1) {
        data.payments[pIdx].valor_pago = Number(dbP.valor_pago);
        updatedCount++;
      }
    });

    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    
    console.log(`--- Sincronização Concluída ---`);
    console.log(`JSON atualizado com ${updatedCount} valores reais de pagamento.`);
  } catch (err) {
    console.error('Erro na sincronização:', err);
  } finally {
    process.exit();
  }
}

massSync();
