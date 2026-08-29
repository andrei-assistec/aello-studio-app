import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, CheckCircle, Tag, Layers } from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection } from '../../hooks/useFirestore';
import { logActivity } from '../../services/logger';
import type { Aluno } from '../../types/database';
import { getPlanosDoAluno } from '../../types/database';
import type { PlanoConta } from './PlanoDeContasPage';

export interface Receita {
  id: string;
  aluno_id?: string;
  aluno_nome?: string;
  descricao?: string;
  plano?: string;
  categoria_id?: string;
  valor: number;
  valor_original?: number;
  tem_desconto?: boolean;
  justificativa_desconto?: string;
  vencimento?: string;
  data_vencimento?: string;
  status: 'pago' | 'pendente' | 'atrasado' | string;
  forma_pagamento?: string;
  data_pagamento?: number | string;
  created_at?: number;
}

interface ReceitaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  receitaToEdit?: Receita | null;
  initialIsAvulsa?: boolean;
}

const getInitialPaymentDateStr = (rec?: Receita | null): string => {
  if (rec?.data_pagamento) {
    if (typeof rec.data_pagamento === 'number') {
      return new Date(rec.data_pagamento).toISOString().split('T')[0];
    }
    if (typeof rec.data_pagamento === 'string' && rec.data_pagamento.length >= 10) {
      return rec.data_pagamento.substring(0, 10);
    }
  }
  return new Date().toISOString().split('T')[0];
};

export const ReceitaFormModal: React.FC<ReceitaFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  receitaToEdit,
  initialIsAvulsa = false
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isAvulsa, setIsAvulsa] = useState(initialIsAvulsa);
  const [descricaoAvulsa, setDescricaoAvulsa] = useState('');
  const { data: alunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: todasReceitas } = useCollection<Receita>('receitas');

  const { data: planoContas } = useCollection<PlanoConta>('plano_contas', 'codigo');
  const categoriasReceita = planoContas.filter(c => c.ativo && c.tipo === 'receita');

  const [formData, setFormData] = useState({
    aluno_id: '',
    plano: 'Plano Mensal',
    categoria_id: '',
    valor: '',
    valor_original: '',
    tem_desconto: false,
    justificativa_desconto: '',
    vencimento: new Date().toISOString().split('T')[0],
    data_pagamento: new Date().toISOString().split('T')[0],
    status: 'pendente' as Receita['status'],
    forma_pagamento: '-'
  });

  const [pendentesDoAluno, setPendentesDoAluno] = useState<Receita[]>([]);
  const [selectedReceitaPendenteId, setSelectedReceitaPendenteId] = useState<string>('');

  useEffect(() => {
    if (receitaToEdit) {
      const isAvulsaEdit = !receitaToEdit.aluno_id;
      setIsAvulsa(isAvulsaEdit);
      if (isAvulsaEdit) {
        setDescricaoAvulsa(receitaToEdit.descricao || receitaToEdit.aluno_nome || '');
      }
      const temDesc = Boolean(receitaToEdit.tem_desconto || receitaToEdit.justificativa_desconto);
      setFormData({
        aluno_id: receitaToEdit.aluno_id || '',
        plano: receitaToEdit.plano || 'Plano Mensal',
        categoria_id: receitaToEdit.categoria_id || '',
        valor: receitaToEdit.valor?.toString() || '',
        valor_original: receitaToEdit.valor_original?.toString() || receitaToEdit.valor?.toString() || '',
        tem_desconto: temDesc,
        justificativa_desconto: receitaToEdit.justificativa_desconto || '',
        vencimento: receitaToEdit.vencimento || receitaToEdit.data_vencimento || new Date().toISOString().split('T')[0],
        data_pagamento: getInitialPaymentDateStr(receitaToEdit),
        status: receitaToEdit.status || 'pendente',
        forma_pagamento: receitaToEdit.forma_pagamento || '-'
      });
      setSelectedReceitaPendenteId(receitaToEdit.id);
    } else {
      setIsAvulsa(initialIsAvulsa);
      setDescricaoAvulsa('');
      setFormData({
        aluno_id: '',
        plano: initialIsAvulsa ? 'Receita Avulsa' : 'Plano Mensal',
        categoria_id: categoriasReceita.find(c => c.codigo === '1.1')?.id || categoriasReceita[0]?.id || '',
        valor: '',
        valor_original: '',
        tem_desconto: false,
        justificativa_desconto: '',
        vencimento: new Date().toISOString().split('T')[0],
        data_pagamento: new Date().toISOString().split('T')[0],
        status: 'pendente',
        forma_pagamento: '-'
      });
      setPendentesDoAluno([]);
      setSelectedReceitaPendenteId('');
    }
  }, [receitaToEdit, isOpen, initialIsAvulsa, planoContas]);

  const handleAlunoChange = (alunoId: string) => {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) {
      setFormData(prev => ({ ...prev, aluno_id: '' }));
      setPendentesDoAluno([]);
      return;
    }

    const pendentes = todasReceitas.filter(r => r.aluno_id === alunoId && r.status !== 'pago');
    setPendentesDoAluno(pendentes);

    if (pendentes.length > 0 && !receitaToEdit) {
      const p = pendentes[0];
      setSelectedReceitaPendenteId(p.id);
      setFormData(prev => ({
        ...prev,
        aluno_id: alunoId,
        plano: p.plano || prev.plano,
        categoria_id: p.categoria_id || prev.categoria_id,
        valor: p.valor?.toString() || prev.valor,
        valor_original: p.valor_original?.toString() || p.valor?.toString() || prev.valor_original,
        tem_desconto: Boolean(p.tem_desconto || p.justificativa_desconto),
        justificativa_desconto: p.justificativa_desconto || '',
        vencimento: p.vencimento || p.data_vencimento || prev.vencimento
      }));
    } else {
      setSelectedReceitaPendenteId('');
      setFormData(prev => ({ ...prev, aluno_id: alunoId }));
    }
  };

  const handleSelectReceitaPendente = (recId: string) => {
    setSelectedReceitaPendenteId(recId);
    if (!recId) return;
    const p = pendentesDoAluno.find(item => item.id === recId);
    if (p) {
      setFormData(prev => ({
        ...prev,
        plano: p.plano || prev.plano,
        categoria_id: p.categoria_id || prev.categoria_id,
        valor: p.valor?.toString() || prev.valor,
        valor_original: p.valor_original?.toString() || p.valor?.toString() || prev.valor_original,
        tem_desconto: Boolean(p.tem_desconto || p.justificativa_desconto),
        justificativa_desconto: p.justificativa_desconto || '',
        vencimento: p.vencimento || p.data_vencimento || prev.vencimento
      }));
    }
  };

  const handlePlanoChange = (planoNome: string) => {
    setFormData(prev => ({ ...prev, plano: planoNome }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'valor' && !prev.tem_desconto) {
        next.valor_original = value;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAvulsa && !descricaoAvulsa.trim()) {
      alert("Por favor, preencha a descrição da receita avulsa.");
      return;
    }

    if (!isAvulsa && !formData.aluno_id) {
      alert("Por favor, selecione um aluno.");
      return;
    }

    if (formData.status === 'pago' && formData.forma_pagamento === '-') {
      alert("Por favor, selecione a Forma de Pagamento para declarar como Pago.");
      return;
    }

    if (formData.tem_desconto && !formData.justificativa_desconto.trim()) {
      alert("Por favor, preencha a justificativa do desconto concedido.");
      return;
    }

    setIsSaving(true);
    try {
      let alunoNome = 'Receita Avulsa';
      if (!isAvulsa) {
        const aluno = alunos.find(a => a.id === formData.aluno_id);
        alunoNome = aluno ? `${aluno.nome} ${aluno.sobrenome || ''}`.trim() : 'Aluno Não Identificado';
      } else {
        alunoNome = descricaoAvulsa.trim();
      }

      const valFinal = parseFloat(formData.valor) || 0;
      const valOriginal = formData.tem_desconto ? (parseFloat(formData.valor_original) || valFinal) : valFinal;

      const parsedData: any = {
        aluno_id: isAvulsa ? "" : formData.aluno_id,
        aluno_nome: alunoNome,
        descricao: isAvulsa ? descricaoAvulsa.trim() : "",
        plano: isAvulsa ? "Receita Avulsa" : formData.plano,
        categoria_id: formData.categoria_id,
        valor: valFinal,
        valor_original: valOriginal,
        tem_desconto: Boolean(formData.tem_desconto),
        justificativa_desconto: formData.tem_desconto ? formData.justificativa_desconto.trim() : "",
        vencimento: formData.vencimento,
        data_vencimento: formData.vencimento,
        status: formData.status,
        forma_pagamento: formData.status === 'pago' ? formData.forma_pagamento : '-',
        data_pagamento: formData.status === 'pago' ? new Date(formData.data_pagamento + 'T12:00:00').getTime() : null
      };

      const targetId = selectedReceitaPendenteId || receitaToEdit?.id;

      if (targetId) {
        await updateDoc(doc(db, 'receitas', targetId), parsedData);
        await logActivity({
          action: 'UPDATE',
          resource_type: 'prescricao',
          details: `Atualizou recebimento de ${parsedData.aluno_nome} - R$ ${parsedData.valor.toFixed(2)}${formData.tem_desconto ? ` (Desconto: ${formData.justificativa_desconto})` : ''}`
        });
      } else {
        await addDoc(collection(db, 'receitas'), {
          ...parsedData,
          created_at: Date.now()
        });
        await logActivity({
          action: 'CREATE',
          resource_type: 'prescricao',
          details: `Registrou nova conta a receber para ${parsedData.aluno_nome} - R$ ${parsedData.valor.toFixed(2)}${formData.tem_desconto ? ` (Desconto: ${formData.justificativa_desconto})` : ''}`
        });
      }
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao salvar receita:", error);
      alert("Erro ao salvar dados: " + (error.message || error.toString()));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-brand-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Modal Horizontal Amplo (max-w-3xl para caber confortavelmente sem rolar) */}
      <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-surface-200 animate-slide-up flex flex-col max-h-[92vh]">
        
        {/* Header Compacto */}
        <div className="p-3.5 px-5 border-b border-surface-150 flex justify-between items-center bg-surface-50">
          <h3 className="text-lg font-display font-bold text-brand-dark">
            {receitaToEdit ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Horizontal */}
        <form onSubmit={handleSubmit} className="p-4 px-5 space-y-3 overflow-y-auto custom-scrollbar flex-1">

          {/* Linha 1: Seletor de Tipo (Aluno vs Avulsa) + Campo de Aluno/Descrição lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-surface-500 mb-1">Tipo de Lançamento</label>
              <div className="flex items-center gap-1 p-1 bg-surface-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsAvulsa(false);
                    setFormData(prev => ({ ...prev, aluno_id: '' }));
                  }}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    !isAvulsa ? 'bg-white shadow text-brand-dark font-extrabold' : 'text-surface-500 hover:text-brand-dark'
                  }`}
                >
                  <span>👤 Mensalidade</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAvulsa(true);
                    setFormData(prev => ({ ...prev, aluno_id: '', plano: 'Receita Avulsa' }));
                    setPendentesDoAluno([]);
                  }}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    isAvulsa ? 'bg-white shadow text-brand-dark font-extrabold' : 'text-surface-500 hover:text-brand-dark'
                  }`}
                >
                  <span>🏷️ Avulsa (Sem Aluno)</span>
                </button>
              </div>
            </div>

            <div className="md:col-span-7">
              {!isAvulsa ? (
                <div>
                  <label className="block text-xs font-semibold text-brand-dark mb-1">Aluno / Cliente <span className="text-red-500">*</span></label>
                  <select 
                    name="aluno_id"
                    required={!isAvulsa}
                    value={formData.aluno_id}
                    onChange={(e) => handleAlunoChange(e.target.value)}
                    className="input-field py-1.5 text-xs"
                  >
                    <option value="">Selecione o aluno...</option>
                    {alunos.map(a => (
                      <option key={a.id} value={a.id}>{a.nome} {a.sobrenome || ''}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-brand-dark mb-1">
                    Descrição da Receita Avulsa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={descricaoAvulsa}
                    onChange={(e) => setDescricaoAvulsa(e.target.value)}
                    placeholder="Ex: Venda de Camiseta, Evento, Aluguel, etc."
                    className="input-field py-1.5 text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Banner de Múltiplos Planos */}
          {(() => {
            if (!formData.aluno_id) return null;
            const alObj = alunos.find(a => a.id === formData.aluno_id);
            if (!alObj) return null;
            const planosDoAluno = getPlanosDoAluno(alObj);
            if (planosDoAluno.length <= 1) return null;

            return (
              <div className="p-2.5 bg-brand-50 border border-brand-200 rounded-xl space-y-1">
                <label className="block text-[11px] font-bold text-brand-dark uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand-medium" /> Aluno com {planosDoAluno.length} Planos - Selecione o Contrato:
                </label>
                <select
                  onChange={(e) => {
                    const selectedPlanId = e.target.value;
                    const planItem = planosDoAluno.find(p => p.id === selectedPlanId);
                    if (planItem) {
                      const now = new Date();
                      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                      const dueDay = String(planItem.dia_vencimento || '10').padStart(2, '0');
                      setFormData(prev => ({
                        ...prev,
                        plano: planItem.plano_nome,
                        valor: planItem.valor_mensalidade?.toString() || prev.valor,
                        valor_original: planItem.valor_mensalidade?.toString() || prev.valor_original,
                        vencimento: `${ym}-${dueDay}`
                      }));
                    }
                  }}
                  className="input-field py-1 text-xs font-bold text-brand-dark bg-white border-brand-300"
                >
                  <option value="">-- Escolha qual plano está sendo recebido --</option>
                  {planosDoAluno.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.plano_nome} - R$ {p.valor_mensalidade?.toFixed(2)} (Vencimento dia {p.dia_vencimento}) {p.personal_nome ? `- Prof: ${p.personal_nome}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* Banner de Mensalidade Gerada Pendente */}
          {pendentesDoAluno.length > 0 && !receitaToEdit && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
              <label className="block text-[11px] font-bold text-amber-800 uppercase">
                Vincular a mensalidade gerada:
              </label>
              <select
                value={selectedReceitaPendenteId}
                onChange={(e) => handleSelectReceitaPendente(e.target.value)}
                className="input-field py-1 text-xs font-semibold text-amber-900 border-amber-300"
              >
                <option value="">(Criar novo recebimento separado)</option>
                {pendentesDoAluno.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.plano} - Venc: {p.vencimento || p.data_vencimento} - R$ {p.valor}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Linha 2: Plano, Categoria, Valor, Data Vencimento e Status Lado a Lado Horizontal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-brand-dark mb-1">Plano</label>
              <select 
                name="plano"
                value={formData.plano}
                onChange={(e) => handlePlanoChange(e.target.value)}
                className="input-field py-1.5 text-xs"
              >
                <option value="Plano Mensal">Plano Mensal</option>
                <option value="Plano Trimestral">Plano Trimestral</option>
                <option value="Plano Semestral">Plano Semestral</option>
                <option value="Plano Anual">Plano Anual</option>
                <option value="Receita Avulsa">Receita Avulsa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-dark mb-1">Categoria (Plano de Contas)</label>
              <select 
                name="categoria_id"
                value={formData.categoria_id}
                onChange={handleChange}
                className="input-field py-1.5 text-xs"
              >
                <option value="">Selecione a conta...</option>
                {categoriasReceita.map(c => (
                  <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-dark mb-1">
                {formData.tem_desconto ? 'Valor Cobrado (R$)' : 'Valor (R$)'}
              </label>
              <input 
                type="number" 
                name="valor"
                required
                step="0.01"
                value={formData.valor}
                onChange={handleChange}
                className="input-field py-1.5 text-xs font-bold text-emerald-700"
                placeholder="150,00"
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
                <option value="pendente">A Receber</option>
                <option value="pago">Pago (Recebido)</option>
                <option value="atrasado">Atrasado</option>
              </select>
            </div>
          </div>

          {/* Opção de Desconto Horizontal */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox"
                name="tem_desconto"
                checked={formData.tem_desconto}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  tem_desconto: e.target.checked,
                  valor_original: prev.valor_original || prev.valor
                }))}
                className="w-4 h-4 text-amber-600 border-surface-300 rounded focus:ring-amber-500"
              />
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                Conceder Desconto / Ajustar Valor da Mensalidade
              </span>
            </label>

            {formData.tem_desconto && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1 animate-fade-in items-end">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-amber-900 mb-0.5">
                    Tabela Original (R$)
                  </label>
                  <input 
                    type="number" 
                    name="valor_original"
                    step="0.01"
                    value={formData.valor_original}
                    onChange={handleChange}
                    className="input-field py-1 bg-white border-amber-300 text-xs font-semibold text-surface-500 line-through"
                    placeholder="300,00"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-amber-900 mb-0.5">
                    Final Cobrado (R$) <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="number" 
                    name="valor"
                    required
                    step="0.01"
                    value={formData.valor}
                    onChange={handleChange}
                    className="input-field py-1 bg-white border-amber-300 text-xs font-bold text-emerald-700"
                    placeholder="200,00"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-amber-900 mb-0.5">
                    Justificativa do Desconto <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="justificativa_desconto"
                    required={formData.tem_desconto}
                    value={formData.justificativa_desconto}
                    onChange={handleChange}
                    className="input-field py-1 bg-white border-amber-300 text-xs font-medium"
                    placeholder="Ex: Treinou 2x/semana no mês."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Dados do Recebimento Horizontal */}
          {formData.status === 'pago' && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 animate-fade-in">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px] uppercase tracking-wide">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Dados do Recebimento / Liquidação
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
              className="btn-primary py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10 flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar Conta a Receber
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceitaFormModal;
