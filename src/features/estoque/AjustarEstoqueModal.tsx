import React, { useState } from 'react';
import { X, Save, Loader2, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import type { Produto, TipoMovimentoEstoque } from '../../types/estoque';
import { registrarMovimentoEstoque } from '../../lib/estoque/movimentos';
import { useAuth } from '../../hooks/useAuth';

interface AjustarEstoqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  produto: Produto | null;
}

export const AjustarEstoqueModal: React.FC<AjustarEstoqueModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  produto
}) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [tipo, setTipo] = useState<TipoMovimentoEstoque>('ENTRADA_AJUSTE');
  const [qtd, setQtd] = useState('1');
  const [novoCusto, setNovoCusto] = useState(produto ? String(produto.custo_medio || 0) : '0');
  const [observacao, setObservacao] = useState('');

  if (!isOpen || !produto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtdNum = parseInt(qtd, 10) || 0;
    const custoNum = parseFloat(novoCusto) || (produto.custo_medio || 0);

    if (tipo !== 'AJUSTE_CUSTO' && qtdNum <= 0) {
      alert('Informe uma quantidade válida maior que zero.');
      return;
    }
    if (!observacao.trim()) {
      alert('Por favor, informe a justificativa do ajuste para o histórico de auditoria.');
      return;
    }

    setIsSaving(true);
    try {
      await registrarMovimentoEstoque({
        produtoId: produto.id,
        tipo,
        qtd: tipo === 'AJUSTE_CUSTO' ? 0 : qtdNum,
        custoUnit: custoNum,
        origemTipo: 'AJUSTE_INVENTARIO',
        origemId: produto.id,
        usuarioId: user?.uid,
        usuarioNome: user?.displayName || user?.email || 'Admin',
        observacao: observacao.trim()
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao ajustar estoque:', error);
      alert('Ocorreu um erro ao registrar o ajuste.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-surface-200">
        <div className="flex items-center justify-between p-6 bg-surface-50 border-b border-surface-200">
          <div>
            <h3 className="text-base font-bold text-brand-dark">Ajuste de Estoque / Inventário</h3>
            <p className="text-xs text-surface-500 font-medium">#{produto.codigo} — {produto.descricao}</p>
          </div>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-surface-50 rounded-xl flex items-center justify-between text-xs font-semibold">
            <span className="text-surface-600">Saldo Atual em Estoque:</span>
            <span className="font-mono text-sm font-bold text-brand-dark">{produto.saldo} UN</span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
              Tipo de Ajuste
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTipo('ENTRADA_AJUSTE')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  tipo === 'ENTRADA_AJUSTE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-500 shadow-sm'
                    : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                Entrada (+)
              </button>
              <button
                type="button"
                onClick={() => setTipo('SAIDA_AJUSTE')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  tipo === 'SAIDA_AJUSTE'
                    ? 'bg-red-50 text-red-800 border-red-500 shadow-sm'
                    : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 text-red-600" />
                Perda / Saída (−)
              </button>
              <button
                type="button"
                onClick={() => setTipo('AJUSTE_CUSTO')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                  tipo === 'AJUSTE_CUSTO'
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-500 shadow-sm'
                    : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                }`}
              >
                <RefreshCw className="w-4 h-4 text-indigo-600" />
                Corrigir Custo
              </button>
            </div>
          </div>

          {tipo !== 'AJUSTE_CUSTO' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                required
                value={qtd}
                onChange={e => setQtd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
              {tipo === 'AJUSTE_CUSTO' ? 'Novo Custo Médio Unitário (R$)' : 'Custo Unitário da Unidade (R$)'}
            </label>
            <input
              type="number"
              step="0.01"
              value={novoCusto}
              onChange={e => setNovoCusto(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
              Justificativa / Motivo *
            </label>
            <textarea
              required
              rows={2}
              placeholder="Ex: Contagem física de estoque, avaria na peça, acerto inicial..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
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
              disabled={isSaving}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Confirmar Ajuste
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
