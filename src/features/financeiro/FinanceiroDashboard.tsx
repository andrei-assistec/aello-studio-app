import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle, 
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
  PieChart as ChartIcon
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import type { Receita } from './ReceitaFormModal';
import type { Despesa } from './DespesaFormModal';
import type { Aluno } from '../../types/database';
import type { PlanoConta } from './PlanoDeContasPage';

const FinanceStatCard = ({ label, value, change, icon, isPositive }: { 
  label: string, 
  value: string, 
  change: string, 
  icon: React.ReactNode, 
  isPositive?: boolean 
}) => (
  <div className="glass-card p-6 border-l-4 border-l-emerald-500 hover:translate-y-[-4px] transition-all cursor-default">
    <div className="flex justify-between items-start mb-4">
      <p className="text-sm font-medium text-surface-400">{label}</p>
      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
        {icon}
      </div>
    </div>
    <h4 className="text-3xl font-display text-brand-dark mb-2">{value}</h4>
    <p className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>{change}</p>
  </div>
);

export const FinanceiroDashboard = () => {
  const { data: receitas, loading: loadingRec } = useCollection<Receita>('receitas', 'vencimento', 'desc');
  const { data: despesas, loading: loadingDes } = useCollection<Despesa>('despesas', 'vencimento', 'desc');
  const { data: alunos, loading: loadingAlunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: planoContas, loading: loadingPlanos } = useCollection<PlanoConta>('plano_contas', 'codigo');

  const loading = loadingRec || loadingDes || loadingAlunos || loadingPlanos;

  // Datas e Período Atual
  const now = new Date();
  const currentMonthIndex = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const formattedMonthYear = `${monthNames[currentMonthIndex]} / ${currentYear}`;

  const startOfMonth = new Date(currentYear, currentMonthIndex, 1).getTime();
  const endOfMonth = new Date(currentYear, currentMonthIndex + 1, 1).getTime();

  const startOfPrevMonth = new Date(currentYear, currentMonthIndex - 1, 1).getTime();
  const endOfPrevMonth = new Date(currentYear, currentMonthIndex, 1).getTime();

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

  // 1. Receitas recebidas (pagas) no mês atual
  const receitasPagasMes = receitas.filter(r => {
    if ((r.status || '').toLowerCase() !== 'pago') return false;
    const pMs = getItemPaidMs(r);
    return pMs !== null && pMs >= startOfMonth && pMs < endOfMonth;
  });
  const totalRecebido = receitasPagasMes.reduce((acc, r) => acc + (r.valor || 0), 0);

  const receitasPagasPrevMes = receitas.filter(r => {
    if ((r.status || '').toLowerCase() !== 'pago') return false;
    const pMs = getItemPaidMs(r);
    return pMs !== null && pMs >= startOfPrevMonth && pMs < endOfPrevMonth;
  });
  const totalRecebidoPrev = receitasPagasPrevMes.reduce((acc, r) => acc + (r.valor || 0), 0);

  // 2. Despesas pagas no mês atual
  const despesasPagasMes = despesas.filter(d => {
    if ((d.status || '').toLowerCase() !== 'pago') return false;
    const pMs = getItemPaidMs(d);
    return pMs !== null && pMs >= startOfMonth && pMs < endOfMonth;
  });
  const totalPago = despesasPagasMes.reduce((acc, d) => acc + (d.valor || 0), 0);

  const despesasPagasPrevMes = despesas.filter(d => {
    if ((d.status || '').toLowerCase() !== 'pago') return false;
    const pMs = getItemPaidMs(d);
    return pMs !== null && pMs >= startOfPrevMonth && pMs < endOfPrevMonth;
  });
  const totalPagoPrev = despesasPagasPrevMes.reduce((acc, d) => acc + (d.valor || 0), 0);

  // 3. Lucro Líquido
  const lucroLiquido = totalRecebido - totalPago;
  const margemLucro = totalRecebido > 0 ? (lucroLiquido / totalRecebido) * 100 : 0;

  // 4. Inadimplência
  // Receitas que vencem no mês atual
  const receitasVencimentoMes = receitas.filter(r => {
    const dueStr = getItemDueStr(r);
    if (!dueStr) return false;
    const [year, month] = dueStr.split('-').map(Number);
    return year === currentYear && month === (currentMonthIndex + 1);
  });
  const totalFaturamentoMes = receitasVencimentoMes.reduce((acc, r) => acc + (r.valor || 0), 0);

  const todayStr = now.toISOString().split('T')[0];
  const receitasInadimplentesMes = receitasVencimentoMes.filter(r => {
    const st = (r.status || '').toLowerCase();
    const dueStr = getItemDueStr(r);
    return st === 'atrasado' || (st === 'pendente' && dueStr !== '' && dueStr < todayStr);
  });
  const totalInadimplenteVal = receitasInadimplentesMes.reduce((acc, r) => acc + (r.valor || 0), 0);

  const delinquencyRate = totalFaturamentoMes > 0 ? (totalInadimplenteVal / totalFaturamentoMes) * 100 : 0;
  const countInadimplentes = receitas.filter(r => {
    const st = (r.status || '').toLowerCase();
    const dueStr = getItemDueStr(r);
    return st === 'atrasado' || (st === 'pendente' && dueStr !== '' && dueStr < todayStr);
  }).length;

  // Formatação de Mudança percentual
  const getPercentChange = (current: number, previous: number) => {
    if (previous === 0) {
      return current > 0 ? '+100% vs mês anterior' : '0% vs mês anterior';
    }
    const pct = ((current - previous) / previous) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs mês anterior`;
  };

  // Transações Recentes (Receitas pagas)
  const recentTransactions = [...receitas]
    .filter(r => (r.status || '').toLowerCase() === 'pago')
    .sort((a, b) => (getItemPaidMs(b) || 0) - (getItemPaidMs(a) || 0))
    .slice(0, 4);

  // Inadimplentes / A Vencer Gerais (não pagos)
  const pendingOrOverdue = [...receitas]
    .filter(r => (r.status || '').toLowerCase() !== 'pago')
    .sort((a, b) => getItemDueStr(a).localeCompare(getItemDueStr(b)))
    .slice(0, 5);

  // Agrupamentos por Plano de Contas (Mês Atual)
  const getCategorySum = (catId: string, type: 'receita' | 'despesa') => {
    if (type === 'receita') {
      return receitasPagasMes
        .filter(r => r.categoria_id === catId)
        .reduce((sum, r) => sum + (r.valor || 0), 0);
    } else {
      return despesasPagasMes
        .filter(d => d.categoria_id === catId)
        .reduce((sum, d) => sum + (d.valor || 0), 0);
    }
  };

  const planoContasReceitasBreakdown = planoContas
    .filter(c => c.ativo && c.tipo === 'receita')
    .map(c => ({
      ...c,
      total: getCategorySum(c.id, 'receita')
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const planoContasDespesasBreakdown = planoContas
    .filter(c => c.ativo && c.tipo === 'despesa')
    .map(c => ({
      ...c,
      total: getCategorySum(c.id, 'despesa')
    }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const formatRelativeDate = (dateVal?: number | string | null) => {
    const ms = getItemPaidMs({ data_pagamento: dateVal });
    if (!ms) return '-';
    const date = new Date(ms);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Ontem, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const getDaysMessage = (vencimentoStr?: string) => {
    if (!vencimentoStr) return 'Vencimento não informado';
    const targetDate = new Date(vencimentoStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return `Atrasado há ${absDays} ${absDays === 1 ? 'dia' : 'dias'}`;
    } else if (diffDays === 0) {
      return 'Vence hoje';
    } else {
      return `Vence em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    }
  };

  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 11) {
      return '55' + digits;
    }
    return digits;
  };

  const handleNotifySingle = (item: Receita) => {
    const student = item.aluno_id ? alunos.find(a => a.id === item.aluno_id) : undefined;
    const name = item.aluno_nome || item.descricao || 'Aluno';
    const tel = student?.telefone;
    if (!tel) {
      alert(`O aluno ${name} não possui telefone cadastrado.`);
      return;
    }

    const phone = cleanPhone(tel);
    const dueStr = getItemDueStr(item);
    const msg = `Olá ${name}, identificamos que a mensalidade de R$ ${(item.valor || 0).toFixed(2).replace('.', ',')} com vencimento em ${dueStr ? new Date(dueStr + 'T00:00:00').toLocaleDateString('pt-BR') : 'breve'} está pendente de pagamento. Por favor, desconsidere caso já tenha efetuado.`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleNotifyAllOverdue = () => {
    const overdue = pendingOrOverdue.filter(r => {
      const st = (r.status || '').toLowerCase();
      const dueStr = getItemDueStr(r);
      return st === 'atrasado' || (st === 'pendente' && dueStr !== '' && dueStr < todayStr);
    });
    if (overdue.length === 0) {
      alert("Nenhum aluno inadimplente no momento!");
      return;
    }

    const item = overdue[0];
    const name = item.aluno_nome || item.descricao || 'Aluno';
    const student = item.aluno_id ? alunos.find(a => a.id === item.aluno_id) : undefined;
    const tel = student?.telefone;
    if (!tel) {
      alert(`O aluno ${name} não possui telefone cadastrado. Tentando o próximo...`);
      return;
    }

    const phone = cleanPhone(tel);
    const dueStr = getItemDueStr(item);
    const msg = `Olá ${name}, identificamos que a mensalidade de R$ ${(item.valor || 0).toFixed(2).replace('.', ',')} com vencimento em ${dueStr ? new Date(dueStr + 'T00:00:00').toLocaleDateString('pt-BR') : 'breve'} está pendente de pagamento. Por favor, desconsidere caso já tenha efetuado.`;

    if (window.confirm(`Deseja enviar cobrança para o primeiro aluno inadimplente (${name}) via WhatsApp?`)) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Painel Financeiro 💳</h2>
          <p className="text-surface-500">Resumo da saúde financeira do seu studio para este mês.</p>
        </div>
        <div className="flex gap-3">
          <span className="px-4 py-2 rounded-xl bg-white border border-surface-200 text-sm text-surface-600 font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            {formattedMonthYear}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="font-medium">Carregando dados financeiros...</p>
        </div>
      ) : (
        <>
          {/* Grid de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <FinanceStatCard 
              label="Receita Total (Recebido)" 
              value={`R$ ${totalRecebido.toFixed(2).replace('.', ',')}`} 
              icon={<TrendingUp className="w-5 h-5" />} 
              change={getPercentChange(totalRecebido, totalRecebidoPrev)} 
              isPositive={totalRecebido >= totalRecebidoPrev} 
            />
            <FinanceStatCard 
              label="Despesas Totais (Pagas)" 
              value={`R$ ${totalPago.toFixed(2).replace('.', ',')}`} 
              icon={<TrendingDown className="w-5 h-5 text-red-500" />} 
              change={getPercentChange(totalPago, totalPagoPrev)} 
              isPositive={totalPago <= totalPagoPrev} 
            />
            <FinanceStatCard 
              label="Lucro Líquido" 
              value={`R$ ${lucroLiquido.toFixed(2).replace('.', ',')}`} 
              icon={<DollarSign className="w-5 h-5" />} 
              change={`Margem de Lucro: ${margemLucro.toFixed(1)}%`} 
              isPositive={lucroLiquido >= 0} 
            />
            <FinanceStatCard 
              label="Inadimplência (Mês)" 
              value={`${delinquencyRate.toFixed(1)}%`} 
              icon={<AlertCircle className="w-5 h-5 text-amber-500" />} 
              change={`${countInadimplentes} pendências no total`} 
              isPositive={delinquencyRate <= 5} 
            />
          </div>

          {/* Demonstrativo por Plano de Contas (Gráficos/Barras Estilizados) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Receitas por Categoria */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-brand-dark">
                <ChartIcon className="w-5 h-5 text-green-500" />
                Receitas por Plano de Contas
              </h3>
              <div className="space-y-5">
                {planoContasReceitasBreakdown.length > 0 ? (
                  planoContasReceitasBreakdown.map(item => {
                    const pct = totalRecebido > 0 ? (item.total / totalRecebido) * 100 : 0;
                    return (
                      <div key={item.id} className="space-y-2">
                        <div className="flex justify-between text-sm font-semibold text-brand-dark">
                          <span>{item.codigo} - {item.nome}</span>
                          <span>R$ {item.total.toFixed(2).replace('.', ',')} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-surface-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-surface-400 text-center py-10 font-medium">Sem lançamentos de receita consolidados neste mês.</p>
                )}
              </div>
            </div>

            {/* Despesas por Categoria */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-brand-dark">
                <ChartIcon className="w-5 h-5 text-red-500" />
                Despesas por Plano de Contas
              </h3>
              <div className="space-y-5">
                {planoContasDespesasBreakdown.length > 0 ? (
                  planoContasDespesasBreakdown.map(item => {
                    const pct = totalPago > 0 ? (item.total / totalPago) * 100 : 0;
                    return (
                      <div key={item.id} className="space-y-2">
                        <div className="flex justify-between text-sm font-semibold text-brand-dark">
                          <span>{item.codigo} - {item.nome}</span>
                          <span>R$ {item.total.toFixed(2).replace('.', ',')} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-surface-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-red-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-surface-400 text-center py-10 font-medium">Sem lançamentos de despesa consolidados neste mês.</p>
                )}
              </div>
            </div>
          </div>

          {/* Detalhamento */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Entradas Recentes */}
            <div className="lg:col-span-2 glass-card p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Transações Recentes (Receitas)
              </h3>
              <div className="space-y-4">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-surface-100 hover:bg-surface-50 transition-all">
                      <div>
                        <p className="font-semibold text-brand-dark">{item.aluno_nome}</p>
                        <p className="text-xs text-surface-400">
                          {item.plano} • Pago em {formatRelativeDate(item.data_pagamento)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">R$ {item.valor.toFixed(2).replace('.', ',')}</p>
                        <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full font-bold uppercase">Pago</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-surface-400 text-center py-10">Nenhuma entrada recente confirmada.</p>
                )}
              </div>
            </div>

            {/* Pendências / Alertas */}
            <div className="glass-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Inadimplência / A Vencer
                </h3>
                <div className="space-y-4">
                  {pendingOrOverdue.length > 0 ? (
                    pendingOrOverdue.map((item) => {
                      const dueStr = getItemDueStr(item);
                      const isOverdue = (item.status || '').toLowerCase() === 'atrasado' || ((item.status || '').toLowerCase() === 'pendente' && dueStr !== '' && dueStr < todayStr);
                      const name = item.aluno_nome || item.descricao || 'Aluno';
                      return (
                        <div key={item.id} className="flex items-center gap-3 group">
                          <div className={`w-1.5 h-12 rounded-full ${isOverdue ? 'bg-red-400' : 'bg-amber-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-brand-dark leading-tight truncate">{name}</p>
                            <p className="text-xs text-surface-400">
                              {getDaysMessage(dueStr)} • R$ {(item.valor || 0).toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {isOverdue && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[9px] font-bold uppercase">
                                Atrasado
                              </span>
                            )}
                            <button
                              onClick={() => handleNotifySingle(item)}
                              className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors"
                              title="Notificar via WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-surface-400 text-center py-10">Sem pendências ou faturas a vencer.</p>
                  )}
                </div>
              </div>
              
              {pendingOrOverdue.length > 0 && (
                <button 
                  onClick={handleNotifyAllOverdue}
                  className="w-full mt-6 btn-secondary text-sm flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Notificar Inadimplentes (WhatsApp)
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceiroDashboard;
