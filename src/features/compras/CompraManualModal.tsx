import React, { useState } from 'react';
import { X, Save, Loader2, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Produto, Fornecedor } from '../../types/estoque';
import type { ParcelaCompra } from '../../types/compras';
import { registrarMovimentoEstoque } from '../../lib/estoque/movimentos';
import { criarDespesaCompra } from '../../services/financeiroHandler';
import { useAuth } from '../../hooks/useAuth';

interface CompraManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  produtos: Produto[];
  fornecedores: Fornecedor[];
}

interface ItemManualLocal {
  produto_id: string;
  qtd: number;
  custo_unit: number;
}

export const CompraManualModal: React.FC<CompraManualModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  produtos,
  fornecedores
}) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [fornecedorId, setFornecedorId] = useState('');
  const [numeroNota, setNumeroNota] = useState('');
  const [itens, setItens] = useState<ItemManualLocal[]>([]);
  
  // Parcela única por padrão
  const todayStr = new Date().toISOString().slice(0, 10);
  const [parcelas, setParcelas] = useState<ParcelaCompra[]>([
    { numero: 1, vencimento: todayStr, valor: 0 }
  ]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    if (produtos.length === 0) return;
    setItens([...itens, { produto_id: produtos[0].id, qtd: 1, custo_unit: produtos[0].custo_medio || 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ItemManualLocal, val: any) => {
    const clone = [...itens];
    (clone[index] as any)[field] = val;
    setItens(clone);
  };

  const valorTotalProdutos = itens.reduce((acc, i) => acc + (i.qtd * i.custo_unit), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fornecedorId) {
      alert('Selecione um fornecedor.');
      return;
    }
    if (itens.length === 0) {
      alert('Adicione pelo menos 1 produto na compra.');
      return;
    }

    const fornecedorObj = fornecedores.find(f => f.id === fornecedorId);
    if (!fornecedorObj) return;

    setIsSaving(true);
    try {
      // 1. Registra os movimentos de entrada no estoque
      for (const item of itens) {
        await registrarMovimentoEstoque({
          produtoId: item.produto_id,
          tipo: 'ENTRADA_COMPRA',
          qtd: item.qtd,
          custoUnit: item.custo_unit,
          origemTipo: 'COMPRA',
          origemId: numeroNota || 'MANUAL',
          usuarioId: user?.uid,
          usuarioNome: user?.displayName || user?.email || 'Admin',
          observacao: `Compra Manual ${numeroNota ? `#${numeroNota}` : ''} (${fornecedorObj.razao_social})`
        });
      }

      // 2. Lança despesas a pagar para as parcelas via evento PAGAR_CRIAR
      const despesasIds: string[] = [];
      const valorParcelaUnica = valorTotalProdutos / (parcelas.length || 1);

      for (let i = 0; i < parcelas.length; i++) {
        const p = parcelas[i];
        const valParc = p.valor > 0 ? p.valor : Math.round(valorParcelaUnica * 100) / 100;

        const dId = await criarDespesaCompra({
          descricao: `Compra Manual ${numeroNota ? `#${numeroNota}` : ''} — ${fornecedorObj.razao_social} (${i + 1}/${parcelas.length})`,
          valor: valParc,
          vencimento: p.vencimento || todayStr,
          formaPagamento: 'Boleto'
        });
        despesasIds.push(dId);
      }

      // 4. Salva o registro de compra
      await addDoc(collection(db, 'compras'), {
        numero_nota: numeroNota.trim() || undefined,
        fornecedor_id: fornecedorObj.id,
        fornecedor_nome: fornecedorObj.razao_social,
        fornecedor_cnpj: fornecedorObj.cnpj || '',

        itens: itens.map(i => {
          const prodObj = produtos.find(p => p.id === i.produto_id);
          return {
            produto_id: i.produto_id,
            descricao_origem: prodObj?.descricao || 'Produto',
            qtd: i.qtd,
            valor_unitario: i.custo_unit,
            rateio_frete_desconto: i.custo_unit,
            valor_total: i.qtd * i.custo_unit,
            vinculado: true
          };
        }),

        valor_produtos: valorTotalProdutos,
        valor_frete: 0,
        valor_seguro: 0,
        valor_desconto: 0,
        valor_total: valorTotalProdutos,

        parcelas: parcelas.map((p, idx) => ({
          numero: idx + 1,
          vencimento: p.vencimento || todayStr,
          valor: p.valor > 0 ? p.valor : Math.round(valorParcelaUnica * 100) / 100
        })),

        status: 'CONFIRMADA',
        origem: 'MANUAL',
        despesas_ids: despesasIds,

        created_at: Date.now(),
        created_by: user?.email || 'Admin'
      });

      alert('Compra manual registrada com sucesso! Estoque e contas a pagar atualizados.');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao registrar compra manual:', err);
      alert('Erro ao registrar a compra manual.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-surface-200 my-8">
        <div className="flex items-center justify-between p-6 bg-surface-50 border-b border-surface-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-brand-dark">Nova Compra Manual (Sem XML)</h2>
              <p className="text-xs text-surface-500 font-medium">Lançamento direto de reposição com entrada no estoque e despesas contábeis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Cabeçalho */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Fornecedor *
              </label>
              <select
                required
                value={fornecedorId}
                onChange={e => setFornecedorId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Selecione o Fornecedor --</option>
                {fornecedores.map(f => (
                  <option key={f.id} value={f.id}>{f.razao_social} (CNPJ: {f.cnpj})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Nº Nota / Comprovante (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: NF 1234"
                value={numeroNota}
                onChange={e => setNumeroNota(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-surface-600">Itens da Compra</h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {itens.map((item, idx) => (
                <div key={idx} className="p-3 bg-surface-50 rounded-xl border border-surface-200 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={item.produto_id}
                      onChange={e => handleItemChange(idx, 'produto_id', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-surface-300 rounded-lg bg-white font-semibold"
                    >
                      {produtos.map(p => (
                        <option key={p.id} value={p.id}>
                          #{p.codigo} - {p.descricao} (Atual: R$ {p.custo_medio.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qtd"
                      value={item.qtd}
                      onChange={e => handleItemChange(idx, 'qtd', parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2 py-1.5 text-xs border border-surface-300 rounded-lg text-center bg-white font-bold"
                    />
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Custo Unit (R$)"
                      value={item.custo_unit}
                      onChange={e => handleItemChange(idx, 'custo_unit', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 text-xs border border-surface-300 rounded-lg text-right bg-white font-mono"
                    />
                  </div>

                  <div className="w-28 text-right font-mono font-bold text-emerald-800 text-xs">
                    R$ {(item.qtd * item.custo_unit).toFixed(2)}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="text-right mt-3 text-sm font-bold text-brand-dark">
              Total dos Produtos: <span className="text-emerald-700 text-base font-black">R$ {valorTotalProdutos.toFixed(2)}</span>
            </div>
          </div>

          {/* Vencimento da Despesa */}
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-600">Vencimento da Conta a Pagar</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-surface-600 mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  value={parcelas[0]?.vencimento || todayStr}
                  onChange={e => setParcelas([{ numero: 1, vencimento: e.target.value, valor: valorTotalProdutos }])}
                  className="w-full px-3 py-1.5 text-sm border border-surface-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-surface-600 hover:bg-surface-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || itens.length === 0}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Confirmar Compra
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
