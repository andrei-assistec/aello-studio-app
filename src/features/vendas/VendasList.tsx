import React, { useState, useMemo } from 'react';
import {
  ShoppingBag, Plus, Search, Filter, CheckCircle2, AlertTriangle,
  RefreshCw, Loader2, DollarSign, XCircle
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection } from '../../hooks/useFirestore';
import { usePermissao } from '../../hooks/usePermissao';
import { GuardaPagina } from '../../components/acl/GuardaPagina';
import { Se } from '../../components/acl/Se';
import type { Venda } from '../../types/vendas';
import { PdvVendas } from './PdvVendas';
import { DevolucaoTrocaModal } from './DevolucaoTrocaModal';
import { solicitarCancelamentoVenda, aprovarCancelamentoVenda } from '../../lib/vendas/vendasService';

export const VendasList: React.FC = () => {
  const { pode, escopoDe, ehAdmin, userUid } = usePermissao();
  const { data: vendas, loading } = useCollection<Venda>('vendas');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modais
  const [isPdvOpen, setIsPdvOpen] = useState(false);
  const [isDevolucaoOpen, setIsDevolucaoOpen] = useState(false);
  const [vendaToDevolver, setVendaToDevolver] = useState<Venda | null>(null);

  // Escopo de visualização (próprias vs todas)
  const escopoVendas = escopoDe('vendas.ver');

  const vendasFiltradas = useMemo(() => {
    if (!vendas) return [];

    return vendas.filter(v => {
      // Filtro de escopo (instrutor só vê as próprias vendas)
      if (escopoVendas === 'proprias' && !ehAdmin && v.vendedor_id !== userUid) {
        return false;
      }

      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        String(v.numero).includes(term) ||
        v.comprador.nome.toLowerCase().includes(term) ||
        v.vendedor_nome.toLowerCase().includes(term);

      const matchStatus = statusFilter === 'todos' || v.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [vendas, escopoVendas, ehAdmin, userUid, searchTerm, statusFilter]);

  // Ações de Cancelamento
  const handleSolicitarCancelamento = async (venda: Venda) => {
    const motivo = prompt(`Informe o motivo para solicitar o cancelamento da Venda #${venda.numero}:`);
    if (!motivo || !motivo.trim()) return;

    try {
      await solicitarCancelamentoVenda(venda.id, userUid || 'usuario', motivo.trim());
      alert('Solicitação de cancelamento enviada para análise da administração.');
    } catch (err) {
      console.error('Erro ao solicitar cancelamento:', err);
    }
  };

  const handleAprovarCancelamento = async (venda: Venda) => {
    if (!confirm(`Confirma a aprovação do cancelamento da Venda #${venda.numero}? Os itens retornarão ao estoque e as contas pendentes serão canceladas.`)) return;

    try {
      await aprovarCancelamentoVenda(venda, userUid || 'Admin');
      alert(`Venda #${venda.numero} cancelada e estoque estornado com sucesso.`);
    } catch (err) {
      console.error('Erro ao aprovar cancelamento:', err);
    }
  };

  const handleRecusarCancelamento = async (venda: Venda) => {
    const motivo = prompt('Informe a justificativa da recusa do cancelamento:');
    try {
      await updateDoc(doc(db, 'vendas', venda.id), {
        status: 'CONCLUIDA',
        recusado_por: userUid || 'Admin',
        recusado_em: Date.now(),
        motivo_recusa: motivo || 'Cancelamento não autorizado pela administração'
      });
      alert('Solicitação de cancelamento recusada.');
    } catch (err) {
      console.error('Erro ao recusar cancelamento:', err);
    }
  };

  const totalVendasConcluidas = vendasFiltradas.filter(v => v.status === 'CONCLUIDA').length;
  const faturamentoTotal = vendasFiltradas.filter(v => v.status === 'CONCLUIDA').reduce((acc, v) => acc + (v.total || 0), 0);

  return (
    <GuardaPagina pode="vendas.ver">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-brand-dark tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-emerald-600" /> Módulo de Vendas (PDV & Balcão)
            </h1>
            <p className="text-sm text-surface-500 font-medium">
              Faturamento de produtos, vestuário, solicitações de cancelamento e trocas
            </p>
          </div>

          <Se pode="vendas.criar">
            <button
              onClick={() => setIsPdvOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Nova Venda (PDV)
            </button>
          </Se>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Vendas Realizadas</p>
              <h3 className="text-2xl font-black text-brand-dark mt-1">{totalVendasConcluidas}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Faturamento Bruto de Vendas</p>
              <h3 className="text-2xl font-black text-emerald-800 mt-1">R$ {faturamentoTotal.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Bar de Filtros */}
        <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por nº da venda, comprador ou vendedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-surface-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="CONCLUIDA">Concluídas</option>
              <option value="CANCELAMENTO_SOLICITADO">Cancelamento Solicitado</option>
              <option value="CANCELADA">Canceladas</option>
              <option value="DEVOLVIDA_TOTAL">Devolvidas</option>
            </select>
          </div>
        </div>

        {/* Tabela de Vendas */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-surface-500 flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="font-medium">Carregando registro de vendas...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Nº Venda</th>
                    <th className="p-4">Comprador</th>
                    <th className="p-4">Forma Pagto</th>
                    <th className="p-4 text-right">Valor Total</th>
                    <th className="p-4">Vendedor</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Data</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                  {vendasFiltradas.length > 0 ? (
                    vendasFiltradas.map(v => {
                      let badgeStatus = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Concluída
                        </span>
                      );

                      if (v.status === 'CANCELAMENTO_SOLICITADO') {
                        badgeStatus = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Cancelamento Solicitado
                          </span>
                        );
                      } else if (v.status === 'CANCELADA') {
                        badgeStatus = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3" /> Cancelada
                          </span>
                        );
                      } else if (v.status === 'DEVOLVIDA_TOTAL' || v.status === 'DEVOLVIDA_PARCIAL') {
                        badgeStatus = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <RefreshCw className="w-3 h-3" /> Devolvida
                          </span>
                        );
                      }

                      return (
                        <tr key={v.id} className="hover:bg-surface-50/60 transition-colors">
                          <td className="p-4 whitespace-nowrap font-mono font-bold text-brand-dark">
                            #{v.numero}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-brand-dark">{v.comprador.nome}</div>
                            <div className="text-[10px] text-surface-400 font-bold uppercase">{v.comprador.tipo}</div>
                          </td>
                          <td className="p-4 whitespace-nowrap font-semibold">
                            {v.forma_pagamento} ({v.condicao === 'A_PRAZO' ? `${v.parcelas?.length}x` : 'À vista'})
                          </td>
                          <td className="p-4 text-right whitespace-nowrap font-bold text-emerald-800 text-sm">
                            R$ {(v.total || 0).toFixed(2)}
                          </td>
                          <td className="p-4 whitespace-nowrap text-surface-600 font-semibold">
                            {v.vendedor_nome}
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            {badgeStatus}
                          </td>
                          <td className="p-4 text-center whitespace-nowrap font-mono text-surface-500">
                            {v.data ? new Date(v.data).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Devolução / Troca (Até 30 dias ou Admin) */}
                              {v.status === 'CONCLUIDA' && pode('vendas.devolver') && (
                                <button
                                  onClick={() => {
                                    setVendaToDevolver(v);
                                    setIsDevolucaoOpen(true);
                                  }}
                                  className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                                  title="Troca / Devolução"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              )}

                              {/* Instrutor solicita cancelamento */}
                              {v.status === 'CONCLUIDA' && pode('vendas.solicitar_cancelamento') && !ehAdmin && (
                                <button
                                  onClick={() => handleSolicitarCancelamento(v)}
                                  className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-lg transition-all"
                                  title="Solicitar Cancelamento"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </button>
                              )}

                              {/* Admin Aprova ou Recusa Cancelamento Solicitado */}
                              {v.status === 'CANCELAMENTO_SOLICITADO' && ehAdmin && (
                                <>
                                  <button
                                    onClick={() => handleAprovarCancelamento(v)}
                                    className="px-2 py-1 bg-red-600 text-white font-bold rounded text-[10px] hover:bg-red-700"
                                  >
                                    Aprovar Cancelamento
                                  </button>
                                  <button
                                    onClick={() => handleRecusarCancelamento(v)}
                                    className="px-2 py-1 bg-surface-200 text-surface-700 font-bold rounded text-[10px] hover:bg-surface-300"
                                  >
                                    Recusar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-surface-400 font-medium">
                        Nenhuma venda encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal PDV Tela Cheia */}
        {isPdvOpen && (
          <PdvVendas
            onClose={() => setIsPdvOpen(false)}
            onSuccess={() => {}}
          />
        )}

        {/* Modal Devolução / Troca */}
        <DevolucaoTrocaModal
          isOpen={isDevolucaoOpen}
          onClose={() => setIsDevolucaoOpen(false)}
          onSuccess={() => {}}
          venda={vendaToDevolver}
        />
      </div>
    </GuardaPagina>
  );
};
