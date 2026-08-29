import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  Clock, 
  ClipboardList, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRight,
  PieChart,
  CheckCircle2,
  X
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import { useUser } from '../../contexts/UserContext';
import type { Aluno, AgendamentoFixo, AulaSessao, Mesociclo, Plano } from '../../types/database';
import { getPlanosDoAluno } from '../../types/database';
import type { Receita } from '../financeiro/ReceitaFormModal';
import type { Despesa } from '../financeiro/DespesaFormModal';

export const DashboardGeral = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  // Load Firestore Collections
  const { data: alunos, loading: loadingAlunos } = useCollection<Aluno>('alunos');
  const { data: planos, loading: loadingPlanos } = useCollection<Plano>('planos');
  const { data: receitas, loading: loadingReceitas } = useCollection<Receita>('receitas');
  const { data: despesas, loading: loadingDespesas } = useCollection<Despesa>('despesas');
  const { data: agendamentosFixos, loading: loadingAgendamentos } = useCollection<AgendamentoFixo>('agendamentos_fixos');
  const { data: agendaAulas, loading: loadingAulas } = useCollection<AulaSessao>('agenda_aulas');
  const { data: mesociclos, loading: loadingMesos } = useCollection<Mesociclo>('mesociclos');

  const loading = loadingAlunos || loadingPlanos || loadingReceitas || loadingDespesas || loadingAgendamentos || loadingAulas || loadingMesos;

  // Modais de Renovação
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [valorPago, setValorPago] = useState('0');

  // Date Logic
  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();
  const todayStr = now.toISOString().split('T')[0];

  const startOfMonth = new Date(currentYear, currentMonthIndex, 1).getTime();
  const endOfMonth = new Date(currentYear, currentMonthIndex + 1, 1).getTime();

  // Config Capacity
  const [maxCapacity, setMaxCapacity] = useState(3);
  useEffect(() => {
    const loadCapacity = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'agenda'));
        if (snap.exists()) {
          setMaxCapacity(snap.data().max_alunos_slot ?? 3);
        }
      } catch (err) {
        console.error('Erro ao ler config da agenda:', err);
      }
    };
    loadCapacity();
  }, []);

  // 1. Operational calculations
  const alunosAtivos = alunos.filter(a => a.ativo !== false);
  const totalAlunosAtivos = alunosAtivos.length;

  // Alunos sem treino ativo
  const alunosSemTreino = alunosAtivos.filter(aluno => {
    const temMesoAtivo = mesociclos.some(m => m.aluno_id === aluno.id && m.status === 'ativo');
    return !temMesoAtivo;
  });

  // Today's classes and status
  const aulasHoje = agendaAulas.filter(a => a.data === todayStr);
  const presencasHoje = aulasHoje.filter(a => a.status === 'presenca').length;
  const faltasHoje = aulasHoje.filter(a => a.status === 'falta').length;
  const pendentesHoje = aulasHoje.filter(a => a.status === 'confirmado').length;

  // 2. Mensalidades, Planos & Renovações
  const totalFaturamentoProjetado = alunosAtivos.reduce((sum, a) => {
    const pDoAluno = getPlanosDoAluno(a);
    if (pDoAluno.length > 0) {
      return sum + pDoAluno.reduce((sub, p) => sub + (p.valor_mensalidade || 0), 0);
    }
    return sum + (a.valor_mensalidade || 0);
  }, 0);

  const getProximasRenovacoes = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    
    return alunosAtivos
      .filter(a => a.vencimento_plano)
      .map(a => {
        const vDate = new Date(a.vencimento_plano!);
        const diffTime = vDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          id: a.id,
          aluno: `${a.nome} ${a.sobrenome || ''}`.trim(),
          plano: a.plano_nome || 'Plano Mensal',
          dias: diffDays,
          vencimento: a.vencimento_plano ? new Date(a.vencimento_plano + 'T12:00:00').toLocaleDateString('pt-BR') : '',
          valor: `R$ ${(a.valor_mensalidade || 0).toFixed(2).replace('.', ',')}`,
          alunoRaw: a
        };
      })
      .filter(a => a.dias <= 30)
      .sort((a, b) => a.dias - b.dias);
  };

  const proximasRenovacoes = getProximasRenovacoes();

  // Distribuição de Planos
  const getDistribuicaoPlanos = () => {
    const total = alunosAtivos.length;
    if (total === 0) return [];
    
    const counts: Record<string, number> = {};
    alunosAtivos.forEach(a => {
      const pDoAluno = getPlanosDoAluno(a);
      if (pDoAluno.length > 0) {
        pDoAluno.forEach(p => {
          const key = p.plano_nome || 'Plano Personalizado';
          counts[key] = (counts[key] || 0) + 1;
        });
      } else if (a.plano_nome) {
        counts[a.plano_nome] = (counts[a.plano_nome] || 0) + 1;
      }
    });

    return Object.entries(counts).map(([nome, count]) => {
      const pct = (count / total * 100).toFixed(0);
      return {
        nome,
        count,
        pct: `${pct}%`
      };
    }).sort((a, b) => b.count - a.count);
  };

  const distribuicaoPlanos = getDistribuicaoPlanos();

  // Função de cálculo de nova expiração
  const calculateNewExpiration = (aluno: Aluno) => {
    if (!aluno.vencimento_plano) return new Date().toISOString().split('T')[0];
    const current = new Date(aluno.vencimento_plano + 'T12:00:00');
    const today = new Date();
    
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
      
      // 1. Atualizar data de vencimento no Aluno
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

      // 3. Criar receita em Contas a Receber como Paga
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

  const getItemPaidMs = (item: { data_pagamento?: number | string | null }): number | null => {
    if (!item.data_pagamento) return null;
    if (typeof item.data_pagamento === 'number') return item.data_pagamento;
    if (typeof item.data_pagamento === 'string') {
      const parsed = new Date(item.data_pagamento.includes('T') ? item.data_pagamento : item.data_pagamento + 'T12:00:00').getTime();
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const getItemDueStr = (item: { vencimento?: string; data_vencimento?: string }): string => {
    return item.vencimento || item.data_vencimento || '';
  };

  // 3. Financial calculations (Current Month)
  const receitasPagasMes = receitas.filter(r => {
    if ((r.status || '').toLowerCase() !== 'pago') return false;
    const pMs = getItemPaidMs(r);
    return pMs !== null && pMs >= startOfMonth && pMs < endOfMonth;
  });
  const totalRecebido = receitasPagasMes.reduce((acc, r) => acc + (r.valor || 0), 0);

  const despesasPagasMes = despesas.filter(d => {
    if ((d.status || '').toLowerCase() !== 'pago') return false;
    const pMs = getItemPaidMs(d);
    return pMs !== null && pMs >= startOfMonth && pMs < endOfMonth;
  });
  const totalPago = despesasPagasMes.reduce((acc, d) => acc + (d.valor || 0), 0);

  const faturamentoLiquido = totalRecebido - totalPago;

  // Inadimplência
  const receitasInadimplentes = receitas.filter(r => {
    const st = (r.status || '').toLowerCase();
    const dueStr = getItemDueStr(r);
    return st === 'atrasado' || (st === 'pendente' && dueStr !== '' && dueStr < todayStr);
  });
  const totalInadimplencia = receitasInadimplentes.reduce((acc, r) => acc + (r.valor || 0), 0);

  // Previsão de Recebimento no mês
  const receitasVencemMes = receitas.filter(r => {
    const dueStr = getItemDueStr(r);
    if (!dueStr) return false;
    const [year, month] = dueStr.split('-').map(Number);
    return year === currentYear && month === (currentMonthIndex + 1);
  });
  const totalApenasPendenteMes = receitasVencemMes
    .filter(r => r.status !== 'pago')
    .reduce((acc, r) => acc + r.valor, 0);

  // Occupancy calculation
  const totalWeeklySlots = 28 * maxCapacity * 5;
  const totalWeeklyAgendados = agendamentosFixos
    .filter(a => a.ativo !== false)
    .reduce((acc, curr) => acc + (curr.dias?.length || 0), 0);

  const taxaOcupacao = totalWeeklySlots > 0 ? (totalWeeklyAgendados / totalWeeklySlots) * 100 : 0;

  // WhatsApp notify
  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 11) {
      return '55' + digits;
    }
    return digits;
  };

  const handleNotify = (item: Receita) => {
    const student = alunos.find(a => a.id === item.aluno_id);
    const tel = student?.telefone;
    if (!tel) {
      alert(`O aluno ${item.aluno_nome} não possui telefone cadastrado.`);
      return;
    }
    const phone = cleanPhone(tel);
    const msg = `Olá ${item.aluno_nome}, identificamos que a sua mensalidade de R$ ${item.valor.toFixed(2).replace('.', ',')} com vencimento em ${new Date(item.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')} está pendente de pagamento. Por favor, desconsidere caso já tenha efetuado.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-surface-400 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-medium" />
        <p className="font-semibold text-brand-dark">Carregando Dashboard Geral...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-display text-brand-dark">Dashboard Geral 📊</h2>
        <p className="text-surface-500 text-sm">Visão unificada das operações, finanças, treinos e distribuição de mensalidades.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Caixa Líquido */}
        <div className="glass-card p-5 border-l-4 border-l-emerald-500 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold uppercase text-surface-400">Saldo Líquido (Mês)</p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              {faturamentoLiquido >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-display font-bold text-brand-dark">
              R$ {faturamentoLiquido.toFixed(2).replace('.', ',')}
            </h4>
            <p className="text-[11px] text-surface-400 mt-1">
              Entradas: R$ {totalRecebido.toFixed(0)} | Saídas: R$ {totalPago.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Alunos Ativos */}
        <div className="glass-card p-5 border-l-4 border-l-brand-medium flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold uppercase text-surface-400">Alunos Ativos</p>
            <div className="p-2 bg-brand-dark/5 text-brand-medium rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-display font-bold text-brand-dark">
              {totalAlunosAtivos}
            </h4>
            <p className="text-[11px] text-surface-400 mt-1">
              Matrículas ativas no studio
            </p>
          </div>
        </div>

        {/* Faturamento Mensal Projetado */}
        <div className="glass-card p-5 border-l-4 border-l-indigo-600 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold uppercase text-surface-400">Faturamento Projetado</p>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-display font-bold text-brand-dark">
              R$ {totalFaturamentoProjetado.toFixed(2).replace('.', ',')}
            </h4>
            <p className="text-[11px] text-surface-400 mt-1">
              Soma dos planos recorrentes
            </p>
          </div>
        </div>

        {/* Ocupação */}
        <div className="glass-card p-5 border-l-4 border-l-amber-500 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold uppercase text-surface-400">Ocupação Agenda</p>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-display font-bold text-brand-dark">
              {taxaOcupacao.toFixed(1)}%
            </h4>
            <p className="text-[11px] text-surface-400 mt-1">
              {totalWeeklyAgendados} slots semanais ocupados
            </p>
          </div>
        </div>

        {/* Inadimplência */}
        <div className="glass-card p-5 border-l-4 border-l-red-500 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold uppercase text-surface-400">Inadimplência</p>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-display font-bold text-red-600">
              R$ {totalInadimplencia.toFixed(2).replace('.', ',')}
            </h4>
            <p className="text-[11px] text-surface-400 mt-1">
              {receitasInadimplentes.length} pendências em atraso
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Agenda & Renovações */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Próximas Renovações de Mensalidades (30 Dias) */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-brand-dark">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                Renovações de Mensalidades (Próximos 30 dias)
              </h3>
              <button 
                onClick={() => navigate('/prescricao/alunos')}
                className="text-xs text-brand-medium font-bold hover:underline"
              >
                Gerenciar Alunos
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
              {proximasRenovacoes.length > 0 ? (
                proximasRenovacoes.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3.5 rounded-xl border border-surface-100 hover:bg-surface-50 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-brand-dark text-sm">{item.aluno}</p>
                      <p className="text-xs text-surface-400">
                        {item.plano} • {item.dias < 0 
                          ? <span className="text-red-500 font-bold">Vencido há {Math.abs(item.dias)} dias</span> 
                          : item.dias === 0 
                          ? <span className="text-amber-500 font-bold">Vence hoje</span> 
                          : `Vence em ${item.dias} dias`} ({item.vencimento})
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-brand-dark text-xs">{item.valor}</span>
                      <button 
                        onClick={() => handleOpenRenew(item.alunoRaw)}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        Renovar <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-surface-400 text-center py-6">Nenhum plano vencido ou a vencer nos próximos 30 dias.</p>
              )}
            </div>
          </div>

          {/* Agenda de Hoje */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-brand-dark">
                <Clock className="w-5 h-5 text-indigo-500" />
                Resumo da Agenda (Hoje)
              </h3>
              <button 
                onClick={() => navigate('/agenda')}
                className="text-xs text-brand-medium font-bold hover:underline"
              >
                Ver Agenda Completa
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6 text-center">
              <div className="bg-surface-50 p-3 rounded-xl border border-surface-150">
                <p className="text-xs text-surface-400 font-semibold uppercase">Presenças</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{presencasHoje}</p>
              </div>
              <div className="bg-surface-50 p-3 rounded-xl border border-surface-150">
                <p className="text-xs text-surface-400 font-semibold uppercase">Faltas</p>
                <p className="text-2xl font-bold text-red-500 mt-1">{faltasHoje}</p>
              </div>
              <div className="bg-surface-50 p-3 rounded-xl border border-surface-150">
                <p className="text-xs text-surface-400 font-semibold uppercase">Restantes</p>
                <p className="text-2xl font-bold text-amber-500 mt-1">{pendentesHoje}</p>
              </div>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
              {aulasHoje.length > 0 ? (
                aulasHoje.map((aula) => (
                  <div 
                    key={aula.id} 
                    className="flex items-center justify-between p-3.5 rounded-xl border border-surface-100 hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        aula.status === 'presenca' ? 'bg-green-500' :
                        aula.status === 'falta' ? 'bg-red-500' :
                        aula.status === 'cancelado' ? 'bg-surface-400' : 'bg-amber-400'
                      }`} />
                      <div>
                        <p className="font-semibold text-brand-dark text-sm">{aula.aluno_nome}</p>
                        <p className="text-xs text-surface-400">
                          {aula.hora} • Prof: {aula.personal_nome}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      aula.status === 'presenca' ? 'bg-green-100 text-green-700' :
                      aula.status === 'falta' ? 'bg-red-100 text-red-700' :
                      aula.status === 'cancelado' ? 'bg-surface-100 text-surface-600' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {aula.status === 'confirmado' ? 'Pendente' : 
                       aula.status === 'presenca' ? 'Presença' :
                       aula.status === 'falta' ? 'Falta' : 'Cancelado'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-surface-400 text-center py-6">Nenhum agendamento de aula registrado para hoje.</p>
              )}
            </div>
          </div>

          {/* Finanças do Mês */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-brand-dark">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Previsões e Caixa do Mês
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-surface-100 bg-green-50/20">
                <div className="flex justify-between items-center text-green-600 mb-1">
                  <span className="text-xs font-bold uppercase">Receitas Pagas</span>
                  <TrendingUp className="w-4 h-4" />
                </div>
                <p className="text-xl font-bold text-brand-dark">
                  R$ {totalRecebido.toFixed(2).replace('.', ',')}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-surface-100 bg-red-50/20">
                <div className="flex justify-between items-center text-red-500 mb-1">
                  <span className="text-xs font-bold uppercase">Despesas Pagas</span>
                  <TrendingDown className="w-4 h-4" />
                </div>
                <p className="text-xl font-bold text-brand-dark">
                  R$ {totalPago.toFixed(2).replace('.', ',')}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-surface-100 bg-amber-50/20">
                <div className="flex justify-between items-center text-amber-600 mb-1">
                  <span className="text-xs font-bold uppercase">A Receber no Mês</span>
                  <Clock className="w-4 h-4" />
                </div>
                <p className="text-xl font-bold text-brand-dark">
                  R$ {totalApenasPendenteMes.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Distribuição por Planos & Alertas */}
        <div className="space-y-8">
          
          {/* Distribuição de Planos (Características únicas do Módulo Mensalidades) */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-brand-dark">
              <PieChart className="w-5 h-5 text-indigo-600" />
              Distribuição de Alunos por Plano
            </h3>

            <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-1">
              {distribuicaoPlanos.length > 0 ? (
                distribuicaoPlanos.map((plano, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-surface-600">
                      <span>{plano.nome}</span>
                      <span>{plano.count} ({plano.pct})</span>
                    </div>
                    <div className="w-full bg-surface-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: plano.pct }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-surface-400 text-center py-6">Nenhum plano atribuído aos alunos ativos.</p>
              )}
            </div>
          </div>

          {/* Alunos sem Treino Ativo */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-brand-dark">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Alunos Sem Treino Ativo ({alunosSemTreino.length})
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
              {alunosSemTreino.length > 0 ? (
                alunosSemTreino.map((aluno) => (
                  <div 
                    key={aluno.id} 
                    className="flex items-center justify-between p-3 rounded-xl border border-surface-100 hover:bg-surface-50 transition-all cursor-pointer group"
                    onClick={() => navigate('/prescricao/motor')}
                  >
                    <div>
                      <p className="font-semibold text-brand-dark text-sm leading-tight group-hover:text-brand-medium transition-colors">
                        {aluno.nome} {aluno.sobrenome || ''}
                      </p>
                      <p className="text-[10px] text-surface-400 uppercase mt-0.5 font-semibold">
                        {aluno.modalidade} • Obj: {aluno.objetivo}
                      </p>
                    </div>
                    <ClipboardList className="w-4 h-4 text-surface-400 group-hover:text-brand-medium" />
                  </div>
                ))
              ) : (
                <p className="text-sm text-surface-400 text-center py-6">Excelente! Todos os alunos ativos possuem treinos cadastrados.</p>
              )}
            </div>
            {alunosSemTreino.length > 0 && (
              <button 
                onClick={() => navigate('/prescricao/motor')}
                className="w-full mt-4 btn-secondary text-xs cursor-pointer"
              >
                Ir para Prescrição com IA
              </button>
            )}
          </div>

          {/* Cobranças Pendentes */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-brand-dark">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Cobranças Pendentes
            </h3>

            <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
              {receitasInadimplentes.length > 0 ? (
                receitasInadimplentes.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 rounded-xl border border-surface-100 hover:bg-surface-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-dark text-sm truncate">{item.aluno_nome}</p>
                      <p className="text-xs text-red-500 font-medium">
                        R$ {item.valor.toFixed(0)} • Venceu em {new Date(item.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <button
                      onClick={() => handleNotify(item)}
                      className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                      title="Notificar cobrança via WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-surface-400 text-center py-6">Sem contas em atraso no momento. Muito bom!</p>
              )}
            </div>
            {receitasInadimplentes.length > 0 && (
              <button 
                onClick={() => navigate('/financeiro/receitas')}
                className="w-full mt-4 btn-secondary text-xs cursor-pointer"
              >
                Gerenciar Recebimentos
              </button>
            )}
          </div>

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

export default DashboardGeral;
