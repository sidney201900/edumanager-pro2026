import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://edumanager:edumanager2024@localhost:5432/edumanager'
});

async function debug() {
  try {
    // 1. Buscar todos os alunos
    const alunos = await pool.query('SELECT id, nome FROM alunos LIMIT 20');
    console.log('\n=== ALUNOS CADASTRADOS ===');
    alunos.rows.forEach(a => console.log(`  ${a.id} | ${a.nome}`));

    // 2. Buscar TODAS as cobranças do SQL
    const cobrancas = await pool.query(`
      SELECT asaas_payment_id, aluno_id, status, 
             TO_CHAR(vencimento, 'YYYY-MM-DD') as vencimento,
             valor, amount_original, discount, description, type,
             TO_CHAR(data_pagamento, 'YYYY-MM-DD') as data_pagamento,
             transaction_receipt_url
      FROM alunos_cobrancas 
      ORDER BY aluno_id, vencimento ASC
    `);
    
    console.log(`\n=== COBRANÇAS NO SQL (${cobrancas.rows.length} total) ===`);
    const byStudent = {};
    cobrancas.rows.forEach(c => {
      if (!byStudent[c.aluno_id]) byStudent[c.aluno_id] = [];
      byStudent[c.aluno_id].push(c);
    });

    for (const [alunoId, payments] of Object.entries(byStudent)) {
      const aluno = alunos.rows.find(a => a.id === alunoId);
      console.log(`\n  📌 ${aluno?.nome || alunoId} (${payments.length} cobranças):`);
      payments.forEach(p => {
        const status = p.status?.toUpperCase();
        const icon = status === 'PAGO' ? '✅' : status === 'PENDENTE' ? '⏳' : status === 'ATRASADO' ? '🔴' : '❓';
        console.log(`    ${icon} ${p.asaas_payment_id} | ${p.vencimento} | R$${Number(p.valor).toFixed(2)} | Status: ${p.status} | Pago em: ${p.data_pagamento || '-'} | Desc: ${p.description || '-'} | amount_original: ${p.amount_original || '-'}`);
      });
    }

    // 3. Buscar do JSON
    const dataPath = path.join(__dirname, '..', 'data', 'school_data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      const jsonPayments = data.payments || [];
      console.log(`\n=== COBRANÇAS NO JSON (${jsonPayments.length} total) ===`);
      
      const jsonByStudent = {};
      jsonPayments.forEach(p => {
        if (!jsonByStudent[p.studentId]) jsonByStudent[p.studentId] = [];
        jsonByStudent[p.studentId].push(p);
      });

      for (const [studentId, payments] of Object.entries(jsonByStudent)) {
        const aluno = alunos.rows.find(a => a.id === studentId);
        console.log(`\n  📌 ${aluno?.nome || studentId} (${payments.length} cobranças no JSON):`);
        payments.forEach(p => {
          const inSql = cobrancas.rows.find(c => c.asaas_payment_id === p.asaasPaymentId);
          console.log(`    ${inSql ? '🔗' : '⚠️'} ${p.asaasPaymentId || 'SEM_ID'} | ${p.dueDate} | R$${p.amount} | Status: ${p.status} | Desc: ${p.description || '-'} | discount: ${p.discount || 0} | ${inSql ? 'Existe no SQL' : 'SÓ NO JSON!'}`);
        });
      }

      // 4. Verificar cobranças que existem no SQL mas NÃO no JSON
      console.log('\n=== COBRANÇAS QUE EXISTEM NO SQL MAS NÃO NO JSON ===');
      let orphanCount = 0;
      cobrancas.rows.forEach(c => {
        const inJson = jsonPayments.find(p => p.asaasPaymentId === c.asaas_payment_id);
        if (!inJson) {
          orphanCount++;
          console.log(`  ⚠️ ${c.asaas_payment_id} | Aluno: ${c.aluno_id} | ${c.vencimento} | R$${Number(c.valor).toFixed(2)} | Status: ${c.status}`);
        }
      });
      if (orphanCount === 0) console.log('  ✅ Nenhuma — tudo sincronizado.');
    }

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await pool.end();
  }
}

debug();
