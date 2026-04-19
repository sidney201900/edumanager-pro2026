import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen } from 'lucide-react';
import type { Grade, Subject } from '../types';

interface GradeWithSubject extends Grade {
  subjectName: string;
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

  // Use subjects from course instead of deriving from grades
  const displaySubjects = allSubjects.length > 0 
    ? allSubjects 
    : [...new Set(grades.map(g => g.subjectId))].map(id => ({ 
        id, 
        name: grades.find(g => g.subjectId === id)?.subjectName || id 
      }));

  // Logic for General Average: Only show if EVERY subject has a grade > 0
  const isAllGraded = displaySubjects.length > 0 && displaySubjects.every(s => {
    const subjectId = typeof s === 'string' ? s : s.id;
    const subjectGrades = grades.filter(g => g.subjectId === subjectId);
    return subjectGrades.length > 0 && subjectGrades.every(g => g.value > 0);
  });

  const totalAvg = isAllGraded 
    ? grades.reduce((s, g) => s + g.value, 0) / (displaySubjects.length || 1)
    : 0;

  const getGradeColor = (value: number) => {
    if (value >= 7) return 'var(--color-success)';
    if (value >= 5) return 'var(--color-warning)';
    return 'var(--color-danger)';
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
          <p className="page-subtitle">Acompanhe seu desempenho acadêmico</p>
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
          }}>Média Geral</p>
          <p style={{ 
            fontSize: isAllGraded ? '3rem' : '1.25rem', 
            fontWeight: 800, 
            color: 'var(--color-text-primary)',
            lineHeight: 1.2,
            marginTop: 0,
            marginBottom: 0,
            whiteSpace: 'nowrap'
          }}>
            {isAllGraded ? totalAvg.toFixed(1) : 'Aguardando notas...'}
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
        <div className="glass-card animate-fade-in" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th style={{ textAlign: 'center' }}>Nota / Média</th>
                </tr>
              </thead>
              <tbody>
                {displaySubjects.map((s, idx) => {
                  const subjectId = typeof s === 'string' ? s : s.id;
                  const subjectName = typeof s === 'string' ? s : s.name;

                  const subjectGrades = grades.filter(g => g.subjectId === subjectId);
                  const avg = subjectGrades.length > 0
                    ? subjectGrades.reduce((sum, g) => sum + g.value, 0) / subjectGrades.length
                    : 0;
                  return (
                    <tr key={subjectId} style={{
                      animation: `fadeIn 0.3s ease-out ${idx * 0.05}s forwards`,
                      opacity: 0,
                    }}>
                      <td style={{ fontWeight: 500 }}>
                        {subjectName}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {subjectGrades.length > 0 && avg > 0 ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 48, height: 32, borderRadius: 8, padding: '0 8px',
                            background: avg >= 7 ? 'var(--bg-success-alpha)' : avg >= 5 ? 'var(--bg-warning-alpha)' : 'var(--bg-danger-alpha)',
                            fontWeight: 700, fontSize: '0.925rem',
                            color: getGradeColor(avg),
                          }}>
                            {avg.toFixed(1)}
                          </span>
                        ) : (
                          <span style={{ 
                            padding: '4px 10px',
                            background: 'var(--color-surface-light)',
                            borderRadius: 6,
                            color: 'var(--color-text-secondary)', 
                            fontSize: '0.7rem', 
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.025em'
                          }}>
                            Aguardando
                          </span>
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

      {/* Legend */}
      <div className="animate-fade-in" style={{
        display: 'flex', gap: '1.5rem', marginTop: '1rem',
        fontSize: '0.75rem', color: 'var(--color-text-secondary)',
        flexWrap: 'wrap',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)' }} />
          Aprovado (≥ 7.0)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-warning)' }} />
          Recuperação (5.0 - 6.9)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-danger)' }} />
          Reprovado (&lt; 5.0)
        </span>
      </div>
    </div>
  );
}
