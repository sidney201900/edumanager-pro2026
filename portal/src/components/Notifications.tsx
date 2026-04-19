import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, AlertCircle, Info, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Notification as PortalNotification } from '../types';

export default function Notifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      // Fetch core notifications
      const res = await fetch('/api/portal/notificacoes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      let allNotifs = data.notifications || [];

      // Fetch financial status for dynamic alert
      const finRes = await fetch('/api/portal/financeiro', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (finRes.ok) {
        const finData = await finRes.json();
        const atrasadas = (finData.payments || []).filter((p: any) => p.status === 'atrasada');
        
        if (atrasadas.length > 0) {
          const overdueNotif: PortalNotification = {
            id: 'finance-overdue',
            title: 'Pagamento Pendente',
            message: `Identificamos ${atrasadas.length} ${atrasadas.length === 1 ? 'parcela atrasada' : 'parcelas atrasadas'}. Regularize agora para evitar suspensões.`,
            read: false,
            createdAt: new Date().toISOString(),
            type: 'alert'
          };
          allNotifs = [overdueNotif, ...allNotifs];
        }
      }

      setNotifications(allNotifs);
    } catch (err) {
      console.error('Erro ao buscar notificações', err);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    // Polling a cada 30s para simular realtime via SchoolData
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/portal/notificacoes/ler/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteAllRead = async () => {
    const readNotifs = notifications.filter(n => n.read);
    // Remove locally first for instant UI feedback
    setNotifications(prev => prev.filter(n => !n.read));
    // Then fire API calls
    for (const notif of readNotifs) {
      try {
        await fetch(`/api/portal/notificacoes/${notif.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Agora';
    try {
      return new Date(dateStr).toLocaleString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <style>{`
        @keyframes pulse-bell {
          0% { transform: scale(1); }
          15% { transform: scale(1.15) rotate(8deg); }
          30% { transform: scale(1.15) rotate(-8deg); }
          45% { transform: scale(1.15) rotate(5deg); }
          60% { transform: scale(1.15) rotate(-5deg); }
          75% { transform: scale(1); }
          100% { transform: scale(1); }
        }
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.8; }
        }
      `}</style>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--color-surface-light)', border: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--color-text-secondary)',
          transition: 'all 0.2s ease', position: 'relative',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-primary)';
          e.currentTarget.style.color = 'var(--color-primary-light)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }}
      >
        <Bell size={18} style={{
          animation: unreadCount > 0 ? 'pulse-bell 2s ease-in-out infinite' : undefined,
        }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--color-danger)', color: 'white',
            width: 18, height: 18, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 'bold',
            animation: 'badge-pulse 1.5s ease-in-out infinite',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: 340, background: 'var(--color-surface)',
          border: '1px solid var(--glass-border)', borderRadius: 12,
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 1000,
          overflow: 'hidden',
        }}
          className="animate-scale-in"
        >
          <div style={{
            padding: '1rem', borderBottom: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Notificações</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                {unreadCount} {unreadCount === 1 ? 'não lida' : 'não lidas'}
              </span>
              {notifications.some(n => n.read) && (
                <button
                  onClick={deleteAllRead}
                  title="Excluir todas as lidas"
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-danger)',
                    cursor: 'pointer', padding: 4, borderRadius: 4,
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem',
                    opacity: 0.7, transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <Bell size={32} style={{ opacity: 0.2, margin: '0 auto 10px' }} />
                <p style={{ fontSize: '0.85rem' }}>Nenhuma notificação</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notifications.map(notif => {
                  const msgLower = (notif.title + ' ' + notif.message).toLowerCase();
                  const isCancelamento = msgLower.includes('cancel') || msgLower.includes('exclu') || msgLower.includes('remov');
                  const isReposicao = msgLower.includes('reposi');
                  const isExtra = msgLower.includes('extra');
                  const isReagendamento = msgLower.includes('reagend') || msgLower.includes('altera');

                  return (
                    <div
                      key={notif.id}
                      onClick={() => { 
                        if (!notif.read) markAsRead(notif.id); 
                        if (notif.id === 'finance-overdue') {
                          navigate('/financeiro?filter=overdue');
                          setIsOpen(false);
                        } else if (isCancelamento || isReagendamento || isExtra || isReposicao) {
                          navigate('/minhas-aulas');
                          setIsOpen(false);
                        }
                      }}
                      style={{
                        padding: '1rem', borderBottom: '1px solid var(--glass-border)',
                        background: notif.read ? 'transparent' : 'var(--bg-primary-alpha)',
                        display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                        transition: 'all 0.3s ease',
                        opacity: notif.read ? 0.5 : 1,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        padding: 8, borderRadius: '50%', flexShrink: 0,
                        background: notif.read ? 'var(--color-surface-light)'
                          : isCancelamento ? 'var(--bg-danger-alpha)'
                          : isReagendamento ? 'var(--bg-warning-alpha)'
                          : isReposicao ? 'var(--bg-success-alpha)'
                          : isExtra ? 'rgba(147, 51, 234, 0.1)'
                          : 'var(--bg-primary-alpha)',
                      }}>
                        {isCancelamento || isReagendamento
                          ? <AlertCircle size={16} color={notif.read ? 'var(--color-text-secondary)' : (isCancelamento ? 'var(--color-danger)' : 'var(--color-warning)')} />
                          : <Info size={16} color={notif.read ? 'var(--color-text-secondary)' : (isExtra ? '#a855f7' : isReposicao ? 'var(--color-success)' : 'var(--color-primary)')} />
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontSize: '0.8125rem', fontWeight: 600,
                          color: notif.read ? 'var(--color-text-secondary)' : (isCancelamento ? 'var(--color-danger)' : 'var(--color-text)'),
                          marginBottom: 2,
                        }}>
                          {notif.title}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                          {notif.message}
                        </p>
                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>
                          {formatDate(notif.createdAt)}
                        </span>
                      </div>
                      {!notif.read && (
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: 'var(--color-primary)', flexShrink: 0,
                          marginTop: 6,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
