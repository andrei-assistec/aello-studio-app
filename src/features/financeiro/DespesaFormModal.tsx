import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, CheckCircle } from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import { useCollection } from '../../hooks/useFirestore';
import type { PlanoConta } from './PlanoDeContasPage';

export interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  categoria_id?: string;
  valor: number;
  vencimento?: string;
  data_vencimento?: string;
  status: 'pago' | 'pendente' | string;
  forma_pagamento?: string;
  data_pagamento?: number | string | null;
  created_at?: number;
  recorrente?: boolean;
  recorrencia_id?: string;
}

interface DespesaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  despesaToEdit?: Despesa | null;
}

const getInitialPaymentDateStr = (desp?: Despesa | null): string => {
  if (desp?.data_pagamento) {
    if (typeof desp.data_pagamento === 'number') {
      return new Date(desp.data_pagamento).toISOString().split('T')[0];
    }
    if (typeof desp.data_pagamento === 'string' && desp.data_pagamento.length >= 10) {
      return desp.data_pagamento.substring(0, 10);
    }
  }
  return new Date().toISOString().split('T')[0];
};

const addMonthsToDateStr = (dateStr: string, monthsToAdd: number): string => {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  let newMonth = month - 1 + monthsToAdd;
  let newYear = year + Math.floor(newMonth / 12);
  newMonth = ((newMonth % 12) + 12) % 12;

  const maxDays = new Date(newYear, newMonth + 1, 0).getDate();
  const newDay = Math.min(day, maxDays);

  const formattedMonth = String(newMonth + 1).padStart(2, '0');
  const formattedDay = String(newDay).padStart(2, '0');

  return `${newYear}-${formattedMonth}-${formattedDay}`;
};

export const DespesaFormModal: React.FC<DespesaFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  despesaToEdit 
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [recorrente, setRecorrente] = useState(false);
  const [recorrenciaMeses, setRecorrenciaMeses] = useState('12');

  const { data: planoContas } = useCollection<PlanoConta>('plano_contas', 'codigo');
  const categoriasDespesa = planoContas.filter(c => c.ativo && c.tipo === 'despesa');

  const [formData, setFormData] = useState({
    descricao: '',
    categoria_id: '',
    valor: '',
    vencimento: new Date().toISOString().split('T')[0],
    data_pagamento: new Date().toISOString().split('T')[0],
    status: 'pendente' as Despesa['status'],
    forma_pagamento: '-'
  });

  useEffect(() => {
    if (despesaToEdit) {
      setFormData({
        descricao: despesaToEdit.descricao || '',
        categoria_id: despesaToEdit.categoria_id || '',
        valor: despesaToEdit.valor?.toString() || '',
        vencimento: despesaToEdit.vencimento || despesaToEdit.data_vencimento || new Date().toISOString().split('T')[0],
        data_pagamento: getInitialPaymentDateStr(despesaToEdit),
        status: despesaToEdit.status || 'pendente',
        forma_pagamento: (despesaToEdit as any).forma_pagamento || '-'
      });
      setRecorrente(false);
      setRecorrenciaMeses('12');
    } else {
      setFormData({
        descricao: '',
        categoria_id: categoriasDespesa[0]?.id || '',
        valor: '',
        vencimento: new Date().toISOString().split('T')[0],
        data_pagamento: new Date().toISOString().split('T')[0],
        status: 'pendente',
        forma_pagamento: '-'
      });
      setRecorrente(false);
      setRecorrenciaMeses('12');
    }
  }, [despesaToEdit, isOpen, planoContas]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.descricao.trim()) {
      alert("Por favor, informe a descrição da despesa.");
      return;
    }

    if (formData.status === 'pago' && formData.forma_pagamento === '-') {
      alert("Por favor, selecione a Forma de Pagamento para declarar como Quitado.");
      return;
    }

    setIsSaving(true);
    try {
      const selectedCat = planoContas.find(c => c.id === formData.categoria_id);
      const categoriaNome = selectedCat ? selectedCat.nome : 'Outros';

      const baseData: any = {
        descricao: formData.descricao.trim(),
        categoria: categoriaNome,
        categoria_id: formData.categoria_id,
        valor: parseFloat(formData.valor) || 0,
        vencimento: formData.vencimento,
        data_vencimento: formData.vencimento,
        status: formData.status,
        forma_pagamento: formData.status === 'pago' ? formData.forma_pagamento : '-',
        data_pagamento: formData.status === 'pago' ? new Date(formData.data_pagamento + 'T12:00:00').getTime() : null,
      };

      if (despesaToEdit) {
        await updateDoc(doc(db, 'despesas', despesaToEdit.id), baseData);
        await logActivity({
          action: 'UPDATE',
          resource_type: 'prescricao',
          details: `Atualizou despesa "${baseData.descricao}" - R$ ${baseData.valor.toFixed(2)}`
        });
      } else {
        if (recorrente) {
          const totalMeses = parseInt(recorrenciaMeses, 10) || 12;
          const recId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

          for (let i = 0; i < totalMeses; i++) {
            const nextVenc = addMonthsToDateStr(formData.vencimento, i);
            const itemData: any = {
              ...baseData,
              vencimento: nextVenc,
              data_vencimento: nextVenc,
              recorrente: true,
              recorrencia_id: recId,
              created_at: Date.now()
            };
            if (i > 0) {
              itemData.status = 'pendente';
              itemData.forma_pagamento = '-';
              itemData.data_pagamento = null;
            }
            await addDoc(collection(db, 'despesas'), itemData);
          }
          await logActivity({
            action: 'CREATE',
            resource_type: 'prescricao',
            details: `Lançou despesa recorrente "${baseData.descricao}" por ${totalMeses} meses`
          });
        } else {
          await addDoc(collection(db, 'despesas'), {
            ...baseData,
            created_at: Date.now()
          });
          await logActivity({
            action: 'CREATE',
            resource_type: 'prescricao',
            details: `Lançou despesa "${baseData.descricao}" - R$ ${baseData.valor.toFixed(2)}`
          });
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error("Erro ao salvar despesa:", err);
      alert("Erro ao salvar despesa: " + (err.message || err.toString()));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-brand-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Modal Horizontal Amplo (max-w-3xl) */}
      <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-surface-200 animate-slide-up flex flex-col max-h-[92vh]">
        {/* Header Compacto */}
        <div className="p-3.5 px-5 border-b border-surface-150 flex justify-between items-center bg-surface-50">
          <h3 className="text-lg font-display font-bold text-brand-dark">
            {despesaToEdit ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Horizontal */}
        <form onSubmit={handleSave} className="p-4 px-5 space-y-3 overflow-y-auto custom-scrollbar flex-1">
          {/* Linha 1: Descrição e Categoria lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-7">
              <label className="block text-xs font-semibold text-brand-dark mb-1">
                Descrição da Despesa <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                name="descricao"
                required
                value={formData.descricao}
                onChange={handleChange}
                className="input-field py-1.5 text-xs"
                placeholder="Ex: Aluguel do Studio, Luz RGE, Internet..."
              />
            </div>

            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-brand-dark mb-1">Categoria (Plano de Contas)</label>
              <select 
                name="categoria_id"
                value={formData.categoria_id}
                onChange={handleChange}
                className="input-field py-1.5 text-xs"
              >
                <option value="">Selecione uma conta...</option>
                {categoriasDespesa.map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Valor, Vencimento e Status Lado a Lado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-dark mb-1">
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <input 
                type="number" 
                name="valor"
                required
                step="0.01"
                value={formData.valor}
                onChange={handleChange}
                className="input-field py-1.5 text-xs font-bold text-red-600"
                placeholder="250,00"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-dark mb-1">Vencimento</label>
              <input 
                type="date" 
                name="vencimento"
                required
                value={formData.vencimento}
                onChange={handleChange}
                className="input-field py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-dark mb-1">Status</label>
              <select 
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input-field py-1.5 text-xs font-semibold"
              >
                <option value="pendente">A Pagar</option>
                <option value="pago">Pago (Quitado)</option>
              </select>
            </div>
          </div>

          {/* Se Pago: Dados de Liquidação Horizontal */}
          {formData.status === 'pago' && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 animate-fade-in">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px] uppercase tracking-wide">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Dados do Pagamento / Quitação
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">
                    Data do Pagamento <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="date" 
                    name="data_pagamento"
                    required
                    value={formData.data_pagamento}
                    onChange={handleChange}
                    className="input-field py-1 bg-white border-emerald-300 font-semibold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">
                    Espécie / Forma PGTO <span className="text-red-500">*</span>
                  </label>
                  <select 
                    name="forma_pagamento"
                    required
                    value={formData.forma_pagamento}
                    onChange={handleChange}
                    className="input-field py-1 bg-white border-emerald-300 font-semibold text-xs"
                  >
                    <option value="-">-- Selecione a Espécie --</option>
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão Crédito">Cartão de Crédito</option>
                    <option value="Cartão Débito">Cartão de Débito</option>
                    <option value="Transferência Bancária">Transferência Bancária</option>
                    <option value="Boleto">Boleto</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Opção Recorrente Horizontal */}
          {!despesaToEdit && (
            <div className="bg-surface-50 p-3 rounded-xl border border-surface-150 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-surface-300 rounded focus:ring-red-500"
                />
                <span className="text-xs font-semibold text-brand-dark">Repetir mensalmente (Despesa Fixa Recorrente)</span>
              </label>

              {recorrente && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-surface-600">Repetir por:</span>
                  <select 
                    value={recorrenciaMeses}
                    onChange={(e) => setRecorrenciaMeses(e.target.value)}
                    className="bg-white border border-surface-200 rounded-lg px-2.5 py-1 text-xs font-bold text-brand-dark focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="3">3 meses</option>
                    <option value="6">6 meses</option>
                    <option value="12">12 meses (1 ano)</option>
                    <option value="24">24 meses (2 anos)</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex gap-2.5 justify-end pt-3 border-t border-surface-150">
            <button 
              type="button"
              onClick={onClose}
              className="btn-secondary py-1.5 text-xs"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="btn-primary py-1.5 text-xs bg-red-600 hover:bg-red-700 shadow-red-600/10 flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Salvar Conta a Pagar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default DespesaFormModal;
