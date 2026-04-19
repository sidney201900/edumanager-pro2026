import { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Lesson } from '../types';
import { getLessonTimeStatus, parseLessonDateTime } from '../lib/lessonUtils';
import { useRealTimeDate } from '../hooks/useRealTimeDate';

export default function MinhasAulas() {
  const { token } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'history'>('scheduled');
  
  // MUST be called logically at the top level
  const now = useRealTimeDate(10000); // 10s updates

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/portal/aulas', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setLessons(data.lessons || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const ms = parseLessonDateTime(dateStr, '12:00', 12);
      if (isNaN(ms)) return dateStr;
      const date = new Date(ms);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr || typeof timeStr !== 'string') return '';
    return timeStr.substring(0, 5);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 250, height: 32, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: '100%', height: 400, borderRadius: 16 }} />
      </div>
    );
  }

  const nowTime = now.getTime();

  // Process and group lessons
  const processedLessons = lessons.map(l => ({
    ...l,
    ...getLessonTimeStatus(l, now)
  }));

  const activeLessons = processedLessons.filter(l => !l.isCompleted && l.status !== 'cancelled').sort((a, b) => {
    const timeA = parseLessonDateTime(a.date, a.startTime, 0);
    const timeB = parseLessonDateTime(b.date, b.startTime, 0);
    return timeA - timeB;
  });

  const historyLessons = processedLessons.filter(l => l.isCompleted || l.status === 'cancelled').sort((a, b) => {
    const timeA = parseLessonDateTime(a.date, a.startTime, 0);
    const timeB = parseLessonDateTime(b.date, b.startTime, 0);
    return timeB - timeA; // History is descending
  });

  const displayLessons = activeTab === 'scheduled' ? activeLessons : historyLessons;

  return (
    <div className="page-container">
      <style>{`
        @keyframes blink-status {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
      <div className="animate-fade-in" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">Cronograma de Aulas</h1>
            <p className="page-subtitle">Acompanhe suas aulas e reposições agendadas</p>
          </div>

          <div className="glass-card" style={{ padding: '4px', display: 'flex', gap: '4px', borderRadius: 12 }}>
            <button
              onClick={() => setActiveTab('scheduled')}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, transition: 'all 0.2s',
                background: activeTab === 'scheduled' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'scheduled' ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              Aulas Agendadas ({activeLessons.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, transition: 'all 0.2s',
                background: activeTab === 'history' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'history' ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              Histórico ({historyLessons.length})
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade-in stagger-children">
        {displayLessons.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <CalendarIcon size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <p>Nenhuma aula encontrada no cronograma.</p>
          </div>
        ) : (
          displayLessons.map((lesson, idx) => {
            const isCancelled = lesson.status === 'cancelled';
            const isRescheduled = lesson.status === 'rescheduled';
            const isReposicao = lesson.type === 'reposicao';
            
            const { isInProgress, isCompleted } = getLessonTimeStatus(lesson, now);
            const isAbsoluteNext = idx === 0 && !isInProgress && !isCancelled && !isCompleted;

            return (
              <div
                key={lesson.id}
                className="glass-card"
                style={{
                  padding: '1.5rem',
                  opacity: isCancelled ? 0.55 : 1,
                  borderLeft: isCancelled ? '4px solid var(--color-danger)'
                    : isInProgress && !isCancelled ? (lesson.type === 'extra' ? '4px solid #a855f7' : '4px solid var(--color-warning)')
                    : lesson.type === 'extra' ? '4px solid #a855f7'
                    : isAbsoluteNext ? '4px solid var(--color-primary)'
                    : isRescheduled ? '4px solid #8b5cf6'
                    : lesson.type === 'reposicao' ? '4px solid var(--color-success)'
                    : isCompleted ? '4px solid var(--color-success)'
                    : '4px solid var(--color-success)',
                  background: isInProgress && !isCancelled 
                    ? (lesson.type === 'extra' ? 'linear-gradient(90deg, rgba(168, 85, 247, 0.08) 0%, transparent 100%)' : 'linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)')
                    : isAbsoluteNext ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.08) 0%, transparent 100%)'
                    : undefined,
                  boxShadow: isAbsoluteNext ? '0 4px 20px rgba(99, 102, 241, 0.12)' : undefined,
                  animation: isInProgress && !isCancelled ? 'pulse 3s infinite' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <CalendarIcon size={16} />
                        <span style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}>
                          🗓️ {formatDate(lesson.date)}
                        </span>
                      </div>
                      {(lesson.startTime || lesson.endTime) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Clock size={16} />
                          <span style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}>
                            ⏰ {formatTime(lesson.startTime)}{lesson.endTime ? ` às ${formatTime(lesson.endTime)}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    {(isReposicao || lesson.type === 'extra') && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {lesson.type === 'extra' && (
                          <span style={{
                            background: '#9333ea', color: 'white',
                            padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600,
                            border: '1px solid rgba(147, 51, 234, 0.3)'
                          }}>
                            AULA EXTRA
                          </span>
                        )}
                        {isReposicao && (
                          <span style={{
                            background: 'var(--bg-success-alpha)', color: 'var(--color-success)',
                            padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600,
                            border: '1px solid var(--color-success-alpha)'
                          }}>
                            AULA DE REPOSIÇÃO
                          </span>
                        )}
                        {lesson.originalLessonId && (
                           <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
                             Ref. aula original
                           </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    {isCancelled && (
                      <span style={{
                        background: 'var(--color-danger)', color: 'white',
                        padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        CANCELADA{lesson.cancelReason ? ` - ${lesson.cancelReason}` : ''}
                      </span>
                    )}

                    {isRescheduled && !isInProgress && (
                      <span style={{
                        background: 'var(--bg-warning-alpha)', color: 'var(--color-warning)',
                        padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                        border: '1px solid var(--bg-warning-alpha)',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        REAGENDADA
                      </span>
                    )}

                    {isInProgress && !isCancelled && (
                      <span className="animate-pulse" style={{
                        background: 'var(--color-warning)', color: 'white',
                        padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4,
                        boxShadow: '0 0 15px var(--bg-warning-alpha)'
                      }}>
                        <Clock size={12} /> EM ANDAMENTO
                      </span>
                    )}

                    {isCompleted && !isCancelled && !isInProgress && (
                      <span style={{
                        background: 'var(--bg-success-alpha)', color: 'var(--color-success)',
                        padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                        border: '1px solid var(--bg-success-alpha)',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        CONCLUÍDA
                      </span>
                    )}

                    {!isCancelled && !isCompleted && !isRescheduled && !isInProgress && (
                      <span style={{
                        background: 'var(--bg-primary-alpha)', color: 'var(--color-primary)',
                        padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                        border: '1px solid var(--bg-primary-alpha)',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        AGENDADA
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
