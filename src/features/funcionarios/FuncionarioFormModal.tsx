import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';

export interface Funcionario {
  id: string;
  nome: string;
  funcao: 'personal_trainer' | 'recepcionista' | 'administrador';
  salario_base: number;
  comissao_percentual: number;
  telefone: string;
  email: string;
  ordem_apresentacao?: number;
  ativo: boolean;
  created_at?: number;
}

interface FuncionarioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  funcionarioToEdit?: Funcionario | null;
}

export const FuncionarioFormModal: React.FC<FuncionarioFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  funcionarioToEdit 
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    funcao: 'personal_trainer' as Funcionario['funcao'],
    salario_base: '',
    comissao_percentual: '',
    telefone: '',
    email: '',
    ordem_apresentacao: '1',
    ativo: true
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
        ativo: funcionarioToEdit.ativo !== false
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
        ativo: true
      });
    }
  }, [funcionarioToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
          resource_type: 'auth', // reusando logger para log genérico de funcionários
          details: `Atualizou dados do funcionário ${formData.nome}`
        });
      } else {
        await addDoc(collection(db, 'funcionarios'), {
          ...parsedData,
          created_at: Date.now()
        });
        await logActivity({
          action: 'CREATE',
          resource_type: 'auth',
          details: `Cadastrou o funcionário ${formData.nome}`
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

  return (
    <div className="fixed inset-0 bg-brand-dark/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-surface-200 animate-slide-up">
        {/* Header */}
        <div className="p-6 border-b border-surface-150 flex justify-between items-center bg-surface-50">
          <h3 className="text-xl font-display font-bold text-brand-dark">
            {funcionarioToEdit ? 'Editar Funcionário' : 'Novo Funcionário'}
          </h3>
          <button 
            onClick={onClose}
            className="p-2 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-1.5">Nome Completo</label>
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
                <label className="block text-sm font-semibold text-brand-dark mb-1.5">Função</label>
                <select 
                  name="funcao"
                  value={formData.funcao}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="personal_trainer">Personal Trainer</option>
                  <option value="recepcionista">Recepcionista</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-1.5">Telefone</label>
                <input 
                  type="text" 
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="(00) 99999-9999"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-1.5">Ordem de Apresentação na Agenda (1, 2, 3...)</label>
              <input 
                type="number" 
                name="ordem_apresentacao"
                min="1"
                value={formData.ordem_apresentacao}
                onChange={handleChange}
                className="input-field"
                placeholder="Ex: 1 para primeira coluna, 2 para segunda..."
              />
              <p className="text-[11px] text-surface-400 mt-1">Define a posição/sequência da coluna deste personal na tela da Agenda.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-1.5">E-mail</label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-1.5">Salário Fixo Base (R$)</label>
                <input 
                  type="number" 
                  name="salario_base"
                  step="0.01"
                  required
                  value={formData.salario_base}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="2000,00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-brand-dark mb-1.5">Comissão por Aula (%)</label>
                <input 
                  type="number" 
                  name="comissao_percentual"
                  required
                  value={formData.comissao_percentual}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="30"
                  max="100"
                  min="0"
                />
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
                <label htmlFor="ativo" className="text-sm font-semibold text-brand-dark cursor-pointer">
                  Funcionário Ativo
                </label>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-surface-150">
            <button 
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="btn-primary bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Funcionário
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
