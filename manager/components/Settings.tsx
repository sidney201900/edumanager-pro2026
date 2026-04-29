import React, { useState, useMemo } from 'react';
import { SchoolData, SchoolProfile } from '../types';
import { dbService } from '../services/dbService';
import { Download, Upload, Trash2, Database, School, Camera, FileText, Info, AlertTriangle, X, CheckCircle, AlertCircle, Cloud, HelpCircle, RefreshCw, Plus, User, Folder, File as FileIcon, Eye, ExternalLink, Image as ImageIcon, List } from 'lucide-react';
import { isSupabaseConfigured, uploadLogo } from '../services/supabase';
import { useDialog } from '../DialogContext';
import imageCompression from 'browser-image-compression';

interface SettingsProps {
  data: SchoolData;
  updateData: (newData: Partial<SchoolData>) => void;
  setData: (data: SchoolData) => void;
}

const Settings: React.FC<SettingsProps> = ({ data, updateData, setData }) => {
  const { showAlert, showConfirm } = useDialog();
  const [selectedProfileId, setSelectedProfileId] = useState<string>(data.profile.id || 'main-school');
  const [profiles, setProfiles] = useState<SchoolProfile[]>(data.profiles || [data.profile]);
  const [globalLogo, setGlobalLogo] = useState<string>(data.logo || '');
  
  const currentProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

  const currentDirector = useMemo(() => {
    const employees = data.employees || [];
    const categories = data.employeeCategories || [];
    
    return employees.find(e => {
      const cat = categories.find(c => c.id === e.categoryId);
      const catName = cat?.name.toLowerCase() || '';
      const empName = e.name.toLowerCase();
      return catName.includes('diretor') || catName.includes('diretoria') || 
             empName.includes('diretor') || empName.includes('diretoria');
    });
  }, [data.employees, data.employeeCategories]);

  const [profileForm, setProfileForm] = useState<SchoolProfile>(currentProfile);

  const [showEvolutionModal, setShowEvolutionModal] = useState(false);
  const [evolutionForm, setEvolutionForm] = useState({
    apiUrl: data.evolutionConfig?.apiUrl || '',
    instanceName: data.evolutionConfig?.instanceName || '',
    apiKey: data.evolutionConfig?.apiKey || ''
  });

  const saveEvolutionConfig = () => {
    updateData({ evolutionConfig: evolutionForm });
    setShowEvolutionModal(false);
    showAlert('Sucesso', 'Configurações da Evolution API salvas!', 'success');
  };

  React.useEffect(() => {
    setProfileForm(currentProfile);
  }, [selectedProfileId, profiles]);

  React.useEffect(() => {
    setGlobalLogo(data.logo || '');
  }, [data.logo]);

  const [activeTab, setActiveTab] = useState<'perfil' | 'monitoramento'>('perfil');
  const [apiLogs, setApiLogs] = useState<any[]>([]);

  // Helper para normalizar URLs de fotos (vacina contra cache antigo)
  const normalizePhotoUrl = (url?: string) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('data:image')) return url;
    if (url.startsWith('/storage/')) return url;
    
    try {
      const match = url.match(/^https?:\/\/[^\/]+\/(.+)$/);
      if (match) return `/storage/${match[1]}`;
    } catch(e) {}
    
    return url;
  };
  const [systemStats, setSystemStats] = useState<any>(null);

  // Storage Explorer State
  const [showStorageManagerModal, setShowStorageManagerModal] = useState(false);
  const [selectedStorageBucket, setSelectedStorageBucket] = useState<string | null>(null);
  const [storageObjects, setStorageObjects] = useState<any[]>([]);
  const [loadingBucket, setLoadingBucket] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Database Explorer State
  const [showDatabaseExplorerModal, setShowDatabaseExplorerModal] = useState(false);
  const [dbTables, setDbTables] = useState<any[]>([]);
  const [loadingDbTables, setLoadingDbTables] = useState(false);
  const [selectedDbTable, setSelectedDbTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{rows: any[], fields: string[]}>({rows: [], fields: []});
  const [loadingTableData, setLoadingTableData] = useState(false);

  const openDatabaseExplorer = async () => {
    setShowDatabaseExplorerModal(true);
    setLoadingDbTables(true);
    setSelectedDbTable(null);
    try {
      const res = await fetch('/api/database/tables');
      const data = await res.json();
      setDbTables(data.tables || []);
    } catch (e) {
      console.error(e);
      showAlert('Erro', 'Não foi possível carregar as tabelas.', 'error');
    } finally {
      setLoadingDbTables(false);
    }
  };

  const openTable = async (tableName: string) => {
    setSelectedDbTable(tableName);
    setLoadingTableData(true);
    try {
      const res = await fetch(`/api/database/tables/${tableName}/data`);
      const data = await res.json();
      setTableData({ rows: data.rows || [], fields: data.fields || [] });
    } catch (e) {
      console.error(e);
      showAlert('Erro', 'Não foi possível carregar os dados da tabela.', 'error');
    } finally {
      setLoadingTableData(false);
    }
  };
  const openBucket = async (bucketName: string) => {
    setSelectedStorageBucket(bucketName);
    setLoadingBucket(true);
    try {
      const res = await fetch(`/api/storage/buckets/${bucketName}/objects`);
      const data = await res.json();
      setStorageObjects(data.objects || []);
    } catch (e) {
      console.error(e);
      showAlert('Erro', 'Não foi possível carregar os arquivos.', 'error');
    } finally {
      setLoadingBucket(false);
    }
  };

  const deleteStorageObject = (bucket: string, key: string) => {
    showConfirm('Excluir Arquivo', `Apagar permanentemente: ${key}?`, async () => {
      try {
        const res = await fetch(`/api/storage/buckets/${bucket}/objects`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key })
        });
        if (res.ok) {
          setStorageObjects(prev => prev.filter(o => o.key !== key));
          showAlert('Sucesso', 'Arquivo removido do disco físico.', 'success');
          fetchStats(); // Update numbers
        } else {
          showAlert('Erro', 'Falha ao excluir arquivo.', 'error');
        }
      } catch (e) {
        console.error(e);
      }
    });
  };

  const fetchStats = () => {
    fetch('/api/system-stats')
      .then(res => res.json())
      .then(data => {
        if (data.error) console.error('Erro na API:', data.error);
        setSystemStats(data);
      })
      .catch(err => {
        console.error('Erro ao buscar stats do sistema:', err);
        setSystemStats({ error: true });
      });
  };

  React.useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (activeTab === 'monitoramento') {
      fetch('/api/logs')
        .then(res => res.json())
        .then(data => setApiLogs(data))
        .catch(err => console.error('Erro ao buscar logs:', err));
    }
  }, [activeTab]);

  const validateCNPJ = (cnpj: string) => {
    cnpj = cnpj.replace(/[^\d]+/g, '');
    if (cnpj === '' || cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;
    
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1))) return false;
    
    return true;
  };

  const handleZipChange = async (zip: string) => {
    const cleanZip = zip.replace(/\D/g, '');
    setProfileForm(prev => ({ ...prev, zip: zip.replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9) }));
    
    if (cleanZip.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setProfileForm(prev => ({
            ...prev,
            address: data.logradouro,
            city: data.localidade,
            state: data.uf
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const saveProfile = () => {
    if (!validateCNPJ(profileForm.cnpj)) {
      showAlert('Erro', 'CNPJ inválido. Por favor, insira um CNPJ verdadeiro.', 'error');
      return;
    }

    // Check if trying to set as Matriz but another Matriz already exists
    if (profileForm.type === 'matriz') {
      const otherMatriz = profiles.find(p => p.type === 'matriz' && p.id !== profileForm.id);
      if (otherMatriz) {
        showAlert('Erro', `Já existe uma matriz cadastrada (${otherMatriz.name}). Só é permitida uma matriz.`, 'error');
        return;
      }
    }

    const updatedProfiles = profiles.map(p => p.id === profileForm.id ? profileForm : p);
    const mainProfile = updatedProfiles.find(p => p.type === 'matriz') || updatedProfiles[0];
    
    setProfiles(updatedProfiles);
    updateData({ profiles: updatedProfiles, profile: mainProfile });
    showAlert('Sucesso', 'Configurações salvas com sucesso!', 'success');
  };

  const addNewInstitution = () => {
    const newId = `school-${Date.now()}`;
    const newProfile: SchoolProfile = {
      id: newId,
      name: 'Nova Instituição',
      address: '',
      city: '',
      state: '',
      zip: '',
      cnpj: '',
      phone: '',
      email: '',
      type: 'filial'
    };
    setProfiles([...profiles, newProfile]);
    setSelectedProfileId(newId);
  };

  const deleteInstitution = (id: string) => {
    if (profiles.length <= 1) {
      showAlert('Erro', 'É necessário ter pelo menos uma instituição cadastrada.', 'error');
      return;
    }
    
    const profileToDelete = profiles.find(p => p.id === id);
    if (profileToDelete?.type === 'matriz') {
      showAlert('Erro', 'Não é possível excluir a instituição matriz. Altere outra para matriz primeiro.', 'error');
      return;
    }

    showConfirm(
      'Excluir Instituição?',
      `Tem certeza que deseja excluir a instituição "${profileToDelete?.name}"?`,
      () => {
        const updatedProfiles = profiles.filter(p => p.id !== id);
        setProfiles(updatedProfiles);
        setSelectedProfileId(updatedProfiles[0].id);
        updateData({ profiles: updatedProfiles, profile: updatedProfiles[0] });
      }
    );
  };



  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowImportModal(false);
      setIsClosing(false);
    }, 300);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        showAlert('Aguarde', 'Fazendo upload e otimizando a logo...', 'info');
        
        // Compression options
        const options = {
          maxSizeMB: 0.1, // 100KB
          maxWidthOrHeight: 500,
          useWebWorker: true
        };

        const compressedFile = await imageCompression(file, options);
        
        const url = await uploadLogo(compressedFile);
        if (!url) {
           throw new Error("Falha ao obter a URL da logo após o upload");
        }

        setGlobalLogo(url);
        updateData({ logo: url });
        showAlert('Sucesso', 'Logo atualizada com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao fazer upload da imagem:', error);
        showAlert('Erro', 'Falha ao processar e salvar a imagem.', 'error');
      }
    }
  };

  const handleReset = async () => {
    await dbService.resetData();
    window.location.reload();
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '($1) $2 ')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 16);
  };



  const inputClass = "w-full px-4 py-3 bg-white text-black border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm text-sm";

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20">
      <header>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Configurações</h2>
        <p className="text-slate-500 font-medium">Gerencie o perfil da escola, modelo de contrato e dados.</p>
        
        <div className="flex gap-4 mt-6 border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('perfil')}
            className={`pb-2 font-bold text-sm ${activeTab === 'perfil' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Perfil
          </button>
          <button 
            onClick={() => setActiveTab('monitoramento')}
            className={`pb-2 font-bold text-sm ${activeTab === 'monitoramento' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Monitoramento de API
          </button>
        </div>
      </header>

      {activeTab === 'perfil' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xl space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-indigo-600">
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <School size={24} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800">Perfil da Instituição</h3>
                </div>
                <button 
                  onClick={addNewInstitution}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold text-xs shadow-md"
                >
                  <Plus size={16} /> Nova Instituição
                </button>
              </div>

              {/* Institution Selector */}
              <div className="flex flex-wrap gap-2 mb-6">
                {profiles.map(p => (
                  <div key={p.id} className="flex items-center">
                    <button
                      onClick={() => setSelectedProfileId(p.id)}
                      className={`px-4 py-2 rounded-lg font-bold text-xs transition-all border ${
                        selectedProfileId === p.id 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {p.name} {p.type === 'matriz' && '(Matriz)'}
                    </button>
                    {p.id !== selectedProfileId && p.type !== 'matriz' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteInstitution(p.id); }}
                        className="ml-1 p-1 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-40 h-40 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group shadow-inner">
                    {globalLogo ? (
                      <div className="w-full h-full bg-slate-50 flex items-center justify-center p-4">
                        <img src={normalizePhotoUrl(globalLogo)} alt="Logo" className="w-full h-full object-contain p-2" />
                      </div>
                    ) : (
                      <div className="text-slate-300 text-center p-4">
                        <Camera size={40} className="mx-auto mb-2 opacity-20" />
                        <span className="text-[10px] font-bold uppercase text-slate-500">Logo Global</span>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white">
                      <Upload size={24} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase text-center">Logo única para todas as unidades</p>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nome da Escola</label>
                      <input className={inputClass} value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">CNPJ</label>
                      <input className={inputClass} placeholder="00.000.000/0001-00" value={profileForm.cnpj} onChange={e => setProfileForm({...profileForm, cnpj: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">CEP</label>
                      <input className={inputClass} placeholder="00000-000" value={profileForm.zip} onChange={e => handleZipChange(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Endereço</label>
                      <input className={inputClass} value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Cidade</label>
                      <input className={inputClass} value={profileForm.city} onChange={e => setProfileForm({...profileForm, city: e.target.value})} />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Estado (UF)</label>
                      <input className={inputClass} placeholder="UF" value={profileForm.state} onChange={e => setProfileForm({...profileForm, state: e.target.value.toUpperCase().slice(0, 2)})} />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Tipo</label>
                      <select 
                        className={inputClass} 
                        value={profileForm.type} 
                        onChange={e => setProfileForm({...profileForm, type: e.target.value as 'matriz' | 'filial'})}
                      >
                        <option value="matriz">Matriz</option>
                        <option value="filial">Filial</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Telefone</label>
                      <input className={inputClass} placeholder="(00) 0 0000-0000" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: formatPhone(e.target.value)})} maxLength={16} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                      <input className={inputClass} placeholder="Email" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={saveProfile}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg font-bold text-sm"
                >
                  Salvar Perfil da Instituição
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* POSTGRESQL CARD */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3 text-blue-600">
                  <div className="p-2 bg-blue-50 rounded-lg shadow-sm border border-blue-100">
                    <Database size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">Banco de Dados</h3>
                </div>
                {systemStats ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle size={12} /> Online
                  </span>
                ) : (
                  <RefreshCw size={16} className="text-slate-300 animate-spin" />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-4 relative z-10">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tamanho em Disco</p>
                  <p className="text-xl font-black text-slate-800">{systemStats?.postgres?.dbSize || '--'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tabelas SGBD</p>
                  <p className="text-xl font-black text-slate-800">{systemStats?.postgres?.tableCount || '--'} <span className="text-sm font-medium text-slate-400">PostgreSQL</span></p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 relative z-10">
                <button 
                  onClick={openDatabaseExplorer}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all font-black text-sm shadow-sm hover:-translate-y-0.5"
                >
                  <List size={18} /> Explorar Estrutura de Dados
                </button>
              </div>
            </div>

            {/* MINIO STORAGE CARD */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl space-y-4 relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-8 -mb-8 pointer-events-none"></div>
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3 text-red-600">
                  <div className="p-2 bg-red-50 rounded-lg shadow-sm border border-red-100">
                    <Cloud size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">Storage Físico</h3>
                </div>
                {systemStats && !systemStats.minio?.error ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle size={12} /> MinIO
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                    <AlertTriangle size={12} /> Backup
                  </span>
                )}
              </div>
              
              <div className="flex gap-4 relative z-10">
                <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Uso Total</p>
                  <p className="text-xl font-black text-slate-800">{systemStats?.minio?.totalSizeMB || '0.00'} <span className="text-sm font-medium text-slate-400">MB</span></p>
                </div>
                <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Arquivos</p>
                  <p className="text-xl font-black text-slate-800">{systemStats?.minio?.totalItems || '0'}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 relative z-10">
                <button 
                  onClick={() => setShowStorageManagerModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-black text-sm shadow-sm hover:-translate-y-0.5"
                >
                  <Folder size={18} /> Abrir Gerenciador de Arquivos
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl space-y-4">
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Database size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-800">Dados do System</h3>
              </div>
              <button onClick={async () => await dbService.exportData()} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all font-bold text-xs">
                <Download size={16} /> Exportar Backup
              </button>
              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 text-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors font-bold text-xs">
                <Upload size={16} /> Importar Backup
                <input type="file" className="hidden" accept=".json" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    showConfirm(
                      'Substituir Dados?', 
                      '⚠️ Tem certeza que deseja substituir todos os dados atuais? Esta ação não pode ser desfeita.',
                      async () => {
                        await dbService.importData(file);
                        const newData = await dbService.initData();
                        setData(newData);
                        showAlert('Sucesso', '✅ Dados restaurados com sucesso!', 'success');
                      }
                    );
                  }
                }} />
              </label>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl space-y-4">
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-800">Evolution API</h3>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                {data.evolutionConfig?.apiUrl ? (
                  <div className="space-y-2 text-sm text-slate-600">
                    <p><strong>URL:</strong> {data.evolutionConfig.apiUrl}</p>
                    <p><strong>Instância:</strong> {data.evolutionConfig.instanceName}</p>
                    <p><strong>API Key:</strong> ••••••••</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center">Nenhuma credencial configurada.</p>
                )}
              </div>

              <button 
                onClick={() => setShowEvolutionModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold text-xs shadow-md"
              >
                <Plus size={16} /> Configurar Credenciais
              </button>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100 shadow-xl space-y-4">
              <div className="flex items-center gap-3 text-indigo-800">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <User size={20} className="text-indigo-600" />
                </div>
                <h3 className="text-lg font-black text-slate-800">Responsável Legal / Diretor</h3>
              </div>
              
              <div className="p-4 rounded-lg bg-white border border-indigo-50 shadow-sm">
                {currentDirector ? (
                  <div className="space-y-2 text-sm text-slate-700">
                    <p><strong>Nome:</strong> {currentDirector.name}</p>
                    <p><strong>CPF:</strong> {currentDirector.cpf}</p>
                    <p className="text-xs text-indigo-500 mt-2 font-medium bg-indigo-50 inline-block px-2 py-1 rounded">Este responsável assinará automaticamente os documentos.</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center">Nenhum diretor localizado. Cadastre um funcionário como Diretor na aba Funcionários.</p>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl">
              <button 
                onClick={() => showConfirm(
                  'Resetar Sistema', 
                  'Isso apagará TODOS os dados cadastrados. Não há como desfazer.',
                  handleReset,
                  'alert'
                )} 
                className="w-full py-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-bold text-xs flex items-center justify-center gap-2"
              >
                <Trash2 size={16} /> Resetar Fábrica
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xl">
          <h3 className="text-xl font-black text-slate-800 mb-6">Logs de API</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Serviço</th>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apiLogs.map((log, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-slate-500">{new Date(log.date).toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-indigo-600">{log.service}</td>
                    <td className="px-4 py-3 text-slate-700">{log.action}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-mono">{JSON.stringify(log.details)}</td>
                  </tr>
                ))}
                {apiLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Nenhum log encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evolution API Modal */}
      {showEvolutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">Credenciais Evolution API</h3>
              <button 
                onClick={() => setShowEvolutionModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">URL da API</label>
                <input 
                  type="text" 
                  value={evolutionForm.apiUrl} 
                  onChange={e => setEvolutionForm({...evolutionForm, apiUrl: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm text-sm"
                  placeholder="https://api.evolution.com"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nome da Instância</label>
                <input 
                  type="text" 
                  value={evolutionForm.instanceName} 
                  onChange={e => setEvolutionForm({...evolutionForm, instanceName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm text-sm"
                  placeholder="minha-instancia"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">API Key</label>
                <input 
                  type="password" 
                  value={evolutionForm.apiKey} 
                  onChange={e => setEvolutionForm({...evolutionForm, apiKey: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm text-sm"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button 
                onClick={() => setShowEvolutionModal(false)}
                className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={saveEvolutionConfig}
                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2"
              >
                <CheckCircle size={18} /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storage Explorer Modal */}
      {showStorageManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-300 pointer-events-auto">
          <div className="bg-white rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.15)] w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-slide-up border border-slate-100">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-200/50 flex items-center justify-between bg-white/50">
              <div className="flex items-center gap-4 text-slate-800">
                {selectedStorageBucket ? (
                  <button onClick={() => setSelectedStorageBucket(null)} className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl shadow-sm transition-all" title="Voltar para Pastas">
                    <Cloud size={24} />
                  </button>
                ) : (
                  <div className="p-3 bg-red-100 text-red-600 rounded-2xl shadow-sm">
                    <Cloud size={28} />
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-black tracking-tight">{selectedStorageBucket ? selectedStorageBucket : 'Gerenciador de Arquivos'}</h3>
                  <p className="text-sm font-bold text-slate-500">
                    {selectedStorageBucket ? `${storageObjects.length} arquivos encontrados.` : `${systemStats?.minio?.buckets?.length || 0} pastas na nuvem.`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setShowStorageManagerModal(false); setSelectedStorageBucket(null); }}
                className="p-3 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl shadow-sm transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
              {!selectedStorageBucket ? (
                // Pastas (Buckets) View
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {systemStats?.minio?.buckets?.map((b: any, idx: number) => (
                    <div key={idx} onClick={() => openBucket(b.name)} className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-red-300 hover:shadow-xl transition-all cursor-pointer flex items-center gap-5 hover:-translate-y-1">
                      <div className="p-4 bg-red-50 text-red-500 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                        <Folder size={32} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-800">{b.name}</h4>
                        <p className="text-sm font-bold text-slate-400 mt-1">{b.items} arquivos • {b.sizeMB} MB</p>
                      </div>
                    </div>
                  ))}
                  {(!systemStats?.minio?.buckets || systemStats.minio.buckets.length === 0) && (
                    <div className="col-span-full py-10 text-center text-slate-400">
                      <Folder size={64} className="mx-auto mb-4 opacity-20" />
                      <p className="font-bold text-xl">Nenhuma pasta encontrada.</p>
                    </div>
                  )}
                </div>
              ) : loadingBucket ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <RefreshCw size={48} className="animate-spin mb-4 text-red-400" />
                  <p className="font-bold">Acessando MinIO Storage...</p>
                </div>
              ) : storageObjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Folder size={64} className="mb-4 opacity-20" />
                  <p className="font-bold text-xl">Pasta Vazia</p>
                  <p className="text-sm">Nenhum arquivo encontrado neste bucket.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {storageObjects.map((obj, i) => {
                    const isImage = obj.key.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                    const isPdf = obj.key.match(/\.pdf$/i);
                    const sizeKB = (obj.size / 1024).toFixed(1);

                    return (
                      <div key={i} className="group bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden flex flex-col">
                        {/* Thumbnail Area */}
                        <div className="h-32 bg-slate-100 relative flex items-center justify-center overflow-hidden border-b border-slate-100">
                          {isImage ? (
                            <img src={obj.url} alt={obj.key} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                          ) : isPdf ? (
                            <FileText size={48} className="text-red-400/50 group-hover:scale-110 transition-transform" />
                          ) : (
                            <FileIcon size={48} className="text-slate-300 group-hover:scale-110 transition-transform" />
                          )}
                          
                          {/* Hover Actions Overlay */}
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                            {(isImage || isPdf) && (
                              <button onClick={() => setPreviewUrl(obj.url)} className="p-2.5 bg-white/20 hover:bg-white text-white hover:text-slate-900 rounded-full transition-all" title="Visualizar">
                                <Eye size={18} />
                              </button>
                            )}
                            <a href={obj.url} download={obj.key} target="_blank" rel="noreferrer" className="p-2.5 bg-white/20 hover:bg-white text-white hover:text-indigo-600 rounded-full transition-all" title="Baixar Original">
                              <Download size={18} />
                            </a>
                          </div>
                        </div>

                        {/* File Info */}
                        <div className="p-4 flex-1 flex flex-col">
                          <p className="text-xs font-black text-slate-700 truncate" title={obj.key}>{obj.key.split('/').pop()}</p>
                          <div className="mt-auto pt-3 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-md">{sizeKB} KB</span>
                            <button onClick={() => deleteStorageObject(selectedStorageBucket, obj.key)} className="text-slate-300 hover:text-red-500 transition-colors" title="Excluir Permanentemente">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Database Explorer Modal */}
      {showDatabaseExplorerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-300 pointer-events-auto">
          <div className="bg-white rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.15)] w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-slide-up border border-slate-100">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-200/50 flex items-center justify-between bg-white/50">
              <div className="flex items-center gap-4 text-slate-800">
                {selectedDbTable ? (
                  <button onClick={() => setSelectedDbTable(null)} className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-2xl shadow-sm transition-all" title="Voltar para Tabelas">
                    <Database size={24} />
                  </button>
                ) : (
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl shadow-sm">
                    <Database size={28} />
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-black tracking-tight">{selectedDbTable ? selectedDbTable : 'Database Explorer'}</h3>
                  <p className="text-sm font-bold text-slate-500">
                    {selectedDbTable ? `${tableData.rows.length} registros exibidos.` : `${dbTables.length} tabelas no schema public do PostgreSQL.`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setShowDatabaseExplorerModal(false); setSelectedDbTable(null); }}
                className="p-3 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl shadow-sm transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
              {!selectedDbTable ? (
                // Lista de Tabelas
                loadingDbTables ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <RefreshCw size={48} className="animate-spin mb-4 text-blue-400" />
                    <p className="font-bold">Analisando Estrutura do PostgreSQL...</p>
                  </div>
                ) : dbTables.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Database size={64} className="mb-4 opacity-20" />
                    <p className="font-bold text-xl">Nenhuma tabela encontrada</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dbTables.map((table, idx) => (
                      <div key={idx} onClick={() => openTable(table.table_name)} className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-xl transition-all cursor-pointer flex items-center justify-between hover:-translate-y-1">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-50 text-blue-500 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <List size={24} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">{table.table_name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-bold text-slate-500">{table.row_count} registros</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-md">{table.total_size}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : loadingTableData ? (
                // Carregando Dados da Tabela
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <RefreshCw size={48} className="animate-spin mb-4 text-blue-400" />
                  <p className="font-bold">Buscando registros...</p>
                </div>
              ) : tableData.rows.length === 0 ? (
                // Tabela Vazia
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <List size={64} className="mb-4 opacity-20" />
                  <p className="font-bold text-xl">Tabela Vazia</p>
                  <p className="text-sm">Nenhum registro encontrado nesta tabela.</p>
                </div>
              ) : (
                // Visualização de Dados (Grid)
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                          {tableData.fields.map((field, idx) => (
                            <th key={idx} scope="col" className="px-6 py-4 font-black whitespace-nowrap">
                              {field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.rows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            {tableData.fields.map((field, colIdx) => (
                              <td key={colIdx} className="px-6 py-4 whitespace-nowrap">
                                {typeof row[field] === 'object' && row[field] !== null 
                                  ? JSON.stringify(row[field]).substring(0, 50) + (JSON.stringify(row[field]).length > 50 ? '...' : '')
                                  : String(row[field] ?? '').substring(0, 50) + (String(row[field] ?? '').length > 50 ? '...' : '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview */}
      {previewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center animate-in fade-in pointer-events-auto">
          {/* Overlay transparente para fechar ao clicar fora */}
          <div className="absolute inset-0 bg-slate-900/10 cursor-pointer" onClick={() => setPreviewUrl(null)}></div>
          
          <div className="bg-white p-4 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.3)] border border-slate-100 relative z-[61] animate-in zoom-in-95">
            {/* Botão de fechar fixado na moldura */}
            <button 
              onClick={() => setPreviewUrl(null)} 
              className="absolute -top-5 -right-5 p-3 bg-red-500 text-white shadow-xl rounded-full hover:bg-red-600 transition-all z-[62] border-4 border-white"
              title="Fechar Visualização"
            >
              <X size={24} />
            </button>
            
            {previewUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
              <img src={previewUrl} alt="Preview" className="max-w-[85vw] max-h-[85vh] object-contain rounded-lg" />
            ) : (
              <iframe src={previewUrl} className="w-[85vw] h-[85vh] rounded-lg" title="PDF Preview" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;