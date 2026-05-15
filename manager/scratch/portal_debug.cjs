
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://edumanager:EduManager2026!Seguro@localhost:5432/edumanager'
});

async function debug() {
  const studentId = '311709fb-68ab-4168-8684-887b5ec2d731';
  
  console.log('--- SQL DATA (Napoleão) ---');
  const { rows } = await pool.query('SELECT asaas_payment_id, valor, amount_original, valor_pago, vencimento, status FROM alunos_cobrancas WHERE aluno_id = $1', [studentId]);
  console.table(rows);

  console.log('--- JSON DATA (Napoleão) ---');
  const jsonPath = 'C:/Users/Professor/Downloads/remix_-edumanager---sistema-de-gestão-escolar-para-porteiner/school_data.json';
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const payments = data.payments.filter(p => p.studentId === studentId);
  console.table(payments.map(p => ({ 
    asaasPaymentId: p.asaasPaymentId, 
    amount: p.amount, 
    discount: p.discount, 
    dueDate: p.dueDate,
    status: p.status
  })));

  process.exit();
}

debug();
