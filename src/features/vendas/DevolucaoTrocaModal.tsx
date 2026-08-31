import React, { useState } from 'react';
import { X, RefreshCw, CreditCard, DollarSign, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Venda } from '../../types/vendas';
import { usePermissao } from '../../hooks/usePermissao';
import { registrarMovimentoEstoque } from '../../lib/estoque/movimentos';
import { criarDespesaEstorno } from '../../services/financeiroHandler';

interface DevolucaoTrocaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  venda: Venda | null;
}

export const DevolucaoTrocaModal: React.FC<DevolucaoTrocaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  venda
}) => {
  const { pode, ehAdmin, userUid } = usePermissao();
  const [isProcessing, setIsProcessing] = useState(false);
  const [tipoDestino, setTipoDestino] = useState<'CREDITO' | 'ESTORNO_DINHEIRO'>('CREDITO');
  const [observacao, setObservacao] = useState('');

  if (!isOpen || !venda) return null;

  const diasPassados = Math.floor((Date.now() - venda.data) / (1000 * 60 * 60 * 24));
  const passouPrazo30Dias = diasPassados > 30;

  const handleProcessarDevolucao = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passouPrazo30Dias && !ehAdmin) {
      alert('A venda ultrapassou o prazo de 30 dias para devolução. Exige autorização da Adriana (Admin).');
      return;
    }

    if (tipoDestino === 'ESTORNO_DINHEIRO' && !pode('financeiro.estorno')) {
      alert('Apenas administradores possuem permissão para devolver dinheiro (estorno em espécie).');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Devolução dos itens ao estoque (ENTRADA_DEVOLUCAO)
      for (const item of venda.itens) {
        await registrarMovimentoEstoque({
          produtoId: item.produto_id,
          tipo: 'ENTRADA_DEVOLUCAO',
          qtd: item.qtd,
          custoUnit: item.custo_unit_snapshot,
          origemTipo: 'DEVOLUCAO',
          origemId: String(venda.numero),
          usuarioId: userUid || undefined,
          observacao: `Devolução Venda #${venda.numero}: ${observacao}`
        });
      }

      // 2. Destino do valor devolvido
      if (tipoDestino === 'CREDITO') {
        // Concede Crédito na Loja
        await addDoc(collection(db, 'creditos'), {
          comprador: venda.comprador,
          valor_original: venda.total,
          valor_usado: 0,
          valor_disponivel: venda.total,
          origem_venda_id: venda.id,
          concedido_por: userUid || 'Admin',
          concedido_em: Date.now(),
          ativo: true
        });
      } else {
        // Lança Despesa de Estorno via evento
        await criarDespesaEstorno({
          descricao: `Estorno em Espécie — Venda #${venda.numero} (${venda.comprador.nome})`,
          valor: venda.total,
          vencimento: new Date().toISOString().slice(0, 10),
          formaPagamento: venda.forma_pagamento
        });
      }

      // 3. Atualiza status da Venda
      await updateDoc(doc(db, 'vendas', venda.id), {
        status: 'DEVOLVIDA_TOTAL',
        updated_at: Date.now()
      });

      alert(`Devolução da Venda #${venda.numero} processada com sucesso!`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao processar devolução:', err);
      alert('Ocorreu um erro ao registrar a devolução.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-surface-200">
        <div className="flex items-center justify-between p-6 bg-surface-50 border-b border-surface-200">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-brand-dark">Devolução / Troca — Venda #{venda.numero}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleProcessarDevolucao} className="p-6 space-y-4">
          <div className="p-3 bg-surface-50 rounded-xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-surface-500 font-semibold">Comprador:</span>
              <span className="font-bold text-brand-dark">{venda.comprador.nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500 font-semibold">Valor da Venda:</span>
              <span className="font-bold text-emerald-700">R$ {venda.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500 font-semibold">Data da Compra:</span>
              <span>{new Date(venda.data).toLocaleDateString('pt-BR')} ({diasPassados} dias atrás)</span>
            </div>
          </div>

          {passouPrazo30Dias && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Atenção ao Prazo (30 Dias):</strong> Esta venda possui {diasPassados} dias. A devolução fora do prazo exige liberação administrativa.
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
              Destino do Valor Reembolsado
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipoDestino('CREDITO')}
                className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                  tipoDestino === 'CREDITO'
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-500 shadow-sm'
                    : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                }`}
              >
                <CreditCard className="w-5 h-5 text-indigo-600" />
                Crédito na Loja
                <span className="text-[10px] font-normal text-surface-500 text-center">Para próximas compras no studio</span>
              </button>

              {pode('financeiro.estorno') && (
                <button
                  type="button"
                  onClick={() => setTipoDestino('ESTORNO_DINHEIRO')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                    tipoDestino === 'ESTORNO_DINHEIRO'
                      ? 'bg-red-50 text-red-800 border-red-500 shadow-sm'
                      : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                  }`}
                >
                  <DollarSign className="w-5 h-5 text-red-600" />
                  Devolver Dinheiro
                  <span className="text-[10px] font-normal text-surface-500 text-center">Exclusivo Admin</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
              Motivo da Devolução / Observação
            </label>
            <textarea
              rows={2}
              required
              placeholder="Ex: Tamanho não serviu, defeito na costura, desistência..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

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
              disabled={isProcessing}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar Devolução
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
