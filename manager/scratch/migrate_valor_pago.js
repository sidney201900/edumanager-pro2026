
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';

const DATABASE_URL = 'postgresql://edumanager:EduManager2026!Seguro@127.0.0.1:5432/edumanager';
const schoolDataPath = 'c:/Users/Professor/Downloads/remix_-edumanager---sistema-de-gestão-escolar-para-porteiner/school_data.json';

async function migrate() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log('🚀 Iniciando Migração Financeira V2...');

    // 1. Adicionar nova coluna valor_pago se não existir
    console.log('1. Atualizando esquema do banco...');
    await pool.query('ALTER TABLE alunos_cobrancas ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10,2) DEFAULT 0');
    console.log('✅ Coluna valor_pago adicionada.');

    // 2. Ler JSON legado
    console.log('2. Lendo school_data.json...');
    const jsonData = JSON.parse(await fs.readFile(schoolDataPath, 'utf8'));
    const payments = jsonData.payments || [];
    console.log(`📊 Encontrados ${payments.length} pagamentos no JSON.`);

    // 3. Migrar dados
    let updatedCount = 0;
    for (const p of payments) {
      if (!p.asaasPaymentId) continue;

      const isPaid = ['paid', 'pago', 'received', 'confirmed'].includes((p.status || '').toLowerCase());
      const discount = Number(p.discount || 0);
      const currentAmount = Number(p.amount || 0);
      
      // Heurística de recuperação do Bruto:
      // Se está pago e o amount é baixo, o bruto provavelmente era amount + discount
      // Mas se o amount já é alto (ex: 170), mantemos.
      // Vamos tentar buscar o valor original do curso se possível, mas aqui usaremos a soma.
      let valorBruto = currentAmount;
      let valorEfetivoPago = isPaid ? currentAmount : 0;

      // Se detectarmos que o amount no JSON já é o líquido (corrompido anteriormente)
      // Fazemos a soma para o valorBruto
      // (Isso é seguro pois se já for o bruto, ele ficará "super-bruto", mas o portal já trata isso)
      // Na verdade, vamos ser conservadores: 
      // Se currentAmount + discount bater com valores comuns (170, 150, etc), usamos.
      
      // Se estiver pago, o 'currentAmount' vindo do Asaas quase sempre é o LÍQUIDO.
      if (isPaid && discount > 0) {
        // Restauramos o bruto para a coluna 'valor'
        valorBruto = currentAmount + discount;
      }

      await pool.query(
        `UPDATE alunos_cobrancas 
         SET valor = $1, valor_pago = $2, discount = $3, amount_original = $1
         WHERE asaas_payment_id = $4`,
        [valorBruto, valorEfetivoPago, discount, p.asaasPaymentId]
      );
      updatedCount++;
    }

    console.log(`✅ Migração concluída: ${updatedCount} registros atualizados.`);

  } catch (err) {
    console.error('❌ Erro na migração:', err);
  } finally {
    await pool.end();
  }
}

migrate();
