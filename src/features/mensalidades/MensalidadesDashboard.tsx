import React, { useState } from 'react';
import { 
  Users, 
  TrendingUp, 
  RefreshCw, 
  Percent,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
  X,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import type { Aluno, Plano } from '../../types/database';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import { useUser } from '../../contexts/UserContext';

const StatCard = ({ label, value, change, icon, borderClass }: { 
  label: string, 
  value: string, 
  change: string, 
  icon: React.ReactNode,
  borderClass: string
}) => (
  <div className={`glass-card p-6 border-l-4 ${borderClass} hover:translate-y-[-4px] transition-all cursor-default`}>
    <div className="flex justify-between items-start mb-4">
      <p className="text-sm font-medium text-surface-400">{label}</p>
      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
        {icon}
      </div>
    </div>
    <h4 className="text-3xl font-display text-brand-dark mb-2">{value}</h4>
    <p className="text-xs text-indigo-600 font-semibold">{change}</p>
  </div>
);

export const MensalidadesDashboard = () => {
  const { user } = useUser();
  
  // Modais
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [valorPago, setValorPago] = useState('0');

  // Firestore collections
  const { data: alunos, loading: loadingAlunos } = useCollection<Aluno>('alunos');
  const { data: planos, loading: loadingPlanos } = useCollection<Plano>('planos');

  const totalContratosAtivos = alunos.filter(a => a.ativo && a.plano_id).length;

  const totalFaturamentoProjetado = alunos
    .filter(a => a.ativo && a.plano_id)
    .reduce((sum, a) => sum + (a.valor_mensalidade || 0), 0);

  const isThisMonth = (dateStr?: string) => {
    if (!dateStr) return false;
    // YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length < 2) return false;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // 0-indexed month
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth();
  };

  const totalRenovantesMes = alunos.filter(a => a.ativo && a.plano_id && isThisMonth(a.vencimento_plano)).length;

  const getProximasRenovacoes = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);
    
    return alunos
      .filter(a => {
        if (!a.ativo || !a.plano_id || !a.vencimento_plano) return false;
        const vDate = new Date(a.vencimento_plano);
        return vDate <= thirtyDaysLater;
      })
      .map(a => {
        const vDate = new Date(a.vencimento_plano!);
        const diffTime = vDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          id: a.id,
          aluno: `${a.nome} ${a.sobrenome || ''}`.trim(),
          plano: a.plano_nome || 'Plano Personalizado',
          dias: diffDays,
          vencimento: a.vencimento_plano ? new Date(a.vencimento_plano + 'T12:00:00').toLocaleDateString('pt-BR') : '',
          valor: `R$ ${(a.valor_mensalidade || 0).toFixed(2).replace('.', ',')}`,
          alunoRaw: a
        };
      })
      .sort((a, b) => a.dias - b.dias);
  };

  const getDistribuicaoPlanos = () => {
    const total = totalContratosAtivos;
    if (total === 0) return [];
    
    const counts: Record<string, number> = {};
    alunos.forEach(a => {
      if (a.ativo && a.plano_id) {
        counts[a.plano_id] = (counts[a.plano_id] || 0) + 1;
      }
    });

    const activePlanos = planos.filter(p => p.ativo);
    
    return activePlanos.map(p => {
      const count = counts[p.id] || 0;
      const pct = total > 0 ? (count / total * 100).toFixed(0) : '0';
      return {
        nome: p.nome,
        count,
        pct: `${pct}%`
      };
    }).sort((a, b) => b.count - a.count);
  };

  const calculateNewExpiration = (aluno: Aluno) => {
    if (!aluno.vencimento_plano) return new Date().toISOString().split('T')[0];
    const current = new Date(aluno.vencimento_plano + 'T12:00:00');
    const today = new Date();
    
    // Se o plano já venceu, inicia a contagem a partir de hoje
    const start = current < today ? today : current;
    
    const plano = planos.find(p => p.id === aluno.plano_id);
    const months = plano ? plano.duracao_meses : 1;
    
    const next = new Date(start);
    next.setMonth(start.getMonth() + months);
    return next.toISOString().split('T')[0];
  };

  const handleOpenRenew = (aluno: Aluno) => {
    setSelectedAluno(aluno);
    setPaymentMethod('Pix');
    
    // Buscar o plano mais recente correspondente ao plano_id para sugerir o preço atualizado
    const plano = planos.find(p => p.id === aluno.plano_id);
    const precoSugerido = plano ? plano.valor : (aluno.valor_mensalidade || 0);
    setValorPago(precoSugerido.toString());
    
    setIsRenewModalOpen(true);
  };

  const handleConfirmRenew = async () => {
    if (!selectedAluno) return;
    setIsRenewing(true);
    try {
      const plano = planos.find(p => p.id === selectedAluno.plano_id);
      const newVencimento = calculateNewExpiration(selectedAluno);
      const valorFinal = parseFloat(valorPago) || 0;
      
      const planoNome = plano ? plano.nome : (selectedAluno.plano_nome || 'Plano Personalizado');
      const modalidade = plano ? plano.modalidade : (selectedAluno.modalidade || 'musculacao');
      const frequencia = plano ? plano.frequencia_semanal : (selectedAluno.frequencia_semanal || 3);
      
      // 1. Atualizar data de vencimento no Aluno e sincronizar dados do plano
      await updateDoc(doc(db, 'alunos', selectedAluno.id), {
        vencimento_plano: newVencimento,
        valor_mensalidade: valorFinal,
        plano_nome: planoNome,
        modalidade: modalidade,
        frequencia_semanal: frequencia
      });

      // 2. Criar log de Renovação
      await addDoc(collection(db, 'renovacoes'), {
        aluno_id: selectedAluno.id,
        aluno_nome: `${selectedAluno.nome} ${selectedAluno.sobrenome || ''}`.trim(),
        plano_id: selectedAluno.plano_id || '',
        plano_nome: planoNome,
        valor_pago: valorFinal,
        data_renovacao: new Date().toISOString().split('T')[0],
        operador: user?.email || 'admin',
        created_at: Date.now()
      });

      // 3. Criar receita em Contas a Receber (Financeiro) como Paga
      await addDoc(collection(db, 'receitas'), {
        aluno_id: selectedAluno.id,
        aluno_nome: `${selectedAluno.nome} ${selectedAluno.sobrenome || ''}`.trim(),
        plano: planoNome,
        valor: valorFinal,
        vencimento: new Date().toISOString().split('T')[0],
        status: 'pago',
        forma_pagamento: paymentMethod,
        data_pagamento: Date.now(),
        created_at: Date.now()
      });

      await logActivity({
        action: 'UPDATE',
        resource_type: 'receita',
        details: `Efetuou renovação de plano para ${selectedAluno.nome}. Novo vencimento: ${newVencimento}`
      });

      alert('Renovação concluída com sucesso!');
      setIsRenewModalOpen(false);
      setSelectedAluno(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao renovar plano do aluno.');
    } finally {
      setIsRenewing(false);
    }
  };

  if (loadingAlunos || loadingPlanos) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4 text-surface-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
        <p>Carregando métricas de mensalidade...</p>
      </div>
    );
  }

  const proximasRenovacoes = getProximasRenovacoes();
  const distribuicao = getDistribuicaoPlanos();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Gestão de Mensalidades 💳</h2>
          <p className="text-surface-500">Acompanhe contratos, planos recorrentes e taxas de renovação.</p>
        </div>
        <span className="px-4 py-2 rounded-xl bg-white border border-surface-200 text-sm text-surface-600 font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          Visão Geral: {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* Grid de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          label="Contratos Ativos" 
          value={`${totalContratosAtivos} Alunos`} 
          icon={<Users className="w-5 h-5 text-indigo-600" />} 
          change="Planos ativos cadastrados" 
          borderClass="border-l-indigo-600" 
        />
        <StatCard 
          label="Faturamento Mensal Projetado" 
          value={`R$ ${totalFaturamentoProjetado.toFixed(2).replace('.', ',')}`} 
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />} 
          change="Soma dos planos recorrentes" 
          borderClass="border-l-indigo-600" 
        />
        <StatCard 
          label="Vencendo no Mês" 
          value={`${totalRenovantesMes} Alunos`} 
          icon={<RefreshCw className="w-5 h-5 text-indigo-600" />} 
          change="Vencimentos no mês atual" 
          borderClass="border-l-indigo-600" 
        />
        <StatCard 
          label="Taxa de Retenção" 
          value="96,5%" 
          icon={<Percent className="w-5 h-5 text-indigo-600" />} 
          change="Meta estabelecida: 95,0%" 
          borderClass="border-l-indigo-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Próximas Renovações */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-brand-dark">
            <Clock className="w-5 h-5 text-indigo-600" />
            Planos a Vencer nos Próximos 30 dias (ou Vencidos)
          </h3>

          <div className="space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar pr-1">
            {proximasRenovacoes.map((item) => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-4 rounded-xl border border-surface-100 hover:bg-surface-50 transition-all"
              >
                <div>
                  <p className="font-semibold text-brand-dark">{item.aluno}</p>
                  <p className="text-xs text-surface-400">
                    {item.plano} • {item.dias < 0 
                      ? <span className="text-red-500 font-bold">Vencido há {Math.abs(item.dias)} dias</span> 
                      : item.dias === 0 
                      ? <span className="text-amber-500 font-bold">Vence hoje</span> 
                      : `Vence em ${item.dias} dias`} ({item.vencimento})
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-brand-dark">{item.valor}</span>
                  <button 
                    onClick={() => handleOpenRenew(item.alunoRaw)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    Renovar <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {proximasRenovacoes.length === 0 && (
              <div className="text-center p-12 text-surface-400 italic">
                Nenhum plano vencido ou a vencer nos próximos 30 dias.
              </div>
            )}
          </div>
        </div>

        {/* Distribuição de Planos */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-brand-dark">
              <AlertCircle className="w-5 h-5 text-indigo-600" />
              Distribuição de Planos
            </h3>
            <div className="space-y-4">
              {distribuicao.map((plano, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-surface-600">
                    <span>{plano.nome}</span>
                    <span>{plano.count} ({plano.pct})</span>
                  </div>
                  <div className="w-full bg-surface-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: plano.pct }} />
                  </div>
                </div>
              ))}
              {distribuicao.length === 0 && (
                <div className="text-center p-8 text-surface-400 italic">
                  Nenhum plano contratado ativo.
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={() => alert('Mensagem rápida via WhatsApp iniciada (Funcionalidade de alerta)')}
            className="w-full mt-6 btn-primary bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 text-sm cursor-pointer"
          >
            Disparar Avisos Manualmente
          </button>
        </div>
      </div>

      {/* Modal Confirmar Renovação */}
      {isRenewModalOpen && selectedAluno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsRenewModalOpen(false)}></div>
          
          <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-surface-200 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-dark flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                Renovar Matrícula
              </h3>
              <button onClick={() => setIsRenewModalOpen(false)} className="p-2 hover:bg-surface-100 rounded-xl text-surface-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2 text-sm text-brand-dark">
                <p>Aluno: <strong>{selectedAluno.nome} {selectedAluno.sobrenome || ''}</strong></p>
                <p>Plano Atual: <strong>{selectedAluno.plano_nome || 'Nenhum'}</strong></p>
                <p>Valor de Tabela: <strong>R$ {(selectedAluno.valor_mensalidade || 0).toFixed(2).replace('.', ',')}</strong></p>
                <p>Vencimento Atual: <strong>{selectedAluno.vencimento_plano ? new Date(selectedAluno.vencimento_plano + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}</strong></p>
                <p className="text-indigo-700">Novo Vencimento Estimado: <strong>{new Date(calculateNewExpiration(selectedAluno) + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-surface-400" /> Valor Pago (R$)
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={valorPago} 
                    onChange={e => setValorPago(e.target.value)} 
                    className="input-field cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark flex items-center gap-2">
                    Forma de Pagamento
                  </label>
                  <select 
                    value={paymentMethod} 
                    onChange={e => setPaymentMethod(e.target.value)} 
                    className="input-field cursor-pointer"
                  >
                    <option value="Pix">Pix</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
              <button type="button" onClick={() => setIsRenewModalOpen(false)} className="btn-secondary" disabled={isRenewing}>
                Cancelar
              </button>
              <button onClick={handleConfirmRenew} className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isRenewing}>
                {isRenewing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Confirmar e Lançar Caixa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MensalidadesDashboard;
