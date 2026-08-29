import React, { useState } from 'react';
import { 
  Award, 
  Plus, 
  Minus, 
  Search, 
  Filter, 
  CalendarCheck, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import type { Aluno } from '../../types/database';
import { useNavigate } from 'react-router-dom';

export const SaldoAulasPage = () => {
  const navigate = useNavigate();
  const { data: alunos } = useCollection<Aluno>('alunos', 'nome');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBalance, setFilterBalance] = useState<'todos' | 'com_saldo' | 'sem_saldo'>('todos');

  // Modal Ajuste Manual
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('Desmarcou com antecedência (Aviso prévio)');

  // Filtrar alunos
  const filteredAlunos = alunos.filter(a => {
    const matchesSearch = `${a.nome} ${a.sobrenome || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    const credits = a.creditos_reposicao ?? 0;
    if (filterBalance === 'com_saldo') return matchesSearch && credits > 0;
    if (filterBalance === 'sem_saldo') return matchesSearch && credits <= 0;
    return matchesSearch;
  });

  // Totais KPIs
  const totalCreditos = alunos.reduce((sum, a) => sum + (a.creditos_reposicao ?? 0), 0);
  const alunosComCredito = alunos.filter(a => (a.creditos_reposicao ?? 0) > 0).length;

  const handleUpdateCredits = async (aluno: Aluno, delta: number, motivo: string) => {
    const currentCreds = aluno.creditos_reposicao ?? 0;
    const newCreds = Math.max(0, currentCreds + delta);

    try {
      await updateDoc(doc(db, 'alunos', aluno.id), {
        creditos_reposicao: newCreds,
        updated_at: Date.now()
      });

      // Registra no histórico de logs
      await logActivity({
        action: 'UPDATE',
        resource_type: 'agenda',
        resource_name: aluno.nome,
        details: `Ajuste de saldo de aulas para ${aluno.nome}: ${delta > 0 ? '+' : ''}${delta} crédito(s). Motivo: ${motivo}. Saldo final: ${newCreds}`
      });

      alert(`Saldo atualizado! ${aluno.nome} agora possui ${newCreds} crédito(s) de reposição.`);
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar saldo de créditos.');
    }
  };

  const handleConfirmAdjustModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAluno) return;
    await handleUpdateCredits(selectedAluno, adjustAmount, adjustReason);
    setIsAdjustModalOpen(false);
    setSelectedAluno(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Controle de Saldo de Aulas 🎓</h2>
          <p className="text-surface-500 text-sm">
            Gerencie créditos de reposição decorrentes de ausências comunicadas com antecedência.
          </p>
        </div>

        <button 
          onClick={() => navigate('/agenda')} 
          className="btn-primary flex items-center gap-2"
        >
          <CalendarCheck className="w-5 h-5" />
          Ir para a Agenda de Aulas
        </button>
      </div>

      {/* Regras do Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex items-start gap-4">
          <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-950 text-base">Ausência COM Aviso Prévio (+1 Crédito)</h4>
            <p className="text-emerald-800 text-xs mt-1 leading-relaxed">
              Quando o aluno avisa antes do horário da aula que não poderá comparecer, a aula é liberada para vaga de encaixe e o aluno ganha <strong>+1 Crédito de Reposição</strong>.
            </p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-start gap-4">
          <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-sm">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-rose-950 text-base">Ausência SEM Aviso Prévio (Sem Crédito)</h4>
            <p className="text-rose-800 text-xs mt-1 leading-relaxed">
              Alunos que faltam sem notificar previamente não possuem direito à reposição. A aula é contabilizada normalmente e <strong>NÃO gera crédito</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-surface-400">Total de Créditos Ativos</p>
            <h3 className="text-2xl font-bold text-brand-dark mt-1">{totalCreditos} aulas</h3>
          </div>
          <div className="p-3 bg-brand-medium/10 text-brand-medium rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-surface-400">Alunos com Crédito</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{alunosComCredito} alunos</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-surface-400">Reposições Livres</p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">Grade Pronta</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-surface-400" />
          <input 
            type="text" 
            placeholder="Buscar aluno por nome..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-field pl-10 text-xs py-2"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold w-full md:w-auto">
          <Filter className="w-4 h-4 text-surface-400" />
          <span>Status do Saldo:</span>
          <div className="flex bg-surface-100 p-1 rounded-xl border border-surface-200">
            <button 
              onClick={() => setFilterBalance('todos')} 
              className={`px-3 py-1 rounded-lg transition-all ${filterBalance === 'todos' ? 'bg-white font-bold shadow-sm text-brand-dark' : 'text-surface-500'}`}
            >
              Todos ({alunos.length})
            </button>
            <button 
              onClick={() => setFilterBalance('com_saldo')} 
              className={`px-3 py-1 rounded-lg transition-all ${filterBalance === 'com_saldo' ? 'bg-white font-bold shadow-sm text-emerald-700' : 'text-surface-500'}`}
            >
              Com Créditos ({alunosComCredito})
            </button>
            <button 
              onClick={() => setFilterBalance('sem_saldo')} 
              className={`px-3 py-1 rounded-lg transition-all ${filterBalance === 'sem_saldo' ? 'bg-white font-bold shadow-sm text-surface-700' : 'text-surface-500'}`}
            >
              Sem Crédito ({alunos.length - alunosComCredito})
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Alunos e Saldos */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 border-b border-surface-200 font-bold text-brand-dark uppercase tracking-wider">
              <tr>
                <th className="p-4">Aluno</th>
                <th className="p-4">Frequência Semanal</th>
                <th className="p-4">Créditos de Reposição</th>
                <th className="p-4 text-right">Ações Rápidas de Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
              {filteredAlunos.length > 0 ? (
                filteredAlunos.map((aluno) => {
                  const credits = aluno.creditos_reposicao ?? 0;
                  return (
                    <tr key={aluno.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="p-4 font-bold text-brand-dark flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-medium/10 text-brand-medium font-bold flex items-center justify-center text-xs">
                          {aluno.nome.charAt(0)}
                        </div>
                        <div>
                          <span>{aluno.nome} {aluno.sobrenome || ''}</span>
                          {aluno.personal_nome && (
                            <span className="block text-[10px] text-surface-400 font-normal">
                              Prof: {aluno.personal_nome}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 font-semibold text-surface-600">
                        {aluno.frequencia_semanal || 3}x por semana
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${
                          credits > 0 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-surface-100 text-surface-500 border border-surface-200'
                        }`}>
                          <Award className="w-3.5 h-3.5" />
                          {credits} {credits === 1 ? 'aula disponível' : 'aulas disponíveis'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleUpdateCredits(aluno, 1, 'Desmarcou aula com antecedência (Aviso prévio)')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Adicionar 1 crédito por aviso prévio"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            +1 Aviso Prévio
                          </button>

                          {credits > 0 && (
                            <button 
                              onClick={() => handleUpdateCredits(aluno, -1, 'Consumo de crédito em aula de reposição')}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Descontar 1 crédito"
                            >
                              <Minus className="w-3.5 h-3.5" />
                              -1 Crédito
                            </button>
                          )}

                          <button 
                            onClick={() => {
                              setSelectedAluno(aluno);
                              setAdjustAmount(1);
                              setIsAdjustModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-100 text-brand-dark hover:bg-surface-200 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            Ajustar Manual
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-surface-400 italic">
                    Nenhum aluno encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajuste Customizado */}
      {isAdjustModalOpen && selectedAluno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsAdjustModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-surface-200 animate-scale-in">
            <h3 className="text-xl font-bold text-brand-dark mb-4">Ajustar Saldo de Créditos</h3>
            
            <p className="text-xs text-surface-500 mb-4 font-semibold">
              Aluno: <strong className="text-brand-dark">{selectedAluno.nome} {selectedAluno.sobrenome || ''}</strong><br/>
              Saldo atual: <strong>{selectedAluno.creditos_reposicao ?? 0} crédito(s)</strong>
            </p>

            <form onSubmit={handleConfirmAdjustModal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-brand-dark block mb-1">Quantidade de Créditos (Delta)</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="number" 
                    value={adjustAmount} 
                    onChange={e => setAdjustAmount(parseInt(e.target.value) || 0)} 
                    className="input-field" 
                  />
                </div>
                <p className="text-[10px] text-surface-400 mt-1">Use números positivos (ex: 1) para adicionar ou negativos (ex: -1) para remover.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-brand-dark block mb-1">Motivo do Lançamento</label>
                <select 
                  value={adjustReason} 
                  onChange={e => setAdjustReason(e.target.value)} 
                  className="input-field"
                >
                  <option value="Desmarcou com antecedência (Aviso prévio)">Desmarcou com antecedência (Aviso prévio)</option>
                  <option value="Ajuste administrativo pela recepção">Ajuste administrativo pela recepção</option>
                  <option value="Cursos / Feriado do Studio">Cursos / Feriado do Studio</option>
                  <option value="Expiração de saldo vencido">Expiração de saldo vencido</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
