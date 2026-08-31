import React, { useState, useMemo } from 'react';
import { DollarSign, Printer, Loader2, Award } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { GuardaPagina } from '../../components/acl/GuardaPagina';
import type { Venda } from '../../types/vendas';
import type { Funcionario } from '../../types/database';
import { calcularComissoesVendedores } from '../../lib/comissao/comissaoService';

export const RelatorioComissao: React.FC = () => {
  const { data: vendas, loading: loadingVendas } = useCollection<Venda>('vendas');
  const { data: funcionarios } = useCollection<Funcionario>('funcionarios');

  // Filtro Data Inicial (início do mês atual) e Final (fim do mês atual)
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  });
  const [selectedVendedor, setSelectedVendedor] = useState('todos');

  const tsInicio = new Date(dataInicio + 'T00:00:00').getTime();
  const tsFim = new Date(dataFim + 'T23:59:59').getTime();

  const resumoComissoes = useMemo(() => {
    if (!vendas || !funcionarios) return [];
    return calcularComissoesVendedores(vendas, funcionarios, tsInicio, tsFim, selectedVendedor);
  }, [vendas, funcionarios, tsInicio, tsFim, selectedVendedor]);

  const totalVendasPeriodo = resumoComissoes.reduce((acc, r) => acc + r.total_vendas_valor, 0);
  const totalComissoesPeriodo = resumoComissoes.reduce((acc, r) => acc + r.comissao_valor_total, 0);

  const handleImprimir = () => {
    window.print();
  };

  return (
    <GuardaPagina pode="comissao.ver">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-brand-dark tracking-tight flex items-center gap-2">
              <Award className="w-7 h-7 text-amber-600" /> Relatório de Comissões sobre Vendas
            </h1>
            <p className="text-sm text-surface-500 font-medium">
              Apenas sobre produtos de loja e balcão. Mensalidades não incidem comissão.
            </p>
          </div>

          <button
            onClick={handleImprimir}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-surface-200 hover:bg-surface-50 text-surface-700 font-bold text-sm rounded-xl shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" /> Imprimir Relatório
          </button>
        </div>

        {/* Bar de Filtros */}
        <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
              Filtrar por Vendedor
            </label>
            <select
              value={selectedVendedor}
              onChange={e => setSelectedVendedor(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl focus:ring-2 focus:ring-amber-500"
            >
              <option value="todos">Todos os Vendedores</option>
              {funcionarios?.map(f => (
                <option key={f.id} value={f.uid || f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Vendas de Produtos no Período</p>
              <h3 className="text-2xl font-black text-brand-dark mt-1">R$ {totalVendasPeriodo.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Total de Comissões a Pagar</p>
              <h3 className="text-2xl font-black text-amber-900 mt-1">R$ {totalComissoesPeriodo.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tabela de Resumo por Vendedor */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-surface-50 border-b border-surface-200 font-bold text-xs uppercase tracking-wider text-surface-600">
            Resumo Consolidado de Comissões por Vendedor
          </div>

          {loadingVendas ? (
            <div className="p-12 text-center text-surface-500 flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              <p className="font-medium">Calculando comissões do período...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Vendedor / Funcionário</th>
                    <th className="p-4 text-center">Qtd Vendas</th>
                    <th className="p-4 text-right">Total Vendido (R$)</th>
                    <th className="p-4 text-center">% Comissão Médio</th>
                    <th className="p-4 text-right">Comissão Total (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                  {resumoComissoes.length > 0 ? (
                    resumoComissoes.map(r => (
                      <tr key={r.vendedor_id} className="hover:bg-surface-50/60 transition-colors">
                        <td className="p-4 font-bold text-brand-dark">
                          {r.vendedor_nome}
                        </td>
                        <td className="p-4 text-center font-bold">
                          {r.total_vendas_qtd}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-800 text-sm">
                          R$ {r.total_vendas_valor.toFixed(2)}
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-surface-600">
                          {r.comissao_pct_media}%
                        </td>
                        <td className="p-4 text-right font-mono font-black text-amber-900 text-sm">
                          R$ {r.comissao_valor_total.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-surface-400 font-medium">
                        Nenhuma comissão registrada no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </GuardaPagina>
  );
};
