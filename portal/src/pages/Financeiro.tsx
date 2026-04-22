import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ExternalLink, Filter, CreditCard, Printer, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Payment, Boleto } from '../types';

type FilterType = 'all' | 'pending' | 'paid' | 'overdue';

export default function Financeiro() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [filter, setFilter] = useState<FilterType>((searchParams.get('filter') as FilterType) || 'all');
  const [loading, setLoading] = useState(true);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const urlFilter = searchParams.get('filter') as FilterType;
    if (urlFilter && ['all', 'pending', 'paid', 'overdue'].includes(urlFilter)) {
      setFilter(urlFilter);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [payRes, bolRes] = await Promise.all([
          fetch('/api/portal/financeiro', { headers }),
          fetch('/api/portal/boletos', { headers }),
        ]);
        const payData = await payRes.json();
        const bolData = await bolRes.json();
        
        const fetchedPayments = payData.payments || [];
        const fetchedBoletos = bolData.boletos || [];
        
        // We use only the detailed payments list (JSON source) as the primary data
        // to show labels like "Parcela 1/3". The boletos (Supabase source) are 
        // kept only for the PDF link lookup in getBoletoLink.
        setPayments(fetchedPayments);
        setBoletos(fetchedBoletos);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);
  const normalizeStatus = (payment: Payment) => {
    const s = payment.status?.toLowerCase();
    if (['paid', 'received', 'confirmed', 'pago'].includes(s)) return 'paid';
    if (['cancelled', 'cancelado'].includes(s)) return 'cancelled';
    
    // Check if explicitly overdue in database
    if (['overdue', 'atrasado', 'atrasada', 'vencido'].includes(s)) return 'overdue';
    
    return 'pending';
  };

  const isPaid = (p: Payment) => normalizeStatus(p) === 'paid';
  const isPending = (p: Payment) => ['pending', 'overdue'].includes(normalizeStatus(p));

  const filtered = payments.filter(p => {
    if (filter === 'all') return true;
    return normalizeStatus(p) === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dateA = new Date(a.dueDate).getTime();
    const dateB = new Date(b.dueDate).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (p: Payment) => {
    const norm = normalizeStatus(p);
    const map: Record<string, { className: string; label: string }> = {
      paid: { className: 'badge badge-success', label: 'Pago' },
      pending: { className: 'badge badge-warning', label: 'Pendente' },
      overdue: { className: 'badge badge-danger', label: 'Atrasado' },
      cancelled: { className: 'badge badge-info', label: 'Cancelado' },
    };
    const s = map[norm] || { className: 'badge badge-info', label: norm };
    return <span className={s.className}>{s.label}</span>;
  };

  const getReceiptLink = (payment: Payment): string | null => {
    if ((payment as any).transactionReceiptUrl) return (payment as any).transactionReceiptUrl;
    if ((payment as any).transaction_receipt_url) return (payment as any).transaction_receipt_url;
    
    const asaasId = payment.asaasPaymentId || (payment as any).asaas_payment_id;
    
    let boleto = null;
    if (asaasId) {
      boleto = boletos.find(b => (b as any).asaas_payment_id === asaasId);
    }
    
    if (!boleto) {
       boleto = boletos.find(b => 
         (b as any).vencimento === payment.dueDate && 
         Math.abs(Number((b as any).valor) - (payment.amount - (payment.discount || 0))) < 1
       );
    }
    
    if (!boleto) return null;
    return (boleto as any).link_recibo || (boleto as any).transaction_receipt_url || null;
  };

  const handleOpenReceipt = (payment: Payment) => {
    const receiptUrl = getReceiptLink(payment);
    if (receiptUrl) {
      window.open(receiptUrl, '_blank', 'noopener,noreferrer');
    } else {
      setReceiptPayment(payment);
    }
  };

  const getBoletoLink = (payment: Payment) => {
    if (payment.asaasPaymentUrl) return payment.asaasPaymentUrl;
    if ((payment as any).link_boleto) return (payment as any).link_boleto;

    const asaasId = payment.asaasPaymentId || (payment as any).asaas_payment_id;
    
    let boleto = null;
    if (asaasId) {
      boleto = boletos.find(b => (b as any).asaas_payment_id === asaasId);
    }
    
    if (!boleto) {
       boleto = boletos.find(b => 
         (b as any).vencimento === payment.dueDate && 
         Math.abs(Number((b as any).valor) - (payment.amount - (payment.discount || 0))) < 1
       );
    }
    
    return (boleto as any)?.link_boleto || null;
  };

  const getEffectiveValue = (payment: Payment) => {
    const baseAmount = payment.amount || 0;
    const discount = payment.discount || 0;
    const netAmount = baseAmount - discount;
    const status = normalizeStatus(payment);

    // Try to find matching boleto from Supabase sync 
    const asaasId = payment.asaasPaymentId || (payment as any).asaas_payment_id;
    let boleto = null;
    
    if (asaasId) {
      boleto = boletos.find(b => (b as any).asaas_payment_id === asaasId);
    }
    
    if (!boleto) {
      // Fallback: Match by due date and base amount (allowing for interest/fines)
      boleto = boletos.find(b => {
        const bVenc = (b as any).vencimento;
        const bVal = Number((b as any).valor);
        
        // Exact date match
        if (bVenc === payment.dueDate) {
          // If value is exactly base or exactly net
          if (Math.abs(bVal - baseAmount) < 1 || Math.abs(bVal - netAmount) < 1) return true;
          // If it's overdue, the boleto value will be HIGHER than baseAmount
          if (status === 'overdue' && bVal > netAmount) return true;
        }
        return false;
      });
    }
    
    // If we have a boleto and it is overdue or paid, use current Asaas value
    if (boleto && (boleto as any).valor) {
      const bValue = Number((boleto as any).valor);
      if (status === 'overdue' || status === 'paid') {
        return bValue;
      }
    }
    
    // Default: use the discounted base value (net amount)
    return netAmount;
  };

  const totalPending = payments
    .filter(p => isPending(p))
    .reduce((s, p) => s + getEffectiveValue(p), 0);

  const totalPaid = payments
    .filter(p => isPaid(p))
    .reduce((s, p) => s + getEffectiveValue(p), 0);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'pending', label: 'Pendentes' },
    { key: 'paid', label: 'Pagos' },
    { key: 'overdue', label: 'Atrasados' },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: '100%', height: 400, borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="animate-fade-in" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Financeiro</h1>
        <p className="page-subtitle">Acompanhe seus pagamentos e boletos</p>
      </div>

      {/* Summary Cards */}
      <div className="stagger-children" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1rem', marginBottom: '1.5rem',
      }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: '0.5rem' }}>
            TOTAL EM ABERTO
          </p>
          <p style={{ fontSize: '1.375rem', fontWeight: 700, color: totalPending > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
            {formatCurrency(totalPending)}
          </p>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: '0.5rem' }}>
            TOTAL PAGO
          </p>
          <p style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-success)' }}>
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginBottom: '0.5rem' }}>
            TOTAL DE PARCELAS
          </p>
          <p style={{ fontSize: '1.375rem', fontWeight: 700 }}>
            {payments.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: '1rem', flexWrap: 'wrap',
      }}>
        <Filter size={16} color="var(--color-text-secondary)" />
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '0.4375rem 0.875rem', borderRadius: 9999,
              border: '1px solid',
              borderColor: filter === f.key ? 'var(--color-success)' : 'var(--color-border)',
              background: filter === f.key ? 'var(--color-success)' : 'transparent',
              color: filter === f.key ? 'white' : 'var(--color-text-secondary)',
              fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif',
              boxShadow: filter === f.key ? '0 4px 12px var(--bg-success-alpha)' : 'none',
            }}
          >
            {f.label}
          </button>
        ))}
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>ORDEM:</span>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="btn-secondary"
            style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.75rem' }}
          >
            {sortOrder === 'asc' ? 'Crescente (Antigos)' : 'Decrescente (Novos)'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card animate-fade-in" style={{ overflow: 'hidden' }}>
        {sorted.length === 0 ? (
          <div style={{
            padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)',
          }}>
            <CreditCard size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.9375rem' }}>Nenhum pagamento encontrado</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Desconto</th>
                  <th>A Pagar</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((payment, idx) => {
                  const link = getBoletoLink(payment);
                  return (
                    <tr key={payment.id} style={{
                      animation: `fadeIn 0.3s ease-out ${idx * 0.04}s forwards`,
                      opacity: 0,
                    }}>
                      <td>
                        <div>
                          <p style={{ fontWeight: 500 }}>
                            {payment.description || `Parcela ${payment.installmentNumber || '—'}`}
                          </p>
                          {payment.totalInstallments && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                              {payment.installmentNumber}/{payment.totalInstallments}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>{formatDate(payment.dueDate)}</td>
                      <td style={{ fontWeight: 500 }}>
                        {formatCurrency(payment.amount)}
                      </td>
                      <td style={{ color: payment.discount ? 'var(--color-success)' : 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                        {payment.discount ? `- ${formatCurrency(payment.discount)}` : '—'}
                      </td>
                      <td style={{ 
                        fontWeight: 600, 
                        color: normalizeStatus(payment) === 'overdue' ? 'var(--color-danger)' : 'var(--color-primary-light)' 
                      }}>
                        {formatCurrency(getEffectiveValue(payment))}
                      </td>
                      <td data-label="Status">{getStatusBadge(payment)}</td>
                      <td>
                        {isPaid(payment) ? (
                          <button
                            onClick={() => handleOpenReceipt(payment)}
                            style={{
                              fontSize: '0.75rem', padding: '0.375rem 0.75rem',
                              display: 'flex', alignItems: 'center', gap: '0.35rem',
                              background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              cursor: 'pointer', borderRadius: 8, fontWeight: 600,
                              fontFamily: 'Inter, sans-serif',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <Printer size={14} /> Visualizar Recibo
                          </button>
                        ) : isPending(payment) && link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', textDecoration: 'none' }}
                          >
                            <ExternalLink size={14} />
                            Ver Boleto
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receiptPayment && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '1rem',
        }} onClick={() => setReceiptPayment(null)}>
          <div className="glass-card animate-scale-in" style={{
            width: '100%', maxWidth: '500px', backgroundColor: 'var(--color-surface)',
            padding: '2rem', display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Recibo de Pagamento</h3>
              <button onClick={() => setReceiptPayment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                 <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Referência:</span>
                  <span style={{ fontWeight: 600 }}>{receiptPayment.description || `Parcela ${receiptPayment.installmentNumber || '—'}`}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Valor Pago:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(receiptPayment.amount - (receiptPayment.discount || 0))}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Data de Vencimento:</span>
                  <span style={{ fontWeight: 600 }}>{formatDate(receiptPayment.dueDate)}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Status:</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Quitado</span>
               </div>
               {receiptPayment.asaasPaymentId && (
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Cód. Transação:</span>
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{receiptPayment.asaasPaymentId}</span>
                 </div>
               )}
            </div>

            <button 
              onClick={() => window.print()}
              className="btn-primary" 
              style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 600 }}
            >
              <Printer size={18} /> Imprimir Comprovante
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
