import React, { useState, useMemo } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import { 
  UserPlus, 
  UserMinus, 
  TrendingUp, 
  TrendingDown, 
  Printer, 
  Loader2, 
  Sparkles,
  Phone,
  Edit3,
  BarChart2
} from 'lucide-react';
import type { Aluno, Funcionario } from '../../types/database';

export const RelatorioMovimentacaoAlunos: React.FC = () => {
  const { data: alunos, loading: loadingAlunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: funcionarios } = useCollection<Funcionario>('funcionarios', 'nome');

  // Mês de Referência Selecionado (YYYY-MM, padrão: mês atual)
  const today = new Date();
  const defaultMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthKey);
  const [selectedPersonalId, setSelectedPersonalId] = useState<string>('todos');
  const [activeTab, setActiveTab] = useState<'entrantes' | 'inativados' | 'base'>('entrantes');

  // Estado para modal/edição de motivo de inativação
  const [editingAluno, setEditingAluno] = useState<Aluno | null>(null);
  const [newMotivo, setNewMotivo] = useState<string>('');
  const [isSavingMotivo, setIsSavingMotivo] = useState(false);

  const loading = loadingAlunos;

  // Timestamps e datas do mês selecionado
  const { startOfMonth, endOfMonth, monthLabel } = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10) || today.getFullYear();
    const monthIndex = (parseInt(monthStr, 10) || (today.getMonth() + 1)) - 1;

    const start = new Date(year, monthIndex, 1).getTime();
    const end = new Date(year, monthIndex + 1, 1).getTime();

    const dateObj = new Date(year, monthIndex, 15);
    const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return { startOfMonth: start, endOfMonth: end, monthLabel: label };
  }, [selectedMonth]);

  // Helper para extrair timestamp ms de uma data/created_at/updated_at
  const parseTimestamp = (val: any): number | null => {
    if (!val) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = new Date(val.includes('T') ? val : val + 'T12:00:00').getTime();
      return isNaN(parsed) ? null : parsed;
    }
    if (val && typeof val === 'object' && 'seconds' in val) {
      return val.seconds * 1000;
    }
    return null;
  };

  // Filtragem de Alunos por Personal e Período
  const { 
    entrantesNoMes, 
    inativadosNoMes, 
    baseAtivaFimMes,
    churnRate, 
    retencaoRate, 
    saldoLiquido,
    historico6Meses 
  } = useMemo(() => {
    const alunosList = alunos || [];

    // Filtro por Personal se selecionado
    const filteredByPersonal = alunosList.filter(a => {
      if (!a) return false;
      if (selectedPersonalId === 'todos') return true;
      const pIds = a.personal_ids || [];
      return a.personal_id === selectedPersonalId || pIds.includes(selectedPersonalId);
    });

    // 1. Alunos Entrantes (Novos Cadastros no Mês)
    const entrantes = filteredByPersonal.filter(a => {
      const ts = parseTimestamp(a.created_at || (a as any).data_cadastro);
      return ts !== null && ts >= startOfMonth && ts < endOfMonth;
    }).sort((a, b) => (parseTimestamp(b.created_at) || 0) - (parseTimestamp(a.created_at) || 0));

    // 2. Alunos Inativados no Mês
    const inativados = filteredByPersonal.filter(a => {
      if (a.ativo !== false) return false;
      const tsInativacao = parseTimestamp((a as any).inativado_em || a.updated_at);
      return tsInativacao !== null && tsInativacao >= startOfMonth && tsInativacao < endOfMonth;
    }).sort((a, b) => (parseTimestamp((b as any).inativado_em || b.updated_at) || 0) - (parseTimestamp((a as any).inativado_em || a.updated_at) || 0));

    // 3. Base Ativa de Alunos no Fim do Mês
    const baseAtiva = filteredByPersonal.filter(a => a.ativo !== false);

    const qtdEntrantes = entrantes.length;
    const qtdInativados = inativados.length;
    const saldo = qtdEntrantes - qtdInativados;

    // Cálculo da taxa de evasão (Churn Rate %)
    const totalBaseInicio = Math.max(1, baseAtiva.length + qtdInativados - qtdEntrantes);
    const rateChurn = parseFloat(((qtdInativados / totalBaseInicio) * 100).toFixed(1));
    const rateRetencao = parseFloat((100 - rateChurn).toFixed(1));

    // 4. Histórico Comparativo dos Últimos 6 Meses
    const last6Months: Array<{ monthKey: string; label: string; entradas: number; saidas: number; saldo: number }> = [];
    const [yearStr, monthStr] = selectedMonth.split('-');
    const baseYear = parseInt(yearStr, 10) || today.getFullYear();
    const baseMonthIdx = (parseInt(monthStr, 10) || (today.getMonth() + 1)) - 1;

    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseYear, baseMonthIdx - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      const mLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

      const eCount = filteredByPersonal.filter(a => {
        const ts = parseTimestamp(a.created_at || (a as any).data_cadastro);
        return ts !== null && ts >= mStart && ts < mEnd;
      }).length;

      const sCount = filteredByPersonal.filter(a => {
        if (a.ativo !== false) return false;
        const ts = parseTimestamp((a as any).inativado_em || a.updated_at);
        return ts !== null && ts >= mStart && ts < mEnd;
      }).length;

      last6Months.push({
        monthKey: mKey,
        label: mLabel,
        entradas: eCount,
        saidas: sCount,
        saldo: eCount - sCount
      });
    }

    return {
      entrantesNoMes: entrantes,
      inativadosNoMes: inativados,
      baseAtivaFimMes: baseAtiva,
      churnRate: rateChurn,
      retencaoRate: rateRetencao,
      saldoLiquido: saldo,
      historico6Meses: last6Months
    };
  }, [alunos, selectedMonth, selectedPersonalId]);

  // Salvar motivo de inativação no Firestore
  const handleSaveMotivoInativacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAluno) return;
    setIsSavingMotivo(true);

    try {
      const alunoRef = doc(db, 'alunos', editingAluno.id);
      await updateDoc(alunoRef, {
        motivo_inativacao: newMotivo,
        updated_at: Date.now()
      });

      await logActivity({
        action: 'UPDATE',
        resource_type: 'aluno',
        resource_name: editingAluno.nome,
        details: `Registrou motivo de inativação para o aluno ${editingAluno.nome}: "${newMotivo}"`
      });

      setEditingAluno(null);
      setNewMotivo('');
    } catch (err) {
      console.error('Erro ao atualizar motivo de inativação:', err);
      alert('Erro ao salvar motivo de inativação.');
    } finally {
      setIsSavingMotivo(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const personaisList = (funcionarios || []).filter(f => f && ((f as any).funcao === 'personal_trainer' || (f as any).perfil === 'instrutor' || (f as any).perfil === 'admin'));

  return (
    <div className="space-y-6">
      {/* CSS para Impressão PDF */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-3xl font-display text-brand-dark flex items-center gap-2">
            Movimentação & Retenção de Alunos 📊
          </h2>
          <p className="text-surface-500 text-sm">
            Análise detalhada de novos alunos (entradas), cancelamentos (inativações) e taxa de evasão (*churn*).
          </p>
        </div>

        {/* Bar de Filtros de Período e Personal */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Seletor de Personal */}
          <div className="relative min-w-[160px]">
            <select
              value={selectedPersonalId}
              onChange={e => setSelectedPersonalId(e.target.value)}
              className="input-field text-xs font-bold py-2 cursor-pointer bg-white"
            >
              <option value="todos">Todos os Personais</option>
              {personaisList.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          {/* Seletor de Mês/Ano */}
          <div className="relative min-w-[150px]">
            <input 
              type="month" 
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="input-field text-xs font-bold py-2 cursor-pointer bg-white"
            />
          </div>

          {/* Botão Imprimir */}
          <button
            onClick={handlePrint}
            className="btn-secondary flex items-center gap-1.5 py-2 text-xs font-bold bg-white"
          >
            <Printer className="w-4 h-4 text-brand-medium" />
            Imprimir Relatório
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4 no-print">
          <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
          <p className="font-medium">Calculando movimentação de alunos no período...</p>
        </div>
      ) : (
        <>
          {/* Cards de KPIs Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 no-print">
            {/* Entradas (Novos Alunos) */}
            <div className="glass-card p-5 border-l-4 border-emerald-500 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-surface-400 font-semibold uppercase">Novos Alunos (Entradas)</span>
                  <h4 className="text-3xl font-bold text-emerald-700 mt-1">
                    +{entrantesNoMes.length}
                  </h4>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                  <UserPlus className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold mt-2">Cadastrados no mês de {monthLabel}</p>
            </div>

            {/* Saídas (Alunos Inativados) */}
            <div className="glass-card p-5 border-l-4 border-red-500 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-surface-400 font-semibold uppercase">Alunos Inativados (Saídas)</span>
                  <h4 className="text-3xl font-bold text-red-600 mt-1">
                    -{inativadosNoMes.length}
                  </h4>
                </div>
                <div className="p-3 rounded-2xl bg-red-50 text-red-500">
                  <UserMinus className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[11px] text-red-600 font-semibold mt-2">Inativados no mês de {monthLabel}</p>
            </div>

            {/* Saldo Líquido */}
            <div className="glass-card p-5 border-l-4 border-brand-medium relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-surface-400 font-semibold uppercase">Saldo Líquido do Mês</span>
                  <h4 className={`text-3xl font-bold mt-1 ${saldoLiquido >= 0 ? 'text-brand-dark' : 'text-amber-600'}`}>
                    {saldoLiquido >= 0 ? `+${saldoLiquido}` : saldoLiquido}
                  </h4>
                </div>
                <div className={`p-3 rounded-2xl ${saldoLiquido >= 0 ? 'bg-brand-50 text-brand-medium' : 'bg-amber-50 text-amber-600'}`}>
                  {saldoLiquido >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                </div>
              </div>
              <p className="text-[11px] text-surface-500 font-semibold mt-2">
                {saldoLiquido >= 0 ? 'Crescimento positivo na base' : 'Retração na base de alunos'}
              </p>
            </div>

            {/* Taxa de Evasão (Churn Rate %) */}
            <div className="glass-card p-5 border-l-4 border-indigo-600 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs text-surface-400 font-semibold uppercase">Taxa de Evasão (Churn)</span>
                  <h4 className="text-3xl font-bold text-indigo-700 mt-1">
                    {churnRate}%
                  </h4>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                  <BarChart2 className="w-6 h-6" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-semibold text-surface-500">Retenção: <strong className="text-indigo-700">{retencaoRate}%</strong></span>
              </div>
            </div>
          </div>

          {/* Gráfico / Histórico Comparativo dos Últimos 6 Meses */}
          <div className="glass-card p-6 no-print">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-medium" />
                  Evolução Histórica dos Últimos 6 Meses (Entradas vs Saídas)
                </h3>
                <p className="text-xs text-surface-400">Comparativo do fluxo de alunos para análise de tendência de crescimento do estúdio.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              {historico6Meses.map((item) => (
                <div key={item.monthKey} className="p-3.5 bg-surface-50 rounded-2xl border border-surface-200 text-center flex flex-col justify-between">
                  <span className="text-xs font-bold text-brand-dark capitalize block mb-2">{item.label}</span>
                  
                  <div className="space-y-1 my-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-600 font-semibold">Entradas:</span>
                      <strong className="text-emerald-700">+{item.entradas}</strong>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-red-500 font-semibold">Saídas:</span>
                      <strong className="text-red-600">-{item.saidas}</strong>
                    </div>
                  </div>

                  <div className={`mt-2 pt-2 border-t border-surface-200 text-xs font-bold ${item.saldo >= 0 ? 'text-brand-medium' : 'text-amber-600'}`}>
                    Saldo: {item.saldo >= 0 ? `+${item.saldo}` : item.saldo}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seção Nominal de Alunos com Navegação em Abas */}
          <div className="glass-card overflow-hidden no-print">
            <div className="p-4 bg-surface-50 border-b border-surface-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              {/* Abas */}
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-surface-200">
                <button
                  onClick={() => setActiveTab('entrantes')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'entrantes' 
                      ? 'bg-emerald-500 text-white shadow-xs' 
                      : 'text-surface-600 hover:text-brand-dark'
                  }`}
                >
                  🟢 Novos Alunos Entrantes ({entrantesNoMes.length})
                </button>

                <button
                  onClick={() => setActiveTab('inativados')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'inativados' 
                      ? 'bg-red-500 text-white shadow-xs' 
                      : 'text-surface-600 hover:text-brand-dark'
                  }`}
                >
                  🔴 Alunos Inativados ({inativadosNoMes.length})
                </button>

                <button
                  onClick={() => setActiveTab('base')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'base' 
                      ? 'bg-brand-dark text-white shadow-xs' 
                      : 'text-surface-600 hover:text-brand-dark'
                  }`}
                >
                  👥 Base Ativa no Período ({baseAtivaFimMes.length})
                </button>
              </div>

              <span className="text-xs text-surface-500 font-semibold">
                Mês de Referência: <strong className="text-brand-dark capitalize">{monthLabel}</strong>
              </span>
            </div>

            {/* Tabela de Conteúdo de acordo com a Aba Selecionada */}
            <div className="overflow-x-auto">
              {activeTab === 'entrantes' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-50/50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Aluno</th>
                      <th className="p-4">Data de Cadastro / Entrada</th>
                      <th className="p-4">Telefone / Contato</th>
                      <th className="p-4">Personal Responsável</th>
                      <th className="p-4">Status Atual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 text-surface-700 font-medium">
                    {entrantesNoMes.length > 0 ? (
                      entrantesNoMes.map(aluno => {
                        const tsCreated = parseTimestamp(aluno.created_at || aluno.data_cadastro);
                        const dtStr = tsCreated ? new Date(tsCreated).toLocaleDateString('pt-BR') : 'N/I';
                        const pNome = aluno.personal_nome || 'Não atribuído';

                        return (
                          <tr key={aluno.id} className="hover:bg-surface-50/60 transition-colors">
                            <td className="p-4 font-bold text-brand-dark text-sm">
                              {aluno.nome}
                            </td>
                            <td className="p-4 font-bold text-emerald-700">
                              {dtStr}
                            </td>
                            <td className="p-4 text-surface-500">
                              {aluno.telefone ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5 text-surface-400" />
                                  {aluno.telefone}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="p-4 font-semibold text-brand-dark">
                              {pNome}
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                NOVO ALUNO ATIVO
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-surface-400 font-medium">
                          Nenhum novo aluno cadastrado no mês de {monthLabel}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'inativados' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-50/50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Aluno</th>
                      <th className="p-4">Data da Inativação</th>
                      <th className="p-4">Telefone / Contato</th>
                      <th className="p-4">Personal Responsável</th>
                      <th className="p-4">Motivo do Cancelamento</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 text-surface-700 font-medium">
                    {inativadosNoMes.length > 0 ? (
                      inativadosNoMes.map(aluno => {
                        const tsInativado = parseTimestamp(aluno.inativado_em || aluno.updated_at);
                        const dtStr = tsInativado ? new Date(tsInativado).toLocaleDateString('pt-BR') : 'N/I';
                        const pNome = aluno.personal_nome || 'Não atribuído';

                        return (
                          <tr key={aluno.id} className="hover:bg-surface-50/60 transition-colors">
                            <td className="p-4 font-bold text-brand-dark text-sm">
                              {aluno.nome}
                            </td>
                            <td className="p-4 font-bold text-red-600">
                              {dtStr}
                            </td>
                            <td className="p-4 text-surface-500">
                              {aluno.telefone ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5 text-surface-400" />
                                  {aluno.telefone}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="p-4 font-semibold text-brand-dark">
                              {pNome}
                            </td>
                            <td className="p-4">
                              {aluno.motivo_inativacao ? (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-100 text-surface-700 border border-surface-200">
                                  {aluno.motivo_inativacao}
                                </span>
                              ) : (
                                <span className="text-surface-400 italic">Motivo não registrado</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => {
                                  setEditingAluno(aluno);
                                  setNewMotivo(aluno.motivo_inativacao || '');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface-100 hover:bg-brand-dark hover:text-white text-surface-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Registrar Motivo
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-surface-400 font-medium">
                          Nenhum aluno inativado no mês de {monthLabel}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'base' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-50/50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Aluno</th>
                      <th className="p-4">Data de Cadastro</th>
                      <th className="p-4">Telefone / Contato</th>
                      <th className="p-4">Personal Responsável</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 text-surface-700 font-medium">
                    {baseAtivaFimMes.length > 0 ? (
                      baseAtivaFimMes.map(aluno => {
                        const tsCreated = parseTimestamp(aluno.created_at || aluno.data_cadastro);
                        const dtStr = tsCreated ? new Date(tsCreated).toLocaleDateString('pt-BR') : 'N/I';

                        return (
                          <tr key={aluno.id} className="hover:bg-surface-50/60 transition-colors">
                            <td className="p-4 font-bold text-brand-dark">
                              {aluno.nome}
                            </td>
                            <td className="p-4 text-surface-500">
                              {dtStr}
                            </td>
                            <td className="p-4 text-surface-500">
                              {aluno.telefone || '-'}
                            </td>
                            <td className="p-4 font-semibold text-brand-dark">
                              {aluno.personal_nome || 'Não atribuído'}
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ATIVO
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-surface-400 font-medium">
                          Nenhum aluno ativo encontrado na base.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal Registrar Motivo de Inativação */}
      {editingAluno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-xs" onClick={() => setEditingAluno(null)}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-surface-200 animate-scale-in">
            <h3 className="text-lg font-bold text-brand-dark mb-1">Registrar Motivo de Cancelamento</h3>
            <p className="text-xs text-surface-500 mb-4">
              Informe o motivo da saída do aluno <strong className="text-brand-dark">{editingAluno.nome}</strong>.
            </p>

            <form onSubmit={handleSaveMotivoInativacao} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-brand-dark block mb-1">Motivo Principal</label>
                <select
                  value={newMotivo}
                  onChange={e => setNewMotivo(e.target.value)}
                  className="input-field text-xs font-semibold cursor-pointer mb-2"
                >
                  <option value="">Selecione um motivo...</option>
                  <option value="Mudança de Endereço / Cidade">Mudança de Endereço / Cidade</option>
                  <option value="Falta de Tempo / Incompatibilidade de Horário">Falta de Tempo / Incompatibilidade de Horário</option>
                  <option value="Motivos Financeiros">Motivos Financeiros</option>
                  <option value="Problemas de Saúde / Lesão">Problemas de Saúde / Lesão</option>
                  <option value="Insatisfação com Atendimento / Treinos">Insatisfação com Atendimento / Treinos</option>
                  <option value="Outro Motivo">Outro Motivo</option>
                </select>

                <input
                  type="text"
                  placeholder="Ou digite um motivo personalizado..."
                  value={newMotivo}
                  onChange={e => setNewMotivo(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-100">
                <button
                  type="button"
                  onClick={() => setEditingAluno(null)}
                  className="btn-secondary text-xs"
                  disabled={isSavingMotivo}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs flex items-center gap-1"
                  disabled={isSavingMotivo}
                >
                  {isSavingMotivo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar Motivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÁREA DE IMPRESSÃO EXECUTIVA (PDF/Papel) */}
      <div id="print-area" className="hidden">
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight">AELLO STUDIO</h1>
            <p className="text-xs font-bold">Relatório Executivo de Movimentação & Retenção de Alunos</p>
            <p className="text-xs text-gray-600">Período de Referência: {monthLabel}</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
            <p>Filtro Personal: {selectedPersonalId === 'todos' ? 'Todos os Personais' : selectedPersonalId}</p>
          </div>
        </div>

        {/* Resumo Executivo em Impressão */}
        <div className="grid grid-cols-4 gap-4 bg-gray-100 p-4 border border-black mb-6 text-center text-xs">
          <div>
            <span className="block font-bold">Novos Alunos:</span>
            <span className="text-lg font-black text-green-700">+{entrantesNoMes.length}</span>
          </div>
          <div>
            <span className="block font-bold">Inativações:</span>
            <span className="text-lg font-black text-red-700">-{inativadosNoMes.length}</span>
          </div>
          <div>
            <span className="block font-bold">Saldo Líquido:</span>
            <span className="text-lg font-black">{saldoLiquido >= 0 ? `+${saldoLiquido}` : saldoLiquido}</span>
          </div>
          <div>
            <span className="block font-bold">Taxa de Churn:</span>
            <span className="text-lg font-black">{churnRate}%</span>
          </div>
        </div>

        {/* Tabela Entrantes Impressão */}
        <h3 className="font-bold text-xs uppercase mb-2">1. Novos Alunos Cadastrados no Mês ({entrantesNoMes.length})</h3>
        <table className="w-full text-left text-xs border-collapse border border-black mb-6">
          <thead>
            <tr className="bg-gray-200 border-b border-black font-bold">
              <th className="p-2 border-r border-black">Aluno</th>
              <th className="p-2 border-r border-black">Data Entrada</th>
              <th className="p-2 border-r border-black">Contato</th>
              <th className="p-2">Personal Responsável</th>
            </tr>
          </thead>
          <tbody>
            {entrantesNoMes.map((a, i) => (
              <tr key={i} className="border-b border-gray-300">
                <td className="p-2 border-r border-black font-bold">{a.nome}</td>
                <td className="p-2 border-r border-black">{parseTimestamp(a.created_at || a.data_cadastro) ? new Date(parseTimestamp(a.created_at || a.data_cadastro)!).toLocaleDateString('pt-BR') : 'N/I'}</td>
                <td className="p-2 border-r border-black">{a.telefone || '-'}</td>
                <td className="p-2">{a.personal_nome || 'Não atribuído'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tabela Inativados Impressão */}
        <h3 className="font-bold text-xs uppercase mb-2">2. Alunos Inativados no Mês ({inativadosNoMes.length})</h3>
        <table className="w-full text-left text-xs border-collapse border border-black mb-6">
          <thead>
            <tr className="bg-gray-200 border-b border-black font-bold">
              <th className="p-2 border-r border-black">Aluno</th>
              <th className="p-2 border-r border-black">Data Inativação</th>
              <th className="p-2 border-r border-black">Contato</th>
              <th className="p-2 border-r border-black">Personal</th>
              <th className="p-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {inativadosNoMes.map((a, i) => (
              <tr key={i} className="border-b border-gray-300">
                <td className="p-2 border-r border-black font-bold">{a.nome}</td>
                <td className="p-2 border-r border-black">{parseTimestamp(a.inativado_em || a.updated_at) ? new Date(parseTimestamp(a.inativado_em || a.updated_at)!).toLocaleDateString('pt-BR') : 'N/I'}</td>
                <td className="p-2 border-r border-black">{a.telefone || '-'}</td>
                <td className="p-2 border-r border-black">{a.personal_nome || 'Não atribuído'}</td>
                <td className="p-2">{a.motivo_inativacao || 'Não informado'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RelatorioMovimentacaoAlunos;
