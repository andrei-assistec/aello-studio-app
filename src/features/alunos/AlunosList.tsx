import { useState } from 'react';
import { Search, Plus, Filter, MoreVertical, Eye, Loader2, Power, Trash2, Layers } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import type { Aluno } from '../../types/database';
import { getPlanosDoAluno } from '../../types/database';
import { AlunoFormModal } from './AlunoFormModal';
import { generateSingleStudentMonthFinance } from '../../services/monthlyFinanceGenerator';

export const AlunosList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alunoToEdit, setAlunoToEdit] = useState<Aluno | null>(null);
  
  // Filtros
  const [showFiltros, setShowFiltros] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ativo' | 'inativo'>('all');

  // Menu de ações
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const { data: alunos, loading } = useCollection<Aluno>('alunos', 'nome');

  const filteredAlunos = alunos.filter(a => {
    const matchBusca = a.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || (filterStatus === 'ativo' ? a.ativo : !a.ativo);
    return matchBusca && matchStatus;
  });

  const handleOpenEdit = (aluno: Aluno) => {
    setAlunoToEdit(aluno);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleCreateNew = () => {
    setAlunoToEdit(null);
    setIsModalOpen(true);
  };

  const handletoggleStatus = async (aluno: Aluno) => {
    const isActivating = aluno.ativo === false;

    if (isActivating) {
      if (window.confirm(`Deseja REATIVAR a matrícula do aluno ${aluno.nome}? Uma cobrança de mensalidade será gerada para o mês atual.`)) {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        await updateDoc(doc(db, 'alunos', aluno.id), { 
          ativo: true,
          data_reativacao: currentYM
        });
        
        await generateSingleStudentMonthFinance({ ...aluno, ativo: true, data_reativacao: currentYM }, currentYM);

        await logActivity({
          action: 'UPDATE',
          resource_type: 'aluno',
          resource_id: aluno.id,
          resource_name: aluno.nome,
          details: `Reativou aluno ${aluno.nome} e gerou cobrança do mês atual (${currentYM})`
        });
      }
      setActiveMenuId(null);
      return;
    }

    // Se estiver desativando (Inativação)
    try {
      const q = query(collection(db, 'receitas'), where('aluno_id', '==', aluno.id));
      const receitasSnap = await getDocs(q);
      const pendentes: { id: string; valor: number; vencimento: string }[] = [];
      
      receitasSnap.forEach(docSnap => {
        const data = docSnap.data();
        if ((data.status || 'pendente').toLowerCase() !== 'pago') {
          pendentes.push({
            id: docSnap.id,
            valor: data.valor || 0,
            vencimento: data.vencimento || data.data_vencimento || ''
          });
        }
      });

      if (pendentes.length > 0) {
        const totalPendente = pendentes.reduce((acc, p) => acc + p.valor, 0);
        const decisao = window.confirm(
          `O aluno ${aluno.nome} possui ${pendentes.length} conta(s) pendente(s)/vencida(s) no valor total de R$ ${totalPendente.toFixed(2)}.\n\n` +
          `[ OK ] = Desativar o aluno e APAGAR/CANCELAR as contas pendentes não cobradas.\n` +
          `[ CANCELAR ] = Escolher se deseja MANTER as contas pendentes ou cancelar a desativação.`
        );

        if (decisao) {
          // Apagar contas pendentes do aluno
          for (const p of pendentes) {
            await deleteDoc(doc(db, 'receitas', p.id));
          }
          await updateDoc(doc(db, 'alunos', aluno.id), { ativo: false });
          await logActivity({
            action: 'UPDATE',
            resource_type: 'aluno',
            resource_id: aluno.id,
            resource_name: aluno.nome,
            details: `Desativou aluno ${aluno.nome} e removeu ${pendentes.length} conta(s) pendente(s) não cobradas`
          });
        } else {
          const manterContas = window.confirm(`Deseja MANTER as ${pendentes.length} contas pendentes registradas no sistema e apenas desativar o aluno?`);
          if (manterContas) {
            await updateDoc(doc(db, 'alunos', aluno.id), { ativo: false });
            await logActivity({
              action: 'UPDATE',
              resource_type: 'aluno',
              resource_id: aluno.id,
              resource_name: aluno.nome,
              details: `Desativou aluno ${aluno.nome} mantendo ${pendentes.length} conta(s) pendente(s) no sistema`
            });
          }
        }
      } else {
        if (window.confirm(`Deseja DESATIVAR a matrícula do aluno ${aluno.nome}?`)) {
          await updateDoc(doc(db, 'alunos', aluno.id), { ativo: false });
          await logActivity({
            action: 'UPDATE',
            resource_type: 'aluno',
            resource_id: aluno.id,
            resource_name: aluno.nome,
            details: `Desativou aluno ${aluno.nome}`
          });
        }
      }
    } catch (e: any) {
      console.error("Erro ao alterar status do aluno:", e);
      alert("Erro ao alterar status do aluno: " + e.message);
    }
    setActiveMenuId(null);
  };

  const handleDelete = async (aluno: Aluno) => {
    if (window.confirm(`ATENÇÃO: Deseja EXCLUIR permanentemente o aluno ${aluno.nome}? Esta ação apagará todo o histórico.`)) {
      await deleteDoc(doc(db, 'alunos', aluno.id));
      await logActivity({
        action: 'DELETE',
        resource_type: 'aluno',
        resource_id: aluno.id,
        resource_name: aluno.nome,
        details: `Excluiu permanentemente o aluno ${aluno.nome}`
      });
    }
    setActiveMenuId(null);
  };

  return (
    <div className="space-y-6">
      
      <AlunoFormModal 
        isOpen={isModalOpen} 
        alunoToEdit={alunoToEdit}
        onClose={() => {
          setIsModalOpen(false);
          setAlunoToEdit(null);
        }} 
        onSuccess={() => {
          setIsModalOpen(false);
          setAlunoToEdit(null);
          // O snapshot do firebase atualiza a lista automaticamente
        }} 
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Gestão de Alunos</h2>
          <p className="text-surface-500">
            {loading ? 'Carregando...' : `Gerencie sua base de ${alunos.length} alunos cadastrados.`}
          </p>
        </div>
        <button 
          className="btn-primary"
          onClick={handleCreateNew}
        >
          <Plus className="w-5 h-5" />
          Novo Aluno
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6 relative">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome..." 
            className="input-field pl-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <button 
            className={`btn-secondary flex gap-2 ${showFiltros ? '!bg-brand-medium text-white' : ''}`}
            onClick={() => setShowFiltros(!showFiltros)}
          >
            <Filter className="w-5 h-5" />
            Filtros
          </button>
          
          {/* Menu Dropdown de Filtros */}
          {showFiltros && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-surface-200 rounded-xl shadow-xl z-10 p-3 animate-fade-in">
              <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Status</p>
              <div className="space-y-1">
                <button onClick={() => setFilterStatus('all')} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-100 ${filterStatus === 'all' ? 'bg-surface-100 font-bold' : ''}`}>Todos</button>
                <button onClick={() => setFilterStatus('ativo')} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-green-50 text-green-700 ${filterStatus === 'ativo' ? 'bg-green-50 font-bold' : ''}`}>Apenas Ativos</button>
                <button onClick={() => setFilterStatus('inativo')} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-100 text-surface-600 ${filterStatus === 'inativo' ? 'bg-surface-100 font-bold' : ''}`}>Apenas Inativos</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
            <p className="font-medium">Carregando alunos do Firebase...</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-surface-50 border-b border-surface-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Aluno</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Professor / Personal</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Objetivo</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Restrições Médicas</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-dark text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filteredAlunos.map((aluno) => (
                <tr key={aluno.id} className="hover:bg-surface-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-dark/5 rounded-full flex items-center justify-center text-brand-dark font-bold uppercase shrink-0">
                        {aluno.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-brand-dark leading-tight mb-1">
                          {aluno.nome} {aluno.sobrenome || ''}
                        </p>
                        <p className="text-xs text-surface-400">
                          Freq: {aluno.frequencia_semanal}x/sem • <span className="capitalize">{aluno.modalidade || 'musculacao'}</span>
                        </p>
                        {(aluno.creditos_reposicao ?? 0) > 0 && (
                          <span className="inline-block mt-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                            {aluno.creditos_reposicao} aula(s) em haver
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const planosList = getPlanosDoAluno(aluno);
                      if (aluno.tem_multiplos_planos || planosList.length > 1) {
                        return (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-medium font-bold text-[10px] uppercase border border-brand-200">
                              <Layers className="w-3 h-3" /> {planosList.length} Planos Contratados
                            </span>
                            {planosList.map((p, idx) => (
                              <div key={p.id || idx} className="text-xs text-surface-600">
                                <span className="font-semibold text-brand-dark">{p.plano_nome}</span>: {p.personal_nome || 'Sem Personal'} <span className="text-surface-400">({p.valor_mensalidade ? `R$ ${p.valor_mensalidade.toFixed(2)}` : '-'})</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return (
                        <div>
                          <div className="text-sm font-semibold text-brand-dark">
                            {aluno.personal_nome || <span className="text-surface-400 font-normal italic">Sem vínculo</span>}
                          </div>
                          {aluno.plano_nome && (
                            <div className="text-xs text-surface-500 font-medium">
                              {aluno.plano_nome} {aluno.valor_mensalidade ? `(R$ ${aluno.valor_mensalidade.toFixed(2)})` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-surface-600">
                    <span className="truncate max-w-[150px] inline-block" title={aluno.objetivo}>{aluno.objetivo || 'Não definido'}</span>
                  </td>
                  <td className="px-6 py-4">
                    {aluno.restricoes && aluno.restricoes.toLowerCase() !== 'none' ? (
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {aluno.restricoes.split(',').map((rest, i) => (
                          <span key={i} className="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            {rest.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-surface-400 text-xs italic">Nenhuma</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${aluno.ativo ? 'bg-green-100 text-green-700' : 'bg-surface-200 text-surface-500'}`}>
                      {aluno.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 relative">
                      <button 
                        onClick={() => handleOpenEdit(aluno)}
                        className="p-2 hover:bg-brand-dark/10 rounded-lg text-brand-dark transition-colors" 
                        title="Ver / Editar Ficha"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === aluno.id ? null : aluno.id)}
                        className="p-2 hover:bg-brand-dark/10 rounded-lg text-surface-500 transition-colors"
                        title="Mais Ações"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {/* Menu de Açõe Inline */}
                      {activeMenuId === aluno.id && (
                        <div className="absolute right-0 top-12 w-48 bg-white border border-surface-200 shadow-xl rounded-xl z-20 overflow-hidden animate-fade-in text-left">
                          <button 
                            onClick={() => handletoggleStatus(aluno)}
                            className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-surface-50 transition-colors border-b border-surface-100"
                          >
                            <Power className={`w-4 h-4 ${aluno.ativo ? 'text-surface-500' : 'text-green-600'}`} />
                            {aluno.ativo ? 'Desativar Aluno' : 'Reativar Aluno'}
                          </button>
                          <button 
                            onClick={() => handleDelete(aluno)}
                            className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-red-50 text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir Permanente
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAlunos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-surface-400">
                    Nenhum aluno encontrado para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
