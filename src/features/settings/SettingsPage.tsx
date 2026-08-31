import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  Bell, 
  Database, 
  ArrowLeft,
  Clock,
  User as UserIcon,
  Loader2,
  Building2,
  Upload,
  Save,
  Phone,
  MapPin,
  FileText,
  Users
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import type { LogEntry } from '../../types/database';
import { AlertCircle, Download } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import type { UserProfile } from '../../contexts/UserContext';

type SettingsTab = 'main' | 'perfil' | 'seguranca' | 'dados' | 'notificacoes' | 'acessos';

interface StudioConfig {
  nome: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  logoUrl: string;
}

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('main');
  const { profile } = useUser();
  const { data: logs, loading: loadingLogs } = useCollection<LogEntry>('logs', 'created_at', 'desc');

  // Controle de Acesso
  const { data: usuariosList, loading: loadingUsuarios } = useCollection<UserProfile>('usuarios');
  const { data: funcionariosList, loading: loadingFuncionarios } = useCollection<{ id: string; nome: string; email: string; perfil?: string; funcao?: string; uid?: string; created_at?: number }>('funcionarios');
  
  const loadingUsers = loadingUsuarios || loadingFuncionarios;

  const combinedUsers = useMemo(() => {
    const map = new Map<string, UserProfile>();

    usuariosList.forEach(u => {
      const key = (u.email || u.id).toLowerCase();
      map.set(key, { ...u });
    });

    funcionariosList.forEach(f => {
      if (!f.email) return;
      const key = f.email.toLowerCase();
      if (!map.has(key)) {
        const isAdm = f.perfil === 'admin' || f.funcao === 'administrador';
        map.set(key, {
          id: f.uid || f.id,
          email: f.email,
          nome: f.nome,
          role: isAdm ? 'admin' : 'trainer',
          modulos: isAdm 
            ? ['prescricao', 'financeiro', 'agenda', 'mensalidades', 'vendas', 'estoque', 'compras', 'comissao', 'relatorios']
            : ['prescricao', 'agenda'],
          created_at: f.created_at || Date.now()
        });
      } else {
        const existing = map.get(key)!;
        if (f.perfil === 'admin' || f.funcao === 'administrador') {
          existing.role = 'admin';
        }
      }
    });

    return Array.from(map.values());
  }, [usuariosList, funcionariosList]);

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'trainer' | 'finance' | 'user'>('user');
  const [editModulos, setEditModulos] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  const [studioConfig, setStudioConfig] = useState<StudioConfig>({
    nome: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    logoUrl: ''
  });
  const [loadingStudio, setLoadingStudio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Estado para Backup
  const [lastBackup, setLastBackup] = useState<string | null>(localStorage.getItem('aello_last_backup'));
  const [needsBackup, setNeedsBackup] = useState(false);

  // Verificar se precisa de backup (mais de 24h)
  useEffect(() => {
    if (lastBackup) {
      const lastDate = new Date(lastBackup).getTime();
      const now = new Date().getTime();
      const hours24 = 24 * 60 * 60 * 1000;
      if (now - lastDate > hours24) {
        setNeedsBackup(true);
      } else {
        setNeedsBackup(false);
      }
    } else {
      setNeedsBackup(true); // Nunca fez backup
    }
  }, [lastBackup]);

  // Função para realizar o Backup
  const handleFullBackup = async () => {
    setIsSaving(true);
    try {
      const collectionsToBackup = ['alunos', 'equipamentos', 'exercicios', 'logs', 'config'];
      const backupData: any = {
        version: "1.0",
        date: new Date().toISOString(),
        studio: studioConfig,
        data: {}
      };

      for (const colName of collectionsToBackup) {
        const querySnapshot = await getDocs(collection(db, colName));
        backupData.data[colName] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_aello_studio_${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      const nowStr = new Date().toISOString();
      localStorage.setItem('aello_last_backup', nowStr);
      setLastBackup(nowStr);
      
      await logActivity({
        action: 'UPDATE',
        resource_type: 'auth',
        details: 'Realizou backup manual de todos os dados do sistema'
      });

      alert("Backup concluído e baixado com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao realizar backup.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAccess = async () => {
    if (!selectedUser) return;
    setIsSavingAccess(true);
    try {
      const finalModulos = editRole === 'admin' 
        ? ['prescricao', 'financeiro', 'agenda', 'mensalidades', 'vendas', 'estoque', 'compras', 'comissao', 'relatorios']
        : editModulos;

      const userRef = doc(db, 'usuarios', selectedUser.id);
      await setDoc(userRef, {
        email: selectedUser.email,
        nome: selectedUser.nome,
        role: editRole,
        perfil: editRole === 'admin' ? 'admin' : 'instrutor',
        modulos: finalModulos,
        updated_at: Date.now()
      }, { merge: true });

      const funcMatch = funcionariosList.find(f => f.email?.toLowerCase() === selectedUser.email?.toLowerCase() || f.uid === selectedUser.id);
      if (funcMatch) {
        await updateDoc(doc(db, 'funcionarios', funcMatch.id), {
          perfil: editRole === 'admin' ? 'admin' : 'instrutor',
          updated_at: Date.now()
        });
      }

      await logActivity({
        action: 'UPDATE',
        resource_type: 'auth',
        details: `Alterou privilégios do usuário ${selectedUser.email}: Cargo para ${editRole}, Módulos: ${finalModulos.join(', ')}`
      });

      setIsModalOpen(false);
      setSelectedUser(null);
      alert('Permissões atualizadas com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar permissões do usuário.');
    } finally {
      setIsSavingAccess(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dados') {
      const loadConfig = async () => {
        setLoadingStudio(true);
        try {
          const docRef = doc(db, 'config', 'studio');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setStudioConfig(docSnap.data() as StudioConfig);
          }
        } catch (error) {
          console.error("Erro ao carregar config:", error);
        } finally {
          setLoadingStudio(false);
        }
      };
      loadConfig();
    }
  }, [activeTab]);

  const handleSaveStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'config', 'studio'), studioConfig);
      await logActivity({
        action: 'UPDATE',
        resource_type: 'auth',
        details: 'Atualizou os dados da empresa/studio'
      });
      alert("Configurações salvas com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const storageRef = ref(storage, `branding/logo_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setStudioConfig(prev => ({ ...prev, logoUrl: url }));
      
      await logActivity({
        action: 'UPDATE',
        resource_type: 'auth',
        details: 'Realizou upload de novo logotipo do studio'
      });
    } catch (error) {
      console.error(error);
      alert("Erro ao fazer upload do logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-700 border-green-200';
      case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-200';
      case 'LOGIN': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'LOGOUT': return 'bg-surface-200 text-surface-600 border-surface-300';
      default: return 'bg-surface-100 text-surface-500 border-surface-200';
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dados':
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setActiveTab('main')} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
                <ArrowLeft className="w-6 h-6 text-surface-500" />
              </button>
              <div>
                <h3 className="text-xl font-bold text-brand-dark">Dados do Studio</h3>
                <p className="text-sm text-surface-500">Informações que aparecerão em relatórios e recibos.</p>
              </div>
            </div>

            {loadingStudio ? (
              <div className="p-12 flex flex-col items-center justify-center gap-4 text-surface-400">
                <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
                <p>Carregando dados da empresa...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-card p-8">
                  <form onSubmit={handleSaveStudio} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-surface-400" /> Nome do Studio / Empresa
                        </label>
                        <input 
                          type="text" 
                          value={studioConfig.nome}
                          onChange={e => setStudioConfig({...studioConfig, nome: e.target.value})}
                          className="input-field" 
                          placeholder="Ex: Aello Studio Personal" 
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                            <FileText className="w-4 h-4 text-surface-400" /> CNPJ
                          </label>
                          <input 
                            type="text" 
                            value={studioConfig.cnpj}
                            onChange={e => setStudioConfig({...studioConfig, cnpj: e.target.value})}
                            className="input-field" 
                            placeholder="00.000.000/0001-00" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                            <Phone className="w-4 h-4 text-surface-400" /> Telefone para Contato
                          </label>
                          <input 
                            type="tel" 
                            value={studioConfig.telefone}
                            onChange={e => setStudioConfig({...studioConfig, telefone: e.target.value})}
                            className="input-field" 
                            placeholder="(55) 9 9999-9999" 
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-surface-400" /> Endereço Completo
                        </label>
                        <input 
                          type="text" 
                          value={studioConfig.endereco}
                          onChange={e => setStudioConfig({...studioConfig, endereco: e.target.value})}
                          className="input-field" 
                          placeholder="Rua, Número, Bairro - Cidade/UF" 
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <button 
                        type="submit" 
                        disabled={isSaving}
                        className="btn-primary w-full justify-center md:w-auto"
                      >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Salvar Alterações
                      </button>
                    </div>
                  </form>
                </div>

                <div className="space-y-6">
                  <div className="glass-card p-6 flex flex-col items-center text-center">
                    <h4 className="font-bold text-brand-dark mb-4">Logotipo do Studio</h4>
                    <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-surface-200 flex items-center justify-center bg-surface-50 relative overflow-hidden group">
                      {studioConfig.logoUrl ? (
                        <img src={studioConfig.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
                      ) : (
                        <Building2 className="w-12 h-12 text-surface-300" />
                      )}
                      
                      {uploadingLogo && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-brand-medium" />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 w-full">
                      <label className="btn-secondary w-full justify-center cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Alterar Logo
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                      <p className="text-[10px] text-surface-400 mt-2 italic">Recomendado: PNG fundo transparente</p>
                    </div>
                  </div>

                  {/* Seção de Backup */}
                  <div className="glass-card p-6">
                    <h4 className="font-bold text-brand-dark mb-4 flex items-center gap-2">
                      <Database className="w-4 h-4" /> Segurança de Dados
                    </h4>
                    
                    {needsBackup && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">
                          <span className="font-bold block mb-1">Backup Necessário!</span>
                          Você não realiza um backup dos dados há mais de 24 horas. Recomendamos baixar uma cópia agora.
                        </p>
                      </div>
                    )}

                    <button 
                      onClick={handleFullBackup}
                      disabled={isSaving}
                      className="btn-secondary w-full justify-center"
                    >
                      <Download className="w-4 h-4" />
                      {isSaving ? 'Processando...' : 'Baixar Backup (JSON)'}
                    </button>
                    
                    {lastBackup && (
                      <p className="text-[10px] text-surface-400 mt-3 text-center">
                        Último backup: {new Date(lastBackup).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'seguranca':
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setActiveTab('main')} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
                <ArrowLeft className="w-6 h-6 text-surface-500" />
              </button>
              <div>
                <h3 className="text-xl font-bold text-brand-dark">Logs de Auditoria</h3>
                <p className="text-sm text-surface-500">Histórico completo de ações no sistema.</p>
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              {loadingLogs ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4 text-surface-400">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
                  <p>Carregando registros de segurança...</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-surface-50 border-b border-surface-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-400">Usuário</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-400">Ação</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-400">Detalhes</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-400">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-surface-400" />
                            <span className="text-sm font-medium text-brand-dark">{log.user_email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadge(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-surface-600">
                          {log.details}
                          {log.resource_name && <span className="text-brand-medium font-bold ml-1">({log.resource_name})</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs text-surface-400">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDateTime(log.created_at)}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-surface-400 italic">
                          Nenhum log registrado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );

      case 'acessos':
        if (profile?.role !== 'admin') {
          return <div className="p-8 text-red-500 font-semibold">Acesso negado. Apenas administradores podem acessar esta seção.</div>;
        }
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setActiveTab('main')} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
                <ArrowLeft className="w-6 h-6 text-surface-500" />
              </button>
              <div>
                <h3 className="text-xl font-bold text-brand-dark">Controle de Acesso</h3>
                <p className="text-sm text-surface-500">Configure as permissões e níveis de acesso de cada colaborador/usuário do sistema.</p>
              </div>
            </div>

            {loadingUsers ? (
              <div className="p-12 flex flex-col items-center justify-center gap-4 text-surface-400">
                <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
                <p>Carregando usuários...</p>
              </div>
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-50 border-b border-surface-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-400">Usuário</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-400">Cargo</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-400">Módulos Permitidos</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-surface-400 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {combinedUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-surface-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-brand-dark">{u.nome || 'Sem Nome'}</span>
                              <span className="text-xs text-surface-400">{u.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                              u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              u.role === 'trainer' ? 'bg-blue-100 text-blue-700' :
                              u.role === 'finance' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-surface-100 text-surface-700'
                            }`}>
                              {u.role === 'admin' ? 'Administrador' :
                               u.role === 'trainer' ? 'Personal Trainer' :
                               u.role === 'finance' ? 'Financeiro' : 'Usuário'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {u.role === 'admin' ? (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100">
                                  Acesso Total (Admin)
                                </span>
                              ) : (
                                <>
                                  {u.modulos?.map(m => (
                                    <span key={m} className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-brand-medium/5 text-brand-medium border border-brand-medium/10 capitalize">
                                      {m === 'prescricao' ? 'Prescrição' : m}
                                    </span>
                                  ))}
                                  {(!u.modulos || u.modulos.length === 0) && (
                                    <span className="text-xs text-surface-400 italic">Nenhum</span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => {
                                setSelectedUser(u);
                                setEditRole(u.role || 'trainer');
                                setEditModulos(u.modulos || []);
                                setIsModalOpen(true);
                              }}
                              className="btn-secondary py-1.5 px-3 text-xs"
                            >
                              Editar Permissões
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div onClick={() => setActiveTab('perfil')} className="glass-card p-6 flex items-start gap-4 hover:border-brand-medium transition-colors cursor-pointer group">
              <div className="p-3 bg-brand-dark/5 rounded-xl text-brand-dark group-hover:bg-brand-dark group-hover:text-white transition-all">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-brand-dark mb-1">Meu Perfil</h3>
                <p className="text-sm text-surface-500">Altere seu e-mail, senha e foto de perfil.</p>
              </div>
            </div>

            <div onClick={() => setActiveTab('notificacoes')} className="glass-card p-6 flex items-start gap-4 hover:border-brand-medium transition-colors cursor-pointer group">
              <div className="p-3 bg-brand-dark/5 rounded-xl text-brand-dark group-hover:bg-brand-dark group-hover:text-white transition-all">
                <Bell className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-brand-dark mb-1">Notificações</h3>
                <p className="text-sm text-surface-500">Configurações de avisos de renovação.</p>
              </div>
            </div>

            {profile?.role === 'admin' && (
              <>
                <div onClick={() => setActiveTab('acessos')} className="glass-card p-6 flex items-start gap-4 hover:border-brand-medium transition-colors cursor-pointer group">
                  <div className="p-3 bg-brand-dark/5 rounded-xl text-brand-dark group-hover:bg-brand-dark group-hover:text-white transition-all">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-brand-dark mb-1">Controle de Acesso</h3>
                    <p className="text-sm text-surface-500">Gerencie as permissões e módulos dos usuários.</p>
                  </div>
                </div>

                <div onClick={() => setActiveTab('seguranca')} className="glass-card p-6 flex items-start gap-4 hover:border-brand-medium transition-colors cursor-pointer group">
                  <div className="p-3 bg-brand-dark/5 rounded-xl text-brand-dark group-hover:bg-brand-dark group-hover:text-white transition-all">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-brand-dark mb-1">Segurança e Auditoria</h3>
                    <p className="text-sm text-surface-500">Logs de acesso e histórico de alterações.</p>
                  </div>
                </div>

                <div onClick={() => setActiveTab('dados')} className="glass-card p-6 flex items-start gap-4 hover:border-brand-medium transition-colors cursor-pointer group">
                  <div className="p-3 bg-brand-dark/5 rounded-xl text-brand-dark group-hover:bg-brand-dark group-hover:text-white transition-all">
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-brand-dark mb-1">Dados do Studio</h3>
                    <p className="text-sm text-surface-500">Cadastro da empresa e logotipo oficial.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-display text-brand-dark">Configurações</h2>
        <p className="text-surface-500">Gerencie as preferências do seu studio e conta.</p>
      </div>

      {renderContent()}

      {/* Modal de Edição de Acessos */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-surface-200 animate-scale-in">
            <h3 className="text-xl font-bold text-brand-dark mb-2">Editar Permissões de Acesso</h3>
            <p className="text-sm text-surface-500 mb-6">
              Alterando os acessos de <span className="font-bold text-brand-medium">{selectedUser.nome}</span> ({selectedUser.email})
            </p>

            <div className="space-y-6">
              {/* Role Select */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-dark">Nível de Acesso (Cargo)</label>
                <select
                  value={editRole}
                  onChange={(e) => {
                    const r = e.target.value as any;
                    setEditRole(r);
                    if (r === 'admin') {
                      setEditModulos(['prescricao', 'financeiro', 'agenda', 'mensalidades']);
                    }
                  }}
                  className="input-field cursor-pointer"
                >
                  <option value="user">Usuário Comum</option>
                  <option value="trainer">Personal Trainer</option>
                  <option value="finance">Financeiro</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {/* Module Checkboxes */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-brand-dark block">Módulos Habilitados</label>
                
                {editRole === 'admin' ? (
                  <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 text-xs text-purple-700 leading-relaxed font-semibold">
                    Administradores possuem acesso automático e irrestrito a todos os módulos do sistema.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {[
                      { id: 'prescricao', label: 'Prescrição de Treinos' },
                      { id: 'agenda', label: 'Agenda & Aulas' },
                      { id: 'cadastros', label: 'Cadastro de Alunos' },
                      { id: 'vendas', label: 'Vendas (PDV Balcão)' },
                      { id: 'financeiro', label: 'Gestão Financeira' },
                      { id: 'mensalidades', label: 'Controle de Mensalidades' },
                      { id: 'estoque', label: 'Estoque de Produtos' },
                      { id: 'compras', label: 'Compras & NF-e' },
                      { id: 'comissao', label: 'Comissões de Vendas' },
                      { id: 'relatorios', label: 'Relatórios Estratégicos' }
                    ].map((m) => {
                      const isChecked = editModulos.includes(m.id);
                      return (
                        <label 
                          key={m.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isChecked 
                              ? 'bg-brand-medium/5 border-brand-medium text-brand-dark font-semibold shadow-xs'
                              : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditModulos([...editModulos, m.id]);
                              } else {
                                setEditModulos(editModulos.filter(x => x !== m.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-surface-300 text-brand-medium focus:ring-brand-medium cursor-pointer"
                          />
                          <span className="text-xs">{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8 pt-4 border-t border-surface-100">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedUser(null);
                }}
                className="btn-secondary"
                disabled={isSavingAccess}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAccess}
                className="btn-primary"
                disabled={isSavingAccess}
              >
                {isSavingAccess ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
