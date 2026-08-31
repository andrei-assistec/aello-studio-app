import React, { useState } from 'react';
import { ShoppingBag, Upload, Plus, FileText, CheckCircle2, AlertTriangle, Loader2, DollarSign } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { GuardaPagina } from '../../components/acl/GuardaPagina';
import type { Compra } from '../../types/compras';
import type { Produto, Fornecedor } from '../../types/estoque';
import { ComprarXmlModal } from './ComprarXmlModal';
import { CompraManualModal } from './CompraManualModal';

export const ComprasList: React.FC = () => {
  const { data: compras, loading } = useCollection<Compra>('compras');
  const { data: produtos } = useCollection<Produto>('produtos');
  const { data: fornecedores } = useCollection<Fornecedor>('fornecedores');

  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const totalCompras = compras?.length || 0;
  const totalInvestido = compras?.reduce((acc, c) => acc + (c.valor_total || 0), 0) || 0;

  return (
    <GuardaPagina pode="compras.ver">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-brand-dark tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-indigo-600" /> Gestão de Compras & NF-e
            </h1>
            <p className="text-sm text-surface-500 font-medium">
              Entrada de mercadorias com autoaprendizado de De-Para e geração de contas a pagar
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-surface-200 hover:bg-surface-50 text-surface-700 font-bold text-sm rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 text-emerald-600" /> Nova Compra Manual
            </button>

            <button
              onClick={() => setIsXmlModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
            >
              <Upload className="w-4 h-4" /> Importar XML NF-e
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Notas & Entradas Registradas</p>
              <h3 className="text-2xl font-black text-brand-dark mt-1">{totalCompras}</h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Total Investido em Reposição</p>
              <h3 className="text-2xl font-black text-emerald-800 mt-1">R$ {totalInvestido.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tabela de Compras */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-surface-500 flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="font-medium">Carregando histórico de compras...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                    <th className="p-4">Origem</th>
                    <th className="p-4">Nº Nota / Doc</th>
                    <th className="p-4">Fornecedor</th>
                    <th className="p-4 text-center">Itens</th>
                    <th className="p-4 text-right">Valor Total</th>
                    <th className="p-4 text-center">Parcelas</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                  {compras && compras.length > 0 ? (
                    compras.map(c => (
                      <tr key={c.id} className="hover:bg-surface-50/60 transition-colors">
                        <td className="p-4 whitespace-nowrap font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            c.origem === 'XML' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-surface-100 text-surface-700'
                          }`}>
                            {c.origem || 'MANUAL'}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap font-mono font-bold text-brand-dark">
                          {c.numero_nota ? `#${c.numero_nota}` : '-'}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-brand-dark">{c.fornecedor_nome}</div>
                          <div className="text-[10px] text-surface-400 font-mono">{c.fornecedor_cnpj}</div>
                        </td>
                        <td className="p-4 text-center font-bold">
                          {c.itens?.length || 0}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap font-bold text-emerald-800 text-sm">
                          R$ {(c.valor_total || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <span className="bg-surface-100 px-2 py-0.5 rounded text-surface-600 font-semibold">
                            {c.parcelas?.length || 1}x
                          </span>
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          {c.status === 'CONFIRMADA' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Confirmada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Pendente Vínculo
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap text-surface-500 font-mono">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-surface-400 font-medium">
                        Nenhuma compra ou nota fiscal registrada até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modais */}
        <ComprarXmlModal
          isOpen={isXmlModalOpen}
          onClose={() => setIsXmlModalOpen(false)}
          onSuccess={() => {}}
          produtos={produtos || []}
          fornecedores={fornecedores || []}
        />

        <CompraManualModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          onSuccess={() => {}}
          produtos={produtos || []}
          fornecedores={fornecedores || []}
        />
      </div>
    </GuardaPagina>
  );
};
