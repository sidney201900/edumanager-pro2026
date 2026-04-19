import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileText, Eye, Printer, X, FileSignature } from 'lucide-react';
import type { Contract } from '../types';

export default function Contratos() {
  const { token } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!viewingContract) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${viewingContract.title}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
              body { 
                font-family: 'Inter', sans-serif; 
                padding: 40px; 
                color: #1a1a1a; 
                line-height: 1.8; 
                text-align: justify;
                white-space: pre-line;
                font-size: 12pt;
              }
              p, div { margin-bottom: 1rem; text-indent: 2.5rem; }
              h1, h2, h3, h4 { 
                text-align: center; 
                margin: 1.5rem 0 1rem; 
                text-indent: 0; 
                font-weight: 700; 
                text-transform: uppercase;
              }
              ul, ol { padding-left: 3rem; margin-bottom: 1rem; }
              li { margin-bottom: 0.5rem; }
              @page { margin: 2cm; }
            </style>
          </head>
          <body>${viewingContract.content}</body>
        </html>
      `);
      printWindow.document.close();
      // Wait for font loading
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/portal/contratos', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setContracts(data.contracts || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  const handleOpenModal = (contract: Contract) => {
    setViewingContract(contract);
  };

  const closeModal = () => {
    setViewingContract(null);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="animate-fade-in" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Contratos</h1>
        <p className="page-subtitle">Seus contratos com a instituição</p>
      </div>

      {contracts.length === 0 ? (
        <div className="glass-card animate-fade-in" style={{
          padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)',
        }}>
          <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p>Nenhum contrato encontrado</p>
        </div>
      ) : (
        <div className="stagger-children" style={{
          display: 'grid', gap: '1rem',
        }}>
          {contracts.map(contract => (
            <div key={contract.id} className="glass-card" style={{
              padding: '1.5rem', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'var(--bg-primary-alpha)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <FileText size={24} color="var(--color-primary-light)" />
                </div>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{contract.title}</h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    Emitido em {formatDate(contract.createdAt)}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-primary"
                  onClick={() => handleOpenModal(contract)}
                  style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <FileSignature size={16} /> Ver Contrato Atual
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {viewingContract && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '1rem',
        }}
          onClick={closeModal}
        >
          <div className="glass-card animate-scale-in" style={{
            width: '100%', maxWidth: '896px', height: '80vh',
            display: 'flex', flexDirection: 'column',
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--glass-border)',
            }}>
              <h3 style={{ fontWeight: 600 }}>{viewingContract.title}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" onClick={handlePrint} style={{ fontSize: '0.8125rem' }}>
                  <Printer size={16} /> Imprimir
                </button>
                <button
                  onClick={closeModal}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none',
                    background: 'var(--color-surface-lighter)', color: 'var(--color-text)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <style>{`
              .contract-content p,
              .contract-content div {
                margin-bottom: 1rem;
                text-indent: 2rem;
              }
              .contract-content br + br {
                display: block;
                margin-top: 0.75rem;
                content: '';
              }
              .contract-content h1,
              .contract-content h2,
              .contract-content h3,
              .contract-content h4 {
                text-align: center;
                margin: 1.5rem 0 1rem;
                text-indent: 0;
                font-weight: 700;
              }
              .contract-content ul,
              .contract-content ol {
                padding-left: 2.5rem;
                margin-bottom: 1rem;
              }
              .contract-content li {
                margin-bottom: 0.5rem;
              }
            `}</style>
            <div
              ref={printRef}
              className="contract-content"
              style={{
                padding: '2rem', overflow: 'auto', flex: 1,
                fontSize: '0.9375rem', lineHeight: 1.8,
                color: 'var(--color-text-secondary)',
                textAlign: 'justify',
                whiteSpace: 'pre-line',
              }}
              dangerouslySetInnerHTML={{ __html: viewingContract.content }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
