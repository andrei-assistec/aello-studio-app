import React, { useState } from 'react';
import { Plus, Edit2, Archive, DollarSign, X, Save, Clock, HelpCircle, Dumbbell } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import type { Plano, Aluno } from '../../types/database';
import { logActivity } from '../../services/logger';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const CadastroPlanos = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Firestore collections
  const { data: planos, add: addPlano, update: updatePlano, loading: loadingPlanos } = useCollection<Plano>('planos');
  const { data: alunos } = useCollection<Aluno>('alunos');

  const [formData, setFormData] = useState({
    nome: '',
    duracao_meses: 1,
    valor: 150.00,
    frequencia_semanal: 3 as 1 | 2 | 3 | 4 | 5,
    modalidade: 'musculacao' as 'musculacao' | 'funcional' | 'ambas',
    descricao: ''
  });

  const getAlunosCount = (planoId: string) => {
    return alunos.filter(a => a.plano_id === planoId && a.ativo).length;
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      nome: '',
      duracao_meses: 1,
      valor: 150.00,
      frequencia_semanal: 3,
      modalidade: 'musculacao',
      descricao: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (plano: Plano) => {
    setEditingId(plano.id);
    setFormData({
      nome: plano.nome,
      duracao_meses: plano.duracao_meses,
      valor: plano.valor,
      frequencia_semanal: plano.frequencia_semanal || 3,
      modalidade: plano.modalidade || 'musculacao',
      descricao: plano.descricao || ''
    });
    setIsModalOpen(true);
  };

  const handleArchive = async (plano: Plano) => {
    const confirm = window.confirm(`Deseja realmente ${plano.ativo ? 'arquivar' : 'reativar'} o plano ${plano.nome}?`);
    if (confirm) {
      try {
        await updatePlano(plano.id, { ativo: !plano.ativo });
        await logActivity({
          action: 'UPDATE',
          resource_type: 'plano',
          resource_id: plano.id,
          resource_name: plano.nome,
          details: `Alterou status do plano ${plano.nome} para ${!plano.ativo ? 'INATIVO' : 'ATIVO'}`
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      alert("O nome do plano é obrigatório.");
      return;
    }

    const dataSave = {
      nome: formData.nome.trim(),
      duracao_meses: Number(formData.duracao_meses),
      valor: Number(formData.valor),
      frequencia_semanal: Number(formData.frequencia_semanal) as 1 | 2 | 3 | 4 | 5,
      modalidade: formData.modalidade,
      descricao: formData.descricao.trim(),
      ativo: true
    };

    try {
      if (editingId) {
        await updatePlano(editingId, dataSave);
        
        // Sincronizar dados do plano editado com todos os alunos vinculados
        const alunosComPlano = alunos.filter(a => a.plano_id === editingId);
        if (alunosComPlano.length > 0) {
          const promises = alunosComPlano.map(aluno => 
            updateDoc(doc(db, 'alunos', aluno.id), {
              plano_nome: dataSave.nome,
              valor_mensalidade: dataSave.valor,
              modalidade: dataSave.modalidade as 'musculacao' | 'funcional' | 'ambas',
              frequencia_semanal: dataSave.frequencia_semanal
            })
          );
          await Promise.all(promises);
        }

        await logActivity({
          action: 'UPDATE',
          resource_type: 'plano',
          resource_id: editingId,
          resource_name: dataSave.nome,
          details: `Atualizou os dados do plano ${dataSave.nome} e sincronizou com ${alunosComPlano.length} aluno(s)`
        });
      } else {
        await addPlano({
          ...dataSave,
          created_at: Date.now()
        });
        await logActivity({
          action: 'CREATE',
          resource_type: 'plano',
          resource_name: dataSave.nome,
          details: `Criou novo plano: ${dataSave.nome} no valor de R$ ${dataSave.valor}`
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar o plano.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Planos & Valores 💸</h2>
          <p className="text-surface-500">Cadastre e configure a grade de planos oferecidos pelo studio.</p>
        </div>
        <button onClick={handleOpenCreate} className="btn-primary bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10">
          <Plus className="w-5 h-5" />
          Novo Plano
        </button>
      </div>

      {loadingPlanos ? (
        <div className="p-12 text-center text-surface-400">Carregando planos...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {planos.map((plano) => (
            <div 
              key={plano.id} 
              className={`glass-card p-6 border transition-all flex flex-col justify-between ${
                plano.ativo ? 'border-surface-150 hover:shadow-xl' : 'border-red-100 opacity-60 bg-red-50/10'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold uppercase">
                    Duração: {plano.duracao_meses === 1 ? 'Mensal' : plano.duracao_meses === 3 ? 'Trimestral' : plano.duracao_meses === 6 ? 'Semestral' : plano.duracao_meses === 12 ? 'Anual' : `${plano.duracao_meses} meses`}
                  </span>
                  <span className="text-xs text-surface-400 font-semibold">
                    {getAlunosCount(plano.id)} alunos ativos
                  </span>
                </div>

                <div className="flex justify-between items-start gap-4 mb-2">
                  <h3 className="text-xl font-display font-bold text-brand-dark">{plano.nome}</h3>
                  {!plano.ativo && (
                    <span className="bg-red-100 text-red-800 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">Arquivado</span>
                  )}
                </div>
                
                <p className="text-xs text-surface-400 font-bold mb-4 uppercase">
                  Freq: {plano.frequencia_semanal}x/sem • <span className="capitalize">{plano.modalidade}</span>
                </p>

                <p className="text-sm text-surface-500 mb-6 leading-relaxed">
                  {plano.descricao || 'Sem descrição cadastrada.'}
                </p>

                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-2xl font-display font-bold text-emerald-600">
                      R$ {plano.valor.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-xs text-surface-400 font-semibold block">Preço de tabela</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-surface-100 pt-4 mt-auto">
                <button 
                  onClick={() => handleOpenEdit(plano)}
                  className="flex-1 btn-secondary text-xs py-2 justify-center gap-1.5 hover:bg-surface-50"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar Detalhes
                </button>
                <button 
                  onClick={() => handleArchive(plano)}
                  className={`p-2 border rounded-xl transition-all cursor-pointer ${
                    plano.ativo 
                      ? 'border-red-100 hover:bg-red-50 text-red-500' 
                      : 'border-green-100 hover:bg-green-50 text-green-500'
                  }`}
                  title={plano.ativo ? 'Arquivar Plano' : 'Reativar Plano'}
                >
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {planos.length === 0 && (
            <div className="col-span-full p-12 text-center text-surface-400 italic">
              Nenhum plano cadastrado.
            </div>
          )}
        </div>
      )}

      {/* Modal Criar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl border border-surface-200 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-dark">
                {editingId ? 'Editar Plano' : 'Novo Plano'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-100 rounded-xl text-surface-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Nome do Plano</label>
                <input 
                  type="text" 
                  value={formData.nome} 
                  onChange={e => setFormData({ ...formData, nome: e.target.value })} 
                  className="input-field"
                  placeholder="Ex: Mensal 2x Musculação"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark flex items-center gap-1">
                    <Clock className="w-4 h-4 text-surface-400" /> Duração (Meses)
                  </label>
                  <input 
                    type="number" 
                    value={formData.duracao_meses} 
                    onChange={e => setFormData({ ...formData, duracao_meses: parseInt(e.target.value) || 1 })} 
                    className="input-field"
                    min="1"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-surface-400" /> Valor (R$)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.valor} 
                    onChange={e => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })} 
                    className="input-field"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark">Frequência Semanal</label>
                  <select 
                    value={formData.frequencia_semanal} 
                    onChange={e => setFormData({ ...formData, frequencia_semanal: parseInt(e.target.value) as any })} 
                    className="input-field"
                  >
                    <option value="1">1x por semana</option>
                    <option value="2">2x por semana</option>
                    <option value="3">3x por semana</option>
                    <option value="4">4x por semana</option>
                    <option value="5">5x por semana</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark flex items-center gap-1">
                    <Dumbbell className="w-4 h-4 text-surface-400" /> Modalidade
                  </label>
                  <select 
                    value={formData.modalidade} 
                    onChange={e => setFormData({ ...formData, modalidade: e.target.value as any })} 
                    className="input-field"
                  >
                    <option value="musculacao">Musculação</option>
                    <option value="funcional">Funcional</option>
                    <option value="ambas">Ambas</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark flex items-center gap-1">
                  <HelpCircle className="w-4 h-4 text-surface-400" /> Descrição do Plano
                </label>
                <textarea 
                  value={formData.descricao} 
                  onChange={e => setFormData({ ...formData, descricao: e.target.value })} 
                  className="input-field min-h-[70px]"
                  placeholder="Recursos do plano, regras de trancamento, etc."
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  <Save className="w-5 h-5" />
                  Salvar Plano
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroPlanos;
