import { useState, useMemo } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import { 
  Users, 
  DollarSign, 
  CheckCircle, 
  Loader2, 
  Award,
  Calendar,
  FileText,
  Printer,
  X,
  PlusCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import type { Funcionario } from '../funcionarios/FuncionarioFormModal';
import type { Aluno, Plano } from '../../types/database';
import type { Receita } from './ReceitaFormModal';

interface DetailedCommissionItem {
  receitaId: string;
  alunoId: string;
  alunoNome: string;
  descricao: string;
  dataPagamento: string;
  valorPago: number;
  comissaoPct: number;
  comissaoValor: number;
  status: string;
}

export const FolhaComissoes = () => {
  const { data: funcionarios, loading: loadingFunc } = useCollection<Funcionario>('funcionarios', 'nome');
  const { data: alunos, loading: loadingAlunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: receitas, loading: loadingRec } = useCollection<Receita>('receitas', 'vencimento', 'desc');
  const { data: despesas, loading: loadingDesp } = useCollection<any>('despesas');
  const { data: planosList } = useCollection<Plano>('planos', 'nome');

  const [loadingPayId, setLoadingPayId] = useState<string | null>(null);
  const [successPayId, setSuccessPayId] = useState<string | null>(null);

  // Mês Selecionado (Padrão: Mês Atual YYYY-MM)
  const today = new Date();
  const defaultMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthKey);

  // Estado do Modal de Detalhes (Extrato do Colaborador)
  const [selectedFuncionarioModal, setSelectedFuncionarioModal] = useState<Funcionario | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loading = loadingFunc || loadingAlunos || loadingRec || loadingDesp;

  // Cálculo das datas do mês selecionado
  const { startOfMonth, endOfMonth, monthLabel } = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10) || today.getFullYear();
    const monthIndex = (parseInt(monthStr, 10) || (today.getMonth() + 1)) - 1;

    const start = new Date(year, monthIndex, 1).getTime();
    const end = new Date(year, monthIndex + 1, 1).getTime();

    const dateObj = new Date(year, monthIndex, 15);
    const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return { startOfMonth: start, endOfMonth: end, monthLabel: label };
  }, [selectedMonth]);

  // Função para verificar se a Conta a Pagar já foi gerada na coleção despesas
  const getDespesaStatus = (funcionarioId: string, funcionarioNome: string) => {
    const despesaMatch = (despesas || []).find(d => {
      if (!d) return false;
      const isFuncMatch = d.funcionario_id === funcionarioId || 
                          (d.descricao || '').toLowerCase().includes((funcionarioNome || '').toLowerCase());
      
      const dt = d.data_vencimento || d.vencimento || d.data_pagamento || '';
      const isMonthMatch = dt.startsWith(selectedMonth) || d.mes_referencia === selectedMonth;

      return isFuncMatch && isMonthMatch;
    });

    if (!despesaMatch) return { exists: false };

    const statusUpper = (despesaMatch.status || '').toUpperCase();
    if (statusUpper === 'PAGO' || statusUpper === 'PAGA') {
      return { exists: true, status: 'PAGO', despesa: despesaMatch };
    }
    return { exists: true, status: 'PENDENTE', despesa: despesaMatch };
  };

  // Helper para determinar o % de comissão específico do plano contratado pelo aluno
  const getCommissionPctForRevenue = (f: Funcionario, alunoObj: Aluno | undefined, r: Receita): { pct: number; modalityName: string } => {
    const comissMap = f.comissoes_modalidades || {};
    const defaultPct = parseFloat(f.comissao_percentual as any) || 0;

    // Se o colaborador não possuir regras de comissão por plano configuradas, usa o padrão geral
    if (!comissMap || Object.keys(comissMap).length === 0) {
      return { pct: defaultPct, modalityName: 'Padrão Geral' };
    }

    // 1. Verificação por ID direto do plano do aluno (alunoObj.plano_id)
    if (alunoObj?.plano_id && comissMap[alunoObj.plano_id] !== undefined) {
      const pFound = (planosList || []).find(p => p.id === alunoObj.plano_id);
      return { pct: comissMap[alunoObj.plano_id], modalityName: pFound?.nome || alunoObj.plano_nome || 'Plano' };
    }

    // 2. Verificação por ID de plano contratado (caso o aluno tenha múltiplos planos)
    if (alunoObj?.planos_contratados && Array.isArray(alunoObj.planos_contratados)) {
      const pContratado = alunoObj.planos_contratados.find(p => p.id === r.plano_contratado_id || p.plano_id === r.plano_contratado_id);
      if (pContratado?.plano_id && comissMap[pContratado.plano_id] !== undefined) {
        return { pct: comissMap[pContratado.plano_id], modalityName: pContratado.plano_nome || 'Plano' };
      }
    }

    // 3. Verificação por nome do plano em r.plano ou alunoObj.plano_nome
    const planoNome = (r.plano || alunoObj?.plano_nome || '').trim();
    if (planoNome) {
      // Procura o plano pelo nome na lista de planos cadastrados
      const matchedPlano = (planosList || []).find(p => p.nome.trim().toLowerCase() === planoNome.toLowerCase() || p.id === planoNome);
      if (matchedPlano && comissMap[matchedPlano.id] !== undefined) {
        return { pct: comissMap[matchedPlano.id], modalityName: matchedPlano.nome };
      }
      // Se chave foi salva pelo próprio nome do plano
      if (comissMap[planoNome] !== undefined) {
        return { pct: comissMap[planoNome], modalityName: planoNome };
      }
    }

    // 4. Verificação por correspondência de texto na lista de planos cadastrados
    for (const p of (planosList || [])) {
      const pDesc = ((r.descricao || '') + ' ' + (r.plano || '') + ' ' + (alunoObj?.plano_nome || '')).toLowerCase();
      if (pDesc.includes(p.nome.toLowerCase())) {
        if (comissMap[p.id] !== undefined) {
          return { pct: comissMap[p.id], modalityName: p.nome };
        }
        if (comissMap[p.nome] !== undefined) {
          return { pct: comissMap[p.nome], modalityName: p.nome };
        }
      }
    }

    // 5. Verificação de chaves dinâmicas no mapa de comissões
    for (const [key, val] of Object.entries(comissMap)) {
      const pDesc = ((r.descricao || '') + ' ' + (r.plano || '') + ' ' + (alunoObj?.plano_nome || '')).toLowerCase();
      if (pDesc.includes(key.toLowerCase())) {
        return { pct: val, modalityName: key };
      }
    }

    // Regra de Negócio: Se o plano não tiver comissão configurada para o profissional, a comissão é 0%
    return { pct: 0, modalityName: (planoNome || 'Plano') + ' (0%)' };
  };

  // Função para calcular salário e comissões reais do profissional no mês selecionado
  const calculateProfessionalSalary = (f: Funcionario) => {
    if (!f) return { 
      countStudents: 0, 
      faturamentoAlunos: 0, 
      comissao: 0, 
      salarioBase: 0, 
      totalPagar: 0,
      detailedItems: [] as DetailedCommissionItem[]
    };

    const alunosList = alunos || [];
    const receitasList = receitas || [];

    const fUid = (f as any).uid;

    // 1. Encontrar todos os alunos vinculados a este personal
    const activeStudents = alunosList.filter(aluno => 
      aluno && 
      (aluno.personal_id === f.id || (aluno.personal_ids || []).includes(f.id) || (fUid && (aluno.personal_ids || []).includes(fUid))) && 
      aluno.ativo !== false
    );
    const countStudents = activeStudents.length;
    const studentIds = activeStudents.map(a => a.id);

    // 2. Encontrar mensalidades pagas no mês selecionado para estes alunos
    const detailedItems: DetailedCommissionItem[] = [];
    let totalComissaoCalculada = 0;

    const monthlyRevenues = receitasList.filter(r => {
      if (!r || (r.status || '').toLowerCase() !== 'pago') return false;
      
      let pMs: number | null = null;
      if (typeof r.data_pagamento === 'number') pMs = r.data_pagamento;
      else if (typeof r.data_pagamento === 'string') {
        const parsed = new Date(r.data_pagamento.includes('T') ? r.data_pagamento : r.data_pagamento + 'T12:00:00').getTime();
        if (!isNaN(parsed)) pMs = parsed;
      }

      const isDateInMonth = pMs !== null && pMs >= startOfMonth && pMs < endOfMonth;
      const isStudentMatch = Boolean(r.aluno_id && studentIds.includes(r.aluno_id));

      if (isDateInMonth && isStudentMatch) {
        const alunoObj = activeStudents.find(a => a.id === r.aluno_id);
        const valorPago = parseFloat(r.valor as any) || 0;
        
        // Calcula a comissão específica da modalidade do aluno
        const { pct, modalityName } = getCommissionPctForRevenue(f, alunoObj, r);
        const comissaoValor = valorPago * (pct / 100);
        totalComissaoCalculada += comissaoValor;

        let dtFormatted = 'Data N/I';
        if (pMs) {
          dtFormatted = new Date(pMs).toLocaleDateString('pt-BR');
        }

        detailedItems.push({
          receitaId: r.id,
          alunoId: r.aluno_id || '',
          alunoNome: alunoObj?.nome || r.aluno_nome || 'Aluno Sem Nome',
          descricao: `${r.descricao || 'Mensalidade'} (${modalityName})`,
          dataPagamento: dtFormatted,
          valorPago,
          comissaoPct: pct,
          comissaoValor,
          status: r.status || 'PAGO'
        });

        return true;
      }
      return false;
    });

    const faturamentoAlunos = monthlyRevenues.reduce((acc, r) => acc + (parseFloat(r.valor as any) || 0), 0);
    const salarioBase = parseFloat(f.salario_base as any) || 0;
    const totalPagar = salarioBase + totalComissaoCalculada;

    return {
      countStudents,
      faturamentoAlunos,
      comissao: totalComissaoCalculada,
      salarioBase,
      totalPagar,
      detailedItems
    };
  };

  // Gerar lançamento Pendente em Contas a Pagar (despesas)
  const handleGerarContaPagar = async (funcionario: Funcionario) => {
    setLoadingPayId(funcionario.id);
    setSuccessPayId(null);

    const { totalPagar, salarioBase, comissao, countStudents } = calculateProfessionalSalary(funcionario);

    try {
      const vencimentoData = new Date(startOfMonth);
      vencimentoData.setMonth(vencimentoData.getMonth() + 1, 0); // Último dia do mês
      const dtVencimentoStr = vencimentoData.toISOString().split('T')[0];

      // Registrar no Firestore na coleção despesas com status PENDENTE
      await addDoc(collection(db, 'despesas'), {
        descricao: `Folha de Pagamento & Comissão - ${funcionario.nome || 'Colaborador'} (${selectedMonth})`,
        categoria: 'Salários & Comissões',
        valor: totalPagar,
        vencimento: dtVencimentoStr,
        data_vencimento: dtVencimentoStr,
        status: 'pendente',
        funcionario_id: funcionario.id,
        funcionario_nome: funcionario.nome,
        mes_referencia: selectedMonth,
        observacoes: `Salário Fixo: R$ ${salarioBase.toFixed(2)} | Comissões (${countStudents} alunos): R$ ${comissao.toFixed(2)}`,
        created_at: Date.now()
      });

      // Registrar auditoria
      await logActivity({
        action: 'CREATE',
        resource_type: 'receita',
        resource_name: 'Conta a Pagar Folha',
        details: `Gerou conta a pagar (pendente) da folha/comissão de ${funcionario.nome || 'Colaborador'} no valor de R$ ${totalPagar.toFixed(2)}`
      });

      setSuccessPayId(funcionario.id);
      setTimeout(() => setSuccessPayId(null), 4000);
    } catch (error) {
      console.error("Erro ao gerar conta a pagar do funcionário:", error);
      alert("Erro ao gerar conta a pagar.");
    } finally {
      setLoadingPayId(null);
    }
  };

  const handleOpenExtratoModal = (f: Funcionario) => {
    setSelectedFuncionarioModal(f);
    setIsDetailModalOpen(true);
  };

  const handlePrintExtrato = () => {
    window.print();
  };

  const activeFuncionarios = (funcionarios || []).filter(f => f && f.ativo !== false);

  // Cálculos consolidados para os cards no topo
  const { totalSalariosFixos, totalComissoesEstimadas, totalFolhaConsolidada } = useMemo(() => {
    let fixos = 0;
    let comissoes = 0;

    activeFuncionarios.forEach(f => {
      const { salarioBase, comissao } = calculateProfessionalSalary(f);
      fixos += salarioBase;
      comissoes += comissao;
    });

    return {
      totalSalariosFixos: fixos,
      totalComissoesEstimadas: comissoes,
      totalFolhaConsolidada: fixos + comissoes
    };
  }, [activeFuncionarios, alunos, receitas, selectedMonth]);

  // Dados do modal selecionado
  const modalCalcData = useMemo(() => {
    if (!selectedFuncionarioModal) return null;
    return calculateProfessionalSalary(selectedFuncionarioModal);
  }, [selectedFuncionarioModal, alunos, receitas, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* CSS Exclusivo de Impressão */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header com Seletor de Mês */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-3xl font-display text-brand-dark flex items-center gap-2">
            Folha & Comissões 💵
          </h2>
          <p className="text-surface-500 text-sm">
            Cálculo detalhado de comissões por aluno, salários e lançamento em Contas a Pagar.
          </p>
        </div>

        {/* Seletor de Período (Mês/Ano) */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-surface-200 shadow-xs">
          <Calendar className="w-5 h-5 text-brand-medium ml-2" />
          <span className="text-xs font-bold text-surface-600 uppercase tracking-wider hidden sm:inline">Mês de Referência:</span>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="input-field text-xs font-bold py-1.5 px-3 cursor-pointer w-auto"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4 no-print">
          <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
          <p className="font-medium">Carregando folha e comissões do período...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards da Folha do Mês */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 no-print">
            <div className="glass-card p-6 border-l-4 border-l-indigo-600 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-2xl font-display font-bold text-brand-dark">
                  R$ {totalSalariosFixos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h4>
                <p className="text-xs font-semibold text-surface-400">Total Salários Fixos ({activeFuncionarios.length} prof.)</p>
              </div>
            </div>

            <div className="glass-card p-6 border-l-4 border-l-amber-500 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-2xl font-display font-bold text-brand-dark">
                  R$ {totalComissoesEstimadas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h4>
                <p className="text-xs font-semibold text-surface-400">Comissões sobre Alunos ({monthLabel})</p>
              </div>
            </div>

            <div className="glass-card p-6 border-l-4 border-l-emerald-600 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-2xl font-display font-bold text-emerald-700">
                  R$ {totalFolhaConsolidada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h4>
                <p className="text-xs font-semibold text-surface-400">Total Bruto da Folha no Mês</p>
              </div>
            </div>
          </div>

          {/* Tabela de Colaboradores & Comissões */}
          <div className="glass-card overflow-hidden no-print">
            <div className="p-4 bg-surface-50 border-b border-surface-200 flex justify-between items-center">
              <h3 className="font-bold text-sm text-brand-dark uppercase tracking-wider">
                Resumo por Colaborador — {monthLabel}
              </h3>
              <span className="text-xs text-surface-500 font-semibold">
                {activeFuncionarios.length} colaboradores listados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50/50 border-b border-surface-200 text-xs text-surface-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Profissional</th>
                    <th className="px-6 py-4">Salário Fixo</th>
                    <th className="px-6 py-4">Alunos Vinculados</th>
                    <th className="px-6 py-4">Faturamento Alunos</th>
                    <th className="px-6 py-4">Comissão (%)</th>
                    <th className="px-6 py-4">Total Líquido</th>
                    <th className="px-6 py-4 text-center">Detalhamento</th>
                    <th className="px-6 py-4 text-right">Ação em Contas a Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-xs text-surface-700 font-medium">
                  {activeFuncionarios.length > 0 ? (
                    activeFuncionarios.map((f) => {
                      const { countStudents, faturamentoAlunos, comissao, salarioBase, totalPagar } = calculateProfessionalSalary(f);
                      const funcDesc = (f.funcao || 'colaborador').replace('_', ' ');
                      const despesaInfo = getDespesaStatus(f.id, f.nome);

                      return (
                        <tr key={f.id} className="hover:bg-surface-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-bold text-sm text-brand-dark">{f.nome || 'Sem Nome'}</p>
                              <p className="text-[11px] text-surface-400 capitalize">{funcDesc}</p>
                            </div>
                          </td>

                          <td className="px-6 py-4 font-semibold text-brand-dark">
                            R$ {salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="px-6 py-4">
                            {f.funcao === 'personal_trainer' ? (
                              <span className="font-bold text-brand-dark px-2.5 py-1 bg-surface-100 rounded-lg">
                                {countStudents} {countStudents === 1 ? 'aluno' : 'alunos'}
                              </span>
                            ) : (
                              <span className="text-surface-400">-</span>
                            )}
                          </td>

                          <td className="px-6 py-4 font-semibold text-brand-dark">
                            {f.funcao === 'personal_trainer' ? (
                              <span>R$ {faturamentoAlunos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            ) : (
                              <span className="text-surface-400">-</span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            {f.funcao === 'personal_trainer' ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-indigo-600">R$ {comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                <span className="text-[10px] text-surface-400">({f.comissao_percentual || 0}%)</span>
                              </div>
                            ) : (
                              <span className="text-surface-400">-</span>
                            )}
                          </td>

                          <td className="px-6 py-4 font-bold text-sm text-emerald-600">
                            R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Botão Ver Extrato Detalhado */}
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleOpenExtratoModal(f)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-dark/5 hover:bg-brand-dark text-brand-dark hover:text-white font-bold text-xs rounded-xl transition-all border border-brand-dark/10 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Ver Extrato
                            </button>
                          </td>

                          {/* Ação / Lançamento em Contas a Pagar */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {successPayId === f.id ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs animate-fade-in">
                                  <CheckCircle className="w-4 h-4" />
                                  Conta Pendente Criada!
                                </span>
                              ) : despesaInfo.exists ? (
                                despesaInfo.status === 'PAGO' ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    Quitado em Contas a Pagar
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    Gerado (A Pagar)
                                  </span>
                                )
                              ) : (
                                <button 
                                  onClick={() => handleGerarContaPagar(f)}
                                  disabled={loadingPayId === f.id}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  {loadingPayId === f.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Gerando...
                                    </>
                                  ) : (
                                    <>
                                      <PlusCircle className="w-3.5 h-3.5" />
                                      Gerar Conta a Pagar
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-surface-400 font-medium">
                        Nenhum colaborador ativo cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Flutuante — Extrato Detalhado do Colaborador (Aluno por Aluno) */}
      {isDetailModalOpen && selectedFuncionarioModal && modalCalcData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
          {/* Overlay Backdrop */}
          <div 
            className="absolute inset-0 bg-brand-dark/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDetailModalOpen(false)}
          ></div>

          {/* Modal Content */}
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-surface-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
            {/* Modal Header */}
            <div className="p-6 bg-brand-dark text-white flex justify-between items-start">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-medium/20 text-brand-medium border border-brand-medium/30">
                  Extrato de Comissões & Provento
                </span>
                <h3 className="text-2xl font-bold font-display mt-1">
                  {selectedFuncionarioModal.nome}
                </h3>
                <p className="text-xs text-surface-300">
                  Referência: <strong className="text-white capitalize">{monthLabel}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintExtrato}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Extrato
                </button>
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1 text-surface-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              {/* Badges Consolidados do Profissional */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400 block">Salário Fixo</span>
                  <span className="text-base font-bold text-brand-dark">
                    R$ {modalCalcData.salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">Alunos & Faturamento</span>
                  <span className="text-base font-bold text-indigo-700">
                    {modalCalcData.countStudents} alunos <span className="text-xs font-semibold text-indigo-500">(R$ {modalCalcData.faturamentoAlunos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span>
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Comissão ({selectedFuncionarioModal.comissao_percentual || 0}%)</span>
                  <span className="text-base font-bold text-amber-700">
                    R$ {modalCalcData.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Total a Receber</span>
                  <span className="text-base font-bold text-emerald-700">
                    R$ {modalCalcData.totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Tabela Aluno por Aluno */}
              <div>
                <h4 className="font-bold text-sm text-brand-dark mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-medium" />
                  Discriminação por Aluno e Receita no Mês
                </h4>

                <div className="overflow-x-auto rounded-2xl border border-surface-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-100/70 font-bold text-brand-dark uppercase tracking-wider border-b border-surface-200">
                      <tr>
                        <th className="p-3">Aluno</th>
                        <th className="p-3">Descrição / Plano</th>
                        <th className="p-3">Data Pgto</th>
                        <th className="p-3 text-right">Valor Pago (R$)</th>
                        <th className="p-3 text-center">% Comis.</th>
                        <th className="p-3 text-right">Comissão (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                      {modalCalcData.detailedItems.length > 0 ? (
                        modalCalcData.detailedItems.map((item, idx) => (
                          <tr key={`${item.receitaId}-${idx}`} className="hover:bg-surface-50">
                            <td className="p-3 font-bold text-brand-dark">{item.alunoNome}</td>
                            <td className="p-3 text-surface-600">{item.descricao}</td>
                            <td className="p-3 text-surface-500 font-semibold">{item.dataPagamento}</td>
                            <td className="p-3 text-right font-bold text-brand-dark">
                              R$ {item.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center font-bold text-indigo-600">
                              {item.comissaoPct}%
                            </td>
                            <td className="p-3 text-right font-bold text-amber-700">
                              R$ {item.comissaoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-surface-400 font-medium">
                            Nenhum faturamento de mensalidades registrado para os alunos deste colaborador no mês de {monthLabel}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-surface-50 font-bold border-t border-surface-200 text-brand-dark">
                      <tr>
                        <td colSpan={3} className="p-3 text-right">TOTALIZADOR DE MENSALIDADES & COMISSÕES:</td>
                        <td className="p-3 text-right font-black text-brand-dark">
                          R$ {modalCalcData.faturamentoAlunos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center text-surface-400">-</td>
                        <td className="p-3 text-right font-black text-amber-700">
                          R$ {modalCalcData.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-50 border-t border-surface-200 flex justify-between items-center">
              <span className="text-xs text-surface-500">
                Lançamento para quitação via módulo <strong>Contas a Pagar</strong>.
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handlePrintExtrato}
                  className="btn-primary text-xs flex items-center gap-1.5 bg-brand-dark"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Extrato
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA DE IMPRESSÃO (Oculta na tela normal, visível no window.print()) */}
      {selectedFuncionarioModal && modalCalcData && (
        <div id="print-area" className="hidden">
          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tight">AELLO STUDIO</h1>
              <p className="text-xs">Demonstrativo de Proventos & Extrato de Comissões</p>
              <p className="text-xs text-gray-600">Referência: {monthLabel}</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
              <p>Status: Lançado em Contas a Pagar</p>
            </div>
          </div>

          <div className="mb-6 bg-gray-50 p-4 border border-gray-300 rounded text-xs grid grid-cols-2 gap-4">
            <div>
              <p><strong>Colaborador:</strong> {selectedFuncionarioModal.nome}</p>
              <p><strong>Cargo/Função:</strong> {(selectedFuncionarioModal.funcao || '').replace('_', ' ')}</p>
              <p><strong>E-mail:</strong> {selectedFuncionarioModal.email || 'N/I'}</p>
            </div>
            <div>
              <p><strong>Salário Fixo:</strong> R$ {modalCalcData.salarioBase.toFixed(2)}</p>
              <p><strong>Comissão Calculada ({selectedFuncionarioModal.comissao_percentual || 0}%):</strong> R$ {modalCalcData.comissao.toFixed(2)}</p>
              <p className="text-sm font-bold mt-1"><strong>TOTAL LÍQUIDO A RECEBER: R$ {modalCalcData.totalPagar.toFixed(2)}</strong></p>
            </div>
          </div>

          <h3 className="font-bold text-sm uppercase mb-2">Discriminação de Alunos e Receitas ({modalCalcData.detailedItems.length} lançamentos)</h3>

          <table className="w-full text-left text-xs border-collapse border border-black mb-8">
            <thead>
              <tr className="bg-gray-200 border-b border-black">
                <th className="p-2 border-r border-black">Aluno</th>
                <th className="p-2 border-r border-black">Descrição</th>
                <th className="p-2 border-r border-black">Data Pgto</th>
                <th className="p-2 text-right border-r border-black">Valor (R$)</th>
                <th className="p-2 text-center border-r border-black">% Comis.</th>
                <th className="p-2 text-right">Comissão (R$)</th>
              </tr>
            </thead>
            <tbody>
              {modalCalcData.detailedItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-300">
                  <td className="p-2 border-r border-black font-bold">{item.alunoNome}</td>
                  <td className="p-2 border-r border-black">{item.descricao}</td>
                  <td className="p-2 border-r border-black">{item.dataPagamento}</td>
                  <td className="p-2 text-right border-r border-black">R$ {item.valorPago.toFixed(2)}</td>
                  <td className="p-2 text-center border-r border-black">{item.comissaoPct}%</td>
                  <td className="p-2 text-right">R$ {item.comissaoValor.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold border-t border-black">
                <td colSpan={3} className="p-2 text-right border-r border-black">TOTALIZADORES:</td>
                <td className="p-2 text-right border-r border-black">R$ {modalCalcData.faturamentoAlunos.toFixed(2)}</td>
                <td className="p-2 text-center border-r border-black">-</td>
                <td className="p-2 text-right">R$ {modalCalcData.comissao.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-16 pt-8 border-t border-black grid grid-cols-2 gap-12 text-center text-xs">
            <div>
              <div className="border-b border-black mb-1 w-3/4 mx-auto"></div>
              <p className="font-bold">{selectedFuncionarioModal.nome}</p>
              <p className="text-gray-500">Assinatura do Colaborador</p>
            </div>
            <div>
              <div className="border-b border-black mb-1 w-3/4 mx-auto"></div>
              <p className="font-bold">Aello Studio — Administração</p>
              <p className="text-gray-500">Responsável Financeiro</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolhaComissoes;
