import React, { useState, useMemo } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Target, 
  ShieldCheck, 
  Printer, 
  Sliders, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart as PieIcon, 
  Sparkles, 
  HelpCircle,
  BarChart3,
  Layers,
  Building2,
  RefreshCw,
  Loader2
} from 'lucide-react';
import type { Aluno } from '../../types/database';
import type { Receita } from '../financeiro/ReceitaFormModal';
import type { Despesa } from '../financeiro/DespesaFormModal';

export const RelatorioDRE: React.FC = () => {
  // 1. Dados do Firestore
  const { data: receitas, loading: loadingRec } = useCollection<Receita>('receitas');
  const { data: despesas, loading: loadingDesp } = useCollection<Despesa>('despesas');
  const { data: alunos, loading: loadingAlunos } = useCollection<Aluno>('alunos', 'nome');

  // 2. Filtros de Período e Regime
  const today = new Date();
  const defaultMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthKey);
  const [regime, setRegime] = useState<'competencia' | 'caixa'>('competencia');

  // 3. Meta da Margem de Contribuição Ideal (Persistida no localStorage)
  const [idealMarginPct, setIdealMarginPct] = useState<number>(() => {
    const saved = localStorage.getItem('agy_dre_ideal_margin');
    return saved ? Number(saved) : 60; // Padrão de 60% para studios
  });

  const handleIdealMarginChange = (val: number) => {
    setIdealMarginPct(val);
    localStorage.setItem('agy_dre_ideal_margin', String(val));
  };

  // 4. Estados de UI (Grupos Expandidos na Tabela DRE e Simulador)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    receitaBruta: false,
    custosVariaveis: true,
    custosFixos: true,
    investimentos: false,
    financeiro: false
  });

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 5. Estado do Simulador de Sensibilidade / Metas
  const [showSimulator, setShowSimulator] = useState(false);
  const [simTicketDelta, setSimTicketDelta] = useState<number>(0);
  const [simCustoFixoReductionPct, setSimCustoFixoReductionPct] = useState<number>(0);
  const [simNovosAlunos, setSimNovosAlunos] = useState<number>(0);

  // 6. Timestamps e Datas do Mês Selecionado
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

  // Navegação de mês (< Anterior / Próximo >)
  const handlePrevMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
  };

  // Helpers de parsing de data
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

  const getItemDueStr = (item: { vencimento?: string; data_vencimento?: string }): string => {
    return item.vencimento || item.data_vencimento || '';
  };

  // Classificador inteligente de despesas
  const classifyDespesa = (d: Despesa): 'investimento' | 'financeiro' | 'variavel' | 'fixo' => {
    const desc = (d.descricao || '').toLowerCase();
    const cat = (d.categoria || '').toLowerCase();

    // 1. Investimentos (CAPEX: aquisição de aparelhos, reformas estruturais, benfeitorias, equipamentos)
    if (
      cat.includes('investimento') ||
      cat.includes('imobilizado') ||
      cat.includes('reforma') ||
      cat.includes('equipamento') ||
      desc.includes('investimento') ||
      desc.includes('equipamento') ||
      desc.includes('aparelho') ||
      desc.includes('máquina') ||
      desc.includes('maquina') ||
      desc.includes('reforma') ||
      desc.includes('obra') ||
      desc.includes('benfeitoria') ||
      desc.includes('ar-condicionado') ||
      desc.includes('ar condicionado')
    ) {
      return 'investimento';
    }

    // 2. Despesas Financeiras (empréstimos, financiamentos, parcelas bancárias de capital)
    if (
      cat.includes('empréstimo') ||
      cat.includes('emprestimo') ||
      cat.includes('financiamento') ||
      desc.includes('parcela sicredi') ||
      desc.includes('sicoob') ||
      desc.includes('empréstimo') ||
      desc.includes('emprestimo') ||
      desc.includes('financiamento') ||
      desc.includes('amortização')
    ) {
      return 'financeiro';
    }

    // 3. Custos Variáveis (comissões, repasses a personais, taxas de maquininha/cartão, CMV de produtos, Simples Nacional)
    if (
      cat.includes('repasse personal') ||
      desc.includes('comissão') ||
      desc.includes('comissao') ||
      desc.includes('repasse') ||
      cat.includes('tarifa') ||
      desc.includes('taxa cartão') ||
      desc.includes('taxa de cartão') ||
      desc.includes('maquininha') ||
      desc.includes('stone') ||
      desc.includes('cielo') ||
      desc.includes('rede') ||
      desc.includes('pagseguro') ||
      desc.includes('getnet') ||
      desc.includes('simples nacional') ||
      desc.includes('das simples') ||
      desc.includes('cmv') ||
      desc.includes('compra de mercadoria')
    ) {
      return 'variavel';
    }

    // 4. Custos Fixos Operacionais (todas as demais despesas estruturais)
    return 'fixo';
  };

  // 7. Processamento e Consolidação dos Dados Financeiros
  const dreData = useMemo(() => {
    const listRec = receitas || [];
    const listDesp = despesas || [];
    const listAlunos = alunos || [];

    // --- FILTRAGEM DE RECEITAS NO MÊS ---
    const filteredReceitas = listRec.filter(r => {
      if ((r.status || '').toLowerCase() === 'cancelado') return false;

      if (regime === 'caixa') {
        // No caixa, conta apenas o que foi efetivamente PAGO no período
        if ((r.status || '').toLowerCase() !== 'pago') return false;
        const paidTs = parseTimestamp(r.data_pagamento);
        return paidTs !== null && paidTs >= startOfMonth && paidTs < endOfMonth;
      } else {
        // Na competência, conta títulos com vencimento no mês
        const dueStr = getItemDueStr(r);
        if (dueStr) {
          const dueTs = parseTimestamp(dueStr);
          return dueTs !== null && dueTs >= startOfMonth && dueTs < endOfMonth;
        }
        const createdTs = parseTimestamp(r.created_at);
        return createdTs !== null && createdTs >= startOfMonth && createdTs < endOfMonth;
      }
    });

    // Subdivisão das Receitas
    let recMensalidades = 0;
    let recAulasAvulsas = 0;
    let recVendasProdutos = 0;
    let recOutras = 0;
    let deducoesDescontos = 0;

    filteredReceitas.forEach(r => {
      const val = Number(r.valor) || 0;
      const origem = (r.origem || '').toUpperCase();
      const desc = (r.descricao || '').toLowerCase();

      // Dedução de descontos comerciais concedidos
      if (r.tem_desconto && r.valor_original && r.valor_original > val) {
        deducoesDescontos += (r.valor_original - val);
      }

      if (origem === 'MENSALIDADE' || desc.includes('mensalidade') || r.plano || r.plano_contratado_id) {
        recMensalidades += val;
      } else if (origem === 'AVULSA' || desc.includes('avulsa') || desc.includes('personal')) {
        recAulasAvulsas += val;
      } else if (origem === 'VENDA' || desc.includes('produto') || desc.includes('loja') || desc.includes('suplemento')) {
        recVendasProdutos += val;
      } else {
        recOutras += val;
      }
    });

    const receitaBruta = recMensalidades + recAulasAvulsas + recVendasProdutos + recOutras;
    const receitaLiquida = Math.max(0, receitaBruta - deducoesDescontos);

    // --- FILTRAGEM DE DESPESAS NO MÊS ---
    const filteredDespesas = listDesp.filter(d => {
      if ((d.status || '').toLowerCase() === 'cancelado') return false;

      if (regime === 'caixa') {
        // No caixa, conta o que foi efetivamente PAGO no período
        if ((d.status || '').toLowerCase() !== 'pago') return false;
        const paidTs = parseTimestamp(d.data_pagamento);
        return paidTs !== null && paidTs >= startOfMonth && paidTs < endOfMonth;
      } else {
        // Na competência, conta títulos com vencimento no mês
        const dueStr = getItemDueStr(d);
        if (dueStr) {
          const dueTs = parseTimestamp(dueStr);
          return dueTs !== null && dueTs >= startOfMonth && dueTs < endOfMonth;
        }
        const createdTs = parseTimestamp(d.created_at);
        return createdTs !== null && createdTs >= startOfMonth && createdTs < endOfMonth;
      }
    });

    // Classificação analítica das despesas
    const itensVariaveis: Array<{ id: string; descricao: string; categoria: string; valor: number }> = [];
    const itensFixos: Array<{ id: string; descricao: string; categoria: string; valor: number }> = [];
    const itensInvestimentos: Array<{ id: string; descricao: string; categoria: string; valor: number }> = [];
    const itensFinanceiros: Array<{ id: string; descricao: string; categoria: string; valor: number }> = [];

    // Agrupamentos por categoria
    const categoriasFixasMap: Record<string, number> = {};
    const categoriasVariaveisMap: Record<string, number> = {};

    filteredDespesas.forEach(d => {
      const val = Number(d.valor) || 0;
      const cat = d.categoria || 'Outras Despesas';
      const classe = classifyDespesa(d);

      if (classe === 'variavel') {
        itensVariaveis.push({ id: d.id, descricao: d.descricao, categoria: cat, valor: val });
        categoriasVariaveisMap[cat] = (categoriasVariaveisMap[cat] || 0) + val;
      } else if (classe === 'investimento') {
        itensInvestimentos.push({ id: d.id, descricao: d.descricao, categoria: cat, valor: val });
      } else if (classe === 'financeiro') {
        itensFinanceiros.push({ id: d.id, descricao: d.descricao, categoria: cat, valor: val });
      } else {
        itensFixos.push({ id: d.id, descricao: d.descricao, categoria: cat, valor: val });
        categoriasFixasMap[cat] = (categoriasFixasMap[cat] || 0) + val;
      }
    });

    const totalCustosVariaveis = itensVariaveis.reduce((acc, i) => acc + i.valor, 0);
    const totalCustosFixos = itensFixos.reduce((acc, i) => acc + i.valor, 0);
    const totalInvestimentos = itensInvestimentos.reduce((acc, i) => acc + i.valor, 0);
    const totalFinanceiro = itensFinanceiros.reduce((acc, i) => acc + i.valor, 0);

    // --- CÁLCULOS GERENCIAIS CRÍTICOS ---
    // 1. Margem de Contribuição Real
    const margemContribuicaoReal = receitaLiquida - totalCustosVariaveis;
    const margemContribuicaoPct = receitaLiquida > 0 ? (margemContribuicaoReal / receitaLiquida) * 100 : 0;

    // 2. Ponto de Equilíbrio (Break-Even)
    const mcDecimal = margemContribuicaoPct > 0 ? margemContribuicaoPct / 100 : 0;
    const pontoEquilibrioReais = mcDecimal > 0 ? totalCustosFixos / mcDecimal : 0;

    // Alunos ativos no mês de referência
    const alunosAtivos = listAlunos.filter(a => a.ativo !== false);
    const qtdAlunosAtivos = alunosAtivos.length || 1;

    // Ticket Médio Real por Aluno (Mensalidades / Alunos Ativos)
    const ticketMedio = recMensalidades > 0 && qtdAlunosAtivos > 0 
      ? recMensalidades / qtdAlunosAtivos 
      : 280; // Referência média caso ainda não haja faturamento lançado

    // Ponto de Equilíbrio em Número de Alunos
    const pontoEquilibrioAlunos = ticketMedio > 0 
      ? Math.ceil(pontoEquilibrioReais / ticketMedio) 
      : 0;

    // Margem de Segurança Operacional (%)
    const margemSegurancaPct = receitaLiquida > 0 
      ? ((receitaLiquida - pontoEquilibrioReais) / receitaLiquida) * 100 
      : 0;

    // 3. Percentuais sobre a Receita Líquida (Análise Vertical)
    const pctCustoVariavel = receitaLiquida > 0 ? (totalCustosVariaveis / receitaLiquida) * 100 : 0;
    const pctCustoFixo = receitaLiquida > 0 ? (totalCustosFixos / receitaLiquida) * 100 : 0;
    const pctInvestimentos = receitaLiquida > 0 ? (totalInvestimentos / receitaLiquida) * 100 : 0;
    const pctFinanceiro = receitaLiquida > 0 ? (totalFinanceiro / receitaLiquida) * 100 : 0;

    // 4. EBITDA / Resultado Operacional (antes de investimentos e financeiro)
    const ebitda = margemContribuicaoReal - totalCustosFixos;
    const ebitdaPct = receitaLiquida > 0 ? (ebitda / receitaLiquida) * 100 : 0;

    // 5. Lucro Líquido Final do Exercício
    const lucroLiquido = ebitda - totalInvestimentos - totalFinanceiro;
    const lucratividadePct = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

    // Diagnóstico da Margem de Contribuição vs Ideal
    const gapMargem = margemContribuicaoPct - idealMarginPct;
    let statusMargem: 'ideal' | 'alerta' | 'critico' = 'ideal';
    if (gapMargem < -5) statusMargem = 'critico';
    else if (gapMargem < 0) statusMargem = 'alerta';

    return {
      // Receitas
      receitaBruta,
      recMensalidades,
      recAulasAvulsas,
      recVendasProdutos,
      recOutras,
      deducoesDescontos,
      receitaLiquida,
      // Despesas
      totalCustosVariaveis,
      totalCustosFixos,
      totalInvestimentos,
      totalFinanceiro,
      itensVariaveis,
      itensFixos,
      itensInvestimentos,
      itensFinanceiros,
      categoriasFixasMap,
      categoriasVariaveisMap,
      // Indicadores
      margemContribuicaoReal,
      margemContribuicaoPct,
      pontoEquilibrioReais,
      pontoEquilibrioAlunos,
      ticketMedio,
      qtdAlunosAtivos,
      margemSegurancaPct,
      pctCustoVariavel,
      pctCustoFixo,
      pctInvestimentos,
      pctFinanceiro,
      ebitda,
      ebitdaPct,
      lucroLiquido,
      lucratividadePct,
      statusMargem,
      gapMargem
    };
  }, [receitas, despesas, alunos, startOfMonth, endOfMonth, regime, idealMarginPct]);

  // 8. Cálculos do Simulador de Sensibilidade
  const simuladorResult = useMemo(() => {
    const baseTicket = dreData.ticketMedio + simTicketDelta;
    const baseAlunos = Math.max(0, dreData.qtdAlunosAtivos + simNovosAlunos);
    const novoCustoFixo = dreData.totalCustosFixos * (1 - simCustoFixoReductionPct / 100);

    // Nova receita estimada
    const novaRecMensalidades = baseAlunos * baseTicket;
    const novaRecOutras = dreData.recAulasAvulsas + dreData.recVendasProdutos + dreData.recOutras;
    const novaRecLiquida = Math.max(0, novaRecMensalidades + novaRecOutras - dreData.deducoesDescontos);

    // Custos variáveis mantêm a mesma proporção sobre a receita
    const novoCustoVariavel = novaRecLiquida * (dreData.pctCustoVariavel / 100);
    const novaMargemContribuicao = novaRecLiquida - novoCustoVariavel;
    const novaMargemPct = novaRecLiquida > 0 ? (novaMargemContribuicao / novaRecLiquida) * 100 : 0;

    // Novo Break-Even
    const novoMcDec = novaMargemPct > 0 ? novaMargemPct / 100 : 0;
    const novoPE_Reais = novoMcDec > 0 ? novoCustoFixo / novoMcDec : 0;
    const novoPE_Alunos = baseTicket > 0 ? Math.ceil(novoPE_Reais / baseTicket) : 0;

    const novoEbitda = novaMargemContribuicao - novoCustoFixo;
    const novoLucroLiquido = novoEbitda - dreData.totalInvestimentos - dreData.totalFinanceiro;
    const novaLucratividadePct = novaRecLiquida > 0 ? (novoLucroLiquido / novaRecLiquida) * 100 : 0;

    return {
      novaRecLiquida,
      novoCustoFixo,
      novoCustoVariavel,
      novaMargemContribuicao,
      novaMargemPct,
      novoPE_Reais,
      novoPE_Alunos,
      novoLucroLiquido,
      novaLucratividadePct,
      deltaLucro: novoLucroLiquido - dreData.lucroLiquido,
      deltaPE_Alunos: novoPE_Alunos - dreData.pontoEquilibrioAlunos
    };
  }, [dreData, simTicketDelta, simCustoFixoReductionPct, simNovosAlunos]);

  // Formatação monetária
  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPct = (val: number) => {
    return `${val.toFixed(1)}%`;
  };

  const loading = loadingRec || loadingDesp || loadingAlunos;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-surface-500">Calculando Demonstrativo do Resultado (DRE)...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estilos para Impressão Executiva em Folha A4 */}
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
            background: white !important;
            color: black !important;
            padding: 10px 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* CABEÇALHO EXECUTIVO E CONTROLES */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-black text-brand-dark tracking-tight flex items-center gap-2.5">
              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                <BarChart3 className="w-6 h-6" />
              </span>
              DRE Gerencial Completa
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-surface-100 text-surface-600 border border-surface-200">
              {regime === 'competencia' ? 'Competência' : 'Caixa'}
            </span>
          </div>
          <p className="text-sm text-surface-500 font-medium mt-1">
            Demonstrativo do Resultado: Margem de Contribuição, Ponto de Equilíbrio, Lucratividade e Investimentos.
          </p>
        </div>

        {/* Barra de Filtros e Ferramentas */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Seletor de Regime: Competência vs Caixa */}
          <div className="bg-surface-100 p-1 rounded-xl flex items-center border border-surface-200 text-xs font-bold">
            <button
              onClick={() => setRegime('competencia')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                regime === 'competencia'
                  ? 'bg-white text-brand-dark shadow-xs'
                  : 'text-surface-500 hover:text-brand-dark'
              }`}
              title="Analisa faturas e vencimentos do mês (visão contábil/econômica)"
            >
              Competência
            </button>
            <button
              onClick={() => setRegime('caixa')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                regime === 'caixa'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-surface-500 hover:text-brand-dark'
              }`}
              title="Analisa entradas e saídas efetivamente pagas no mês (visão financeira de caixa)"
            >
              Caixa
            </button>
          </div>

          {/* Navegador de Mês */}
          <div className="flex items-center bg-white border border-surface-200 rounded-xl p-0.5 shadow-xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-surface-500 hover:text-brand-dark hover:bg-surface-50 rounded-lg transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => e.target.value && setSelectedMonth(e.target.value)}
              className="px-2 py-1 text-xs font-bold text-brand-dark bg-transparent border-0 focus:ring-0 cursor-pointer outline-none"
            />
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-surface-500 hover:text-brand-dark hover:bg-surface-50 rounded-lg transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Botão Simulador de Sensibilidade */}
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              showSimulator 
                ? 'bg-indigo-600 text-white border-indigo-700' 
                : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            {showSimulator ? 'Ocultar Simulador' : 'Simulador de Metas'}
          </button>

          {/* Botão de Impressão Executiva */}
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-bold bg-white text-surface-700 hover:text-brand-dark border border-surface-200 hover:bg-surface-50 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            Imprimir DRE
          </button>
        </div>
      </div>

      {/* ÁREA IMPRIMÍVEL DA DRE */}
      <div id="print-area" className="space-y-6">

        {/* CABEÇALHO TIMBRADO NA IMPRESSÃO */}
        <div className="hidden print:block border-b-2 border-brand-dark pb-4 mb-4">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black text-brand-dark tracking-tight">AELLO STUDIO DE PERSONAL</h1>
              <p className="text-xs text-surface-600 font-bold uppercase">Demonstrativo do Resultado do Exercício (DRE Gerencial)</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold">Mês de Referência: <span className="capitalize">{monthLabel}</span></p>
              <p className="text-surface-500">Regime: {regime === 'competencia' ? 'Competência' : 'Caixa'}</p>
              <p className="text-surface-400 text-[10px]">Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* 4 CARDS DE KPIS EXECUTIVOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          
          {/* Card 1: Margem de Contribuição Real vs Ideal */}
          <div className="glass-card p-5 border-l-4 border-l-emerald-500 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-surface-500">
                  Margem de Contribuição
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-brand-dark">
                    {formatCurrency(dreData.margemContribuicaoReal)}
                  </h3>
                  <span className={`text-sm font-black ${
                    dreData.statusMargem === 'ideal' ? 'text-emerald-600' :
                    dreData.statusMargem === 'alerta' ? 'text-amber-500' : 'text-rose-600'
                  }`}>
                    {formatPct(dreData.margemContribuicaoPct)}
                  </span>
                </div>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            {/* Comparativo com Meta Ideal */}
            <div className="mt-4 pt-3 border-t border-surface-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-surface-500 font-medium">Meta Ideal:</span>
                <span className="font-black text-brand-dark">{idealMarginPct}%</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                dreData.statusMargem === 'ideal' ? 'bg-emerald-100 text-emerald-800' :
                dreData.statusMargem === 'alerta' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {dreData.gapMargem >= 0 ? `+${dreData.gapMargem.toFixed(1)}% Acima` : `${dreData.gapMargem.toFixed(1)}% Abaixo`}
              </span>
            </div>

            {/* Seletor Rápido de Meta Ideal */}
            <div className="mt-2.5 flex items-center gap-1.5 no-print">
              <span className="text-[10px] text-surface-400 font-semibold">Ajustar meta:</span>
              {[50, 55, 60, 65, 70].map(pct => (
                <button
                  key={pct}
                  onClick={() => handleIdealMarginChange(pct)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                    idealMarginPct === pct 
                      ? 'bg-brand-dark text-white' 
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Card 2: Ponto de Equilíbrio (Break-Even) */}
          <div className="glass-card p-5 border-l-4 border-l-blue-500 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-surface-500">
                  Ponto de Equilíbrio
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-black text-brand-dark">
                    {formatCurrency(dreData.pontoEquilibrioReais)}
                  </h3>
                </div>
                <p className="text-xs text-surface-500 font-semibold mt-0.5">
                  Necessário para cobrir todos os custos
                </p>
              </div>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            {/* Métrica em Alunos & Margem de Segurança */}
            <div className="mt-4 pt-3 border-t border-surface-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-surface-500 font-medium">Meta em Alunos: </span>
                <strong className="text-blue-700 font-black">{dreData.pontoEquilibrioAlunos} alunos</strong>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                dreData.margemSegurancaPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {dreData.margemSegurancaPct >= 0 
                  ? `${dreData.margemSegurancaPct.toFixed(1)}% Folga` 
                  : `${Math.abs(dreData.margemSegurancaPct).toFixed(1)}% Déficit`}
              </span>
            </div>

            <div className="mt-2 text-[10px] text-surface-400">
              Ticket Médio: <strong className="text-surface-600">{formatCurrency(dreData.ticketMedio)}</strong> | Base Ativa: <strong className="text-surface-600">{dreData.qtdAlunosAtivos} alunos</strong>
            </div>
          </div>

          {/* Card 3: Lucratividade Líquida & EBITDA */}
          <div className={`glass-card p-5 border-l-4 relative overflow-hidden ${
            dreData.lucroLiquido >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500'
          }`}>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-surface-500">
                  Lucratividade Líquida
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className={`text-2xl font-black ${
                    dreData.lucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {formatCurrency(dreData.lucroLiquido)}
                  </h3>
                  <span className={`text-sm font-black ${
                    dreData.lucratividadePct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {formatPct(dreData.lucratividadePct)}
                  </span>
                </div>
              </div>
              <div className={`p-2.5 rounded-xl ${
                dreData.lucroLiquido >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {dreData.lucroLiquido >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-surface-100 flex items-center justify-between text-xs">
              <span className="text-surface-500 font-medium">Resultado Operacional (EBITDA):</span>
              <strong className={`font-black ${dreData.ebitda >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(dreData.ebitda)} ({formatPct(dreData.ebitdaPct)})
              </strong>
            </div>

            <div className="mt-2 text-[10px] text-surface-400">
              Retorno sobre a Receita Líquida após impostos e investimentos
            </div>
          </div>

          {/* Card 4: Estrutura de Custos & Investimentos */}
          <div className="glass-card p-5 border-l-4 border-l-purple-500 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-surface-500">
                  Estrutura de Gastos
                </span>
                <div className="mt-1">
                  <h3 className="text-2xl font-black text-brand-dark">
                    {formatCurrency(dreData.totalCustosFixos + dreData.totalCustosVariaveis + dreData.totalInvestimentos)}
                  </h3>
                </div>
              </div>
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                <PieIcon className="w-5 h-5" />
              </div>
            </div>

            {/* Barrinhas de Distribuição Percentual */}
            <div className="mt-3 space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-surface-600 mb-1">
                  <span>Custos Fixos:</span>
                  <strong className="text-amber-700">{formatPct(dreData.pctCustoFixo)} ({formatCurrency(dreData.totalCustosFixos)})</strong>
                </div>
                <div className="w-full bg-surface-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, dreData.pctCustoFixo)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-surface-600 mb-1">
                  <span>Custos Variáveis:</span>
                  <strong className="text-indigo-700">{formatPct(dreData.pctCustoVariavel)} ({formatCurrency(dreData.totalCustosVariaveis)})</strong>
                </div>
                <div className="w-full bg-surface-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, dreData.pctCustoVariavel)}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-surface-600 mb-1">
                  <span>Investimentos (CAPEX):</span>
                  <strong className="text-purple-700">{formatPct(dreData.pctInvestimentos)} ({formatCurrency(dreData.totalInvestimentos)})</strong>
                </div>
                <div className="w-full bg-surface-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: `${Math.min(100, dreData.pctInvestimentos)}%` }} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* SIMULADOR DE METAS E SENSIBILIDADE RETRÁTIL */}
        {showSimulator && (
          <div className="glass-card p-6 border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-white rounded-2xl shadow-sm no-print animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-6 pb-4 border-b border-indigo-100">
              <div>
                <h3 className="text-lg font-black text-indigo-950 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Simulador de Sensibilidade & Metas ("O que acontece se...?")
                </h3>
                <p className="text-xs text-surface-600">
                  Ajuste os parâmetros abaixo para simular instantaneamente o impacto no ponto de equilíbrio e no lucro líquido do estúdio.
                </p>
              </div>
              <button
                onClick={() => {
                  setSimTicketDelta(0);
                  setSimCustoFixoReductionPct(0);
                  setSimNovosAlunos(0);
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Redefinir Parâmetros
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Slider 1: Reajuste de Ticket Médio */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-surface-700">Ajuste no Ticket Médio:</span>
                  <strong className={`font-black ${simTicketDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {simTicketDelta >= 0 ? `+${formatCurrency(simTicketDelta)}` : formatCurrency(simTicketDelta)}
                  </strong>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="150"
                  step="5"
                  value={simTicketDelta}
                  onChange={e => setSimTicketDelta(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-surface-400">
                  <span>-R$ 50</span>
                  <span>Atual: {formatCurrency(dreData.ticketMedio)}</span>
                  <span>+R$ 150</span>
                </div>
              </div>

              {/* Slider 2: Redução de Custos Fixos */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-surface-700">Redução de Custos Fixos:</span>
                  <strong className="font-black text-amber-700">
                    -{simCustoFixoReductionPct}% ({formatCurrency(dreData.totalCustosFixos * (simCustoFixoReductionPct / 100))})
                  </strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="5"
                  value={simCustoFixoReductionPct}
                  onChange={e => setSimCustoFixoReductionPct(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-surface-400">
                  <span>0%</span>
                  <span>-20%</span>
                  <span>-40%</span>
                </div>
              </div>

              {/* Slider 3: Saldo de Novos Alunos */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-surface-700">Novos Alunos Matriculados:</span>
                  <strong className={`font-black ${simNovosAlunos >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {simNovosAlunos >= 0 ? `+${simNovosAlunos}` : simNovosAlunos} alunos
                  </strong>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="50"
                  step="1"
                  value={simNovosAlunos}
                  onChange={e => setSimNovosAlunos(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-surface-400">
                  <span>-20</span>
                  <span>Base: {dreData.qtdAlunosAtivos}</span>
                  <span>+50</span>
                </div>
              </div>
            </div>

            {/* Resultado do Cenário Simulado */}
            <div className="mt-6 pt-4 border-t border-indigo-100 grid grid-cols-2 md:grid-cols-4 gap-4 bg-indigo-900/5 p-4 rounded-xl">
              <div>
                <span className="text-[10px] font-bold uppercase text-surface-500">Novo Ponto de Equilíbrio</span>
                <p className="text-lg font-black text-indigo-950">{formatCurrency(simuladorResult.novoPE_Reais)}</p>
                <span className="text-xs text-surface-600">
                  Meta: <strong>{simuladorResult.novoPE_Alunos} alunos</strong>
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-surface-500">Impacto na Meta de Alunos</span>
                <p className={`text-lg font-black ${
                  simuladorResult.deltaPE_Alunos <= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {simuladorResult.deltaPE_Alunos <= 0 
                    ? `${Math.abs(simuladorResult.deltaPE_Alunos)} alunos a menos` 
                    : `+${simuladorResult.deltaPE_Alunos} alunos necessários`}
                </p>
                <span className="text-[10px] text-surface-500">Para cobrir os custos fixos</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-surface-500">Novo Lucro Líquido Projetado</span>
                <p className={`text-lg font-black ${
                  simuladorResult.novoLucroLiquido >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {formatCurrency(simuladorResult.novoLucroLiquido)}
                </p>
                <span className="text-xs text-surface-600 font-bold">
                  {formatPct(simuladorResult.novaLucratividadePct)} de Lucratividade
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-surface-500">Variação no Lucro Final</span>
                <p className={`text-lg font-black flex items-center gap-1 ${
                  simuladorResult.deltaLucro >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {simuladorResult.deltaLucro >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  {simuladorResult.deltaLucro >= 0 ? `+${formatCurrency(simuladorResult.deltaLucro)}` : formatCurrency(simuladorResult.deltaLucro)}
                </p>
                <span className="text-[10px] text-surface-500">Comparado ao resultado atual</span>
              </div>
            </div>
          </div>
        )}

        {/* VISUAL CASCATA FINANCEIRA (WATERFALL DRE) */}
        <div className="glass-card p-6 border border-surface-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-black text-brand-dark flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-medium" />
                Cascata Financeira Visual (Fluxo DRE)
              </h3>
              <p className="text-xs text-surface-500">
                Visualização do caminho do faturamento até o lucro líquido final
              </p>
            </div>
            <span className="text-xs font-bold text-surface-500 capitalize bg-surface-50 px-3 py-1 rounded-lg border border-surface-200">
              {monthLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            
            {/* 1. Receita Bruta */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <span className="text-[10px] font-bold uppercase text-emerald-700">1. Receita Bruta</span>
              <p className="text-base font-black text-emerald-900 mt-1">{formatCurrency(dreData.receitaBruta)}</p>
              <span className="text-[10px] font-semibold text-emerald-700">Entradas Totais</span>
            </div>

            {/* 2. Custos Variáveis */}
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
              <span className="text-[10px] font-bold uppercase text-indigo-700">2. (-) Custos Variáveis</span>
              <p className="text-base font-black text-indigo-900 mt-1">-{formatCurrency(dreData.totalCustosVariaveis)}</p>
              <span className="text-[10px] font-semibold text-indigo-700">{formatPct(dreData.pctCustoVariavel)} da receita</span>
            </div>

            {/* 3. Margem de Contribuição */}
            <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-center">
              <span className="text-[10px] font-bold uppercase text-teal-800">3. (=) Margem Contribuição</span>
              <p className="text-base font-black text-teal-950 mt-1">{formatCurrency(dreData.margemContribuicaoReal)}</p>
              <span className="text-[10px] font-bold text-teal-800">{formatPct(dreData.margemContribuicaoPct)} da receita</span>
            </div>

            {/* 4. Custos Fixos */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <span className="text-[10px] font-bold uppercase text-amber-800">4. (-) Custos Fixos</span>
              <p className="text-base font-black text-amber-950 mt-1">-{formatCurrency(dreData.totalCustosFixos)}</p>
              <span className="text-[10px] font-semibold text-amber-800">{formatPct(dreData.pctCustoFixo)} da receita</span>
            </div>

            {/* 5. Investimentos */}
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-center">
              <span className="text-[10px] font-bold uppercase text-purple-800">5. (-) Investimentos</span>
              <p className="text-base font-black text-purple-950 mt-1">-{formatCurrency(dreData.totalInvestimentos)}</p>
              <span className="text-[10px] font-semibold text-purple-800">{formatPct(dreData.pctInvestimentos)} (CAPEX)</span>
            </div>

            {/* 6. Lucro Líquido Final */}
            <div className={`p-3.5 border rounded-xl text-center ${
              dreData.lucroLiquido >= 0 
                ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950' 
                : 'bg-rose-100/80 border-rose-300 text-rose-950'
            }`}>
              <span className="text-[10px] font-black uppercase">6. (=) Lucro Líquido</span>
              <p className="text-base font-black mt-1">{formatCurrency(dreData.lucroLiquido)}</p>
              <span className="text-[10px] font-bold">{formatPct(dreData.lucratividadePct)} Lucratividade</span>
            </div>

          </div>
        </div>

        {/* TABELA DRE COMPLETA ESTRUTURADA (ANÁLISE VERTICAL) */}
        <div className="glass-card overflow-hidden border border-surface-200">
          <div className="p-4 bg-surface-50 border-b border-surface-200 flex justify-between items-center">
            <div>
              <h3 className="text-base font-black text-brand-dark flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-medium" />
                Estrutura Analítica da DRE
              </h3>
              <p className="text-xs text-surface-500 font-medium">
                Detalhamento linha por linha com Análise Vertical (% AV sobre a Receita Líquida)
              </p>
            </div>
            <span className="text-xs text-surface-500 font-bold hidden sm:inline-block">
              Base: Receita Operacional Líquida (100%)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-100/70 border-b border-surface-200 text-surface-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-[60%]">Conta / Linha de Resultado</th>
                  <th className="py-3 px-4 text-right w-[20%]">Valor (R$)</th>
                  <th className="py-3 px-4 text-right w-[20%]">% AV (Receita Líq.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-medium text-surface-700">

                {/* 1. RECEITA OPERACIONAL BRUTA */}
                <tr className="bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors cursor-pointer" onClick={() => toggleGroup('receitaBruta')}>
                  <td className="py-3 px-4 font-black text-brand-dark flex items-center gap-2">
                    {expandedGroups.receitaBruta ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />}
                    (+) 1. RECEITA OPERACIONAL BRUTA
                  </td>
                  <td className="py-3 px-4 text-right font-black text-emerald-800">
                    {formatCurrency(dreData.receitaBruta)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-surface-500">
                    {dreData.receitaLiquida > 0 ? formatPct((dreData.receitaBruta / dreData.receitaLiquida) * 100) : '0%'}
                  </td>
                </tr>

                {/* Subitens da Receita Bruta */}
                {expandedGroups.receitaBruta && (
                  <>
                    <tr className="bg-white hover:bg-surface-50/50">
                      <td className="py-2.5 px-4 pl-10 text-surface-600">1.1 Mensalidades de Alunos</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(dreData.recMensalidades)}</td>
                      <td className="py-2.5 px-4 text-right text-surface-500">
                        {dreData.receitaLiquida > 0 ? formatPct((dreData.recMensalidades / dreData.receitaLiquida) * 100) : '0%'}
                      </td>
                    </tr>
                    <tr className="bg-white hover:bg-surface-50/50">
                      <td className="py-2.5 px-4 pl-10 text-surface-600">1.2 Aulas Avulsas / Personal</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(dreData.recAulasAvulsas)}</td>
                      <td className="py-2.5 px-4 text-right text-surface-500">
                        {dreData.receitaLiquida > 0 ? formatPct((dreData.recAulasAvulsas / dreData.receitaLiquida) * 100) : '0%'}
                      </td>
                    </tr>
                    <tr className="bg-white hover:bg-surface-50/50">
                      <td className="py-2.5 px-4 pl-10 text-surface-600">1.3 Venda de Produtos & Suplementos (Loja)</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(dreData.recVendasProdutos)}</td>
                      <td className="py-2.5 px-4 text-right text-surface-500">
                        {dreData.receitaLiquida > 0 ? formatPct((dreData.recVendasProdutos / dreData.receitaLiquida) * 100) : '0%'}
                      </td>
                    </tr>
                    <tr className="bg-white hover:bg-surface-50/50">
                      <td className="py-2.5 px-4 pl-10 text-surface-600">1.4 Outras Receitas / Avaliação Física</td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatCurrency(dreData.recOutras)}</td>
                      <td className="py-2.5 px-4 text-right text-surface-500">
                        {dreData.receitaLiquida > 0 ? formatPct((dreData.recOutras / dreData.receitaLiquida) * 100) : '0%'}
                      </td>
                    </tr>
                  </>
                )}

                {/* Deduções e Descontos */}
                <tr className="bg-surface-50/40">
                  <td className="py-2.5 px-4 pl-8 text-surface-600 font-semibold">
                    (-) 1.5 Deduções & Descontos Comerciais Concedidos
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-rose-600">
                    -{formatCurrency(dreData.deducoesDescontos)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-surface-500">
                    {dreData.receitaLiquida > 0 ? `-${formatPct((dreData.deducoesDescontos / dreData.receitaLiquida) * 100)}` : '0%'}
                  </td>
                </tr>

                {/* 2. RECEITA OPERACIONAL LÍQUIDA */}
                <tr className="bg-emerald-100/40 border-y-2 border-emerald-300 font-black">
                  <td className="py-3.5 px-4 text-brand-dark text-sm">
                    (=) 2. RECEITA OPERACIONAL LÍQUIDA (ROL)
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-900 text-sm">
                    {formatCurrency(dreData.receitaLiquida)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-900 font-black">
                    100.0%
                  </td>
                </tr>

                {/* 3. CUSTOS VARIÁVEIS */}
                <tr className="bg-indigo-50/40 hover:bg-indigo-50/70 transition-colors cursor-pointer" onClick={() => toggleGroup('custosVariaveis')}>
                  <td className="py-3 px-4 font-black text-brand-dark flex items-center gap-2">
                    {expandedGroups.custosVariaveis ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />}
                    (-) 3. CUSTOS VARIÁVEIS (CV)
                  </td>
                  <td className="py-3 px-4 text-right font-black text-indigo-900">
                    -{formatCurrency(dreData.totalCustosVariaveis)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-700">
                    {formatPct(dreData.pctCustoVariavel)}
                  </td>
                </tr>

                {/* Subitens de Custos Variáveis */}
                {expandedGroups.custosVariaveis && (
                  <>
                    {Object.entries(dreData.categoriasVariaveisMap).map(([catNome, valor]) => (
                      <tr key={catNome} className="bg-white hover:bg-surface-50/50">
                        <td className="py-2 px-4 pl-10 text-surface-600">
                          {catNome}
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-surface-800">
                          -{formatCurrency(valor)}
                        </td>
                        <td className="py-2 px-4 text-right text-surface-500">
                          {dreData.receitaLiquida > 0 ? formatPct((valor / dreData.receitaLiquida) * 100) : '0%'}
                        </td>
                      </tr>
                    ))}
                    {Object.keys(dreData.categoriasVariaveisMap).length === 0 && (
                      <tr className="bg-white">
                        <td colSpan={3} className="py-2 px-4 pl-10 text-surface-400 italic">
                          Nenhum custo variável discriminado no período.
                        </td>
                      </tr>
                    )}
                  </>
                )}

                {/* 4. MARGEM DE CONTRIBUIÇÃO REAL */}
                <tr className="bg-teal-100/50 border-y-2 border-teal-400 font-black text-sm">
                  <td className="py-3.5 px-4 text-teal-950 flex items-center gap-2">
                    (=) 4. MARGEM DE CONTRIBUIÇÃO REAL (MC)
                  </td>
                  <td className="py-3.5 px-4 text-right text-teal-950">
                    {formatCurrency(dreData.margemContribuicaoReal)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-teal-950 font-black">
                    {formatPct(dreData.margemContribuicaoPct)}
                  </td>
                </tr>

                {/* 5. CUSTOS & DESPESAS FIXAS */}
                <tr className="bg-amber-50/40 hover:bg-amber-50/70 transition-colors cursor-pointer" onClick={() => toggleGroup('custosFixos')}>
                  <td className="py-3 px-4 font-black text-brand-dark flex items-center gap-2">
                    {expandedGroups.custosFixos ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />}
                    (-) 5. CUSTOS & DESPESAS FIXAS OPERACIONAIS (CF)
                  </td>
                  <td className="py-3 px-4 text-right font-black text-amber-900">
                    -{formatCurrency(dreData.totalCustosFixos)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-amber-700">
                    {formatPct(dreData.pctCustoFixo)}
                  </td>
                </tr>

                {/* Subitens de Custos Fixos por Categoria */}
                {expandedGroups.custosFixos && (
                  <>
                    {Object.entries(dreData.categoriasFixasMap).map(([catNome, valor]) => (
                      <tr key={catNome} className="bg-white hover:bg-surface-50/50">
                        <td className="py-2 px-4 pl-10 text-surface-600">
                          {catNome}
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-surface-800">
                          -{formatCurrency(valor)}
                        </td>
                        <td className="py-2 px-4 text-right text-surface-500">
                          {dreData.receitaLiquida > 0 ? formatPct((valor / dreData.receitaLiquida) * 100) : '0%'}
                        </td>
                      </tr>
                    ))}
                    {Object.keys(dreData.categoriasFixasMap).length === 0 && (
                      <tr className="bg-white">
                        <td colSpan={3} className="py-2 px-4 pl-10 text-surface-400 italic">
                          Nenhum custo fixo registrado no período.
                        </td>
                      </tr>
                    )}
                  </>
                )}

                {/* 6. EBITDA / RESULTADO OPERACIONAL */}
                <tr className="bg-surface-100/70 border-y border-surface-300 font-black">
                  <td className="py-3 px-4 text-brand-dark">
                    (=) 6. RESULTADO OPERACIONAL (EBITDA / LAJIDA)
                  </td>
                  <td className={`py-3 px-4 text-right font-black ${
                    dreData.ebitda >= 0 ? 'text-emerald-800' : 'text-rose-800'
                  }`}>
                    {formatCurrency(dreData.ebitda)}
                  </td>
                  <td className={`py-3 px-4 text-right font-black ${
                    dreData.ebitdaPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {formatPct(dreData.ebitdaPct)}
                  </td>
                </tr>

                {/* 7. INVESTIMENTOS (CAPEX) */}
                <tr className="bg-purple-50/40 hover:bg-purple-50/70 transition-colors cursor-pointer" onClick={() => toggleGroup('investimentos')}>
                  <td className="py-3 px-4 font-black text-brand-dark flex items-center gap-2">
                    {expandedGroups.investimentos ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />}
                    (-) 7. INVESTIMENTOS / CAPEX (Equipamentos, Reformas, Obras)
                  </td>
                  <td className="py-3 px-4 text-right font-black text-purple-900">
                    -{formatCurrency(dreData.totalInvestimentos)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-purple-700">
                    {formatPct(dreData.pctInvestimentos)}
                  </td>
                </tr>

                {/* Subitens de Investimentos */}
                {expandedGroups.investimentos && (
                  <>
                    {dreData.itensInvestimentos.map(inv => (
                      <tr key={inv.id} className="bg-white hover:bg-surface-50/50">
                        <td className="py-2 px-4 pl-10 text-surface-600">
                          {inv.descricao} <span className="text-[10px] text-surface-400">({inv.categoria})</span>
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-surface-800">
                          -{formatCurrency(inv.valor)}
                        </td>
                        <td className="py-2 px-4 text-right text-surface-500">
                          {dreData.receitaLiquida > 0 ? formatPct((inv.valor / dreData.receitaLiquida) * 100) : '0%'}
                        </td>
                      </tr>
                    ))}
                    {dreData.itensInvestimentos.length === 0 && (
                      <tr className="bg-white">
                        <td colSpan={3} className="py-2 px-4 pl-10 text-surface-400 italic">
                          Nenhum investimento registrado neste mês.
                        </td>
                      </tr>
                    )}
                  </>
                )}

                {/* 8. DESPESAS FINANCEIRAS */}
                <tr className="bg-surface-50/40 hover:bg-surface-100/50 transition-colors cursor-pointer" onClick={() => toggleGroup('financeiro')}>
                  <td className="py-2.5 px-4 font-semibold text-surface-700 flex items-center gap-2">
                    {expandedGroups.financeiro ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />}
                    (-) 8. Despesas Financeiras & Amortização de Empréstimos
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-surface-800">
                    -{formatCurrency(dreData.totalFinanceiro)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-surface-500">
                    {formatPct(dreData.pctFinanceiro)}
                  </td>
                </tr>

                {/* Subitens Financeiros */}
                {expandedGroups.financeiro && (
                  <>
                    {dreData.itensFinanceiros.map(f => (
                      <tr key={f.id} className="bg-white hover:bg-surface-50/50">
                        <td className="py-2 px-4 pl-10 text-surface-600">
                          {f.descricao} <span className="text-[10px] text-surface-400">({f.categoria})</span>
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-surface-800">
                          -{formatCurrency(f.valor)}
                        </td>
                        <td className="py-2 px-4 text-right text-surface-500">
                          {dreData.receitaLiquida > 0 ? formatPct((f.valor / dreData.receitaLiquida) * 100) : '0%'}
                        </td>
                      </tr>
                    ))}
                    {dreData.itensFinanceiros.length === 0 && (
                      <tr className="bg-white">
                        <td colSpan={3} className="py-2 px-4 pl-10 text-surface-400 italic">
                          Nenhuma despesa de empréstimo ou financiamento no mês.
                        </td>
                      </tr>
                    )}
                  </>
                )}

                {/* 9. LUCRO LÍQUIDO FINAL DO EXERCÍCIO */}
                <tr className={`border-t-2 font-black text-base ${
                  dreData.lucroLiquido >= 0 
                    ? 'bg-emerald-200/50 border-emerald-500 text-emerald-950' 
                    : 'bg-rose-200/50 border-rose-500 text-rose-950'
                }`}>
                  <td className="py-4 px-4">
                    (=) 9. LUCRO LÍQUIDO DO EXERCÍCIO (RESULTADO FINAL)
                  </td>
                  <td className="py-4 px-4 text-right">
                    {formatCurrency(dreData.lucroLiquido)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {formatPct(dreData.lucratividadePct)}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>

        {/* RESUMO DOS INDICADORES E NOTAS GERENCIAIS */}
        <div className="glass-card p-6 border border-surface-200 bg-surface-50/50">
          <h4 className="text-sm font-black text-brand-dark mb-3 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-surface-500" />
            Guia de Leitura & Interpretação dos Indicadores do Estúdio
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-surface-600">
            <div className="p-3 bg-white rounded-xl border border-surface-200">
              <strong className="text-brand-dark block mb-1">Margem de Contribuição ({formatPct(dreData.margemContribuicaoPct)}):</strong>
              Mostra quanto sobra de cada mensalidade após pagar comissões e taxas variáveis. A meta saudável para estúdios é de <strong>60%</strong>. Se estiver baixa, revise as alíquotas de comissões ou reajuste planos.
            </div>

            <div className="p-3 bg-white rounded-xl border border-surface-200">
              <strong className="text-brand-dark block mb-1">Ponto de Equilíbrio ({dreData.pontoEquilibrioAlunos} Alunos / {formatCurrency(dreData.pontoEquilibrioReais)}):</strong>
              É o faturamento mínimo mensal para não ter prejuízo. Com seu ticket médio de <strong>{formatCurrency(dreData.ticketMedio)}</strong>, você precisa de exatamente {dreData.pontoEquilibrioAlunos} alunos ativos para zerar custos fixos.
            </div>

            <div className="p-3 bg-white rounded-xl border border-surface-200">
              <strong className="text-brand-dark block mb-1">Investimentos em Separado ({formatCurrency(dreData.totalInvestimentos)}):</strong>
              Aparelhos e reformas são listados após o EBITDA para não distorcer o cálculo do ponto de equilíbrio operacional, permitindo ver se a operação é rentável por si só.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
