const db = {
  amount_original: '150.00',
  valor: '150.00',
  discount: '20.00'
};

const jsonP = {
  amount: 150, // Assuming webhook corrupted it
  discount: 20
};

let amountOriginal = Number(db.amount_original) || Number(jsonP.amount) || Number(db.valor) || 0;
const discount = Number(db.discount) || (jsonP.amount ? Number(jsonP.discount || 0) : 0);

console.log('amountOriginal before:', amountOriginal);
console.log('discount:', discount);
console.log('db.valor:', Number(db.valor));

if (amountOriginal === Number(db.valor) && discount > 0) {
  amountOriginal += discount;
  console.log('BUGFIX APPLIED! New amountOriginal:', amountOriginal);
} else {
  console.log('BUGFIX NOT APPLIED. Conditions:', {
    isEqual: amountOriginal === Number(db.valor),
    hasDiscount: discount > 0
  });
}
