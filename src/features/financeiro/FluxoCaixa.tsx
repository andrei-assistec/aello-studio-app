import { useState } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle,
  Briefcase,
  Loader2,
  Filter,
  Eye,
  EyeOff,
  PlusCircle,
  MinusCircle
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { ReceitaFormModal } from './ReceitaFormModal';
import type { Receita } from './ReceitaFormModal';
import { DespesaFormModal } from './DespesaFormModal';
import type { Despesa } from './DespesaFormModal';
import type { PlanoConta } from './PlanoDeContasPage';

export const FluxoCaixa = () => {
  const { data: receitas, loading: loadingRec } = useCollection<Receita>('receitas');
  const { data: despesas, loading: loadingDes } = useCollection<Despesa>('despesas');
  const { data: planoContas } = useCollection<PlanoConta>('plano_contas', 'codigo');

  const loading = loadingRec || loadingDes;

  // Modais de Lançamento Avulso
  const [isReceitaModalOpen, setIsReceitaModalOpen] = useState(false);
  const [isDespesaModalOpen, setIsDespesaModalOpen] = useState(false);

  // Ordenação por colunas (Estilo Excel)
  const [sortField, setSortField] = useState<string>('data_vencimento');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtros de período (Mês/Ano)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [showOnlyPaid, setShowOnlyPaid] = useState<boolean>(false);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Gera lista dos últimos 12 meses até os próximos 12 meses para o seletor
  const periodOptions: { month: number; year: number; label: string }[] = [];
  for (let i = -12; i <= 12; i++) {
    const tempDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    periodOptions.push({
      month: tempDate.getMonth(),
      year: tempDate.getFullYear(),
      label: `${monthNames[tempDate.getMonth()]} / ${tempDate.getFullYear()}`
    });
  }

  // Define o intervalo de milissegundos para o mês selecionado
  const startOfPeriod = new Date(selectedYear, selectedMonth, 1).getTime();
  const endOfPeriod = new Date(selectedYear, selectedMonth + 1, 1).getTime();
  const selectedMonthYearStr = `${String(selectedYear)}-${String(selectedMonth + 1).padStart(2, '0')}`;

  // Helper de conversão e extração de data segura
  const getItemDateMs = (item: any, isPaid: boolean): number => {
    if (isPaid && item.data_pagamento) {
      if (typeof item.data_pagamento === 'number') {
        return item.data_pagamento;
      }
      if (typeof item.data_pagamento === 'string') {
        const parsed = new Date(item.data_pagamento.includes('T') ? item.data_pagamento : item.data_pagamento + 'T12:00:00').getTime();
        if (!isNaN(parsed)) return parsed;
      }
    }
    
    const dueStr = item.vencimento || item.data_vencimento;
    if (dueStr && typeof dueStr === 'string') {
      const parsed = new Date(dueStr.includes('T') ? dueStr : dueStr + 'T12:00:00').getTime();
      if (!isNaN(parsed)) return parsed;
    }

    if (typeof item.created_at === 'number') {
      return item.created_at;
    }

    return Date.now();
  };

  const getItemMonthYearStr = (item: any): string => {
    const dueStr = item.vencimento || item.data_vencimento;
    if (dueStr && typeof dueStr === 'string' && dueStr.length >= 7) {
      return dueStr.substring(0, 7); // "YYYY-MM"
    }

    const isPaid = (item.status || '').toLowerCase() === 'pago';
    const ms = getItemDateMs(item, isPaid);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return selectedMonthYearStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  // Helper para obter nome da categoria do Plano de Contas
  const getCategoryName = (catId?: string, fallbackName?: string, type?: 'receita' | 'despesa') => {
    if (catId) {
      const match = planoContas.find(c => c.id === catId);
      if (match) return `${match.codigo} - ${match.nome}`;
    }
    if (fallbackName) return fallbackName;
    return type === 'receita' ? '1.1 - Mensalidade' : '2.8 - Outras Despesas';
  };

  // Filtrar e mapear entradas (receitas)
  const entradas = receitas
    .filter(r => {
      const statusNorm = (r.status || 'pendente').toLowerCase();
      const isPaid = statusNorm === 'pago';
      const dateMs = getItemDateMs(r, isPaid);

      if (showOnlyPaid) {
        return isPaid && dateMs >= startOfPeriod && dateMs < endOfPeriod;
      }

      const monthYearStr = getItemMonthYearStr(r);
      return monthYearStr === selectedMonthYearStr;
    })
    .map(r => {
      const statusNorm = (r.status || 'pendente').toLowerCase();
      const isPaid = statusNorm === 'pago';
      const dateMs = getItemDateMs(r, isPaid);
      const val = typeof r.valor === 'number' ? r.valor : (parseFloat(r.valor as any) || 0);
      const desc = r.descricao || (r.aluno_nome ? `Mensalidade - ${r.aluno_nome}` : 'Receita');

      const dueStr = r.vencimento || r.data_vencimento || '';
      let dueMs = 0;
      if (dueStr) {
        const parsed = new Date(dueStr.includes('T') ? dueStr : dueStr + 'T12:00:00').getTime();
        dueMs = isNaN(parsed) ? dateMs : parsed;
      } else {
        dueMs = dateMs;
      }

      let paidMs: number | null = null;
      if (isPaid && r.data_pagamento) {
        if (typeof r.data_pagamento === 'number') paidMs = r.data_pagamento;
        else if (typeof r.data_pagamento === 'string') {
          const p = new Date(r.data_pagamento.includes('T') ? r.data_pagamento : r.data_pagamento + 'T12:00:00').getTime();
          paidMs = isNaN(p) ? null : p;
        }
      }

      return {
        id: `receita-${r.id}`,
        raw_id: r.id,
        tipo: 'entrada' as const,
        descricao: desc,
        categoria: getCategoryName(r.categoria_id, r.plano || (r as any).categoria, 'receita'),
        valor: val,
        valor_original: r.valor_original,
        justificativa_desconto: r.justificativa_desconto || (r as any).observacao || '',
        data_vencimento_ms: dueMs,
        data_pagamento_ms: paidMs,
        data: dateMs,
        status: statusNorm
      };
    });

  // Filtrar e mapear saídas (despesas)
  const saidas = despesas
    .filter(d => {
      const statusNorm = (d.status || 'pendente').toLowerCase();
      const isPaid = statusNorm === 'pago';
      const dateMs = getItemDateMs(d, isPaid);

      if (showOnlyPaid) {
        return isPaid && dateMs >= startOfPeriod && dateMs < endOfPeriod;
      }

      const monthYearStr = getItemMonthYearStr(d);
      return monthYearStr === selectedMonthYearStr;
    })
    .map(d => {
      const statusNorm = (d.status || 'pendente').toLowerCase();
      const isPaid = statusNorm === 'pago';
      const dateMs = getItemDateMs(d, isPaid);
      const val = typeof d.valor === 'number' ? d.valor : (parseFloat(d.valor as any) || 0);

      const dueStr = d.vencimento || d.data_vencimento || '';
      let dueMs = 0;
      if (dueStr) {
        const parsed = new Date(dueStr.includes('T') ? dueStr : dueStr + 'T12:00:00').getTime();
        dueMs = isNaN(parsed) ? dateMs : parsed;
      } else {
        dueMs = dateMs;
      }

      let paidMs: number | null = null;
      if (isPaid && d.data_pagamento) {
        if (typeof d.data_pagamento === 'number') paidMs = d.data_pagamento;
        else if (typeof d.data_pagamento === 'string') {
          const p = new Date(d.data_pagamento.includes('T') ? d.data_pagamento : d.data_pagamento + 'T12:00:00').getTime();
          paidMs = isNaN(p) ? null : p;
        }
      }

      return {
        id: `despesa-${d.id}`,
        raw_id: d.id,
        tipo: 'saida' as const,
        descricao: d.descricao || 'Despesa',
        categoria: getCategoryName(d.categoria_id, d.categoria, 'despesa'),
        valor: val,
        valor_original: undefined as number | undefined,
        data_vencimento_ms: dueMs,
        data_pagamento_ms: paidMs,
        data: dateMs,
        status: statusNorm,
        justificativa_desconto: ''
      };
    });

  // Mesclar transações e aplicar ordenação Excel por colunas
  const rawTransacoes = [...entradas, ...saidas];
  const transacoes = rawTransacoes.sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    switch (sortField) {
      case 'id':
        valA = ((a as any).raw_id || a.id).toLowerCase();
        valB = ((b as any).raw_id || b.id).toLowerCase();
        break;
      case 'data_vencimento':
        valA = a.data_vencimento_ms || 0;
        valB = b.data_vencimento_ms || 0;
        break;
      case 'data_pagamento':
        valA = a.data_pagamento_ms || 0;
        valB = b.data_pagamento_ms || 0;
        break;
      case 'descricao':
        valA = a.descricao.toLowerCase();
        valB = b.descricao.toLowerCase();
        break;
      case 'categoria':
        valA = a.categoria.toLowerCase();
        valB = b.categoria.toLowerCase();
        break;
      case 'valor':
        valA = a.valor;
        valB = b.valor;
        break;
      case 'status':
        valA = a.status;
        valB = b.status;
        break;
      default:
        valA = a.data;
        valB = b.data;
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Cálculos dinâmicos
  const totalEntradas = entradas.reduce((acc, t) => acc + t.valor, 0);
  const totalSaidas = saidas.reduce((acc, t) => acc + t.valor, 0);
  const saldoFinal = totalEntradas - totalSaidas;

  const formatDate = (ms?: number | null) => {
    if (!ms || isNaN(ms)) return '-';
    try {
      return new Date(ms).toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  const renderSortHeader = (label: string, field: string) => (
    <th 
      onClick={() => handleSort(field)}
      className="p-4 cursor-pointer hover:bg-surface-100 transition-colors select-none group"
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <span className="text-[10px] text-surface-400 group-hover:text-brand-dark">
          {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </div>
    </th>
  );

  return (
    <div className="space-y-8">
      {/* Header e Filtros */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Fluxo de Caixa 📊</h2>
          <p className="text-surface-500">Fluxo detalhado e previsões de caixa com base no Plano de Contas.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Botões de Lançamento Avulso Rápido */}
          <button
            onClick={() => setIsReceitaModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            + Nova Receita Avulsa
          </button>

          <button
            onClick={() => setIsDespesaModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-red-600 text-white hover:bg-red-700 transition-all flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer"
          >
            <MinusCircle className="w-4 h-4" />
            + Nova Despesa Avulsa
          </button>

          {/* Seletor de Realizado vs Previsto */}
          <button
            onClick={() => setShowOnlyPaid(p => !p)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
              showOnlyPaid 
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {showOnlyPaid ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showOnlyPaid ? 'Exibindo: Realizado (Pagos)' : 'Exibindo: Projetado (Previsto + Pagos)'}
          </button>

          {/* Seletor de Mês/Ano */}
          <div className="flex items-center gap-2 bg-white border border-surface-200 rounded-xl px-4 py-2">
            <Filter className="w-3.5 h-3.5 text-surface-400" />
            <select
              value={`${selectedMonth}-${selectedYear}`}
              onChange={(e) => {
                const [m, y] = e.target.value.split('-');
                setSelectedMonth(parseInt(m, 10));
                setSelectedYear(parseInt(y, 10));
              }}
              className="text-sm font-semibold text-brand-dark bg-transparent outline-none cursor-pointer border-none"
            >
              {periodOptions.map((opt, idx) => (
                <option key={idx} value={`${opt.month}-${opt.year}`}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-1">Entradas {showOnlyPaid ? '(Realizadas)' : '(Previstas + Pagas)'}</p>
            <h3 className="text-2xl font-bold text-emerald-600">
              R$ {totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-surface-500 mt-1">{entradas.length} lançamento(s)</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-6 border-l-4 border-l-red-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-1">Saídas {showOnlyPaid ? '(Realizadas)' : '(Previstas + Pagas)'}</p>
            <h3 className="text-2xl font-bold text-red-600">
              R$ {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-surface-500 mt-1">{saidas.length} lançamento(s)</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>

        <div className={`glass-card p-6 border-l-4 flex items-center justify-between ${saldoFinal >= 0 ? 'border-l-brand-medium' : 'border-l-red-500'}`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-1">Saldo do Período</p>
            <h3 className={`text-2xl font-bold ${saldoFinal >= 0 ? 'text-brand-dark' : 'text-red-600'}`}>
              R$ {saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-surface-500 mt-1">Resultado Líquido</p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${saldoFinal >= 0 ? 'bg-brand-50 text-brand-dark' : 'bg-red-50 text-red-600'}`}>
            <Briefcase className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Extrato em Tabela com Ordenação Estilo Excel */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-surface-200 flex justify-between items-center bg-surface-50">
          <div>
            <h3 className="text-lg font-bold text-brand-dark font-display">Extrato do Fluxo de Caixa</h3>
            <p className="text-xs text-surface-500">Clique nos títulos das colunas para ordenar (asc/desc).</p>
          </div>
          <span className="text-xs font-semibold text-surface-500 bg-surface-200 px-3 py-1 rounded-full">
            {transacoes.length} transação(ões)
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
            <p className="font-medium">Carregando fluxo de caixa...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                  {renderSortHeader('Cód. Conta', 'id')}
                  {renderSortHeader('Vencimento', 'data_vencimento')}
                  {renderSortHeader('Data Pagamento', 'data_pagamento')}
                  {renderSortHeader('Descrição / Lançamento', 'descricao')}
                  {renderSortHeader('Plano / Categoria', 'categoria')}
                  <th className="p-4">Tipo</th>
                  {renderSortHeader('Valor (R$)', 'valor')}
                  {renderSortHeader('Status', 'status')}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                {transacoes.length > 0 ? (
                  transacoes.map((t) => {
                    const rawCode = (t as any).raw_id || t.id.replace(/^(receita-|despesa-)/, '');
                    return (
                    <tr key={t.id} className="hover:bg-surface-50/80 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <span 
                          className="font-mono text-[11px] font-bold text-surface-600 bg-surface-100 hover:bg-surface-200 px-2 py-0.5 rounded border border-surface-200 select-all cursor-pointer transition-colors"
                          title={`ID Completo: ${rawCode} (Clique para copiar)`}
                          onClick={() => {
                            navigator.clipboard.writeText(rawCode);
                            alert(`Código copiado: ${rawCode}`);
                          }}
                        >
                          #{rawCode.slice(0, 8)}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-surface-600 font-semibold">
                        {formatDate(t.data_vencimento_ms)}
                      </td>
                      <td className="p-4 whitespace-nowrap font-semibold">
                        {t.data_pagamento_ms ? (
                          <span className="text-emerald-700 font-bold">{formatDate(t.data_pagamento_ms)}</span>
                        ) : (
                          <span className="text-surface-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-brand-dark block">{t.descricao}</span>
                        {t.justificativa_desconto && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block font-semibold">
                            Desconto: {t.justificativa_desconto}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-surface-600">
                        {t.categoria}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {t.tipo === 'entrada' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" /> Receita
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 inline-flex items-center gap-1">
                            <ArrowDownRight className="w-3 h-3" /> Despesa
                          </span>
                        )}
                      </td>
                      <td className={`p-4 font-bold whitespace-nowrap text-sm ${t.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.tipo === 'entrada' ? '+' : '-'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {t.valor_original && t.valor_original > t.valor && (
                          <span className="text-[10px] text-surface-400 line-through block font-normal">
                            De R$ {t.valor_original.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {t.status === 'pago' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-max">
                            <CheckCircle className="w-3 h-3" /> Pago / Recebido
                          </span>
                        ) : t.status === 'atrasado' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 w-max">
                            Atrasado
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 w-max">
                            Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-surface-400 font-medium">
                    Nenhuma transação encontrada para este período.
                  </td>
                </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais de Lançamento Avulso */}
      <ReceitaFormModal
        isOpen={isReceitaModalOpen}
        onClose={() => setIsReceitaModalOpen(false)}
        onSuccess={() => setIsReceitaModalOpen(false)}
        initialIsAvulsa={true}
      />

      <DespesaFormModal
        isOpen={isDespesaModalOpen}
        onClose={() => setIsDespesaModalOpen(false)}
        onSuccess={() => setIsDespesaModalOpen(false)}
      />
    </div>
  );
};
