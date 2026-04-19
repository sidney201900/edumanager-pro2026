import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User, Mail, Phone, Calendar, MapPin, CreditCard,
  Lock, Eye, EyeOff, Loader2, CheckCircle2, Shield
} from 'lucide-react';

export default function MeusDados() {
  const { student, updatePassword } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 4) {
      setError('A nova senha deve ter pelo menos 4 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  if (!student) return null;

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '1rem',
      padding: '0.875rem 0', borderBottom: '1px solid rgba(51,65,85,0.3)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(99,102,241,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color="var(--color-primary-light)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>
          {label}
        </p>
        <p style={{ fontSize: '0.875rem', fontWeight: 500, marginTop: 2, wordBreak: 'break-word' }}>
          {value || '—'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <div className="animate-fade-in" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Meus Dados</h1>
        <p className="page-subtitle">Suas informações pessoais</p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '1.5rem',
      }}>
        {/* Personal Data */}
        <div className="glass-card animate-fade-in" style={{ padding: '1.5rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            marginBottom: '1.5rem', paddingBottom: '1rem',
            borderBottom: '1px solid var(--glass-border)',
          }}>
            {student.photo ? (
              <img src={student.photo} alt={student.name} style={{
                width: 64, height: 64, borderRadius: '50%', objectFit: 'cover',
                border: '3px solid var(--color-primary)',
              }} />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', fontWeight: 700,
              }}>
                {student.name.charAt(0)}
              </div>
            )}
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>{student.name}</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-accent)' }}>
                {student.enrollmentNumber}
              </p>
              <span className={`badge ${student.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: 4 }}>
                {student.status === 'active' ? 'Ativo' : student.status === 'inactive' ? 'Inativo' : 'Cancelado'}
              </span>
            </div>
          </div>

          <InfoRow icon={CreditCard} label="CPF" value={student.cpf} />
          <InfoRow icon={CreditCard} label="RG" value={student.rg} />
          <InfoRow icon={Calendar} label="Data de Nascimento" value={student.birthDate ? formatDate(student.birthDate) : undefined} />
          <InfoRow icon={Phone} label="Telefone" value={student.phone} />
          <InfoRow icon={Mail} label="Email" value={student.email} />
        </div>

        {/* Address + Guardian */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-card animate-fade-in" style={{ padding: '1.5rem' }}>
            <h3 style={{
              fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <MapPin size={18} color="var(--color-primary-light)" /> Endereço
            </h3>
            <div style={{ fontSize: '0.875rem', lineHeight: 1.8, color: 'var(--color-text-secondary)' }}>
              {student.addressStreet ? (
                <>
                  <p>{student.addressStreet}{student.addressNumber ? `, ${student.addressNumber}` : ''}</p>
                  <p>{student.addressNeighborhood}</p>
                  <p>{student.addressCity}{student.addressState ? ` - ${student.addressState}` : ''}</p>
                  {student.addressZip && <p>CEP: {student.addressZip}</p>}
                </>
              ) : (
                <p>Endereço não cadastrado</p>
              )}
            </div>
          </div>

          {/* Guardian */}
          {(student.guardianName || student.guardianCpf) && (
            <div className="glass-card animate-fade-in" style={{ padding: '1.5rem' }}>
              <h3 style={{
                fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <Shield size={18} color="var(--color-primary-light)" /> Responsável
              </h3>
              <InfoRow icon={User} label="Nome" value={student.guardianName} />
              <InfoRow icon={CreditCard} label="CPF" value={student.guardianCpf} />
              {student.guardianPhone && <InfoRow icon={Phone} label="Telefone" value={student.guardianPhone} />}
              {student.guardianEmail && <InfoRow icon={Mail} label="Email" value={student.guardianEmail} />}
            </div>
          )}

          {/* Change Password */}
          <div className="glass-card animate-fade-in" style={{ padding: '1.5rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: showPasswordForm ? '1.25rem' : 0,
            }}>
              <h3 style={{
                fontWeight: 600, fontSize: '0.9375rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <Lock size={18} color="var(--color-primary-light)" /> Segurança
              </h3>
              {!showPasswordForm && (
                <button
                  id="change-password-btn"
                  className="btn-secondary"
                  onClick={() => setShowPasswordForm(true)}
                  style={{ fontSize: '0.8125rem' }}
                >
                  Alterar Senha
                </button>
              )}
            </div>

            {showPasswordForm && (
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {error && (
                  <div className="animate-fade-in" style={{
                    background: 'var(--bg-danger-alpha)', border: '1px solid var(--border-danger-alpha)',
                    borderRadius: 10, padding: '0.625rem 0.875rem',
                    color: 'var(--color-danger)', fontSize: '0.8125rem',
                  }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div className="animate-fade-in" style={{
                    background: 'var(--bg-success-alpha)', border: '1px solid var(--border-success-alpha)',
                    borderRadius: 10, padding: '0.625rem 0.875rem',
                    color: 'var(--color-success)', fontSize: '0.8125rem',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <CheckCircle2 size={16} /> {success}
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <input
                    className="input-field"
                    type={showCurrent ? 'text' : 'password'}
                    placeholder="Senha atual"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
                    }}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    className="input-field"
                    type={showNew ? 'text' : 'password'}
                    placeholder="Nova senha"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
                    }}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <input
                  className="input-field"
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                    {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setError('');
                      setSuccess('');
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
