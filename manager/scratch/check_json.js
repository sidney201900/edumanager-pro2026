import { pool } from '../services/database.js'; 
pool.query("SELECT data FROM app_state WHERE id = 'school_data'").then(r => { 
  const p = r.rows[0].data.payments.find(p => p.asaasPaymentId === 'pay_iipssljwa9df3fsq'); 
  console.log('JSON AMOUNT:', p.amount, 'JSON DISCOUNT:', p.discount); 
  process.exit(0); 
}).catch(e => console.error(e));
