import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CalendarCheck, BookOpen, Clock, TrendingUp, AlertTriangle, CalendarClock } from 'lucide-react';
import type { Payment, Attendance, Class, Course, Lesson } from '../types';
import { getLessonTimeStatus, getNormalizedDate, parseLessonDateTime } from '../lib/lessonUtils';
import { useRealTimeDate } from '../hooks/useRealTimeDate';

interface DashboardData {
  payments: Payment[];
  attendance: Attendance[];
  lessons: Lesson[];
  studentClass: Class | null;
  course: Course | null;
}

export default function Dashboard() {
  const { student, token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Real-time update every 10s
  const now = useRealTimeDate(10000);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [finRes, freqRes, meRes, aulasRes] = await Promise.all([
          fetch('/api/portal/financeiro', { headers }),
          fetch('/api/portal/frequencia', { headers }),
          fetch('/api/portal/me', { headers }),
          fetch('/api/portal/aulas', { headers }),
        ]);
        const finData = await finRes.json();
        const freqData = await freqRes.json();
        const meData = await meRes.json();
        const aulasData = await aulasRes.json();
        setData({
          payments: finData.payments || [],
          attendance: freqData.attendance || [],
          lessons: aulasData.lessons || [],
          studentClass: meData.class || null,
          course: meData.course || null,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchAll();
  }, [token]);

  if (loading) {
    return (
      <div className="page-container stagger-children">
        <div className="skeleton" style={{ width: 300, height: 32, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  const pendingPayments = data?.payments.filter(p => p.status === 'pending' || p.status === 'overdue') || [];
  const overduePayments = data?.payments.filter(p => p.status === 'overdue') || [];
  const totalPending = pendingPayments.reduce((s, p) => s + (p.amount - (p.discount || 0)), 0);

  const totalAttendance = data?.attendance.length || 0;
  const totalCourseLessons = data?.lessons.length || 0;
  const presences = data?.attendance.filter(a => a.type === 'presence').length || 0;
  const frequencyPercent = totalCourseLessons > 0 ? Math.round((presences / totalCourseLessons) * 100) : 0;

  const nextDue = pendingPayments
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (d: string) => {
    if (!d) return '—';
    const ms = parseLessonDateTime(d, '12:00', 12);
    if (isNaN(ms)) return d;
    return new Date(ms).toLocaleDateString('pt-BR');
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getNext7DaysReplacements = () => {
    if (!data?.lessons) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    return data.lessons.filter(l => {
      if (l.status === 'cancelled') return false;
      const parsedMs = parseLessonDateTime(l.date, '00:00', 0);
      if (isNaN(parsedMs)) return false;
      
      const classDate = new Date(parsedMs);
      classDate.setHours(0, 0, 0, 0);
      
      return l.type === 'reposicao' && classDate >= today && classDate <= in7Days;
    });
  };

  const getNextOrCurrentClass = (): { lesson: Lesson; isInProgress: boolean } | null => {
    if (!data?.lessons || data.lessons.length === 0) return null;
    
    const activeLessons = data.lessons.filter(l => l.status !== 'cancelled');
    
    // Normalize "now" date
    const nowNorm = getNormalizedDate(now.toISOString());
    
    // 1. First, priority: anything strictly "In Progress" RIGHT NOW
    const currentlyPlaying = activeLessons.find(l => {
      const { isInProgress } = getLessonTimeStatus(l, now);
      return isInProgress;
    });
    if (currentlyPlaying) return { lesson: currentlyPlaying, isInProgress: true };
    
    // 2. Secondary: If it's today and not completed yet
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const lessonsRemainingToday = activeLessons
      .filter(l => {
        const lessonMs = parseLessonDateTime(l.date, '12:00', 12);
        const lessonDate = new Date(lessonMs);
        lessonDate.setHours(0, 0, 0, 0);
        
        const { isCompleted } = getLessonTimeStatus(l, now);
        return lessonDate.getTime() === today.getTime() && !isCompleted;
      })
      .sort((a, b) => {
        const timeA = parseLessonDateTime(a.date, a.startTime || (a as any).start_time, 0);
        const timeB = parseLessonDateTime(b.date, b.startTime || (b as any).start_time, 0);
        return timeA - timeB;
      });
      
    if (lessonsRemainingToday[0]) {
      const { isInProgress } = getLessonTimeStatus(lessonsRemainingToday[0], now);
      return { lesson: lessonsRemainingToday[0], isInProgress };
    }
    
    // 3. Last resort: Next future lesson
    const nextFuture = activeLessons
      .filter(l => {
        const { isCompleted } = getLessonTimeStatus(l, now);
        return !isCompleted;
      })
      .sort((a, b) => {
        const dateA = parseLessonDateTime(a.date, a.startTime || (a as any).start_time, 0);
        const dateB = parseLessonDateTime(b.date, b.startTime || (b as any).start_time, 0);
        return dateA - dateB;
      });

    if (nextFuture[0]) {
      const { isInProgress } = getLessonTimeStatus(nextFuture[0], now);
      return { lesson: nextFuture[0], isInProgress };
    }
    
    return null;
  };

  const formatTime = (t?: string) => (t && typeof t === 'string') ? t.substring(0, 5) : '';

  const replacements = getNext7DaysReplacements();
  const nextClassInfo = getNextOrCurrentClass();
  const nextClass = nextClassInfo?.lesson || null;
  const isCurrentlyInProgress = nextClassInfo?.isInProgress || false;

  return (
    <div className="page-container">
      <style>{`
        @keyframes blink-status {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
      `}</style>
      {/* Greeting */}
      <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">
          {greeting()}, <span className="gradient-text">{student?.name.split(' ')[0]}</span>! 👋
        </h1>
        <p className="page-subtitle">
          Aqui está um resumo da sua vida acadêmica.
        </p>

        {replacements.map(rep => (
          <div key={rep.id} className="glass-card animate-fade-in" style={{
            marginTop: '1.25rem', padding: '1rem',
            background: 'var(--bg-success-alpha)', border: '1px solid var(--border-success-alpha)',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            color: 'var(--color-success)'
          }}>
            <CalendarClock size={20} />
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text)' }}>
              🗓️ <strong>Aviso:</strong> Você tem uma reposição agendada para o dia <strong>{formatDate(rep.date || '')}</strong>
              {rep.startTime ? ` às ${formatTime(rep.startTime)}` : ''}.
            </p>
          </div>
        ))}
      </div>

      {/* Cards Grid */}
      <div className="stagger-children" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {/* Turma Card */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--bg-primary-alpha)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={22} color="var(--color-primary-light)" />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                MINHA TURMA
              </p>
            </div>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {data?.studentClass?.name || 'Não vinculado'}
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.375rem' }}>
            {data?.course?.name || '—'}
          </p>
          {data?.studentClass?.schedule && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-accent)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={14} /> {data.studentClass.schedule}
            </p>
          )}
          {data?.studentClass?.teacher && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                Professor Responsável
              </p>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {data.studentClass.teacher}
              </p>
            </div>
          )}
        </div>

        {/* Próxima Aula Card */}
        <div className="glass-card" style={{
          padding: '1.5rem',
          border: isCurrentlyInProgress || nextClass?.type === 'extra' ? `2px solid ${nextClass?.type === 'extra' ? '#a855f7' : 'var(--color-info)'}` : undefined,
            background: isCurrentlyInProgress 
              ? (nextClass?.type === 'extra' 
                  ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)'
                  : nextClass?.type === 'reposicao'
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(22, 163, 74, 0.15) 100%)'
                  : 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(99, 102, 241, 0.15) 100%)')
              : undefined,
            boxShadow: isCurrentlyInProgress 
              ? (nextClass?.type === 'extra' ? '0 0 30px rgba(147, 51, 234, 0.2)' : nextClass?.type === 'reposicao' ? '0 0 30px rgba(34, 197, 94, 0.2)' : '0 0 30px rgba(59, 130, 246, 0.2)')
              : undefined,
            animation: isCurrentlyInProgress ? 'pulse-glow 3s infinite' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: isCurrentlyInProgress 
                  ? (nextClass?.type === 'extra' ? 'rgba(147, 51, 234, 0.15)' : nextClass?.type === 'reposicao' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)')
                  : 'var(--bg-primary-alpha)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: isCurrentlyInProgress ? 'pulse-glow 2s infinite' : undefined,
              }}>
                {isCurrentlyInProgress ? (
                  <Clock size={22} color={nextClass?.type === 'extra' ? '#a855f7' : nextClass?.type === 'reposicao' ? '#22c55e' : 'white'} />
                ) : (
                  <CalendarClock size={22} color={nextClass?.type === 'extra' ? '#a855f7' : nextClass?.type === 'reposicao' ? '#22c55e' : 'var(--color-primary-light)'} />
                )}
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isCurrentlyInProgress ? (
                    <>
                      <Clock size={14} color={nextClass?.type === 'extra' ? '#a855f7' : nextClass?.type === 'reposicao' ? '#22c55e' : 'var(--color-info)'} className="animate-pulse" />
                      <span style={{ color: nextClass?.type === 'extra' ? '#a855f7' : nextClass?.type === 'reposicao' ? '#22c55e' : 'var(--color-info)', fontWeight: 700 }}>AULA EM ANDAMENTO</span>
                    </>
                  ) : (
                    'PRÓXIMA AULA'
                  )}
                </p>
              </div>
            </div>
          {nextClass ? (
            <>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.2, color: isCurrentlyInProgress ? (nextClass.type === 'extra' ? '#a855f7' : nextClass.type === 'reposicao' ? '#22c55e' : 'var(--color-info)') : undefined }}>
                {nextClass.status === 'rescheduled' ? 'Reagendada' : (nextClass.type === 'reposicao' ? 'Reposição' : (nextClass.type === 'extra' ? 'Aula Extra' : 'Aula Regular'))}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.375rem' }}>
                {formatDate(nextClass.date || '')}
              </p>
              {(nextClass.startTime || nextClass.endTime) && (
                <p style={{ fontSize: '0.75rem', color: isCurrentlyInProgress ? 'var(--color-info)' : 'var(--color-accent)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={14} /> {formatTime(nextClass.startTime)} {nextClass.endTime && `às ${formatTime(nextClass.endTime)}`}
                </p>
              )}
              {isCurrentlyInProgress && (
                <span className="animate-pulse" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  marginTop: '0.75rem', padding: '4px 10px', borderRadius: 6,
                  background: nextClass.type === 'extra' ? '#a855f7' : nextClass.type === 'reposicao' ? '#22c55e' : 'var(--color-info)', color: 'white',
                  fontSize: '0.7rem', fontWeight: 600,
                }}>
                  <Clock size={12} /> • AULA EM ANDAMENTO
                </span>
              )}
            </>
          ) : (
             <>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                Nenhuma aula
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.375rem' }}>
                Você não possui próximas aulas
              </p>
             </>
          )}
        </div>

        {/* Financeiro Card */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: overduePayments.length > 0 ? 'var(--bg-danger-alpha)' : 'var(--bg-success-alpha)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CreditCard size={22} color={overduePayments.length > 0 ? 'var(--color-danger)' : 'var(--color-success)'} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                FINANCEIRO
              </p>
            </div>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {formatCurrency(totalPending)}
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.375rem' }}>
            {pendingPayments.length} parcela{pendingPayments.length !== 1 ? 's' : ''} pendente{pendingPayments.length !== 1 ? 's' : ''}
          </p>
          {overduePayments.length > 0 && (
            <p style={{
              fontSize: '0.75rem', color: 'var(--color-danger)',
              marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <AlertTriangle size={14} /> {overduePayments.length} atrasada{overduePayments.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Frequência Card */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: frequencyPercent >= 75 ? 'var(--bg-accent-alpha)' : 'var(--bg-warning-alpha)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CalendarCheck size={22} color={frequencyPercent >= 75 ? 'var(--color-accent-light)' : 'var(--color-warning)'} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                FREQUÊNCIA
              </p>
            </div>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {frequencyPercent}%
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.375rem' }}>
            {presences} presença{presences !== 1 ? 's' : ''} de {totalCourseLessons} aula{totalCourseLessons !== 1 ? 's' : ''} do curso
          </p>
          <div style={{
            marginTop: '0.75rem', height: 6, borderRadius: 3,
            background: 'var(--color-surface)',
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${frequencyPercent}%`,
              background: frequencyPercent >= 75 ? 'var(--gradient-primary)' : 'var(--color-warning)',
              transition: 'width 1s ease',
            }} />
          </div>
        </div>

        {/* Próximo Vencimento Card */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--bg-warning-alpha)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={22} color="var(--color-warning)" />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                PRÓXIMO VENCIMENTO
              </p>
            </div>
          </div>
          {nextDue ? (
            <>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {formatCurrency(nextDue.amount - (nextDue.discount || 0))}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.375rem' }}>
                Vence em {formatDate(nextDue.dueDate)}
              </p>
              {nextDue.description && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-accent)', marginTop: '0.5rem' }}>
                  {nextDue.description}
                </p>
              )}
            </>
          ) : (
            <>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>
                Em dia! ✅
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '0.375rem' }}>
                Nenhuma parcela pendente
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
