import React, { useState } from 'react';
import { 
  Repeat, 
  Plus, 
  Sparkles, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  RefreshCw
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';

export interface ContaFixa {
  id: string;
  descricao: string;
  categoria: string;
  tipo: 'DESPESA' | 'RECEITA';
  valor_medio: number;
  dia_vencimento: number;
  frequencia: 'MENSAL' | 'TRIMESTRAL' | 'ANUAL';
  forma_pagamento?: string;
  banco?: string;
  ativo: boolean;
  created_at?: number;
}

export const ContasFixasPage = () => {
  const { data: contasFixas, remove: deleteConta } = useCollection<ContaFixa>('contas_fixas');
  const { data: despesas } = useCollection<any>('despesas');
  const { data: receitas } = useCollection<any>('receitas');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [form, setForm] = useState({
    descricao: '',
    categoria: 'Despesas Operacionais',
    tipo: 'DESPESA' as 'DESPESA' | 'RECEITA',
    valor_medio: '',
    dia_vencimento: '5',
    frequencia: 'MENSAL' as 'MENSAL' | 'TRIMESTRAL' | 'ANUAL',
    forma_pagamento: 'PIX/Transferência',
    banco: 'Sicredi',
    ativo: true
  });

  // Lista padrão de contas fixas pré-calculadas com base no histórico real dos extratos OFX do Studio
  const defaultTemplates = [
    { descricao: 'Folha / Pró-Labore / Equipe', categoria: 'Salários & Pró-Labore', tipo: 'DESPESA', valor_medio: 3970.90, dia_vencimento: 5 },
    { descricao: 'Aluguel do Studio', categoria: 'Aluguel & Condomínio', tipo: 'DESPESA', valor_medio: 2500.00, dia_vencimento: 5 },
    { descricao: 'Repasse Personal - Maristela', categoria: 'Repasse Personal Trainers', tipo: 'DESPESA', valor_medio: 1043.83, dia_vencimento: 5 },
    { descricao: 'Pagamento de Empréstimo - Andrei', categoria: 'Empréstimos & Financiamentos', tipo: 'DESPESA', valor_medio: 803.60, dia_vencimento: 5 },
    { descricao: 'Energia Elétrica (RGE)', categoria: 'Energia Elétrica', tipo: 'DESPESA', valor_medio: 342.74, dia_vencimento: 10 },
    { descricao: 'Impostos & Taxas (DAS / Simples)', categoria: 'Impostos & Taxas', tipo: 'DESPESA', valor_medio: 294.55, dia_vencimento: 20 },
    { descricao: 'Repasse Personal - Ana Claudia', categoria: 'Repasse Personal Trainers', tipo: 'DESPESA', valor_medio: 234.67, dia_vencimento: 5 },
    { descricao: 'Serviços Contábeis', categoria: 'Serviços Contábeis', tipo: 'DESPESA', valor_medio: 217.00, dia_vencimento: 15 },
    { descricao: 'Água & Saneamento (CORSAN)', categoria: 'Água & Saneamento', tipo: 'DESPESA', valor_medio: 187.44, dia_vencimento: 12 },
    { descricao: 'Internet & Telefonia', categoria: 'Internet & Telefonia', tipo: 'DESPESA', valor_medio: 88.99, dia_vencimento: 20 },
    { descricao: 'Tarifas Bancárias / Cesta Sicredi', categoria: 'Tarifas Bancárias', tipo: 'DESPESA', valor_medio: 24.00, dia_vencimento: 1 }
  ];

  // Inicializar modelos padrão se a coleção estiver vazia
  const handlePopulateDefaults = async () => {
    if (contasFixas.length > 0) {
      if (!confirm('Deseja adicionar os modelos padrões pré-calculados às suas contas fixas existentes?')) return;
    }

    try {
      for (const t of defaultTemplates) {
        await addDoc(collection(db, 'contas_fixas'), {
          ...t,
          frequencia: 'MENSAL',
          forma_pagamento: 'PIX/Transferência',
          banco: 'Sicredi',
          ativo: true,
          created_at: Date.now()
        });
      }
      alert('Contas fixas pré-calculadas importadas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar modelos padrão.');
    }
  };

  // Gerar Lançamentos de Previsão para o Mês Atual
  const handleGenerateForecasts = async () => {
    setIsGenerating(true);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonthStr = String(now.getMonth() + 1).padStart(2, '0');
    const monthKey = `${curYear}-${curMonthStr}`;

    let totalDespesasGenerated = 0;
    let totalReceitasGenerated = 0;

    try {
      const activeContas = contasFixas.filter(c => c.ativo !== false);

      for (const conta of activeContas) {
        const dia = String(conta.dia_vencimento || 5).padStart(2, '0');
        const dueDate = `${curYear}-${curMonthStr}-${dia}`;
        const forecastKey = `PREV_${monthKey}_${conta.id || conta.descricao.replace(/\s+/g, '_')}`;

        if (conta.tipo === 'DESPESA') {
          // Checar se já existe no mês
          const exists = despesas.some((d: any) => 
            d.forecast_key === forecastKey || 
            (d.descricao === conta.descricao && d.data_vencimento && d.data_vencimento.startsWith(monthKey))
          );

          if (!exists) {
            await addDoc(collection(db, 'despesas'), {
              descricao: `${conta.descricao} (Previsão Recorrente)`,
              categoria: conta.categoria || 'Despesas Operacionais',
              valor: conta.valor_medio,
              data_vencimento: dueDate,
              status: 'PENDENTE',
              forma_pagamento: conta.forma_pagamento || 'PIX/Transferência',
              banco: conta.banco || 'Sicredi',
              is_forecast: true,
              forecast_key: forecastKey,
              created_at: Date.now()
            });
            totalDespesasGenerated++;
          }
        } else {
          const exists = receitas.some((r: any) => 
            r.forecast_key === forecastKey || 
            (r.descricao === conta.descricao && r.data_vencimento && r.data_vencimento.startsWith(monthKey))
          );

          if (!exists) {
            await addDoc(collection(db, 'receitas'), {
              descricao: `${conta.descricao} (Previsão Recorrente)`,
              categoria: conta.categoria || 'Receitas Operacionais',
              valor: conta.valor_medio,
              data_vencimento: dueDate,
              status: 'PENDENTE',
              forma_pagamento: conta.forma_pagamento || 'PIX/Transferência',
              banco: conta.banco || 'Sicredi',
              is_forecast: true,
              forecast_key: forecastKey,
              created_at: Date.now()
            });
            totalReceitasGenerated++;
          }
        }
      }

      await logActivity({
        action: 'CREATE',
        resource_type: 'receita',
        resource_name: 'Previsões Mensais',
        details: `Gerou previsões financeiras para ${monthKey}: ${totalDespesasGenerated} despesas e ${totalReceitasGenerated} receitas.`
      });

      alert(`🎉 Previsões geradas com sucesso para o mês ${curMonthStr}/${curYear}!\n\n• Despesas Previstas: ${totalDespesasGenerated}\n• Receitas Previstas: ${totalReceitasGenerated}`);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar previsões do mês.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao || !form.valor_medio) {
      alert('Preencha a descrição e o valor médio.');
      return;
    }

    try {
      const payload = {
        descricao: form.descricao,
        categoria: form.categoria,
        tipo: form.tipo,
        valor_medio: parseFloat(form.valor_medio) || 0,
        dia_vencimento: parseInt(form.dia_vencimento) || 5,
        frequencia: form.frequencia,
        forma_pagamento: form.forma_pagamento,
        banco: form.banco,
        ativo: form.ativo
      };

      if (editingId) {
        await updateDoc(doc(db, 'contas_fixas', editingId), payload);
      } else {
        await addDoc(collection(db, 'contas_fixas'), {
          ...payload,
          created_at: Date.now()
        });
      }

      setIsModalOpen(false);
      setEditingId(null);
      setForm({
        descricao: '',
        categoria: 'Despesas Operacionais',
        tipo: 'DESPESA',
        valor_medio: '',
        dia_vencimento: '5',
        frequencia: 'MENSAL',
        forma_pagamento: 'PIX/Transferência',
        banco: 'Sicredi',
        ativo: true
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar conta fixa.');
    }
  };

  const totalFixasSaida = contasFixas
    .filter(c => c.ativo !== false && c.tipo === 'DESPESA')
    .reduce((acc, curr) => acc + (curr.valor_medio || 0), 0);

  const totalFixasEntrada = contasFixas
    .filter(c => c.ativo !== false && c.tipo === 'RECEITA')
    .reduce((acc, curr) => acc + (curr.valor_medio || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Contas Fixas & Previsões Recorrentes 🔄</h2>
          <p className="text-surface-500 text-sm">
            Gestão automatizada de despesas e receitas recorrentes pré-calculadas para projeção futura.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {contasFixas.length === 0 && (
            <button 
              onClick={handlePopulateDefaults}
              className="btn-secondary flex items-center gap-1.5 py-2 text-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Carregar Padrões Pré-calculados
            </button>
          )}

          <button 
            onClick={handleGenerateForecasts}
            disabled={isGenerating || contasFixas.length === 0}
            className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 py-2 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            ✨ Lançar Previsões do Mês Atual
          </button>

          <button 
            onClick={() => {
              setEditingId(null);
              setForm({
                descricao: '',
                categoria: 'Despesas Operacionais',
                tipo: 'DESPESA',
                valor_medio: '',
                dia_vencimento: '5',
                frequencia: 'MENSAL',
                forma_pagamento: 'PIX/Transferência',
                banco: 'Sicredi',
                ativo: true
              });
              setIsModalOpen(true);
            }} 
            className="btn-primary flex items-center gap-1.5 py-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            Nova Conta Fixa
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 border-l-4 border-rose-500">
          <span className="text-xs text-surface-400 font-semibold uppercase">Total Despesas Fixas (Mensal)</span>
          <h4 className="text-2xl font-bold text-rose-600 mt-1">R$ {totalFixasSaida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
          <p className="text-[10px] text-surface-400 mt-1">Custo Fixo Recorrente do Studio</p>
        </div>

        <div className="glass-card p-5 border-l-4 border-emerald-500">
          <span className="text-xs text-surface-400 font-semibold uppercase">Receitas Fixas (Mensal)</span>
          <h4 className="text-2xl font-bold text-emerald-600 mt-1">R$ {totalFixasEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
          <p className="text-[10px] text-surface-400 mt-1">Mensalidades Recorrentes de Alunos</p>
        </div>

        <div className="glass-card p-5 border-l-4 border-brand-medium">
          <span className="text-xs text-surface-400 font-semibold uppercase">Contas Cadastradas</span>
          <h4 className="text-2xl font-bold text-brand-dark mt-1">{contasFixas.length} Regras</h4>
          <p className="text-[10px] text-brand-medium mt-1">Automação de Lançamentos Futuros</p>
        </div>
      </div>

      {/* Tabela de Contas Fixas */}
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2">
            <Repeat className="w-5 h-5 text-brand-medium" />
            Regras de Contas Fixas Recorrentes
          </h3>

          {contasFixas.length === 0 && (
            <button 
              onClick={handlePopulateDefaults}
              className="text-xs font-bold text-brand-medium hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Clique para importar as 11 contas fixas calculadas dos extratos
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 border-b border-surface-200 font-bold text-brand-dark uppercase">
              <tr>
                <th className="p-3">Descrição da Conta</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Dia Venc.</th>
                <th className="p-3">Valor Médio (R$)</th>
                <th className="p-3">Frequência</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
              {contasFixas.map(cf => (
                <tr key={cf.id} className="hover:bg-surface-50/50">
                  <td className="p-3 font-bold text-brand-dark flex items-center gap-2">
                    {cf.tipo === 'DESPESA' ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    )}
                    {cf.descricao}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      cf.tipo === 'DESPESA' ? 'bg-rose-50 text-rose-705 border border-rose-200' : 'bg-emerald-50 text-emerald-705 border border-emerald-200'
                    }`}>
                      {cf.tipo}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-surface-600">{cf.categoria}</td>
                  <td className="p-3 font-bold">Dia {cf.dia_vencimento || 5}</td>
                  <td className="p-3 font-bold text-brand-dark">
                    R$ {(cf.valor_medio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-surface-500">{cf.frequencia || 'MENSAL'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      cf.ativo !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-400'
                    }`}>
                      {cf.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button 
                      onClick={() => {
                        setEditingId(cf.id);
                        setForm({
                          descricao: cf.descricao,
                          categoria: cf.categoria || 'Despesas Operacionais',
                          tipo: cf.tipo || 'DESPESA',
                          valor_medio: String(cf.valor_medio || ''),
                          dia_vencimento: String(cf.dia_vencimento || 5),
                          frequencia: cf.frequencia || 'MENSAL',
                          forma_pagamento: cf.forma_pagamento || 'PIX/Transferência',
                          banco: cf.banco || 'Sicredi',
                          ativo: cf.ativo !== false
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-1 text-surface-400 hover:text-brand-dark"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteConta(cf.id)}
                      className="p-1 text-surface-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {contasFixas.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-surface-400">
                    Nenhuma regra de conta fixa cadastrada. Clique no botão acima para importar as contas calculadas dos extratos!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-surface-200 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-dark">
                {editingId ? 'Editar Conta Fixa' : 'Nova Conta Fixa Recorrente'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-surface-400 hover:text-red-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-brand-dark">Descrição da Conta</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: Aluguel do Studio, Luz, Assessoria Contábil" 
                  value={form.descricao} 
                  onChange={e => setForm({ ...form, descricao: e.target.value })} 
                  className="input-field text-xs" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-brand-dark">Tipo</label>
                  <select 
                    value={form.tipo} 
                    onChange={e => setForm({ ...form, tipo: e.target.value as 'DESPESA' | 'RECEITA' })} 
                    className="input-field text-xs font-bold"
                  >
                    <option value="DESPESA">🔻 Despesa (Saída)</option>
                    <option value="RECEITA">🟢 Receita (Entrada)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-brand-dark">Categoria</label>
                  <input 
                    type="text" 
                    value={form.categoria} 
                    onChange={e => setForm({ ...form, categoria: e.target.value })} 
                    className="input-field text-xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-brand-dark">Valor Médio Mensal (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={form.valor_medio} 
                    onChange={e => setForm({ ...form, valor_medio: e.target.value })} 
                    className="input-field text-xs font-bold" 
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-brand-dark">Dia do Vencimento (1 a 31)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="31" 
                    value={form.dia_vencimento} 
                    onChange={e => setForm({ ...form, dia_vencimento: e.target.value })} 
                    className="input-field text-xs" 
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-xs">Cancelar</button>
                <button type="submit" className="btn-primary text-xs flex items-center gap-1">
                  <Save className="w-4 h-4" /> Salvar Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
