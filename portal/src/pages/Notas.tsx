import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, FileText } from 'lucide-react';
import type { Grade, Subject } from '../types';

interface GradeWithSubject extends Grade {
  subjectName: string;
  examTitle?: string;
  evaluationType?: string;
  maxScore?: number;
  periodName?: string;
  correctCount?: number;
  wrongCount?: number;
}

export default function Notas() {
  const { token } = useAuth();
  const [grades, setGrades] = useState<GradeWithSubject[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/portal/notas', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setGrades(data.grades || []);
        setPeriods(data.periods || []);
        setAllSubjects(data.allSubjects || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: '100%', height: 300, borderRadius: 16 }} />
      </div>
    );
  }

  const displaySubjects = allSubjects.length > 0 
    ? allSubjects 
    : [...new Set(grades.map(g => g.subjectId))].map(id => ({ 
        id, 
        name: grades.find(g => String(g.subjectId) === String(id))?.subjectName || id 
      }));

  // General average logic
  const calculateGeneralAverage = () => {
    if (displaySubjects.length === 0 || grades.length === 0) return 0;
    
    let totalSum = 0;
    let totalCount = 0;

    displaySubjects.forEach(subject => {
      const subjectId = typeof subject === 'string' ? subject : subject.id;
      const subjectGrades = grades.filter(g => String(g.subjectId) === String(subjectId));
      if (subjectGrades.length === 0) return;

      const periodValues: Record<string, number[]> = {};
      subjectGrades.forEach(g => {
        const periodKey = String(g.periodName || g.period);
        if (!periodValues[periodKey]) periodValues[periodKey] = [];
        periodValues[periodKey].push(g.value);
      });

      const periodAvgs: number[] = [];
      Object.values(periodValues).forEach(values => {
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          periodAvgs.push(sum / values.length);
        }
      });

      if (periodAvgs.length > 0) {
        const subjectAvg = periodAvgs.reduce((a, b) => a + b, 0) / periodAvgs.length;
        totalSum += subjectAvg;
        totalCount++;
      }
    });

    return totalCount > 0 ? totalSum / totalCount : 0;
  };

  const totalAvg = calculateGeneralAverage();

  const getGradeColor = (value: number, maxScore: number = 10) => {
    const percentage = (value / maxScore) * 10;
    if (percentage >= 7) return 'var(--color-success)';
    if (percentage >= 5) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const getBgColor = (value: number, maxScore: number = 10) => {
    const percentage = (value / maxScore) * 10;
    if (percentage >= 7) return 'var(--bg-success-alpha)';
    if (percentage >= 5) return 'var(--bg-warning-alpha)';
    return 'var(--bg-danger-alpha)';
  };

  return (
    <div className="page-container">
      <div className="animate-fade-in" style={{ 
        marginBottom: '2rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div>
          <h1 className="page-title">Notas & Boletim</h1>
          <p className="page-subtitle">Acompanhe seu desempenho detalhado por disciplina</p>
        </div>

        <div className="glass-card" style={{ 
          padding: '1rem 2rem', 
          textAlign: 'center',
          background: 'var(--bg-primary-alpha)',
          border: '1px solid var(--color-primary-alpha)',
          borderRadius: '24px',
          minWidth: 200
        }}>
          <p style={{ 
            fontSize: '0.75rem', 
            fontWeight: 700, 
            color: 'var(--color-primary)', 
            letterSpacing: '0.1em', 
            marginBottom: '0.25rem',
            textTransform: 'uppercase'
          }}>Média Geral (Estimada)</p>
          <p style={{ 
            fontSize: totalAvg > 0 ? '3rem' : '1.25rem', 
            fontWeight: 800, 
            color: 'var(--color-text-primary)',
            lineHeight: 1.2,
            marginTop: 0,
            marginBottom: 0,
            whiteSpace: 'nowrap'
          }}>
            {totalAvg > 0 ? totalAvg.toFixed(1) : 'Aguardando notas...'}
          </p>
        </div>
      </div>

      {displaySubjects.length === 0 ? (
        <div className="glass-card animate-fade-in" style={{
          padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)',
        }}>
          <BookOpen size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ fontSize: '0.9375rem' }}>Nenhuma matéria cadastrada no curso</p>
        </div>
      ) : (
        <div className="stagger-children">
          {displaySubjects.map((subject, idx) => {
            const subjectId = typeof subject === 'string' ? subject : subject.id;
            const subjectName = typeof subject === 'string' ? subject : subject.name;
            const subjectGrades = grades.filter(g => String(g.subjectId) === String(subjectId));
            
            // Calculate Subject Average
            const periodValues: Record<string, number[]> = {};
            subjectGrades.forEach(g => {
              const periodKey = String(g.periodName || g.period);
              if (!periodValues[periodKey]) periodValues[periodKey] = [];
              periodValues[periodKey].push(g.value);
            });
            const pAvgs: number[] = [];
            Object.values(periodValues).forEach(values => {
              if (values.length > 0) {
                pAvgs.push(values.reduce((a, b) => a + b, 0) / values.length);
              }
            });
            const subjectAvg = pAvgs.length > 0 ? pAvgs.reduce((a, b) => a + b, 0) / pAvgs.length : null;
            
            return (
              <div key={subjectId} className="glass-card animate-fade-in" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', background: 'var(--color-surface-light)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>{subjectName}</h2>
                  {subjectAvg !== null && (
                    <div style={{ padding: '4px 12px', borderRadius: '8px', background: getBgColor(subjectAvg), color: getGradeColor(subjectAvg), fontWeight: 800, fontSize: '0.85rem' }}>
                      MÉDIA: {subjectAvg.toFixed(1)}
                    </div>
                  )}
                </div>
                
                <div style={{ padding: '1.5rem' }}>
                  {periods.map(period => {
                    const periodGrades = subjectGrades.filter(g => String(g.periodName || g.period) === String(period));
                    if (periodGrades.length === 0) return null;

                    const periodAvg = periodGrades.length > 0 ? periodGrades.reduce((sum, g) => sum + g.value, 0) / periodGrades.length : 0;

                    return (
                      <div key={period} style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '2px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                          <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>{period}</h3>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            Média do Período: <span style={{ color: getGradeColor(periodAvg, 10) }}>{periodAvg.toFixed(1)}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {periodGrades.map((grade) => {
                            const isActivity = grade.evaluationType === 'activity';
                            const maxScore = grade.maxScore ?? 10;
                            const isDirect = !(grade as any).examId;

                            return (
                              <div key={grade.id} style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                padding: '0.75rem 1rem', 
                                background: 'var(--color-surface)', 
                                border: '1px solid var(--glass-border)', 
                                borderRadius: '12px' 
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div style={{ 
                                    padding: '4px', borderRadius: '6px', 
                                    background: isDirect ? 'var(--bg-warning-alpha)' : isActivity ? 'var(--bg-info-alpha, #e0f2fe)' : 'var(--bg-primary-alpha)',
                                    color: isDirect ? 'var(--color-warning)' : isActivity ? 'var(--color-info, #0369a1)' : 'var(--color-primary)'
                                  }}>
                                    <FileText size={16} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                      {isDirect ? 'Lançamento Direto (Professor)' : grade.examTitle || 'Avaliação sem título'}
                                    </div>
                                    {!isDirect && (
                                      <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span>{isActivity ? 'ATIVIDADE' : 'PROVA'} • VALE: {maxScore} PTS</span>
                                        {grade.correctCount !== undefined && grade.wrongCount !== undefined && (
                                          <>
                                            <span style={{ color: 'var(--glass-border)' }}>|</span>
                                            <span style={{ color: 'var(--color-success)' }}>{grade.correctCount} Acertos</span>
                                            <span style={{ color: 'var(--color-danger)' }}>{grade.wrongCount} Erros</span>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div style={{ 
                                  padding: '4px 12px', borderRadius: '8px', 
                                  background: getBgColor(grade.value, maxScore),
                                  color: getGradeColor(grade.value, maxScore),
                                  fontWeight: 800, fontSize: '0.9rem'
                                }}>
                                  {grade.value.toFixed(1)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {subjectGrades.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem', padding: '1rem' }}>
                      Nenhuma nota lançada para esta disciplina.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="animate-fade-in" style={{
        display: 'flex', gap: '1.5rem', marginTop: '1rem',
        fontSize: '0.75rem', color: 'var(--color-text-secondary)',
        flexWrap: 'wrap',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)' }} />
          Bom Desempenho
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-warning)' }} />
          Atenção
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-danger)' }} />
          Baixo Desempenho
        </span>
      </div>
    </div>
  );
}
