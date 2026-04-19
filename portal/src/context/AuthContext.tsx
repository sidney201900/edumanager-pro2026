import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, Student } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  student: Student | null;
  token: string | null;
  isLoading: boolean;
  schoolLogo: string | null;
  login: (enrollmentNumber: string, password: string) => Promise<void>;
  logout: () => void;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  const fetchStudentData = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/portal/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudent(data.student);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do aluno:', err);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('portal_token');
    const savedUser = localStorage.getItem('portal_user');
    
    // Fetch School Logo for the portal
    fetch('/api/portal/escola')
      .then(res => res.json())
      .then(data => {
        if (data.logo) {
          setSchoolLogo(data.logo);
          // Set favicon dynamically
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.logo;
        }
      })
      .catch(() => {});

    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsed);
        fetchStudentData(savedToken);
      } catch {
        localStorage.removeItem('portal_token');
        localStorage.removeItem('portal_user');
      }
    }
    setIsLoading(false);
  }, [fetchStudentData]);

  const login = async (enrollmentNumber: string, password: string) => {
    const res = await fetch('/api/portal/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentNumber, password }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Credenciais inválidas');
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    setStudent(data.student);
    localStorage.setItem('portal_token', data.token);
    localStorage.setItem('portal_user', JSON.stringify(data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setStudent(null);
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_user');
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    const res = await fetch('/api/portal/alterar-senha', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao alterar senha');
    }
  };

  return (
    <AuthContext.Provider value={{ user, student, token, isLoading, schoolLogo, login, logout, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
