import React, { useState } from 'react';
import { Search, Plus, Calendar, Clock, Edit2, Trash2, X, Save, Dumbbell, User } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import type { AgendamentoFixo, Aluno } from '../../types/database';
import type { Funcionario } from '../funcionarios/FuncionarioFormModal';
import { logActivity } from '../../services/logger';

export const AgendamentosList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load datasets
  const { data: agendamentos, add: addAgendamento, update: updateAgendamento, remove: deleteAgendamento, loading } = useCollection<AgendamentoFixo>('agendamentos_fixos');
  const { data: alunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: colaboradores } = useCollection<Funcionario>('funcionarios', 'nome');
  
  const trainers = colaboradores.filter(c => c.funcao === 'personal_trainer' && c.ativo !== false);

  const [formData, setFormData] = useState({
    aluno_id: '',
    personal_id: '',
    dias: [] as string[],
    hora: '08:00',
    modalidade: 'musculacao' as 'musculacao' | 'funcional'
  });

  const slotsHorarios = [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30', '22:00'
  ];

  const diasDisponiveis = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      aluno_id: '',
      personal_id: '',
      dias: [],
      hora: '08:00',
      modalidade: 'musculacao'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: AgendamentoFixo) => {
    setEditingId(item.id);
    setFormData({
      aluno_id: item.aluno_id,
      personal_id: item.personal_id,
      dias: item.dias || [],
      hora: item.hora,
      modalidade: item.modalidade || 'musculacao'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (item: AgendamentoFixo) => {
    if (window.confirm(`Remover permanentemente a grade horária fixa de ${item.aluno_nome}?`)) {
      try {
        await deleteAgendamento(item.id);
        await logActivity({
          action: 'DELETE',
          resource_type: 'agenda',
          resource_id: item.id,
          resource_name: item.aluno_nome,
          details: `Removeu o agendamento fixo de ${item.aluno_nome} (${item.dias.join(', ')} às ${item.hora})`
        });
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir agendamento.');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.aluno_id || !formData.personal_id || formData.dias.length === 0) {
      alert("Selecione o Aluno, o Personal Trainer e ao menos 1 dia da semana.");
      return;
    }

    const alunoSel = alunos.find(a => a.id === formData.aluno_id);
    const personalSel = trainers.find(t => t.id === formData.personal_id);

    const dataSave = {
      aluno_id: formData.aluno_id,
      aluno_nome: alunoSel ? `${alunoSel.nome} ${alunoSel.sobrenome || ''}`.trim() : '',
      personal_id: formData.personal_id,
      personal_nome: personalSel ? personalSel.nome : '',
      dias: formData.dias,
      hora: formData.hora,
      modalidade: formData.modalidade,
      ativo: true
    };

    try {
      if (editingId) {
        await updateAgendamento(editingId, dataSave);
        await logActivity({
          action: 'UPDATE',
          resource_type: 'agenda',
          resource_id: editingId,
          resource_name: dataSave.aluno_nome,
          details: `Atualizou agendamento fixo de ${dataSave.aluno_nome} para ${dataSave.dias.join(', ')} às ${dataSave.hora}`
        });
      } else {
        await addAgendamento({
          ...dataSave,
          created_at: Date.now()
        });
        await logActivity({
          action: 'CREATE',
          resource_type: 'agenda',
          resource_name: dataSave.aluno_nome,
          details: `Criou novo agendamento fixo para ${dataSave.aluno_nome} em ${dataSave.dias.join(', ')} às ${dataSave.hora}`
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar agendamento fixo.');
    }
  };

  const toggleDia = (dia: string) => {
    setFormData(prev => {
      const dias = prev.dias.includes(dia)
        ? prev.dias.filter(d => d !== dia)
        : [...prev.dias, dia];
      return { ...prev, dias };
    });
  };

  const filtered = agendamentos.filter(item => 
    item.aluno_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Agendamentos Fixos 👥</h2>
          <p className="text-surface-500">Veja e gerencie a grade fixa semanal recorrente de cada aluno do studio.</p>
        </div>
        <button onClick={handleOpenCreate} className="btn-primary">
          <Plus className="w-5 h-5" />
          Novo Agendamento Fixo
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="glass-card p-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar por nome do aluno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-surface-200 rounded-xl py-3 pl-12 pr-4 text-brand-dark focus:ring-2 focus:ring-brand-medium focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>

      {/* Grid de Agendamentos Fixos */}
      {loading ? (
        <div className="p-12 text-center text-surface-400">Carregando agendamentos...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <div key={item.id} className="glass-card p-6 hover:shadow-xl transition-all border border-surface-150 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 font-bold">
                    {item.aluno_nome.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">
                    {item.modalidade === 'funcional' ? 'Funcional' : 'Musculação'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-brand-dark mb-1">{item.aluno_nome}</h3>
                <p className="text-xs text-surface-400 mb-4">Personal: {item.personal_nome}</p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-surface-500">
                    <Calendar className="w-4 h-4 text-brand-medium" />
                    <span>Dias: <strong>{item.dias.join(', ')}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-surface-500">
                    <Clock className="w-4 h-4 text-brand-medium" />
                    <span>Horário: <strong>{item.hora}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-surface-100 pt-4 mt-auto">
                <button 
                  onClick={() => handleOpenEdit(item)}
                  className="flex-1 btn-secondary text-xs py-2 justify-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button 
                  onClick={() => handleDelete(item)}
                  className="p-2 border border-red-100 hover:bg-red-50 text-red-500 rounded-xl transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full p-12 text-center text-surface-400 italic">
              Nenhum agendamento fixo cadastrado.
            </div>
          )}
        </div>
      )}

      {/* Modal Criar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl border border-surface-200 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-dark">
                {editingId ? 'Editar Agendamento Fixo' : 'Novo Agendamento Fixo'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-100 rounded-xl text-surface-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                  <User className="w-4 h-4 text-surface-400" /> Selecione o Aluno
                </label>
                <select 
                  value={formData.aluno_id} 
                  onChange={e => setFormData({ ...formData, aluno_id: e.target.value })} 
                  className="input-field"
                  disabled={!!editingId}
                >
                  <option value="">-- Selecione o Aluno --</option>
                  {alunos.filter(a => a.ativo).map(a => (
                    <option key={a.id} value={a.id}>{a.nome} {a.sobrenome || ''}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                  <User className="w-4 h-4 text-surface-400" /> Personal Trainer Responsável
                </label>
                <select 
                  value={formData.personal_id} 
                  onChange={e => setFormData({ ...formData, personal_id: e.target.value })} 
                  className="input-field"
                >
                  <option value="">-- Selecione o Personal --</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                    <Clock className="w-4 h-4 text-surface-400" /> Horário Fixo
                  </label>
                  <select 
                    value={formData.hora} 
                    onChange={e => setFormData({ ...formData, hora: e.target.value })} 
                    className="input-field"
                  >
                    {slotsHorarios.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-surface-400" /> Modalidade
                  </label>
                  <select 
                    value={formData.modalidade} 
                    onChange={e => setFormData({ ...formData, modalidade: e.target.value as any })} 
                    className="input-field"
                  >
                    <option value="musculacao">Musculação</option>
                    <option value="funcional">Funcional</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-dark block">Dias da Semana Recorrentes</label>
                <div className="flex flex-wrap gap-2">
                  {diasDisponiveis.map(dia => {
                    const isSelected = formData.dias.includes(dia);
                    return (
                      <button
                        type="button"
                        key={dia}
                        onClick={() => toggleDia(dia)}
                        className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-brand-medium text-white border-brand-medium shadow-sm shadow-brand-medium/20' 
                            : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                        }`}
                      >
                        {dia}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  <Save className="w-5 h-5" />
                  Salvar Grade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendamentosList;
