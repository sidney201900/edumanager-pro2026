import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const [enrollment, setEnrollment] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('Portal do Aluno');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/portal/escola')
      .then(res => res.json())
      .then(data => {
        if (data.logo) setSchoolLogo(data.logo);
        if (data.name) setSchoolName(data.name);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(enrollment.trim(), password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--gradient-login)',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background Orbs */}
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--bg-primary-alpha) 0%, transparent 70%)',
        top: '-15%', left: '-10%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--bg-accent-alpha) 0%, transparent 70%)',
        bottom: '-10%', right: '-5%', pointerEvents: 'none',
      }} />

      <div className="animate-scale-in" style={{
        width: '100%', maxWidth: 420, position: 'relative', zIndex: 1,
      }}>
        <div className="glass-card" style={{ padding: '2.5rem 2rem' }}>
          {/* Logo */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            marginBottom: '2rem',
          }}>
            {schoolLogo ? (
              <img
                src={schoolLogo}
                alt={schoolName}
                style={{
                  maxWidth: 100, maxHeight: 100, objectFit: 'contain',
                  marginBottom: '1rem', borderRadius: 12,
                }}
              />
            ) : (
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1rem',
              }}
                className="animate-float"
              >
                <GraduationCap size={36} color="white" />
              </div>
            )}
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }}>
              Portal do <span className="gradient-text">Aluno</span>
            </h1>
            <p style={{
              color: 'var(--color-text-secondary)', fontSize: '0.875rem',
              marginTop: '0.375rem', textAlign: 'center',
            }}>
              Acesse suas informações acadêmicas
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="animate-fade-in" style={{
              background: 'var(--bg-danger-alpha)', border: '1px solid var(--border-danger-alpha)',
              borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '1.25rem',
              color: 'var(--color-danger)', fontSize: '0.8125rem', textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{
                display: 'block', fontSize: '0.8125rem', fontWeight: 500,
                color: 'var(--color-text-secondary)', marginBottom: '0.375rem',
              }}>
                Nº de Matrícula
              </label>
              <input
                id="enrollment-input"
                className="input-field"
                type="text"
                placeholder="Ex: MAT-202600001"
                value={enrollment}
                onChange={(e) => setEnrollment(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: '0.8125rem', fontWeight: 500,
                color: 'var(--color-text-secondary)', marginBottom: '0.375rem',
              }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password-input"
                  className="input-field"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--color-text-secondary)',
                    cursor: 'pointer', padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="login-btn"
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                width: '100%', padding: '0.9375rem', marginTop: '0.5rem',
                fontSize: '0.9375rem',
              }}
            >
              {loading ? (
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p style={{
            textAlign: 'center', marginTop: '1.5rem',
            fontSize: '0.75rem', color: 'var(--color-text-secondary)',
          }}>
            Sua senha padrão são os 6 primeiros dígitos do seu CPF
          </p>
        </div>

        <p style={{
          textAlign: 'center', marginTop: '1.5rem',
          fontSize: '0.6875rem', color: 'rgba(148,163,184,0.5)',
        }}>
          © {new Date().getFullYear()} EduManager • Portal do Aluno
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
