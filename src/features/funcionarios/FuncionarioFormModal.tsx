import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Award, UserCheck, Percent } from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection } from '../../hooks/useFirestore';
import { logActivity } from '../../services/logger';

export interface Funcionario {
  id: string;
  nome: string;
  funcao: 'personal_trainer' | 'recepcionista' | 'administrador';
  salario_base: number;
  comissao_percentual: number;
  comissoes_modalidades?: Record<string, number>;
  telefone: string;
  email: string;
  ordem_apresentacao?: number;
  ativo: boolean;
  perfil?: 'admin' | 'instrutor';
  uid?: string | null;
  created_at?: number;
}

interface FuncionarioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  funcionarioToEdit?: Funcionario | null;
}

// Modalidades Master padrão do estúdio para comissão por modalidade
const MODALIDADES_PADRAO = [
  { key: 'musculacao', label: 'Musculação (Planos de Musculação)' },
  { key: 'funcional', label: 'Treino Funcional' },
  { key: 'idosos', label: 'Grupo de Idosos' },
  { key: 'pilates', label: 'Pilates' },
  { key: 'personal', label: 'Personal Trainer Individual' },
  { key: 'avaliacao', label: 'Avaliação Física' },
  { key: 'loja', label: 'Vendas de Produtos (Loja / Balcão)' },
];

export const FuncionarioFormModal: React.FC<FuncionarioFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  funcionarioToEdit 
}) => {
  const { data: planos } = useCollection<any>('planos');

  const [activeTab, setActiveTab] = useState<'dados' | 'comissoes'>('dados');
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    funcao: 'personal_trainer' as Funcionario['funcao'],
    salario_base: '',
    comissao_percentual: '',
    telefone: '',
    email: '',
    ordem_apresentacao: '1',
    ativo: true,
    comissoes_modalidades: {} as Record<string, number>
  });

  useEffect(() => {
    if (funcionarioToEdit) {
      setFormData({
        nome: funcionarioToEdit.nome || '',
        funcao: funcionarioToEdit.funcao || 'personal_trainer',
        salario_base: funcionarioToEdit.salario_base?.toString() || '',
        comissao_percentual: funcionarioToEdit.comissao_percentual?.toString() || '',
        telefone: funcionarioToEdit.telefone || '',
        email: funcionarioToEdit.email || '',
        ordem_apresentacao: (funcionarioToEdit.ordem_apresentacao ?? 1).toString(),
        ativo: funcionarioToEdit.ativo !== false,
        comissoes_modalidades: funcionarioToEdit.comissoes_modalidades || {}
      });
    } else {
      setFormData({
        nome: '',
        funcao: 'personal_trainer',
        salario_base: '',
        comissao_percentual: '',
        telefone: '',
        email: '',
        ordem_apresentacao: '1',
        ativo: true,
        comissoes_modalidades: {}
      });
    }
    setActiveTab('dados');
  }, [funcionarioToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleComissaoModalidadeChange = (key: string, valueStr: string) => {
    const num = parseFloat(valueStr);
    const val = isNaN(num) || num < 0 ? 0 : Math.min(100, num);
    setFormData(prev => ({
      ...prev,
      comissoes_modalidades: {
        ...prev.comissoes_modalidades,
        [key]: val
      }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      alert("O Nome do funcionário é obrigatório.");
      return;
    }

    setIsSaving(true);
    try {
      const parsedData = {
        nome: formData.nome,
        funcao: formData.funcao,
        salario_base: parseFloat(formData.salario_base) || 0,
        comissao_percentual: parseFloat(formData.comissao_percentual) || 0,
        comissoes_modalidades: formData.comissoes_modalidades || {},
        telefone: formData.telefone,
        email: formData.email,
        ordem_apresentacao: parseInt(formData.ordem_apresentacao) || 1,
        ativo: formData.ativo,
        updated_at: Date.now()
      };

      if (funcionarioToEdit) {
        await updateDoc(doc(db, 'funcionarios', funcionarioToEdit.id), parsedData);
        await logActivity({
          action: 'UPDATE',
          resource_type: 'auth',
          details: `Atualizou cadastro e comissões por modalidade do colaborador ${formData.nome}`
        });
      } else {
        await addDoc(collection(db, 'funcionarios'), {
          ...parsedData,
          created_at: Date.now()
        });
        await logActivity({
          action: 'CREATE',
          resource_type: 'auth',
          details: `Cadastrou o colaborador ${formData.nome} com regras de comissão por modalidade`
        });
      }
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao salvar funcionário:", error);
      alert("Erro ao salvar dados do funcionário: " + (error.message || error.toString()));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Lista consolidada de modalidades/planos configuráveis
  const allModalidadesList = [
    ...MODALIDADES_PADRAO,
    ...(planos || []).map((p: any) => ({
      key: p.id || p.nome,
      label: `Plano: ${p.nome} (${p.modalidade || 'Geral'})`
    }))
  ];

  // Remove duplicados por key
  const uniqueModalidades = Array.from(new Map(allModalidadesList.map(item => [item.key, item])).values());

  return (
    <div className="fixed inset-0 bg-brand-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-surface-200 animate-slide-up flex flex-col max-h-[90vh]">
        {/* Header com Abas */}
        <div className="p-6 border-b border-surface-150 bg-surface-50 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-display font-bold text-brand-dark flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-brand-medium" />
                {funcionarioToEdit ? 'Editar Cadastro do Colaborador' : 'Novo Colaborador'}
              </h3>
              <p className="text-xs text-surface-500">Configure os dados pessoais, salário fixo e percentuais de comissão por modalidade.</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-surface-400 hover:text-surface-600 rounded-xl hover:bg-surface-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Abas de Navegação */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-surface-200 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('dados')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dados'
                  ? 'bg-brand-dark text-white shadow-xs'
                  : 'text-surface-600 hover:text-brand-dark hover:bg-surface-100'
              }`}
            >
              👤 Dados Gerais & Salário
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comissoes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'comissoes'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-surface-600 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              Comissões por Modalidade
            </button>
          </div>
        </div>

        {/* Form Body Scrollable */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            {activeTab === 'dados' && (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">Nome Completo</label>
                  <input 
                    type="text" 
                    name="nome"
                    required
                    value={formData.nome}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Ex: João da Silva"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">Função / Cargo</label>
                    <select 
                      name="funcao"
                      value={formData.funcao}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="personal_trainer">Personal Trainer / Instrutor</option>
                      <option value="recepcionista">Recepcionista</option>
                      <option value="administrador">Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">Telefone / WhatsApp</label>
                    <input 
                      type="text" 
                      name="telefone"
                      value={formData.telefone}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="(55) 99999-9999"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">E-mail de Login</label>
                    <input 
                      type="email" 
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="nome@aellostudio.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">Ordem de Exibição na Agenda</label>
                    <input 
                      type="number" 
                      name="ordem_apresentacao"
                      min="1"
                      value={formData.ordem_apresentacao}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="1, 2, 3..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">Salário Fixo Base (R$)</label>
                    <input 
                      type="number" 
                      name="salario_base"
                      step="0.01"
                      required
                      value={formData.salario_base}
                      onChange={handleChange}
                      className="input-field font-bold text-emerald-700"
                      placeholder="1600,00"
                    />
                    <p className="text-[10px] text-surface-400 mt-1">Valor fixo garantido mensal no holerite.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-dark mb-1">Comissão Padrão Geral (%)</label>
                    <input 
                      type="number" 
                      name="comissao_percentual"
                      value={formData.comissao_percentual}
                      onChange={handleChange}
                      className="input-field font-bold text-indigo-600"
                      placeholder="50"
                      max="100"
                      min="0"
                    />
                    <p className="text-[10px] text-surface-400 mt-1">Usada quando a modalidade não tiver percentual específico.</p>
                  </div>
                </div>

                {funcionarioToEdit && (
                  <div className="flex items-center gap-2 py-2">
                    <input 
                      type="checkbox" 
                      name="ativo"
                      id="ativo"
                      checked={formData.ativo}
                      onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                      className="w-4 h-4 text-brand-medium border-surface-300 rounded focus:ring-brand-medium"
                    />
                    <label htmlFor="ativo" className="text-xs font-bold text-brand-dark cursor-pointer">
                      Colaborador Ativo no Sistema
                    </label>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'comissoes' && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start gap-3">
                  <Award className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-900 leading-relaxed font-medium">
                    <strong className="block font-bold mb-0.5 text-indigo-950">Comissão Específica por Modalidade / Plano:</strong>
                    Preencha o % de comissão que este colaborador receberá para cada modalidade de aula. 
                    <span className="block font-bold text-indigo-700 mt-1">
                      ⚠️ Atenção: Se o campo ficar em branco ou for 0, a comissão para esta modalidade será 0% (Sem comissão).
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                  {uniqueModalidades.map(item => {
                    const val = formData.comissoes_modalidades[item.key] ?? '';
                    return (
                      <div 
                        key={item.key} 
                        className="p-3.5 bg-surface-50 rounded-2xl border border-surface-200 flex items-center justify-between gap-3 hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-bold text-brand-dark block truncate">{item.label}</label>
                          <span className="text-[10px] text-surface-400">Modalidade: {item.key}</span>
                        </div>

                        <div className="flex items-center gap-1 min-w-[100px]">
                          <input 
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={val}
                            onChange={(e) => handleComissaoModalidadeChange(item.key, e.target.value)}
                            className="input-field text-xs font-bold text-center py-1.5 px-2 text-indigo-600 bg-white"
                          />
                          <span className="text-xs font-bold text-surface-500">%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-surface-50 border-t border-surface-150 flex gap-3 justify-end">
            <button 
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-xs flex items-center gap-1.5 shadow-indigo-600/10 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Colaborador & Comissões
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FuncionarioFormModal;
