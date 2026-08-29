import { useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { 
  ClipboardList, 
  TrendingUp, 
  Loader2,
  Clock,
  AlertCircle,
  MessageSquare,
  Activity,
  Award,
  UserCheck
} from 'lucide-react';
import type { Aluno, AgendamentoFixo, AulaSessao, Mesociclo } from '../../types/database';
import type { Receita } from '../financeiro/ReceitaFormModal';
import type { Despesa } from '../financeiro/DespesaFormModal';
import type { Funcionario } from '../funcionarios/FuncionarioFormModal';

type PeriodFilter = 'atual' | '3meses' | '6meses' | '12meses' | 'todos';

export const RelatoriosPage = () => {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'frequencia' | 'treinos' | 'colaboradores'>('financeiro');
  const [period, setPeriod] = useState<PeriodFilter>('atual');

  // Load datasets
  const { data: alunos, loading: loadingAlunos } = useCollection<Aluno>('alunos');
  const { data: receitas, loading: loadingReceitas } = useCollection<Receita>('receitas');
  const { data: despesas, loading: loadingDespesas } = useCollection<Despesa>('despesas');
  const { data: agendamentosFixos, loading: loadingAgendamentos } = useCollection<AgendamentoFixo>('agendamentos_fixos');
  const { data: agendaAulas, loading: loadingAulas } = useCollection<AulaSessao>('agenda_aulas');
  const { data: mesociclos, loading: loadingMesos } = useCollection<Mesociclo>('mesociclos');
  const { data: funcionarios, loading: loadingFunc } = useCollection<Funcionario>('funcionarios', 'nome');

  const loading = loadingAlunos || loadingReceitas || loadingDespesas || loadingAgendamentos || loadingAulas || loadingMesos || loadingFunc;

  // Filter periods in milliseconds
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const getPeriodRange = () => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    
    if (period === 'atual') {
      return {
        start: start.getTime(),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
      };
    } else if (period === '3meses') {
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime(),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
      };
    } else if (period === '6meses') {
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime(),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
      };
    } else if (period === '12meses') {
      return {
        start: new Date(now.getFullYear() - 1, now.getMonth() + 1, 1).getTime(),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
      };
    } else {
      return {
        start: 0,
        end: Infinity
      };
    }
  };

  const range = getPeriodRange();

  // Filters items by dates in Brazilian date format or milliseconds
  const parseVencimentoToMs = (vStr: string) => {
    return new Date(vStr + 'T00:00:00').getTime();
  };

  const getItemPaidMs = (item: { data_pagamento?: number | string | null }): number | null => {
    if (!item.data_pagamento) return null;
    if (typeof item.data_pagamento === 'number') return item.data_pagamento;
    if (typeof item.data_pagamento === 'string') {
      const parsed = new Date(item.data_pagamento.includes('T') ? item.data_pagamento : item.data_pagamento + 'T12:00:00').getTime();
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const getItemDueStr = (item: { vencimento?: string; data_vencimento?: string }): string => {
    return item.vencimento || item.data_vencimento || '';
  };

  const filteredReceitas = receitas.filter(r => {
    if (period === 'todos') return true;
    const pMs = getItemPaidMs(r);
    if ((r.status || '').toLowerCase() === 'pago' && pMs !== null) {
      return pMs >= range.start && pMs < range.end;
    }
    const dueStr = getItemDueStr(r);
    if (dueStr) {
      const vMs = parseVencimentoToMs(dueStr);
      return vMs >= range.start && vMs < range.end;
    }
    return false;
  });

  const filteredDespesas = despesas.filter(d => {
    if (period === 'todos') return true;
    const pMs = getItemPaidMs(d);
    if ((d.status || '').toLowerCase() === 'pago' && pMs !== null) {
      return pMs >= range.start && pMs < range.end;
    }
    const dueStr = getItemDueStr(d);
    if (dueStr) {
      const vMs = parseVencimentoToMs(dueStr);
      return vMs >= range.start && vMs < range.end;
    }
    return false;
  });

  const filteredAulas = agendaAulas.filter(a => {
    if (period === 'todos') return true;
    if (!a.data) return false;
    const aMs = parseVencimentoToMs(a.data);
    return aMs >= range.start && aMs < range.end;
  });

  // Operational metrics
  const totalAlunos = alunos.filter(a => a.ativo !== false).length;

  // WhatsApp helper
  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 11) return '55' + digits;
    return digits;
  };

  const handleNotify = (item: Receita) => {
    const student = item.aluno_id ? alunos.find(a => a.id === item.aluno_id) : undefined;
    const name = item.aluno_nome || item.descricao || 'Aluno';
    const tel = student?.telefone;
    if (!tel) {
      alert(`O aluno ${name} não possui telefone cadastrado.`);
      return;
    }
    const phone = cleanPhone(tel);
    const dueStr = getItemDueStr(item);
    const msg = `Olá ${name}, identificamos que a sua mensalidade de R$ ${(item.valor || 0).toFixed(2).replace('.', ',')} com vencimento em ${dueStr ? new Date(dueStr + 'T00:00:00').toLocaleDateString('pt-BR') : 'breve'} está pendente de pagamento. Por favor, desconsidere caso já tenha efetuado.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-surface-400 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-medium" />
        <p className="font-semibold text-brand-dark">Carregando relatórios...</p>
      </div>
    );
  }

  // FINANCE METRICS CALCULATION
  const receitasPagas = filteredReceitas.filter(r => (r.status || '').toLowerCase() === 'pago');
  const totalReceitasPagas = receitasPagas.reduce((acc, r) => acc + (r.valor || 0), 0);

  const despesasPagas = filteredDespesas.filter(d => (d.status || '').toLowerCase() === 'pago');
  const totalDespesasPagas = despesasPagas.reduce((acc, d) => acc + (d.valor || 0), 0);

  const lucroLiquido = totalReceitasPagas - totalDespesasPagas;

  // Receitas por categoria de plano
  const receitasPorPlano: Record<string, number> = {};
  receitasPagas.forEach(r => {
    const p = r.plano || (r as any).categoria || 'Outros';
    receitasPorPlano[p] = (receitasPorPlano[p] || 0) + (r.valor || 0);
  });

  // Despesas por categoria
  const despesasPorCategoria: Record<string, number> = {};
  despesasPagas.forEach(d => {
    const c = d.categoria || 'Outros';
    despesasPorCategoria[c] = (despesasPorCategoria[c] || 0) + (d.valor || 0);
  });

  // Inadimplência no período
  const inadimplentes = filteredReceitas.filter(r => {
    const st = (r.status || '').toLowerCase();
    const dueStr = getItemDueStr(r);
    return st === 'atrasado' || (st === 'pendente' && dueStr !== '' && dueStr < todayStr);
  });
  const totalInadimplencia = inadimplentes.reduce((acc, r) => acc + (r.valor || 0), 0);

  // Previsões pendentes
  const totalApenasPendente = filteredReceitas
    .filter(r => (r.status || '').toLowerCase() === 'pendente' && getItemDueStr(r) >= todayStr)
    .reduce((acc, r) => acc + (r.valor || 0), 0);

  // OPERATIONAL METRICS CALCULATION
  const totalPresencas = filteredAulas.filter(a => a.status === 'presenca').length;
  const totalFaltas = filteredAulas.filter(a => a.status === 'falta').length;

  // Ranking de alunos por presenças / faltas
  const alunoStats: Record<string, { presencas: number; faltas: number; nome: string; telefone?: string }> = {};
  filteredAulas.forEach(a => {
    if (!alunoStats[a.aluno_id]) {
      const studentInfo = alunos.find(st => st.id === a.aluno_id);
      alunoStats[a.aluno_id] = { 
        presencas: 0, 
        faltas: 0, 
        nome: a.aluno_nome,
        telefone: studentInfo?.telefone
      };
    }
    if (a.status === 'presenca') alunoStats[a.aluno_id].presencas++;
    if (a.status === 'falta') alunoStats[a.aluno_id].faltas++;
  });

  const rankingPresencas = Object.values(alunoStats)
    .sort((a, b) => b.presencas - a.presencas)
    .slice(0, 8);

  const rankingFaltas = Object.values(alunoStats)
    .sort((a, b) => b.faltas - a.faltas)
    .slice(0, 8);

  // Ocupação por horários
  const slotsContagem: Record<string, number> = {};
  agendamentosFixos.filter(a => a.ativo !== false).forEach(a => {
    const h = a.hora;
    const diasMulti = a.dias?.length || 0;
    slotsContagem[h] = (slotsContagem[h] || 0) + diasMulti;
  });

  const slotsOrdenados = Object.entries(slotsContagem)
    .map(([hora, alunosCont]) => ({ hora, alunosCont }))
    .sort((a, b) => b.alunosCont - a.alunosCont)
    .slice(0, 8);

  // TRAINING & IA METRICS
  const totalMeso = mesociclos.length;
  const mesoComIA = mesociclos.filter(m => m.ia_sugestao_usada).length;
  const mesoManual = totalMeso - mesoComIA;
  const percentIA = totalMeso > 0 ? (mesoComIA / totalMeso) * 100 : 0;

  const alunosSemTreino = alunos.filter(a => a.ativo !== false).filter(aluno => {
    return !mesociclos.some(m => m.aluno_id === aluno.id && m.status === 'ativo');
  });

  // COLLABORATORS & COMMISSIONS CALCULATION
  const trainersStats = funcionarios.filter(f => f.ativo !== false).map(f => {
    // Aulas ministradas no período (sessões com presença confirmada)
    const aulasDadas = filteredAulas.filter(a => a.personal_id === f.id && a.status === 'presenca').length;
    
    // Alunos vinculados ativos
    const alunosVinculados = alunos.filter(a => a.personal_id === f.id && a.ativo !== false);
    const trainerStudentIds = alunosVinculados.map(a => a.id);

    const faturamentoAlunos = filteredReceitas.filter(r => 
      (r.status || '').toLowerCase() === 'pago' && 
      Boolean(r.aluno_id && trainerStudentIds.includes(r.aluno_id))
    ).reduce((acc, r) => acc + (r.valor || 0), 0);

    const comissaoCalculada = faturamentoAlunos * (f.comissao_percentual / 100);
    const totalLiquido = f.salario_base + comissaoCalculada;

    return {
      ...f,
      aulasDadas,
      alunosVinculadosCount: alunosVinculados.length,
      faturamentoAlunos,
      comissaoCalculada,
      totalLiquido
    };
  });

  return (
    <div className="space-y-8">
      {/* Header e Filtro */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Relatórios & Análises 📊</h2>
          <p className="text-surface-500">Relatórios gerenciais e estatísticas consolidadas do studio.</p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-4 py-2">
          <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">Período:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            className="text-sm font-semibold text-brand-dark bg-transparent outline-none cursor-pointer border-none"
          >
            <option value="atual">Mês Atual</option>
            <option value="3meses">Últimos 3 Meses</option>
            <option value="6meses">Últimos 6 Meses</option>
            <option value="12meses">Últimos 12 Meses</option>
            <option value="todos">Todo o Histórico</option>
          </select>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-surface-200 overflow-x-auto gap-2 pb-1">
        {(['financeiro', 'frequencia', 'treinos', 'colaboradores'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-bold capitalize whitespace-nowrap transition-all border-b-2 -mb-[2px] cursor-pointer ${
              activeTab === tab 
                ? 'border-brand-medium text-brand-medium font-extrabold' 
                : 'border-transparent text-surface-500 hover:text-brand-dark hover:border-surface-300'
            }`}
          >
            {tab === 'financeiro' ? '💰 Financeiro' :
             tab === 'frequencia' ? '🗓️ Frequência & Ocupação' :
             tab === 'treinos' ? '🏋️ Treinos & IA' : '👥 Equipe & Comissões'}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: FINANCEIRO */}
      {activeTab === 'financeiro' && (
        <div className="space-y-8 animate-fade-in">
          {/* Resumos rápidos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="glass-card p-5 border-l-4 border-l-green-500">
              <p className="text-xs font-semibold text-surface-400 uppercase">Receitas Recebidas</p>
              <h4 className="text-2xl font-bold text-brand-dark mt-2">
                R$ {totalReceitasPagas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-[10px] text-surface-400 mt-1">
                A receber no período: R$ {totalApenasPendente.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="glass-card p-5 border-l-4 border-l-red-500">
              <p className="text-xs font-semibold text-surface-400 uppercase">Despesas Pagas</p>
              <h4 className="text-2xl font-bold text-brand-dark mt-2">
                R$ {totalDespesasPagas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
            </div>
            <div className="glass-card p-5 border-l-4 border-l-brand-medium">
              <p className="text-xs font-semibold text-surface-400 uppercase">Resultado Líquido</p>
              <h4 className={`text-2xl font-bold mt-2 ${lucroLiquido >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
            </div>
            <div className="glass-card p-5 border-l-4 border-l-amber-500">
              <p className="text-xs font-semibold text-surface-400 uppercase">Inadimplência Atrasada</p>
              <h4 className="text-2xl font-bold text-red-500 mt-2">
                R$ {totalInadimplencia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* DRE Simplificado */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-brand-dark mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Demonstrativo de Resultados (DRE Simplificado)
              </h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-brand-dark border-b border-surface-100 pb-2 uppercase tracking-wide text-green-600">Receitas (+)</h4>
                  <div className="mt-3 space-y-2 text-sm">
                    {Object.entries(receitasPorPlano).map(([plano, valor]) => (
                      <div key={plano} className="flex justify-between">
                        <span className="text-surface-500">{plano}</span>
                        <span className="font-semibold text-brand-dark">R$ {valor.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                    {Object.keys(receitasPorPlano).length === 0 && (
                      <p className="text-xs text-surface-400">Nenhuma receita computada no período.</p>
                    )}
                    <div className="flex justify-between border-t border-dashed border-surface-250 pt-2 font-bold text-brand-dark">
                      <span>Total de Receitas</span>
                      <span className="text-green-600">R$ {totalReceitasPagas.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-brand-dark border-b border-surface-100 pb-2 uppercase tracking-wide text-red-500">Despesas (-)</h4>
                  <div className="mt-3 space-y-2 text-sm">
                    {Object.entries(despesasPorCategoria).map(([cat, valor]) => (
                      <div key={cat} className="flex justify-between">
                        <span className="text-surface-500">{cat}</span>
                        <span className="font-semibold text-brand-dark">R$ {valor.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                    {Object.keys(despesasPorCategoria).length === 0 && (
                      <p className="text-xs text-surface-400">Nenhuma despesa computada no período.</p>
                    )}
                    <div className="flex justify-between border-t border-dashed border-surface-250 pt-2 font-bold text-brand-dark">
                      <span>Total de Despesas</span>
                      <span className="text-red-500">R$ {totalDespesasPagas.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-brand-dark pt-4 flex justify-between items-center">
                  <span className="font-display font-bold text-brand-dark text-base">Lucro/Prejuízo Líquido</span>
                  <span className={`text-xl font-display font-extrabold ${lucroLiquido >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    R$ {lucroLiquido.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>

            {/* Inadimplentes e Cobranças */}
            <div className="glass-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Alunos Inadimplentes no Período
                </h3>

                <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {inadimplentes.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 border border-surface-100 rounded-xl hover:bg-surface-50">
                      <div>
                        <p className="font-bold text-brand-dark text-sm">{item.aluno_nome}</p>
                        <p className="text-xs text-red-500 font-semibold mt-0.5">
                          R$ {item.valor.toFixed(2)} • Venceu em {new Date(item.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <button
                        onClick={() => handleNotify(item)}
                        className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex-shrink-0"
                        title="Notificar via WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {inadimplentes.length === 0 && (
                    <p className="text-sm text-surface-400 text-center py-12">Nenhum registro de inadimplência pendente para o período selecionado.</p>
                  )}
                </div>
              </div>

              {inadimplentes.length > 0 && (
                <div className="bg-red-50 border border-red-150 p-4 rounded-xl mt-6">
                  <p className="text-xs text-red-700 leading-relaxed">
                    <strong>Alerta de Caixa:</strong> Existem R$ {totalInadimplencia.toFixed(0)} pendentes em atraso. Use as notificações via WhatsApp para cobrar os alunos de forma rápida e amigável.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: FREQUENCIA & OCUPACAO */}
      {activeTab === 'frequencia' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
          {/* Resumos rápidos de presença */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-3">
            <div className="bg-green-50/20 border border-green-100 p-4 rounded-xl flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-green-700 uppercase">Total de Presenças Confirmadas</p>
                <p className="text-2xl font-extrabold text-brand-dark mt-1">{totalPresencas}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-600 opacity-80" />
            </div>
            <div className="bg-red-50/20 border border-red-100 p-4 rounded-xl flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-red-700 uppercase">Total de Faltas Registradas</p>
                <p className="text-2xl font-extrabold text-brand-dark mt-1">{totalFaltas}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500 opacity-80" />
            </div>
          </div>
          {/* Ranking Assiduidade */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-6 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-500" />
              Alunos Mais Assíduos
            </h3>

            <div className="space-y-4">
              {rankingPresencas.map((item, i) => (
                <div key={item.nome} className="flex items-center gap-3">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' :
                    i === 1 ? 'bg-surface-200 text-surface-700' :
                    i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-surface-50 text-surface-500'
                  }`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-brand-dark text-sm truncate">{item.nome}</p>
                    <p className="text-xs text-surface-400">{item.presencas} presenças confirmadas</p>
                  </div>
                </div>
              ))}
              {rankingPresencas.length === 0 && (
                <p className="text-sm text-surface-400 text-center py-10 font-medium">Sem dados de presença para este período.</p>
              )}
            </div>
          </div>

          {/* Ranking Faltas */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-6 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Alunos com Mais Faltas
            </h3>

            <div className="space-y-4">
              {rankingFaltas.filter(item => item.faltas > 0).map((item, i) => (
                <div key={item.nome} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-50 text-red-600 text-xs font-bold">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-dark text-sm truncate">{item.nome}</p>
                      <p className="text-xs text-surface-400">{item.faltas} faltas registradas</p>
                    </div>
                  </div>

                  {item.telefone && (
                    <button
                      onClick={() => {
                        const phone = cleanPhone(item.telefone);
                        const msg = `Olá ${item.nome}, sentimos sua falta nas últimas aulas! Está tudo bem? Qualquer dúvida ou se precisar remarcar seu horário, estamos à disposição. Abraços do Aello Studio!`;
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="p-1.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-colors"
                      title="Mandar mensagem de incentivo / contato"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {rankingFaltas.filter(item => item.faltas > 0).length === 0 && (
                <p className="text-sm text-surface-400 text-center py-10 font-medium">Parabéns! Nenhuma falta registrada neste período.</p>
              )}
            </div>
          </div>

          {/* Horários de Pico */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Horários de Pico (Slots Reservados)
            </h3>

            <div className="space-y-4">
              {slotsOrdenados.map((item, i) => (
                <div key={item.hora} className="flex items-center justify-between p-2 rounded-lg border border-surface-100 hover:bg-surface-50/50">
                  <span className="font-bold text-brand-dark text-sm">{item.hora}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-surface-500">{item.alunosCont} reservas semanais</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      i < 2 ? 'bg-red-500' : i < 5 ? 'bg-amber-400' : 'bg-green-400'
                    }`} />
                  </div>
                </div>
              ))}
              {slotsOrdenados.length === 0 && (
                <p className="text-sm text-surface-400 text-center py-10 font-medium">Sem reservas semanais ativas na agenda.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TREINOS & IA */}
      {activeTab === 'treinos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
          {/* KPI IA */}
          <div className="glass-card p-6 text-center flex flex-col items-center justify-center border-t-4 border-t-brand-medium">
            <Activity className="w-12 h-12 text-brand-medium mb-4" />
            <h3 className="text-xl font-bold text-brand-dark">Adesão ao Motor de IA</h3>
            <p className="text-5xl font-display font-extrabold text-brand-medium mt-4">{percentIA.toFixed(1)}%</p>
            <p className="text-xs text-surface-400 mt-2">
              {mesoComIA} prescrições criadas com IA | {mesoManual} manuais
            </p>
            <div className="w-full bg-surface-100 h-2 rounded-full overflow-hidden mt-6">
              <div 
                className="bg-brand-medium h-full" 
                style={{ width: `${percentIA}%` }}
              />
            </div>
          </div>

          {/* Alunos Sem Treino Ativo */}
          <div className="glass-card p-6 lg:col-span-2">
            <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-red-500" />
              Alunos Sem Treino Ativo no Período ({alunosSemTreino.length} de {totalAlunos})
            </h3>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
              {alunosSemTreino.map(aluno => (
                <div key={aluno.id} className="flex justify-between items-center p-3 border border-surface-100 rounded-xl">
                  <div>
                    <p className="font-bold text-brand-dark text-sm">{aluno.nome} {aluno.sobrenome || ''}</p>
                    <p className="text-xs text-surface-400">Modalidade: {aluno.modalidade} • Objetivo: {aluno.objetivo}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-bold uppercase">Sem Treino</span>
                </div>
              ))}
              {alunosSemTreino.length === 0 && (
                <p className="text-sm text-surface-400 text-center py-12">Fantástico! Todos os alunos cadastrados estão com seus treinos ativos em dia.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: COLABORADORES & COMISSOES */}
      {activeTab === 'colaboradores' && (
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="text-lg font-bold text-brand-dark mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Demonstrativo de Produtividade & Comissões
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-4">Colaborador</th>
                  <th className="p-4">Alunos Vinculados</th>
                  <th className="p-4">Aulas Dadas (Presenças)</th>
                  <th className="p-4">Salário Fixo</th>
                  <th className="p-4">Comissão (%)</th>
                  <th className="p-4">Comissão (R$)</th>
                  <th className="p-4 font-bold text-brand-dark">Líquido a Pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm text-surface-600">
                {trainersStats.map(item => (
                  <tr key={item.id} className="hover:bg-surface-50/50">
                    <td className="p-4 font-bold text-brand-dark">{item.nome}</td>
                    <td className="p-4">{item.alunosVinculadosCount} alunos</td>
                    <td className="p-4 font-semibold text-indigo-600">{item.aulasDadas} aulas</td>
                    <td className="p-4">R$ {item.salario_base.toFixed(2).replace('.', ',')}</td>
                    <td className="p-4">{item.comissao_percentual}%</td>
                    <td className="p-4 text-green-600">R$ {item.comissaoCalculada.toFixed(2).replace('.', ',')}</td>
                    <td className="p-4 font-bold text-brand-dark">
                      R$ {item.totalLiquido.toFixed(2).replace('.', ',')}
                    </td>
                  </tr>
                ))}
                {trainersStats.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-surface-400">
                      Nenhum profissional cadastrado com comissão ativa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatoriosPage;
