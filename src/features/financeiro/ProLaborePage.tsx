import React, { useState } from 'react';
import { 
  UserCheck, 
  DollarSign, 
  Plus, 
  Edit3, 
  Save, 
  X, 
  Award, 
  PieChart, 
  Clock,
  Sparkles
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';

export const ProLaborePage = () => {
  const { data: despesas } = useCollection<any>('despesas');
  const { data: configs } = useCollection<any>('config');

  // Mês Selecionado (Padrão: Mês Atual)
  const today = new Date();
  const defaultMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthKey);

  // Meta de Pró-Labore (Salva na coleção config ou padrão 4000.00)
  const metaConfig = configs.find((c: any) => c.id === 'pro_labore_meta');
  const metaValor = metaConfig ? metaConfig.valor : 4000.00;

  const [isEditMetaOpen, setIsEditMetaOpen] = useState(false);
  const [newMetaInput, setNewMetaInput] = useState<string>(String(metaValor));

  // Modal Novo Saque
  const [isSaqueModalOpen, setIsSaqueModalOpen] = useState(false);
  const [saqueForm, setSaqueForm] = useState({
    data: today.toISOString().split('T')[0],
    valor: '',
    descricao: 'Pró-Labore / Retirada de Sócia - Adriana Minello',
    forma_pagamento: 'PIX',
    banco: 'Sicredi',
    observacoes: ''
  });

  // Salvar Nova Meta do Admin
  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newMetaInput) || 4000;
    try {
      await setDoc(doc(db, 'config', 'pro_labore_meta'), {
        valor: val,
        updated_at: Date.now()
      });

      await logActivity({
        action: 'UPDATE',
        resource_type: 'receita',
        resource_name: 'Meta Pró-Labore',
        details: `Atualizou a meta mensal de Pró-Labore para R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      });

      setIsEditMetaOpen(false);
      alert('Meta mensal de Pró-Labore atualizada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar meta de Pró-Labore.');
    }
  };

  // Filtrar retiradas de Pró-Labore
  const isProLaboreTrn = (d: any) => {
    const desc = (d.descricao || '').toUpperCase();
    const cat = (d.categoria || '').toUpperCase();
    return (
      cat.includes('PRÓ-LABORE') || 
      cat.includes('PRO-LABORE') || 
      cat.includes('PROLABORE') || 
      desc.includes('PRO-LABORE') || 
      desc.includes('PROLABORE') || 
      desc.includes('PRÓ-LABORE') || 
      desc.includes('ADRIANA MINELLO') || 
      desc.includes('RETIRADA SOCIA')
    );
  };

  const allProLaboreDespesas = despesas.filter(isProLaboreTrn);

  // Retiradas do mês selecionado
  const monthProLabore = allProLaboreDespesas.filter(d => {
    const dt = d.data_pagamento || d.data_vencimento || '';
    return dt.startsWith(selectedMonth);
  }).sort((a, b) => (b.data_pagamento || b.data_vencimento || '').localeCompare(a.data_pagamento || a.data_vencimento || ''));

  const totalRetiradoMes = monthProLabore.reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);
  const saldoRestante = Math.max(0, metaValor - totalRetiradoMes);
  const percentAtingido = Math.min(100, Math.round((totalRetiradoMes / (metaValor || 1)) * 100));

  // Cadastrar Novo Saque de Pró-Labore
  const handleSaveSaque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saqueForm.valor) {
      alert('Informe o valor da retirada.');
      return;
    }

    try {
      const val = parseFloat(saqueForm.valor) || 0;
      await addDoc(collection(db, 'despesas'), {
        descricao: saqueForm.descricao,
        categoria: 'Salários & Pró-Labore',
        valor: val,
        data_vencimento: saqueForm.data,
        data_pagamento: saqueForm.data,
        status: 'PAGO',
        forma_pagamento: saqueForm.forma_pagamento,
        banco: saqueForm.banco,
        observacoes: saqueForm.observacoes,
        is_pro_labore: true,
        created_at: Date.now()
      });

      await logActivity({
        action: 'CREATE',
        resource_type: 'receita',
        resource_name: 'Saque Pró-Labore',
        details: `Registrou saque de Pró-Labore no valor de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      });

      setIsSaqueModalOpen(false);
      setSaqueForm({
        data: today.toISOString().split('T')[0],
        valor: '',
        descricao: 'Pró-Labore / Retirada de Sócia - Adriana Minello',
        forma_pagamento: 'PIX',
        banco: 'Sicredi',
        observacoes: ''
      });

      alert('Saque de Pró-Labore lançado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar saque.');
    }
  };

  // Agrupamento Histórico Mês a Mês (Últimos 12 meses)
  const historyMonths: { [key: string]: number } = {};
  allProLaboreDespesas.forEach(d => {
    const dt = d.data_pagamento || d.data_vencimento || '';
    if (dt && dt.length >= 7) {
      const mKey = dt.substring(0, 7);
      historyMonths[mKey] = (historyMonths[mKey] || 0) + (parseFloat(d.valor) || 0);
    }
  });

  const sortedHistoryKeys = Object.keys(historyMonths).sort().reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Gestão de Pró-Labore & Sócios 👑</h2>
          <p className="text-surface-500 text-sm">
            Controle de meta fixa mensal de retiradas, saques fracionados e extrato de sócios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Seletor de Mês */}
          <div className="relative min-w-[160px]">
            <input 
              type="month" 
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="input-field text-xs font-bold py-2"
            />
          </div>

          <button 
            onClick={() => {
              setNewMetaInput(String(metaValor));
              setIsEditMetaOpen(true);
            }}
            className="btn-secondary flex items-center gap-1.5 py-2 text-xs font-bold"
          >
            <Edit3 className="w-4 h-4 text-brand-medium" />
            Configurar Meta Fixa
          </button>

          <button 
            onClick={() => setIsSaqueModalOpen(true)}
            className="btn-primary bg-brand-medium hover:bg-brand-dark text-white flex items-center gap-1.5 py-2 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Registrar Saque de Pró-Labore
          </button>
        </div>
      </div>

      {/* KPI Cards da Meta do Mês */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Meta Mensal */}
        <div className="glass-card p-5 border-l-4 border-indigo-500 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-surface-400 font-semibold uppercase">Meta Mensal de Pró-Labore</span>
              <h4 className="text-2xl font-bold text-brand-dark mt-1">
                R$ {metaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h4>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-surface-400 mt-2">Definida pelo Administrador</p>
        </div>

        {/* Total Retirado no Mês */}
        <div className="glass-card p-5 border-l-4 border-brand-medium relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-surface-400 font-semibold uppercase">Total Sacado no Mês</span>
              <h4 className="text-2xl font-bold text-brand-dark mt-1">
                R$ {totalRetiradoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h4>
            </div>
            <div className="p-2.5 rounded-xl bg-brand-50 text-brand-medium">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-brand-medium mt-2">{monthProLabore.length} lançamentos efetuados</p>
        </div>

        {/* Saldo Restante a Sacar */}
        <div className="glass-card p-5 border-l-4 border-amber-500 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-surface-400 font-semibold uppercase">Saldo Disponível p/ Meta</span>
              <h4 className="text-2xl font-bold text-amber-600 mt-1">
                R$ {saldoRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h4>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-amber-600 mt-2">Valor restante até atingir a meta</p>
        </div>

        {/* Percentual Atingido */}
        <div className="glass-card p-5 border-l-4 border-emerald-500 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-surface-400 font-semibold uppercase">% Da Meta Atingido</span>
              <h4 className="text-2xl font-bold text-emerald-600 mt-1">{percentAtingido}%</h4>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full bg-surface-100 rounded-full h-2 mt-2">
            <div 
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${percentAtingido}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Extrato de Lançamentos Fracionados do Mês Selecionado */}
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-medium" />
            Extrato de Retiradas do Mês ({selectedMonth})
          </h3>

          <span className="text-xs text-surface-500 font-semibold">
            {monthProLabore.length} retiradas registradas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 border-b border-surface-200 font-bold text-brand-dark uppercase">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Descrição / Favorecida</th>
                <th className="p-3">Forma PGTO</th>
                <th className="p-3">Banco</th>
                <th className="p-3">Valor (R$)</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
              {monthProLabore.map(d => (
                <tr key={d.id} className="hover:bg-surface-50/50">
                  <td className="p-3 font-bold text-brand-dark">{d.data_pagamento || d.data_vencimento}</td>
                  <td className="p-3 font-semibold text-surface-800">{d.descricao}</td>
                  <td className="p-3">{d.forma_pagamento || 'PIX'}</td>
                  <td className="p-3 text-surface-500">{d.banco || 'Sicredi'}</td>
                  <td className="p-3 font-bold text-brand-dark">
                    R$ {(parseFloat(d.valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      EFETUADO
                    </span>
                  </td>
                </tr>
              ))}

              {monthProLabore.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-surface-400">
                    Nenhum saque de Pró-Labore registrado no mês selecionado ({selectedMonth}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico Comparativo Mês a Mês */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-brand-medium" />
          Histórico Comparativo de Pró-Labore Mês a Mês ({sortedHistoryKeys.length} meses)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-50 border-b border-surface-200 font-bold text-brand-dark uppercase">
              <tr>
                <th className="p-3">Ano / Mês</th>
                <th className="p-3">Meta (R$)</th>
                <th className="p-3">Total Sacado (R$)</th>
                <th className="p-3">Diferença (R$)</th>
                <th className="p-3">% Atingido</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
              {sortedHistoryKeys.slice(0, 15).map(mKey => {
                const totalM = historyMonths[mKey];
                const dif = totalM - metaValor;
                const pct = Math.round((totalM / (metaValor || 1)) * 100);

                return (
                  <tr key={mKey} className="hover:bg-surface-50/50">
                    <td className="p-3 font-bold text-brand-dark">{mKey}</td>
                    <td className="p-3">R$ {metaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 font-bold text-brand-dark">R$ {totalM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className={`p-3 font-bold ${dif >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {dif >= 0 ? '+' : ''} R$ {dif.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-bold">{pct}%</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pct >= 100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {pct >= 100 ? 'Meta Atingida' : 'Em Andamento'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar Meta */}
      {isEditMetaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsEditMetaOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-surface-200 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-dark">Configurar Meta Mensal de Pró-Labore</h3>
              <button onClick={() => setIsEditMetaOpen(false)} className="p-1 text-surface-400 hover:text-red-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMeta} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-brand-dark">Meta Mensal Desejada (R$)</label>
                <input 
                  type="number" 
                  step="100" 
                  required 
                  value={newMetaInput} 
                  onChange={e => setNewMetaInput(e.target.value)} 
                  className="input-field text-sm font-bold mt-1" 
                />
                <p className="text-[10px] text-surface-400 mt-1">Valor fixo de referência mensal para controle de retiradas da sócia.</p>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setIsEditMetaOpen(false)} className="btn-secondary text-xs">Cancelar</button>
                <button type="submit" className="btn-primary text-xs flex items-center gap-1">
                  <Save className="w-4 h-4" /> Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lançar Novo Saque */}
      {isSaqueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsSaqueModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-surface-200 animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-dark">Registrar Saque de Pró-Labore</h3>
              <button onClick={() => setIsSaqueModalOpen(false)} className="p-1 text-surface-400 hover:text-red-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSaque} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-brand-dark">Data da Retirada</label>
                <input 
                  type="date" 
                  required 
                  value={saqueForm.data} 
                  onChange={e => setSaqueForm({ ...saqueForm, data: e.target.value })} 
                  className="input-field text-xs" 
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-brand-dark">Valor do Saque (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  placeholder="0,00" 
                  value={saqueForm.valor} 
                  onChange={e => setSaqueForm({ ...saqueForm, valor: e.target.value })} 
                  className="input-field text-sm font-bold" 
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-brand-dark">Descrição / Observações</label>
                <input 
                  type="text" 
                  value={saqueForm.descricao} 
                  onChange={e => setSaqueForm({ ...saqueForm, descricao: e.target.value })} 
                  className="input-field text-xs" 
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setIsSaqueModalOpen(false)} className="btn-secondary text-xs">Cancelar</button>
                <button type="submit" className="btn-primary text-xs flex items-center gap-1">
                  <Save className="w-4 h-4" /> Confirmar Saque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
