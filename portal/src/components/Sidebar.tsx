import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, CreditCard, BookOpen, CalendarCheck, CalendarClock,
  FileText, Award, User, LogOut, GraduationCap, X, Menu, ClipboardList
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { normalizePhotoUrl } from '../helpers';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/minhas-aulas', label: 'Cronograma', icon: CalendarClock },
  { path: '/financeiro', label: 'Financeiro', icon: CreditCard },
  { path: '/notas', label: 'Notas', icon: BookOpen },
  { path: '/avaliacoes', label: 'Atividades e Provas', icon: ClipboardList },
  { path: '/frequencia', label: 'Frequência', icon: CalendarCheck },
  { path: '/contratos', label: 'Contratos', icon: FileText },
  { path: '/certificados', label: 'Certificados', icon: Award },
  { path: '/meus-dados', label: 'Meus Dados', icon: User },
];

export default function Sidebar() {
  const { logout, student, schoolLogo } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <>
      {/* Mobile toggle */}
      <button
        id="sidebar-toggle"
        onClick={() => setMobileOpen(true)}
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 1001,
          background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
          border: '1px solid var(--glass-border)', borderRadius: 12,
          padding: 10, color: 'var(--color-text)', cursor: 'pointer',
          display: 'none',
        }}
        className="mobile-sidebar-toggle"
      >
        <Menu size={22} />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'var(--overlay-bg)',
            zIndex: 1099, display: 'block',
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: desktopCollapsed ? 80 : 280,
          minHeight: '100vh',
          background: 'var(--gradient-sidebar)',
          borderRight: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1100,
          transition: 'width 0.3s ease, transform 0.3s ease',
        }}
        className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
      >
        {/* Desktop Collapse Toggle */}
        <button
          onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          className="desktop-collapse-btn"
          title={desktopCollapsed ? "Expandir menu" : "Recolher menu"}
          style={{
            position: 'absolute', top: 22, right: -14, zIndex: 1200,
            background: 'var(--color-surface)', border: '1px solid var(--glass-border)',
            borderRadius: '50%', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--color-text-secondary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {desktopCollapsed ? <Menu size={14} /> : <X size={14} />}
        </button>

        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="mobile-close-btn"
          style={{
            position: 'absolute', top: 12, right: 12, display: 'none',
            background: 'none', border: 'none', color: 'var(--color-text-secondary)',
            cursor: 'pointer', padding: 4,
          }}
        >
          <X size={20} />
        </button>

        {/* Logo */}
        <div style={{
          padding: desktopCollapsed ? '2rem 1rem' : '2rem 1.5rem', 
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: desktopCollapsed ? 'center' : 'flex-start',
          gap: '0.75rem', transition: 'all 0.3s ease',
        }}>
          {schoolLogo ? (
            <img
              src={normalizePhotoUrl(schoolLogo)}
              alt="EduManager"
              style={{
                width: desktopCollapsed ? 40 : 44, height: desktopCollapsed ? 40 : 44, 
                objectFit: 'contain', transition: 'all 0.3s ease', borderRadius: 8,
              }}
            />
          ) : (
            <div style={{
              width: desktopCollapsed ? 40 : 44, height: desktopCollapsed ? 40 : 44, 
              borderRadius: 14, background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.3s ease',
            }}>
              <GraduationCap size={desktopCollapsed ? 20 : 24} color="white" />
            </div>
          )}
          
          {!desktopCollapsed && (
            <div className="sidebar-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.2 }}>
                Portal do <span className="gradient-text">Aluno</span>
              </h1>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                EduManager
              </p>
            </div>
          )}
        </div>

        {/* Student Info */}
        {student && (
          <div style={{
            padding: desktopCollapsed ? '1rem' : '1.25rem 1.5rem',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: desktopCollapsed ? 'center' : 'flex-start', 
            gap: '0.75rem', transition: 'all 0.3s ease',
          }}>
            <div style={{
              width: desktopCollapsed ? 36 : 40, height: desktopCollapsed ? 36 : 40, 
              borderRadius: '50%', background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 700, flexShrink: 0,
              overflow: 'hidden', transition: 'all 0.3s ease', color: 'white'
            }}>
              {student.photo ? (
                <img src={normalizePhotoUrl(student.photo)} alt={student.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                student.name.charAt(0).toUpperCase()
              )}
            </div>
            {!desktopCollapsed && (
              <div className="sidebar-text" style={{ overflow: 'hidden', flex: 1, whiteSpace: 'nowrap' }}>
                <p style={{
                  fontSize: '0.8125rem', fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {student.name}
                </p>
                <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
                  {student.enrollmentNumber}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav style={{
          flex: 1, padding: '1rem 0.75rem',
          display: 'flex', flexDirection: 'column', gap: '0.25rem',
          overflowY: 'auto', overflowX: 'hidden'
        }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={desktopCollapsed ? item.label : undefined}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', 
                justifyContent: desktopCollapsed ? 'center' : 'flex-start',
                gap: '0.75rem',
                padding: desktopCollapsed ? '0.75rem 0' : '0.75rem 1rem', 
                borderRadius: 12,
                textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
                transition: 'all 0.2s ease',
                color: isActive ? 'white' : 'var(--color-text-secondary)',
                background: isActive ? 'var(--color-success)' : 'transparent',
                boxShadow: isActive ? '0 4px 12px var(--bg-success-alpha)' : 'none',
                borderLeft: isActive ? '4px solid var(--color-success)' : '4px solid transparent',
              })}
            >
              <item.icon size={20} />
              {!desktopCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--glass-border)' }}>
          <button
            id="logout-btn"
            onClick={logout}
            title={desktopCollapsed ? "Sair" : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', 
              justifyContent: desktopCollapsed ? 'center' : 'flex-start',
              gap: '0.75rem',
              padding: desktopCollapsed ? '0.75rem 0' : '0.75rem 1rem', 
              borderRadius: 12, border: 'none',
              background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)',
              cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
              transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }}
          >
            <LogOut size={20} />
            {!desktopCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .mobile-sidebar-toggle { display: flex !important; }
          .mobile-close-btn { display: block !important; }
          .desktop-collapse-btn { display: none !important; }
          .sidebar {
            position: fixed !important;
            left: 0; top: 0;
            width: 280px !important;
            transform: translateX(-100%);
            box-shadow: 4px 0 24px rgba(0,0,0,0.4);
          }
          .sidebar.sidebar-open {
            transform: translateX(0);
          }
          .sidebar-text { display: block !important; }
        }
      `}</style>
    </>
  );
}
