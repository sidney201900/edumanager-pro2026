import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CalendarCheck, CheckCircle2, XCircle, FileText, Send, X, Loader2, AlertTriangle, ChevronDown, Clock } from 'lucide-react';
import type { Attendance, Lesson } from '../types';
import { getLessonTimeStatus, getNormalizedDate, isLessonWithinJustificationWindow, parseLessonDateTime } from '../lib/lessonUtils';
import { useRealTimeDate } from '../hooks/useRealTimeDate';

export default function Frequencia() {
  const { token } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'history'>('scheduled');
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [showJustifyModal, setShowJustifyModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [justificationText, setJustificationText] = useState('');
  const [justificationFile, setJustificationFile] = useState<File | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  // Update time every 10s to keep timeline ticking forward live
  // This hook MUST be unconditionally called at the top level
  const now = useRealTimeDate(10000);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [freqRes, aulasRes] = await Promise.all([
          fetch('/api/portal/frequencia', { headers }),
          fetch('/api/portal/aulas', { headers })
        ]);
        const freqData = await freqRes.json();
        const aulasData = await aulasRes.json();
        setAttendance(freqData.attendance || []);
        setLessons(aulasData.lessons || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  const openJustifyModal = (preselectedTimestamp?: string) => {
    setShowJustifyModal(true);
    setSelectedDate(preselectedTimestamp || '');
    setJustificationText('');
    setJustificationFile(null);
    setError('');
    setSuccessMsg('');
  };

  const closeModal = () => {
    setShowJustifyModal(false);
    setSelectedDate('');
    setJustificationText('');
    setJustificationFile(null);
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setJustificationFile(file);
    }
  };

  const handleJustify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      setError('Selecione a data da aula');
      return;
    }
    if (!justificationText.trim()) {
      setError('A justificativa é obrigatória');
      return;
    }
    
    setSubmitLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('date', selectedDate);
    formData.append('motivo', justificationText.trim());
    if (justificationFile) {
      formData.append('arquivo', justificationFile);
    }
    
    try {
      const res = await fetch('/api/portal/frequencia/justificar', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}` 
        },
        body: formData,
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao enviar justificativa');
      }
      
      const { record } = await res.json();
      
      // Update local state
      setAttendance(prev => {
        const exists = prev.find(a => a.id === record.id);
        if (exists) return prev.map(a => a.id === record.id ? record : a);
        return [...prev, record];
      });
      
      closeModal();
      setSuccessMsg(`Justificativa enviada com sucesso para o dia ${formatDate(selectedDate)}!`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Erro ao comunicar com o servidor');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: '100%', height: 300, borderRadius: 16 }} />
      </div>
    );
  }



  // Merge and Categorize
  const processedItems = lessons.map(lesson => {
    const lessonFullISO = new Date(parseLessonDateTime(lesson.date, lesson.startTime || '00:00:00')).toISOString();
    const lessonStartMs = parseLessonDateTime(lesson.date, lesson.startTime || '00:00:00');
    const lessonEndMs = parseLessonDateTime(lesson.date, lesson.endTime || '00:00:00', lesson.endTime ? 0 : 60);

    const atts = attendance.filter(a => {
      if (!a.date || typeof a.date !== 'string') return false;
      
      // 1. Exact Match (Best case)
      if (a.date === lessonFullISO) return true;

      const attMs = new Date(a.date).getTime();

      // 2. Presence Match (Biometrics)
      // Allow any presence within the lesson duration (+ buffer)
      if (a.type === 'presence') {
        return attMs >= (lessonStartMs - 10 * 60000) && attMs <= (lessonEndMs + 5 * 60000);
      }

      // 3. Justification Proximity Match (Strict 10 mins from start)
      const diffMinutes = Math.abs(attMs - lessonStartMs) / (1000 * 60);
      return diffMinutes <= 10;
    });
    
    const { isInProgress, isCompleted } = getLessonTimeStatus(lesson, now);
    return { 
      lesson, 
      attendances: atts,
      isInProgress,
      isCompleted
    };
  });

  // Stats calculation (aligned with list logic)
  const totalCourseLessons = lessons.length;
  const presences = attendance.filter(a => a.type === 'presence' || a.verified === true).length;
  const absences = attendance.filter(a => a.type === 'absence' && !a.verified && !a.justification).length;
  const justified = attendance.filter(a => !!a.justification).length;
  const completedLessons = processedItems.filter(item => item.isCompleted && item.lesson.status !== 'cancelled').length;
  const pendingLessons = processedItems.filter(item => !item.isCompleted && item.lesson.status !== 'cancelled').length;
  const percentage = totalCourseLessons > 0 ? Math.round((presences / totalCourseLessons) * 100) : 0;

  const activeItems = processedItems.filter(item => !item.isCompleted && item.lesson.status !== 'cancelled').sort((a, b) => {
    const dateA = parseLessonDateTime(a.lesson.date, a.lesson.startTime, 0);
    const dateB = parseLessonDateTime(b.lesson.date, b.lesson.startTime, 0);
    return dateA - dateB;
  });

  const historyItems = processedItems.filter(item => item.isCompleted || item.lesson.status === 'cancelled').sort((a, b) => {
    const dateA = parseLessonDateTime(a.lesson.date, a.lesson.startTime, 0);
    const dateB = parseLessonDateTime(b.lesson.date, b.lesson.startTime, 0);
    return dateB - dateA; // History descending
  });

  const displayItems = activeTab === 'scheduled' ? activeItems : historyItems;

  // Collect lessons available for justification modal dropdown
  const justifiableLessons = lessons.filter(l => {
    if (l.status === 'cancelled') return false;
    
    // Check window (uses new 24h before/after logic)
    if (!isLessonWithinJustificationWindow(l, now)) return false;
    
    const lessonFullISO = new Date(parseLessonDateTime(l.date, l.startTime || '00:00:00')).toISOString();
    const lessonStartMs = parseLessonDateTime(l.date, l.startTime || '00:00:00');
    const lessonEndMs = parseLessonDateTime(l.date, l.endTime || '00:00:00', l.endTime ? 0 : 60);

    // Find if THIS SPECIFIC lesson has attendance/justification
    const att = attendance.find(a => {
      if (!a.date || typeof a.date !== 'string') return false;
      const attMs = new Date(a.date).getTime();
      
      // Strict match by ISO or within duration for presence
      if (a.date === lessonFullISO) return true;
      if (a.type === 'presence' && attMs >= (lessonStartMs - 10 * 60000) && attMs <= (lessonEndMs + 5 * 60000)) return true;
      
      return false;
    });

    if (att) {
      if (att.type === 'presence' || att.verified) return false;
      if (att.justification) return false;
    }
    return true;
  });

  const formatDate = (d: string) => {
    try {
      const ms = parseLessonDateTime(d, '12:00', 12);
      if (isNaN(ms)) return d;
      return new Date(ms).toLocaleDateString('pt-BR');
    } catch {
      return d;
    }
  };

  const formatDateFull = (d: string) => {
    try {
      const ms = parseLessonDateTime(d, '12:00', 12);
      if (isNaN(ms)) return d;
      return new Date(ms).toLocaleDateString('pt-BR', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  const parseJustification = (j?: string): string | null => {
    if (!j) return null;
    try {
      const parsed = JSON.parse(j);
      return parsed.motivo || j;
    } catch {
      return j;
    }
  };

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
            <h1 className="page-title">Frequência</h1>
            <p className="page-subtitle">Acompanhe seu histórico de presença e justificativas</p>
          </div>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="animate-fade-in" style={{
          background: 'var(--bg-success-alpha)', border: '1px solid var(--border-success-alpha)',
          borderRadius: 12, padding: '1rem', marginBottom: '1rem',
          color: 'var(--color-success)', fontSize: '0.875rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Stats */}
      <div className="stagger-children" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem', marginBottom: '1.5rem',
      }}>
        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 0.75rem',
            background: `conic-gradient(${percentage >= 75 ? 'var(--color-primary)' : 'var(--color-warning)'} ${percentage * 3.6}deg, var(--color-surface) 0deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'var(--color-surface-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '1rem',
            }}>
              {percentage}%
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            FREQUÊNCIA TOTAL
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-success)' }}>{presences}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginTop: 4 }}>
            PRESENÇAS
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-danger)' }}>{absences}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginTop: 4 }}>
            FALTAS
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{justified}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginTop: 4 }}>
            JUSTIFICATIVAS
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>{totalCourseLessons}</p>
          <p style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
            TOTAL DE AULAS
          </p>
          <div style={{ display: 'flex', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem', gap: '0.5rem' }}>
             <div style={{ flex: 1 }}>
                <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-success)' }}>{completedLessons}</p>
                <p style={{ fontSize: '0.6rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>CONCLUÍDAS</p>
             </div>
             <div style={{ flex: 1, borderLeft: '1px solid var(--glass-border)' }}>
                <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-primary)' }}>{pendingLessons}</p>
                <p style={{ fontSize: '0.6rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>A CONCLUIR</p>
             </div>
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '1rem', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
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
            Próximas Aulas ({activeItems.length})
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
            Histórico ({historyItems.length})
          </button>
        </div>
        
        <button
          onClick={() => openJustifyModal()}
          className="btn-primary"
          style={{ padding: '0.5rem 1.25rem', borderRadius: 12, height: 'auto' }}
        >
          <Send size={18} /> Justificar Falta
        </button>
      </div>

      {/* List */}
      {displayItems.length === 0 ? (
        <div className="glass-card animate-fade-in" style={{
          padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)',
        }}>
          <CalendarCheck size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p>Nenhuma aula encontrada no cronograma</p>
        </div>
      ) : (
        <div className="glass-card animate-fade-in" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Status de Aula</th>
                  <th>Presença</th>
                  <th>Hora Presença</th>
                  <th>Justificativa</th>
                  <th>Texto da Justificativa</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, idx) => {
                  const { lesson, attendances: atts, isInProgress, isCompleted } = item;
                  const isCancelled = lesson.status === 'cancelled';
                  const isRescheduled = lesson.status === 'rescheduled';
                  
                  // PREREQUISITE: 'presence' type OR verified status counts as real presence
                  const isPresent = atts.some(a => a.type === 'presence' || a.verified === true);
                  const hasJustification = atts.some(a => !!a.justification);
                  const activeJustification = atts.find(a => !!a.justification);
                  const justText = parseJustification(activeJustification?.justification);
                  const isJustificationAccepted = activeJustification?.justificationAccepted === true;
                  
                  const isWithinWindow = isLessonWithinJustificationWindow(lesson, now);
                  const canJustify = !isPresent && isWithinWindow && !justText && lesson.status !== 'cancelled';

                  return (
                    <tr key={lesson.id} style={{
                      animation: `fadeIn 0.3s ease-out ${idx * 0.03}s forwards`,
                      opacity: 0,
                      backgroundColor: isJustificationAccepted ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                    }}>
                      <td>{formatDateFull(lesson.date)}</td>
                      <td>
                        {typeof lesson.startTime === 'string' ? (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                            {lesson.startTime.substring(0, 5)}{typeof lesson.endTime === 'string' ? ` - ${lesson.endTime.substring(0, 5)}` : ''}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                          {isInProgress && (
                            <span className="animate-pulse" style={{
                              background: lesson.type === 'extra' ? '#a855f7' : 'var(--color-info)', color: 'white',
                              padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                              display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content'
                            }}>
                              <Clock size={12} /> • AULA EM ANDAMENTO
                            </span>
                          )}
                          {isCancelled ? (
                            <span style={{
                              background: 'var(--color-danger)', color: 'white',
                              padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, width: 'fit-content'
                            }}>
                              CANCELADA
                            </span>
                          ) : isRescheduled ? (
                            <span style={{
                              background: '#8b5cf6', color: 'white',
                              padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, width: 'fit-content'
                            }}>
                              REAGENDADA
                            </span>
                          ) : (isCompleted || parseLessonDateTime(lesson.date || '', '23:59:59') < now.getTime()) ? (
                            <span style={{
                              background: 'var(--color-success)', color: 'white',
                              padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600,
                              display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content'
                            }}>
                              <CheckCircle2 size={12} /> CONCLUÍDA
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              <span style={{
                                background: 'var(--bg-primary-alpha)', color: 'var(--color-primary)',
                                padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, width: 'fit-content'
                              }}>
                                AGENDADA
                              </span>
                                {lesson.type === 'extra' && (
                                  <span style={{
                                    background: '#9333ea', color: 'white',
                                    padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, width: 'fit-content'
                                  }}>
                                    AULA EXTRA
                                  </span>
                                )}
                                {lesson.type === 'reposicao' && (
                                  <span style={{
                                    background: '#22c55e', color: 'white',
                                    padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, width: 'fit-content'
                                  }}>
                                    REPOSIÇÃO
                                  </span>
                                )}
                              </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {isPresent ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-success)' }}>
                            <CheckCircle2 size={16} /> Presente
                          </span>
                        ) : isJustificationAccepted ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontWeight: 600 }}>
                            <AlertTriangle size={16} /> Falta Justificada
                          </span>
                        ) : hasJustification ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-info)', fontWeight: 500 }}>
                            <Clock size={16} /> Justificativa Pendente
                          </span>
                        ) : (isCompleted || parseLessonDateTime(lesson.date || '', '23:59:59') < now.getTime()) ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-danger)' }}>
                            <XCircle size={16} /> Falta
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                            Aguardando
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {atts.length > 0 ? (
                            atts
                              .filter(a => a.type === 'presence' || a.verified)
                              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                              .map((a, aIdx) => {
                                const d = new Date(a.date);
                                if (isNaN(d.getTime())) return null;
                                return (
                                  <span key={a.id} style={{ 
                                    fontSize: '0.8125rem', 
                                    color: 'var(--color-text-secondary)', 
                                    fontWeight: 500,
                                    display: 'block',
                                    borderLeft: isCancelled ? '4px solid var(--color-danger)'
                                      : isInProgress && !isCancelled ? '4px solid var(--color-info)'
                                      : isRescheduled ? '4px solid #8b5cf6'
                                      : isCompleted ? '4px solid var(--color-success)'
                                      : '4px solid var(--color-primary)',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    width: 'fit-content'
                                  }}>
                                    {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                );
                              })
                          ) : (
                            <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                          )}
                          {atts.length > 0 && atts.filter(a => a.type === 'presence' || a.verified).length === 0 && (
                             <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {justText ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: isJustificationAccepted ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                            <FileText size={14} color="currentColor" />
                            {isJustificationAccepted ? 'Justificativa Aceita' : 'Em Análise'}
                          </span>
                        ) : canJustify ? (
                          <button
                            onClick={() => {
                              const timestamp = new Date(parseLessonDateTime(lesson.date, lesson.startTime || '00:00:00')).toISOString();
                              openJustifyModal(timestamp);
                            }}
                            style={{
                              fontSize: '0.75rem', padding: '0.375rem 0.75rem', borderRadius: 8,
                              background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                              fontFamily: 'Inter, sans-serif', fontWeight: 500,
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                          >
                            <Send size={14} />
                            Justificar
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {justText ? (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', maxWidth: 250, display: 'block', wordBreak: 'break-word' }}>
                            {justText}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========== MODAL DE JUSTIFICATIVA ========== */}
      {showJustifyModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--overlay-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '1rem',
        }}>
          <div className="glass-card animate-scale-in" style={{
            width: '100%', maxWidth: 500, padding: '2rem',
            background: 'var(--color-surface)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '1.5rem',
            }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>Justificar Falta</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  Selecione a data e descreva o motivo
                </p>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: 'var(--color-surface-light)', border: '1px solid var(--glass-border)',
                  borderRadius: 8, width: 32, height: 32, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--color-text-secondary)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div style={{
                background: 'var(--bg-danger-alpha)', color: 'var(--color-danger)',
                padding: '0.75rem', borderRadius: 8, fontSize: '0.8125rem', marginBottom: '1rem',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleJustify} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                  Data da aula *
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    className="input-field"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{
                      appearance: 'none', paddingRight: '2.5rem',
                      cursor: 'pointer', width: '100%',
                    }}
                  >
                    <option value="">— Selecione a data da aula —</option>
                    {justifiableLessons
                      .sort((a, b) => {
                        const msA = parseLessonDateTime(a.date, a.startTime);
                        const msB = parseLessonDateTime(b.date, b.startTime);
                        return (isNaN(msB) ? 0 : msB) - (isNaN(msA) ? 0 : msA);
                      })
                      .map(l => {
                        const ts = new Date(parseLessonDateTime(l.date, l.startTime || '00:00:00')).toISOString();
                        return (
                          <option key={l.id} value={ts}>
                            {formatDateFull(l.date)}{l.startTime ? ` — ${l.startTime.substring(0, 5)}` : ''}{l.endTime ? ` às ${l.endTime.substring(0, 5)}` : ''}
                          </option>
                        );
                      })
                    }
                  </select>
                  <ChevronDown size={18} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    pointerEvents: 'none', color: 'var(--color-text-secondary)',
                  }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                  Motivo da ausência *
                </label>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Descreva o motivo da sua falta (ex: Atestado médico, problema familiar...)"
                  value={justificationText}
                  onChange={e => setJustificationText(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                  Anexar documento (opcional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="input-field"
                  style={{ padding: '0.5rem' }}
                />
                {justificationFile && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>
                    ✅ Arquivo carregado com sucesso
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeModal}
                  disabled={submitLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitLoading}
                  style={{ minWidth: 120, display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}
                >
                  {submitLoading ? (
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <><Send size={14} /> Enviar</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
