/**
 * ============================================================
 * SERVIÇO DE DADOS — SELF-HOSTED (API HTTP)
 * ============================================================
 * Substitui a lógica de fetchFromCloud/saveToCloud
 * de @supabase/supabase-js por chamadas HTTP ao backend.
 * 
 * IndexedDB e localStorage continuam como cache local.
 * NENHUMA tela foi alterada.
 * ============================================================
 */
import { SchoolData } from '../types';

const STORAGE_KEY = 'edumanager_db_v1';

const initialContractTemplate = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS

Pelo presente instrumento particular, de um lado {{escola}} (CNPJ: {{cnpj_escola}}), e de outro lado o(a) aluno(a) {{aluno}}, celebram o presente contrato:

1. DO OBJETO: Prestação de serviços educacionais no curso de {{curso}}.
2. DA DURAÇÃO: O curso terá a duração estimada de {{duracao}}.
3. DO INVESTIMENTO: O CONTRATANTE pagará o valor mensal de R$ {{mensalidade}}.
4. DAS OBRIGAÇÕES: A CONTRATADA disponibilizará material e instrutores qualificados.

Data: {{data}}

___________________________________________
Assinatura do Aluno / Responsável`;

const initialData: SchoolData = {
  users: [],
  courses: [],
  students: [],
  classes: [],
  payments: [],
  contracts: [],
  certificates: [],
  attendance: [],
  subjects: [],
  periods: [],
  grades: [],
  handouts: [],
  handoutDeliveries: [],
  employees: [],
  employeeCategories: [],
  lessons: [],
  notifications: [],
  exams: [],
  profile: {
    id: 'main-school',
    name: 'EduManager School',
    address: '',
    city: '',
    state: '',
    zip: '',
    cnpj: '',
    phone: '',
    email: '',
    type: 'matriz'
  },
  logo: '',
  profiles: [
    {
      id: 'main-school',
      name: 'EduManager School',
      address: '',
      city: '',
      state: '',
      zip: '',
      cnpj: '',
      phone: '',
      email: '',
      type: 'matriz'
    }
  ],
  contractTemplates: [
    {
      id: 'default-template',
      name: 'Contrato Padrão',
      content: initialContractTemplate
    }
  ],
  lastUpdated: new Date(0).toISOString()
};

const DB_NAME = 'EduManagerDB';
const STORE_NAME = 'school_data';
const DB_VERSION = 1;

// Helper to open DB (IndexedDB — cache local mantido)
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const dbService = {
  // Initialize and get data (Async)
  initData: async (): Promise<SchoolData> => {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(STORAGE_KEY);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const data = request.result;
          const defaultData = JSON.parse(JSON.stringify(initialData));
          
          if (!data) {
            // Fallback to localStorage migration if IDB is empty
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
              try {
                const parsedLocal = JSON.parse(localData);
                resolve({ ...defaultData, ...parsedLocal });
                return;
              } catch (e) {
                // ignore
              }
            }
            resolve(defaultData);
            return;
          }

          const parsed = data;
          const finalObj = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;

          const users = Array.isArray(finalObj.users) ? finalObj.users : [];
          const finalData = {
            ...defaultData,
            ...finalObj,
            users: users,
            profile: { ...defaultData.profile, ...(finalObj.profile || {}) },
            profiles: Array.isArray(finalObj.profiles) ? finalObj.profiles : (finalObj.profile ? [{ ...defaultData.profile, ...finalObj.profile }] : defaultData.profiles),
            logo: finalObj.logo || finalObj.profile?.logo || ''
          };

          if (finalData.users.length === 0) {
            finalData.users.push({ 
              id: 'default-admin', 
              name: 'admin', 
              displayName: 'Administrador',
              password: 'admin', 
              cpf: '000.000.000-00',
              role: 'admin'
            });
          }
          resolve(finalData);
        };
      });
    } catch (error) {
      console.error("Error loading IDB data", error);
    const fallbackData = JSON.parse(JSON.stringify(initialData));
    fallbackData.users.push({ 
      id: 'default-admin', 
      name: 'admin', 
      displayName: 'Administrador',
      password: 'admin', 
      cpf: '000.000.000-00',
      role: 'admin'
    });
    return fallbackData;
    }
  },

  // Synchronous Local Load (Fallback)
  getData: (): SchoolData => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      // ignore
    }
    return JSON.parse(JSON.stringify(initialData));
  },

  // ============================================================
  // MUDANÇA PRINCIPAL: fetchFromCloud agora usa API HTTP
  // Em vez de: supabase.from('school_data').select('data')
  // Agora usa: fetch('/api/school-data')
  // ============================================================
  fetchFromCloud: async (): Promise<SchoolData | null> => {
    try {
      const response = await fetch('/api/school-data');
      if (!response.ok) {
        console.error("Erro ao buscar dados do servidor:", response.status);
        return null;
      }

      const result = await response.json();
      if (result && result.data) {
        const fetchedData = result.data;
        const defaultData = JSON.parse(JSON.stringify(initialData));
        
        if (!fetchedData.users || !Array.isArray(fetchedData.users) || fetchedData.users.length === 0) {
            fetchedData.users = defaultData.users;
            fetchedData.users.push({
                id: 'default-admin',
                name: 'admin',
                displayName: 'Administrador',
                password: 'admin',
                cpf: '000.000.000-00',
                role: 'admin'
            });
        }

        return {
           ...defaultData,
           ...fetchedData
        };
      }
      return null;
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
      return null;
    }
  },

  saveData: async (data: SchoolData) => {
    try {
      // Note: timestamp updating is handled by updateData in index.tsx to avoid mutating React state.

      // Save to IndexedDB (cache local)
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(data, STORAGE_KEY);
      
      // Try localStorage backup
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn("LocalStorage quota exceeded, relying on IndexedDB");
      }
    } catch (e) {
      console.error("Error saving data", e);
    }
  },

  // ============================================================
  // MUDANÇA PRINCIPAL: saveToCloud agora usa API HTTP
  // Em vez de: supabase.from('school_data').upsert(...)
  // Agora usa: fetch('/api/school-data', { method: 'PUT' })
  // ============================================================
  saveToCloud: async (data: SchoolData): Promise<{ success: boolean; reason?: 'newer_version' | 'error' }> => {
    try {
      const response = await fetch('/api/school-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        if (response.status === 409 && result.reason === 'newer_version') {
          console.warn("Servidor tem versão mais nova. Abortando save.");
          return { success: false, reason: 'newer_version' };
        }
        throw new Error('Erro ao salvar');
      }

      return { success: true };
    } catch (e) {
      console.error("Erro ao salvar na nuvem:", e);
      return { success: false, reason: 'error' };
    }
  },

  exportData: async () => {
    const data = await dbService.initData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edumanager_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          await dbService.saveData(json);
          await dbService.saveToCloud(json);
          resolve();
        } catch (err) {
          reject(new Error('Invalid backup file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  resetData: async (): Promise<void> => {
    try {
      localStorage.clear();
      
      const db = await openDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.delete(STORAGE_KEY);
        
        req.onsuccess = async () => {
          const resetState = JSON.parse(JSON.stringify(initialData));
          resetState.users.push({ 
            id: 'default-admin', 
            name: 'admin', 
            displayName: 'Administrador',
            password: 'admin', 
            cpf: '000.000.000-00',
            role: 'admin'
          });
          
          // Salvar no servidor via API
          try {
            await fetch('/api/school-data', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(resetState),
            });
          } catch(e) {}
          resolve();
        };
        req.onerror = () => resolve();
      });
    } catch (e) {
      console.error(e);
    }
  }
};