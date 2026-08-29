import { useState } from 'react';
import { Search, Plus, Filter, Loader2, Edit2, Power, Trash2 } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import { FuncionarioFormModal } from './FuncionarioFormModal';
import type { Funcionario } from './FuncionarioFormModal';

export const FuncionariosList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [funcionarioToEdit, setFuncionarioToEdit] = useState<Funcionario | null>(null);
  const [filterFuncao, setFilterFuncao] = useState<'all' | Funcionario['funcao']>('all');
  const [showFiltros, setShowFiltros] = useState(false);

  const { data: funcionarios, loading } = useCollection<Funcionario>('funcionarios', 'nome');

  const filteredFuncionarios = funcionarios.filter(f => {
    const nome = f.nome || '';
    const email = f.email || '';
    const matchBusca = nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFuncao = filterFuncao === 'all' || f.funcao === filterFuncao;
    return matchBusca && matchFuncao;
  });

  const handleOpenEdit = (funcionario: Funcionario) => {
    setFuncionarioToEdit(funcionario);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setFuncionarioToEdit(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (funcionario: Funcionario) => {
    const acao = funcionario.ativo ? 'DESATIVAR' : 'REATIVAR';
    if (window.confirm(`Deseja realmente ${acao} o funcionário ${funcionario.nome}?`)) {
      await updateDoc(doc(db, 'funcionarios', funcionario.id), { ativo: !funcionario.ativo });
      await logActivity({
        action: 'UPDATE',
        resource_type: 'auth',
        details: `Alterou status do funcionário para ${!funcionario.ativo ? 'ATIVO' : 'INATIVO'}`
      });
    }
  };

  const handleDelete = async (funcionario: Funcionario) => {
    if (window.confirm(`ATENÇÃO: Deseja EXCLUIR permanentemente o funcionário ${funcionario.nome}?`)) {
      await deleteDoc(doc(db, 'funcionarios', funcionario.id));
      await logActivity({
        action: 'DELETE',
        resource_type: 'auth',
        details: `Excluiu o funcionário ${funcionario.nome}`
      });
    }
  };

  const getFuncaoLabel = (funcao: Funcionario['funcao']) => {
    switch (funcao) {
      case 'personal_trainer': return 'Personal Trainer';
      case 'recepcionista': return 'Recepcionista';
      case 'administrador': return 'Administrador';
      default: return 'Outro';
    }
  };

  return (
    <div className="space-y-6">
      <FuncionarioFormModal 
        isOpen={isModalOpen} 
        funcionarioToEdit={funcionarioToEdit}
        onClose={() => {
          setIsModalOpen(false);
          setFuncionarioToEdit(null);
        }} 
        onSuccess={() => {
          setIsModalOpen(false);
          setFuncionarioToEdit(null);
        }} 
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Colaboradores & Profissionais 👥</h2>
          <p className="text-surface-500">
            {loading ? 'Carregando...' : `Gerencie sua equipe de ${funcionarios.length} profissionais cadastrados.`}
          </p>
        </div>
        <button 
          className="btn-primary bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10"
          onClick={handleCreateNew}
        >
          <Plus className="w-5 h-5" />
          Novo Colaborador
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6 relative">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou e-mail..." 
            className="input-field pl-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <button 
            className={`btn-secondary flex gap-2 ${showFiltros ? '!bg-indigo-600 text-white' : ''}`}
            onClick={() => setShowFiltros(!showFiltros)}
          >
            <Filter className="w-5 h-5" />
            Filtrar Cargo
          </button>
          
          {showFiltros && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-surface-200 rounded-xl shadow-xl z-10 p-3 animate-fade-in">
              <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Função</p>
              <div className="space-y-1">
                <button onClick={() => { setFilterFuncao('all'); setShowFiltros(false); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-100 ${filterFuncao === 'all' ? 'bg-surface-100 font-bold' : ''}`}>Todos</button>
                <button onClick={() => { setFilterFuncao('personal_trainer'); setShowFiltros(false); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 text-indigo-700 ${filterFuncao === 'personal_trainer' ? 'bg-indigo-50 font-bold' : ''}`}>Personal Trainer</button>
                <button onClick={() => { setFilterFuncao('recepcionista'); setShowFiltros(false); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 text-indigo-700 ${filterFuncao === 'recepcionista' ? 'bg-indigo-50 font-bold' : ''}`}>Recepcionista</button>
                <button onClick={() => { setFilterFuncao('administrador'); setShowFiltros(false); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 text-indigo-700 ${filterFuncao === 'administrador' ? 'bg-indigo-50 font-bold' : ''}`}>Administrador</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
            <p className="font-medium">Carregando profissionais...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Colaborador</th>
                  <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Função</th>
                  <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Remuneração Base</th>
                  <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Comissão (%)</th>
                  <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-brand-dark text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm text-surface-600">
                {filteredFuncionarios.length > 0 ? (
                  filteredFuncionarios.map((f) => (
                    <tr key={f.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                            {(f.nome || 'FN').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-brand-dark">{f.nome || 'Sem Nome'}</p>
                            <p className="text-xs text-surface-400">{f.email || ''} {f.telefone ? `• ${f.telefone}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-surface-100 text-surface-600 rounded-lg text-xs font-semibold">
                          {getFuncaoLabel(f.funcao)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-brand-dark">
                        R$ {(f.salario_base || 0).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="px-6 py-4 font-semibold text-indigo-600">
                        {f.comissao_percentual || 0}%
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          f.ativo !== false 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-surface-200 text-surface-400'
                        }`}>
                          {f.ativo !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleOpenEdit(f)}
                            className="p-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg transition-colors"
                            title="Editar Perfil"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(f)}
                            className={`p-2 rounded-lg transition-colors ${
                              f.ativo !== false 
                                ? 'bg-amber-50 hover:bg-amber-500 text-amber-500 hover:text-white' 
                                : 'bg-green-50 hover:bg-green-600 text-green-600 hover:text-white'
                            }`}
                            title={f.ativo !== false ? 'Desativar' : 'Reativar'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(f)}
                            className="p-2 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors"
                            title="Excluir Definitivamente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-surface-400 font-medium">
                      Nenhum colaborador cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default FuncionariosList;
