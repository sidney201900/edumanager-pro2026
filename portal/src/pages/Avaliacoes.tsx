import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Exam, ExamSubmission } from '../types';
import {
  ClipboardList, Clock, ChevronLeft, ChevronRight, Send, CheckCircle2,
  XCircle, Award, AlertTriangle, Timer, ArrowLeft, RefreshCw
} from 'lucide-react';
import { normalizePhotoUrl } from '../helpers';

// ==========================================
// Exam Environment — Portal do Aluno
// ==========================================

type ExamView = 'listing' | 'exam' | 'result';

interface ExamResult {
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  percentage: number;
  final_score: number;
}

export default function Avaliacoes() {
  const { token } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'exams' | 'activities'>('exams');

  // Exam mode state
  const [view, setView] = useState<ExamView>('listing');
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // In-app modal state (replaces native alert/confirm)
  const [modalMsg, setModalMsg] = useState('');
  const [modalType, setModalType] = useState<'info' | 'error' | 'confirm' | 'loading'>('info');
  const [showModal, setShowModal] = useState(false);
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

  const showAppAlert = (msg: string, type: 'info' | 'error' = 'info') => {
    setModalMsg(msg);
    setModalType(type);
    setConfirmCallback(null);
    setShowModal(true);
  };

  const showAppConfirm = (msg: string, onConfirm: () => void) => {
    setModalMsg(msg);
    setModalType('confirm');
    setConfirmCallback(() => onConfirm);
    setShowModal(true);
  };

  // Fetch exams
  const fetchExams = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/portal/avaliacoes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setExams(data.exams || []);
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // Timer logic
  useEffect(() => {
    if (view !== 'exam' || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-submit when time runs out
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, timeLeft > 0]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Start exam
  const startExam = (exam: Exam) => {
    setActiveExam(exam);
    setCurrentQ(0);
    setAnswers({});
    setTimeLeft(exam.durationMinutes * 60);
    setResult(null);
    setView('exam');
  };

  // Submit exam
  const handleSubmit = async (autoSubmit = false) => {
    if (submitting || !activeExam) return;
    setSubmitting(true);
    
    const typeLabel = (activeExam as any).evaluationType === 'activity' ? 'atividade' : 'prova';
    
    // Show Loading Modal
    setModalType('loading');
    setModalMsg(`Enviando sua ${typeLabel}... Por favor, aguarde e não feche esta janela.`);
    setShowModal(true);

    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch('/api/portal/avaliacoes/submeter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ examId: activeExam.id, answers }),
      });

      const data = await res.json();
      
      // Artificial delay of 5 seconds to let the student read the message
      await new Promise(resolve => setTimeout(resolve, 5000));

      if (data.success) {
        // Show Success Modal
        setModalType('info');
        setModalMsg(`Sua ${typeLabel} foi enviada com sucesso! Clique em OK para ver seu resultado.`);
        setShowModal(true);
        
        setConfirmCallback(() => {
            setResult(data.result);
            setView('result');
            fetchExams();
        });
      } else {
        const errorCode = `ERR-${activeExam.id.substring(0, 4)}-${new Date().getTime().toString().slice(-4)}`;
        // Use the error message from server if available
        showAppAlert(data.error || `Não foi possível enviar sua nota. Tente novamente ou contate o suporte. (Código: ${errorCode})`, 'error');
        if (!autoSubmit) setView('listing');
      }
    } catch (err) {
      console.error(err);
      const errorCode = `CONN-ERR-${new Date().getTime().toString().slice(-4)}`;
      showAppAlert(`Erro de conexão ao enviar prova. Verifique sua internet. (Código: ${errorCode})`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const getSubmission = (examId: string) =>
    submissions.find(s => s.exam_id === examId);

  // ==========================================
  // RENDER: Listing
  // ==========================================
  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 250, height: 32, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 200, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Exam Mode (Focused)
  // ==========================================
  if (view === 'exam' && activeExam) {
    const questions = activeExam.questions || [];
    const question = questions[currentQ];
    const totalQ = questions.length;
    const answeredCount = Object.keys(answers).length;
    const isUrgent = timeLeft <= 60;
    const progress = totalQ > 0 ? ((currentQ + 1) / totalQ) * 100 : 0;

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--color-surface)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Exam Header */}
        <div style={{
          padding: '1rem 1.5rem',
          background: 'var(--glass-bg)',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ClipboardList size={24} color="var(--color-primary)" />
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>{activeExam.title}</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Questão {currentQ + 1} de {totalQ} • {answeredCount}/{totalQ} respondidas
              </p>
            </div>
          </div>

          {/* Timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', borderRadius: 12,
            background: isUrgent ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-primary-alpha)',
            border: `1px solid ${isUrgent ? 'var(--color-danger)' : 'var(--color-primary-alpha)'}`,
            animation: isUrgent ? 'pulse 1s infinite' : undefined,
          }}>
            <Timer size={18} color={isUrgent ? 'var(--color-danger)' : 'var(--color-primary)'} />
            <span style={{
              fontSize: '1.25rem', fontWeight: 800, fontFamily: 'monospace',
              color: isUrgent ? 'var(--color-danger)' : 'var(--color-text)',
            }}>
              {formatTimer(timeLeft)}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ height: 4, background: 'var(--glass-border)' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'var(--gradient-primary)',
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Question Area */}
        <div style={{
          flex: 1, overflow: 'auto',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          padding: '2rem 1.5rem',
        }}>
          <div style={{ maxWidth: 700, width: '100%' }}>
            {question && (
              <div className="animate-fade-in" key={question.id}>
                {/* Question Text & Image */}
                <div className="glass-card" style={{
                  padding: '2rem', marginBottom: '1.5rem',
                  borderLeft: '4px solid var(--color-primary)',
                }}>
                  <span style={{
                    display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
                    background: 'var(--bg-primary-alpha)', color: 'var(--color-primary)',
                    padding: '2px 10px', borderRadius: 20, marginBottom: '1rem',
                  }}>
                    QUESTÃO {currentQ + 1}
                  </span>
                  <p style={{ fontSize: '1.05rem', fontWeight: 500, lineHeight: 1.6, marginBottom: question.imageUrl ? '1.5rem' : 0 }}>
                    {question.text}
                  </p>
                  
                  {question.imageUrl && (
                    <div style={{ 
                      marginTop: '1.5rem', 
                      borderRadius: 12, 
                      overflow: 'hidden',
                      border: '2px solid var(--glass-border)',
                      background: 'white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ padding: '8px 12px', background: 'var(--bg-primary-alpha)', borderBottom: '1px solid var(--glass-border)', fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Imagem de Apoio
                      </div>
                      <img 
                        src={normalizePhotoUrl(question.imageUrl)} 
                        alt="Imagem de apoio" 
                        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'zoom-in' }} 
                        onClick={() => window.open(normalizePhotoUrl(question.imageUrl), '_blank')}
                      />
                    </div>
                  )}
                </div>

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {question.options.map((opt, idx) => {
                    const isSelected = answers[question.id] === idx;
                    const letter = String.fromCharCode(65 + idx); // A, B, C, D...
                    return (
                      <button
                        key={idx}
                        onClick={() => selectAnswer(question.id, idx)}
                        className="glass-card"
                        style={{
                          padding: '1rem 1.25rem',
                          display: 'flex', alignItems: 'center', gap: '1rem',
                          cursor: 'pointer', border: 'none', textAlign: 'left',
                          outline: isSelected ? '2px solid var(--color-primary)' : 'none',
                          background: isSelected
                            ? 'var(--bg-primary-alpha)'
                            : 'var(--color-surface-light)',
                          transition: 'all 0.2s ease',
                          borderRadius: 12,
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.875rem', fontWeight: 700, flexShrink: 0,
                          background: isSelected ? 'var(--color-primary)' : 'var(--glass-border)',
                          color: isSelected ? 'white' : 'var(--color-text-secondary)',
                          transition: 'all 0.2s ease',
                        }}>
                          {letter}
                        </div>
                        <span style={{
                          fontSize: '0.9rem', fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--color-text)' : 'var(--color-text-secondary)',
                        }}>
                          {opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          background: 'var(--glass-bg)',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backdropFilter: 'blur(12px)',
        }}>
          <button
            onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
            disabled={currentQ === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.6rem 1.25rem', borderRadius: 10,
              border: '1px solid var(--glass-border)',
              background: 'var(--color-surface-light)',
              color: currentQ === 0 ? 'var(--color-text-secondary)' : 'var(--color-text)',
              cursor: currentQ === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: '0.85rem',
              opacity: currentQ === 0 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={18} /> Anterior
          </button>

          {/* Question dots */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentQ(i)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.7rem', fontWeight: 700,
                  background: i === currentQ
                    ? 'var(--color-primary)'
                    : answers[q.id] !== undefined
                    ? 'var(--color-success)'
                    : 'var(--glass-border)',
                  color: (i === currentQ || answers[q.id] !== undefined) ? 'white' : 'var(--color-text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {currentQ < totalQ - 1 ? (
            <button
              onClick={() => setCurrentQ(prev => Math.min(totalQ - 1, prev + 1))}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.6rem 1.25rem', borderRadius: 10,
                border: 'none',
                background: 'var(--color-primary)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600, fontSize: '0.85rem',
              }}
            >
              Próxima <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={() => {
                if (answeredCount < totalQ) {
                  showAppConfirm(
                    `Você respondeu ${answeredCount} de ${totalQ} questões. Deseja finalizar mesmo assim?`,
                    () => handleSubmit()
                  );
                } else {
                  handleSubmit();
                }
              }}
              disabled={submitting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.6rem 1.5rem', borderRadius: 10,
                border: 'none',
                background: 'var(--color-success)',
                color: 'white',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.85rem',
                boxShadow: '0 4px 12px var(--bg-success-alpha)',
              }}
            >
              <Send size={16} /> {submitting ? 'Enviando...' : 'Finalizar Prova'}
            </button>
          )}
        </div>

        {/* In-App Modal */}
        {showModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}>
            <div className="glass-card animate-scale-in" style={{
              maxWidth: 400, width: '100%', padding: '2rem', textAlign: 'center',
              background: 'var(--color-surface)',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 1rem',
                background: modalType === 'error' ? 'var(--bg-danger-alpha)' : modalType === 'confirm' ? 'var(--bg-warning-alpha)' : 'var(--bg-primary-alpha)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {modalType === 'error'
                  ? <XCircle size={28} color="var(--color-danger)" />
                  : modalType === 'confirm'
                  ? <AlertTriangle size={28} color="var(--color-warning)" />
                  : modalType === 'loading'
                  ? <RefreshCw size={28} color="var(--color-primary)" className="animate-spin" />
                  : <CheckCircle2 size={28} color="var(--color-primary)" />
                }
              </div>
              <p style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: modalType === 'loading' ? 0 : '1.5rem', lineHeight: 1.5 }}>
                {modalMsg}
              </p>
              {modalType !== 'loading' && (
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  {modalType === 'confirm' ? (
                  <>
                    <button
                      onClick={() => setShowModal(false)}
                      style={{
                        flex: 1, padding: '0.65rem', borderRadius: 10,
                        border: '1px solid var(--glass-border)',
                        background: 'var(--color-surface-light)',
                        color: 'var(--color-text)', fontWeight: 600,
                        cursor: 'pointer', fontSize: '0.85rem',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => { setShowModal(false); confirmCallback?.(); }}
                      style={{
                        flex: 1, padding: '0.65rem', borderRadius: 10,
                        border: 'none',
                        background: 'var(--color-success)',
                        color: 'white', fontWeight: 700,
                        cursor: 'pointer', fontSize: '0.85rem',
                      }}
                    >
                      Sim, Finalizar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowModal(false)}
                    style={{
                      width: '100%', padding: '0.65rem', borderRadius: 10,
                      border: 'none',
                      background: 'var(--color-primary)',
                      color: 'white', fontWeight: 700,
                      cursor: 'pointer', fontSize: '0.85rem',
                    }}
                  >
                    OK
                  </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: Result Screen
  // ==========================================
  if (view === 'result' && result) {
    const isApproved = result.final_score >= 6;
    const getMessage = () => {
      if (result.percentage >= 90) return 'Excelente! Você arrasou! 🎉';
      if (result.percentage >= 70) return 'Muito bem! Continue assim! 💪';
      if (result.percentage >= 50) return 'Bom resultado. Pratique mais! 📚';
      return 'Não desanime! Revise o conteúdo e tente novamente. 📖';
    };

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--color-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
      }}>
        <div className="glass-card animate-scale-in" style={{
          maxWidth: 480, width: '100%', padding: '3rem 2rem', textAlign: 'center',
        }}>
          {/* Icon */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 1.5rem',
            background: isApproved ? 'var(--bg-success-alpha)' : 'var(--bg-danger-alpha)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isApproved
              ? <CheckCircle2 size={40} color="var(--color-success)" />
              : <AlertTriangle size={40} color="var(--color-danger)" />
            }
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Prova Finalizada!
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
            {getMessage()}
          </p>

          {/* Score Display */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '2rem',
            marginBottom: '2rem', flexWrap: 'wrap',
          }}>
            <div>
              <p style={{
                fontSize: '3rem', fontWeight: 900, lineHeight: 1,
                color: isApproved ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {result.final_score.toFixed(1)}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                NOTA FINAL
              </p>
            </div>
            <div style={{ width: 1, background: 'var(--glass-border)' }} />
            <div>
              <p style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, color: 'var(--color-text)' }}>
                {result.percentage.toFixed(0)}%
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                APROVEITAMENTO
              </p>
            </div>
          </div>

          {/* Details */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem',
            marginBottom: '2rem',
          }}>
            <div className="glass-card" style={{ padding: '1rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.total_questions}</p>
              <p style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>QUESTÕES</p>
            </div>
            <div className="glass-card" style={{ padding: '1rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>{result.correct_count}</p>
              <p style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ACERTOS</p>
            </div>
            <div className="glass-card" style={{ padding: '1rem', textAlign: 'center' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>{result.wrong_count}</p>
              <p style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ERROS</p>
            </div>
          </div>

          <button
            onClick={() => { setView('listing'); setActiveExam(null); setResult(null); }}
            style={{
              width: '100%', padding: '0.875rem',
              borderRadius: 12, border: 'none',
              background: 'var(--color-primary)', color: 'white',
              fontSize: '0.9rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <ArrowLeft size={18} /> Voltar às Atividades e Provas
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Listing (Default)
  // ==========================================
  const filteredExams = exams.filter(e => {
    const isActivity = (e as any).evaluationType === 'activity';
    return activeTab === 'activities' ? isActivity : !isActivity;
  });

  return (
    <div className="page-container">
      <div className="animate-fade-in" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Atividades e Provas</h1>
        <p className="page-subtitle">Provas e atividades disponíveis para você</p>
      </div>

      {/* Tabs */}
      <div className="animate-fade-in" style={{ 
        display: 'flex', gap: '0.5rem', marginBottom: '2rem', 
        background: 'var(--color-surface-light)', padding: '0.5rem', 
        borderRadius: '12px', border: '1px solid var(--glass-border)',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setActiveTab('exams')}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'exams' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'exams' ? 'white' : 'var(--color-text-secondary)',
            boxShadow: activeTab === 'exams' ? '0 2px 8px var(--bg-primary-alpha)' : 'none'
          }}
        >
          Provas ({exams.filter(e => (e as any).evaluationType !== 'activity').length})
        </button>
        <button
          onClick={() => setActiveTab('activities')}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'activities' ? 'var(--color-info, #0369a1)' : 'transparent',
            color: activeTab === 'activities' ? 'white' : 'var(--color-text-secondary)',
            boxShadow: activeTab === 'activities' ? '0 2px 8px rgba(3, 105, 161, 0.2)' : 'none'
          }}
        >
          Atividades ({exams.filter(e => (e as any).evaluationType === 'activity').length})
        </button>
      </div>

      {filteredExams.length === 0 ? (
        <div className="glass-card animate-fade-in" style={{
          padding: '4rem 2rem', textAlign: 'center',
          color: 'var(--color-text-secondary)',
        }}>
          <ClipboardList size={56} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>Nenhuma avaliação disponível no momento.</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>As provas aparecerão aqui quando forem publicadas pelo professor.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem',
        }} className="animate-fade-in stagger-children">
          {filteredExams.map(exam => {
            const sub = getSubmission(exam.id);
            const isDone = !!sub;

            return (
              <div key={exam.id} className="glass-card" style={{
                padding: '1.5rem',
                borderTop: isDone ? '3px solid var(--color-success)' : '3px solid var(--color-primary)',
                position: 'relative', overflow: 'hidden',
              }}>
                {isDone && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'var(--bg-success-alpha)', color: 'var(--color-success)',
                    padding: '4px 10px', borderRadius: 20,
                    fontSize: '0.65rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <CheckCircle2 size={12} /> REALIZADA
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      backgroundColor: (exam as any).evaluationType === 'activity' ? 'var(--bg-info-alpha, #e0f2fe)' : 'var(--bg-primary-alpha, #ede9fe)',
                      color: (exam as any).evaluationType === 'activity' ? 'var(--color-info, #0369a1)' : 'var(--color-primary, #6d28d9)',
                      border: `1px solid ${(exam as any).evaluationType === 'activity' ? '#bae6fd' : '#ddd6fe'}`
                    }}>
                      {(exam as any).evaluationType === 'activity' ? 'Atividade' : 'Prova'}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                      Vale: {(exam as any).maxScore ?? 10} pts
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4, paddingRight: isDone ? 90 : 0 }}>
                    {exam.title}
                  </h3>
                  {exam.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                      {exam.description}
                    </p>
                  )}
                </div>

                <div style={{
                  display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: '0.75rem', color: 'var(--color-text-secondary)',
                  }}>
                    <Clock size={14} /> {exam.durationMinutes} minutos
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: '0.75rem', color: 'var(--color-text-secondary)',
                  }}>
                    <ClipboardList size={14} /> {exam.questions.length} questões
                  </div>
                </div>

                {isDone ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.75rem 1rem', borderRadius: 10,
                      background: 'var(--bg-success-alpha)',
                    }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>SUA NOTA</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success)' }}>
                          {sub!.final_score.toFixed(1)}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ACERTOS</p>
                        <p style={{ fontSize: '1rem', fontWeight: 700 }}>
                          {sub!.correct_count}/{sub!.total_questions}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        showAppConfirm('Deseja realmente refazer? Sua nota anterior será substituída.', () => startExam(exam));
                      }}
                      style={{
                        width: '100%', padding: '0.65rem',
                        borderRadius: 10, border: '1px solid var(--color-primary-alpha)',
                        background: 'transparent', color: 'var(--color-primary)',
                        fontSize: '0.8rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      Refazer {(exam as any).evaluationType === 'activity' ? 'Atividade' : 'Prova'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startExam(exam)}
                    style={{
                      width: '100%', padding: '0.75rem',
                      borderRadius: 10, border: 'none',
                      background: 'var(--gradient-primary)', color: 'white',
                      fontSize: '0.875rem', fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 4px 15px var(--bg-primary-alpha)',
                    }}
                  >
                    <Award size={18} /> {(exam as any).evaluationType === 'activity' ? 'Iniciar Atividade' : 'Iniciar Prova'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
