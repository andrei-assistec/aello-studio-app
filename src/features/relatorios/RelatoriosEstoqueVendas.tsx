import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Printer, Loader2, PieChart } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { GuardaPagina } from '../../components/acl/GuardaPagina';
import type { Venda } from '../../types/vendas';
import type { Produto, MovimentoEstoque } from '../../types/estoque';
import { calcularCurvaABC, calcularGiroCobertura } from '../../lib/relatorios/relatoriosService';

export const RelatoriosEstoqueVendas: React.FC = () => {
  const { data: vendas, loading: loadingVendas } = useCollection<Venda>('vendas');
  const { data: produtos, loading: loadingProdutos } = useCollection<Produto>('produtos');
  const { data: movimentos, loading: loadingMovs } = useCollection<MovimentoEstoque>('estoque_movimentos');

  const [activeTab, setActiveTab] = useState<'ABC' | 'GIRO'>('ABC');

  const listaCurvaABC = useMemo(() => {
    if (!vendas || !produtos) return [];
    return calcularCurvaABC(vendas, produtos);
  }, [vendas, produtos]);

  const listaGiro = useMemo(() => {
    if (!produtos || !movimentos) return [];
    return calcularGiroCobertura(produtos, movimentos, 30);
  }, [produtos, movimentos]);

  const loading = loadingVendas || loadingProdutos || loadingMovs;

  return (
    <GuardaPagina pode="compras.ver">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-brand-dark tracking-tight flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-indigo-600" /> Relatórios Estratégicos de Vendas & Estoque
            </h1>
            <p className="text-sm text-surface-500 font-medium">
              Curva ABC de faturamento, análise de cobertura de giro e risco de ruptura
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-surface-200 hover:bg-surface-50 text-surface-700 font-bold text-sm rounded-xl shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" /> Imprimir Relatório
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-surface-200 gap-4">
          <button
            onClick={() => setActiveTab('ABC')}
            className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'ABC' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-surface-500 hover:text-surface-800'
            }`}
          >
            <PieChart className="w-4 h-4" /> Curva ABC de Vendas
          </button>

          <button
            onClick={() => setActiveTab('GIRO')}
            className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'GIRO' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-surface-500 hover:text-surface-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Giro & Cobertura de Estoque
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-surface-500 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="font-medium">Gerando dados estratégicos...</p>
          </div>
        ) : activeTab === 'ABC' ? (
          <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden space-y-4">
            <div className="p-4 bg-surface-50 border-b border-surface-200 flex justify-between items-center text-xs font-semibold text-surface-600">
              <span>Análise de Pareto (Classe A: 80% do Faturamento | Classe B: 15% | Classe C: 5%)</span>
              <span className="font-bold text-brand-dark">{listaCurvaABC.length} Itens Analisados</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                    <th className="p-4 text-center">Classe</th>
                    <th className="p-4">Cód</th>
                    <th className="p-4">Descrição do Produto</th>
                    <th className="p-4 text-center">Qtd Vendida</th>
                    <th className="p-4 text-right">Faturamento (R$)</th>
                    <th className="p-4 text-right">Lucro Bruto (R$)</th>
                    <th className="p-4 text-right">Part. (%)</th>
                    <th className="p-4 text-right">Acumulado (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                  {listaCurvaABC.length > 0 ? (
                    listaCurvaABC.map(item => (
                      <tr key={item.produto_id} className="hover:bg-surface-50/60 transition-colors">
                        <td className="p-4 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                            item.classe === 'A' ? 'bg-emerald-100 text-emerald-800' :
                            item.classe === 'B' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            Classe {item.classe}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-surface-600">#{item.codigo}</td>
                        <td className="p-4 font-bold text-brand-dark">{item.descricao}</td>
                        <td className="p-4 text-center font-bold">{item.qtd_vendida} UN</td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-800 text-sm">
                          R$ {item.faturamento.toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono font-semibold text-surface-700">
                          R$ {item.lucro_bruto.toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-indigo-700">
                          {item.participacao_pct}%
                        </td>
                        <td className="p-4 text-right font-mono text-surface-500">
                          {item.acumulado_pct}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-surface-400 font-medium">
                        Nenhum produto vendido no período para gerar a Curva ABC.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden space-y-4">
            <div className="p-4 bg-surface-50 border-b border-surface-200 flex justify-between items-center text-xs font-semibold text-surface-600">
              <span>Giro de Estoque e Análise de Cobertura (Média dos Últimos 30 Dias)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Cód</th>
                    <th className="p-4">Descrição</th>
                    <th className="p-4 text-center">Saldo Atual</th>
                    <th className="p-4 text-center">Consumo Diário</th>
                    <th className="p-4 text-center">Cobertura (Dias)</th>
                    <th className="p-4 text-center">Status Giro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                  {listaGiro.map(g => (
                    <tr key={g.produto_id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="p-4 font-mono font-bold text-surface-600">#{g.codigo}</td>
                      <td className="p-4 font-bold text-brand-dark">{g.descricao}</td>
                      <td className="p-4 text-center font-bold">{g.saldo_atual} UN</td>
                      <td className="p-4 text-center font-mono">{g.consumo_diario} UN/dia</td>
                      <td className="p-4 text-center font-mono font-bold text-sm">
                        {g.dias_cobertura === 999 ? 'Sem Giro' : `${g.dias_cobertura} dias`}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        {g.status_cobertura === 'RUPTURA_IMINENTE' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            Ruptura Iminente
                          </span>
                        ) : g.status_cobertura === 'ALERTA' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Estoque Baixo
                          </span>
                        ) : g.status_cobertura === 'EXCESSO' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Estoque Encalhado
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Estoque Regular
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </GuardaPagina>
  );
};
