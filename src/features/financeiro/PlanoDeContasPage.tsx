import React, { useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Trash2, Edit2, Check, FolderPlus, Loader2 } from 'lucide-react';
import { logActivity } from '../../services/logger';

export interface PlanoConta {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  ativo: boolean;
}

export const PlanoDeContasPage: React.FC = () => {
  const { data: planos, loading } = useCollection<PlanoConta>('plano_contas', 'codigo');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    tipo: 'despesa' as 'receita' | 'despesa',
    ativo: true
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo || !formData.nome) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const docRef = doc(db, 'plano_contas', editingId);
        await updateDoc(docRef, {
          codigo: formData.codigo,
          nome: formData.nome,
          tipo: formData.tipo,
          ativo: formData.ativo
        });
        await logActivity({
          action: 'UPDATE',
          resource_type: 'receita',
          resource_id: editingId,
          resource_name: formData.nome,
          details: `Plano de contas atualizado: ${formData.codigo} - ${formData.nome}`
        });
        setEditingId(null);
      } else {
        const colRef = collection(db, 'plano_contas');
        const docAdded = await addDoc(colRef, {
          codigo: formData.codigo,
          nome: formData.nome,
          tipo: formData.tipo,
          ativo: formData.ativo
        });
        await logActivity({
          action: 'CREATE',
          resource_type: 'receita',
          resource_id: docAdded.id,
          resource_name: formData.nome,
          details: `Plano de contas criado: ${formData.codigo} - ${formData.nome}`
        });
      }

      setFormData({
        codigo: '',
        nome: '',
        tipo: 'despesa',
        ativo: true
      });
    } catch (err) {
      console.error("Erro ao salvar plano de contas:", err);
      alert("Ocorreu um erro ao salvar o plano de contas.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (p: PlanoConta) => {
    setEditingId(p.id);
    setFormData({
      codigo: p.codigo,
      nome: p.nome,
      tipo: p.tipo,
      ativo: p.ativo
    });
  };

  const handleDelete = async (p: PlanoConta) => {
    if (!window.confirm(`Tem certeza que deseja excluir o plano "${p.codigo} - ${p.nome}"?`)) return;

    try {
      await deleteDoc(doc(db, 'plano_contas', p.id));
      await logActivity({
        action: 'DELETE',
        resource_type: 'receita',
        resource_id: p.id,
        resource_name: p.nome,
        details: `Plano de contas deletado: ${p.codigo} - ${p.nome}`
      });
    } catch (err) {
      console.error("Erro ao deletar:", err);
      alert("Não foi possível excluir o plano de contas.");
    }
  };

  const handleSeedDefaults = async () => {
    if (planos.length > 0) {
      if (!window.confirm("Você já possui planos de contas cadastrados. Deseja adicionar os planos padrão assim mesmo?")) {
        return;
      }
    }

    setIsSaving(true);
    const defaults: Omit<PlanoConta, 'id'>[] = [
      // Receitas
      { codigo: '1.1', nome: 'Mensalidades', tipo: 'receita', ativo: true },
      { codigo: '1.2', nome: 'Aulas Avulsas / Personal', tipo: 'receita', ativo: true },
      { codigo: '1.3', nome: 'Avaliações Físicas', tipo: 'receita', ativo: true },
      { codigo: '1.4', nome: 'Venda de Produtos / Suplementos', tipo: 'receita', ativo: true },
      { codigo: '1.5', nome: 'Outras Receitas', tipo: 'receita', ativo: true },
      // Despesas
      { codigo: '2.1', nome: 'Aluguel & Condomínio', tipo: 'despesa', ativo: true },
      { codigo: '2.2', nome: 'Utilidades (Água, Luz, Internet)', tipo: 'despesa', ativo: true },
      { codigo: '2.3', nome: 'Manutenção & Limpeza', tipo: 'despesa', ativo: true },
      { codigo: '2.4', nome: 'Marketing & Divulgação', tipo: 'despesa', ativo: true },
      { codigo: '2.5', nome: 'Impostos & Taxas Bancárias', tipo: 'despesa', ativo: true },
      { codigo: '2.6', nome: 'Sistemas & Software (ERP, Cloud)', tipo: 'despesa', ativo: true },
      { codigo: '2.7', nome: 'Folha de Pagamento & Comissões', tipo: 'despesa', ativo: true },
      { codigo: '2.8', nome: 'Outras Despesas', tipo: 'despesa', ativo: true }
    ];

    try {
      const colRef = collection(db, 'plano_contas');
      for (const d of defaults) {
        // Evita duplicar se já existir o mesmo código
        if (!planos.some(p => p.codigo === d.codigo)) {
          await addDoc(colRef, d);
        }
      }
      alert("Estrutura padrão de plano de contas gerada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar estrutura padrão.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Plano de Contas 📋</h2>
          <p className="text-surface-500">Cadastre e estruture as categorias de receitas e despesas do estúdio.</p>
        </div>
        <button 
          onClick={handleSeedDefaults}
          className="btn-secondary !bg-emerald-50 !text-emerald-700 border border-emerald-200 hover:!bg-emerald-600 hover:!text-white flex items-center gap-2"
        >
          <FolderPlus className="w-4 h-4" />
          Gerar Estrutura Padrão
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de Cadastro/Edição */}
        <div className="glass-card p-6 h-fit">
          <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
            {editingId ? <Edit2 className="w-5 h-5 text-brand-medium" /> : <Plus className="w-5 h-5 text-brand-medium" />}
            {editingId ? 'Editar Categoria' : 'Nova Categoria'}
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase mb-2">Código da Conta</label>
              <input
                type="text"
                name="codigo"
                value={formData.codigo}
                onChange={handleInputChange}
                placeholder="Ex: 1.1 ou 2.1"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase mb-2">Nome da Categoria</label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                placeholder="Ex: Mensalidades, Internet"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase mb-2">Tipo de Fluxo</label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleInputChange}
                className="input-field"
              >
                <option value="receita">Receita (Entrada)</option>
                <option value="despesa">Despesa (Saída)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                name="ativo"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.checked }))}
                className="w-4 h-4 rounded text-brand-medium focus:ring-brand-medium"
              />
              <label htmlFor="ativo" className="text-sm font-semibold text-brand-dark">Categoria Ativa</label>
            </div>

            <div className="flex gap-3 pt-4">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ codigo: '', nome: '', tipo: 'despesa', ativo: true });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingId ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>

        {/* Listagem de Planos */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-lg font-bold text-brand-dark mb-4">Estrutura Atual de Contas</h3>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
              <p className="text-sm font-semibold">Carregando plano de contas...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-200 text-surface-400 text-xs font-bold uppercase">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Nome da Categoria</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-sm">
                  {planos.length > 0 ? (
                    planos.map(p => (
                      <tr key={p.id} className="hover:bg-surface-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-brand-dark">{p.codigo}</td>
                        <td className="py-3 px-4 font-semibold text-brand-dark">{p.nome}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                            p.tipo === 'receita' 
                              ? 'bg-green-50 text-green-700 border border-green-200' 
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {p.tipo === 'receita' ? 'Receita' : 'Despesa'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`w-2.5 h-2.5 rounded-full inline-block ${p.ativo ? 'bg-green-500' : 'bg-surface-300'}`} title={p.ativo ? 'Ativo' : 'Inativo'} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(p)}
                              className="p-1.5 text-surface-400 hover:text-brand-medium rounded-lg hover:bg-surface-50 transition-all"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="p-1.5 text-surface-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-surface-400 font-medium">
                        Nenhuma categoria cadastrada. Clique em "Gerar Estrutura Padrão" para começar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanoDeContasPage;
