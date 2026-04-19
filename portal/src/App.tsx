import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MinhasAulas from './pages/MinhasAulas';
import Financeiro from './pages/Financeiro';
import Notas from './pages/Notas';
import Frequencia from './pages/Frequencia';
import Contratos from './pages/Contratos';
import Certificados from './pages/Certificados';
import MeusDados from './pages/MeusDados';
import Avaliacoes from './pages/Avaliacoes';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

function AppLayout() {
  const { token } = useAuth();
  const [overdueCount, setOverdueCount] = useState(0);

  const normalizeStatus = (payment: any) => {
    const s = payment.status?.toLowerCase();
    if (['paid', 'received', 'confirmed', 'pago'].includes(s)) return 'paid';
    if (['cancelled', 'cancelado'].includes(s)) return 'cancelled';
    
    // Check if explicitly overdue in database
    if (['overdue', 'atrasado', 'atrasada', 'vencido'].includes(s)) return 'overdue';
    
    // Everything else that is not paid/cancelled is treated as pending
    return 'pending';
  };

  useEffect(() => {
    if (!token) return;
    const checkFinance = async () => {
      try {
        const res = await fetch('/api/portal/financeiro', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const atrasadas = (data.payments || []).filter((p: any) => 
            normalizeStatus(p) === 'overdue'
          ).length;
          setOverdueCount(atrasadas);
        }
      } catch (err) {
        console.error('Erro ao verificar financeiro:', err);
      }
    };
    
    checkFinance();
    const interval = setInterval(checkFinance, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-surface)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header />
        
        {overdueCount > 0 && (
          <div style={{
            background: 'var(--color-danger)',
            color: 'white',
            padding: '10px 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '0.875rem',
            fontWeight: 600,
            zIndex: 90,
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <AlertCircle size={18} />
            <span>Atenção: Você possui {overdueCount} {overdueCount === 1 ? 'parcela atrasada' : 'parcelas atrasadas'}. Por favor, regularize seu financeiro.</span>
            <Link to="/financeiro?filter=overdue" style={{ 
              color: 'white', 
              textDecoration: 'underline', 
              marginLeft: '10px',
              fontSize: '0.8rem',
              opacity: 0.9,
              fontWeight: 700
            }}>Ver parcelas atrasadas</Link>
          </div>
        )}

        <main style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/minhas-aulas" element={<MinhasAulas />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/notas" element={<Notas />} />
            <Route path="/frequencia" element={<Frequencia />} />
            <Route path="/contratos" element={<Contratos />} />
            <Route path="/certificados" element={<Certificados />} />
            <Route path="/meus-dados" element={<MeusDados />} />
            <Route path="/avaliacoes" element={<Avaliacoes />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--color-surface)'
      }}>
        <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
