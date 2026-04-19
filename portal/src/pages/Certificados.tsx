import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Award, Download } from 'lucide-react';
import type { Certificate } from '../types';

export default function Certificados() {
  const { token } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/portal/certificados', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setCertificates(data.certificates || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

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
        <h1 className="page-title">Certificados</h1>
        <p className="page-subtitle">Certificados emitidos para você</p>
      </div>

      {certificates.length === 0 ? (
        <div className="glass-card animate-fade-in" style={{
          padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)',
        }}>
          <Award size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p>Nenhum certificado emitido ainda</p>
        </div>
      ) : (
        <div className="stagger-children" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem',
        }}>
          {certificates.map(cert => (
            <div key={cert.id} className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--bg-warning-alpha) 0%, var(--bg-warning-alpha) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <Award size={32} color="var(--color-warning)" />
              </div>
              <h3 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.375rem' }}>
                Certificado
              </h3>
              {cert.description && (
                <p style={{
                  fontSize: '0.8125rem', color: 'var(--color-text-secondary)',
                  marginBottom: '0.75rem',
                }}>
                  {cert.description}
                </p>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--color-accent)' }}>
                Emitido em {formatDate(cert.issueDate)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
