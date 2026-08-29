import { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';
import type { Funcionario } from '../funcionarios/FuncionarioFormModal';
import type { Aluno } from '../../types/database';
import type { Receita } from './ReceitaFormModal';

export const FolhaComissoes = () => {
  const { data: funcionarios, loading: loadingFunc } = useCollection<Funcionario>('funcionarios', 'nome');
  const { data: alunos, loading: loadingAlunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: receitas, loading: loadingRec } = useCollection<Receita>('receitas', 'vencimento', 'desc');

  const [loadingPayId, setLoadingPayId] = useState<string | null>(null);
  const [successPayId, setSuccessPayId] = useState<string | null>(null);

  const loading = loadingFunc || loadingAlunos || loadingRec;

  // Filtro de data do mês atual para fechamento
  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();

  const startOfMonth = new Date(currentYear, currentMonthIndex, 1).getTime();
  const endOfMonth = new Date(currentYear, currentMonthIndex + 1, 1).getTime();

  // Função para calcular salário e comissões reais do profissional
  const calculateProfessionalSalary = (f: Funcionario) => {
    // 1. Encontrar todos os alunos vinculados a este personal
    const activeStudents = alunos.filter(aluno => aluno.personal_id === f.id && aluno.ativo !== false);
    const countStudents = activeStudents.length;

    // 2. Encontrar faturamento de mensalidades pagas no mês atual para estes alunos vinculados
    const studentIds = activeStudents.map(a => a.id);
    const monthlyRevenues = receitas.filter(r => {
      if ((r.status || '').toLowerCase() !== 'pago') return false;
      let pMs: number | null = null;
      if (typeof r.data_pagamento === 'number') pMs = r.data_pagamento;
      else if (typeof r.data_pagamento === 'string') {
        const parsed = new Date(r.data_pagamento.includes('T') ? r.data_pagamento : r.data_pagamento + 'T12:00:00').getTime();
        if (!isNaN(parsed)) pMs = parsed;
      }
      return pMs !== null && pMs >= startOfMonth && pMs < endOfMonth && Boolean(r.aluno_id && studentIds.includes(r.aluno_id));
    });
    const faturamentoAlunos = monthlyRevenues.reduce((acc, r) => acc + r.valor, 0);

    // 3. Comissão = percentual do faturamento total de seus alunos
    const comissao = faturamentoAlunos * (f.comissao_percentual / 100);

    // 4. Líquido final = salário fixo + comissão
    const totalPagar = f.salario_base + comissao;

    return {
      countStudents,
      faturamentoAlunos,
      comissao,
      totalPagar
    };
  };

  const handlePagarFuncionario = async (funcionario: Funcionario) => {
    setLoadingPayId(funcionario.id);
    setSuccessPayId(null);

    const { totalPagar } = calculateProfessionalSalary(funcionario);

    try {
      // Registrar no Firestore na coleção de despesas (Contas a Pagar)
      await addDoc(collection(db, 'despesas'), {
        descricao: `Folha de Pagamento - ${funcionario.nome}`,
        categoria: 'Salários & Comissões',
        valor: totalPagar,
        vencimento: new Date().toISOString().split('T')[0],
        status: 'pago',
        data_pagamento: Date.now(),
        criado_em: Date.now()
      });

      // Registrar logs de auditoria
      await logActivity({
        action: 'CREATE',
        resource_type: 'auth',
        details: `Registrou pagamento de salário/comissão para ${funcionario.nome} no valor de R$ ${totalPagar.toFixed(2)}`
      });

      setSuccessPayId(funcionario.id);
      setTimeout(() => setSuccessPayId(null), 3000);
    } catch (error) {
      console.error("Erro ao registrar pagamento do funcionário:", error);
      alert("Erro ao realizar pagamento.");
    } finally {
      setLoadingPayId(null);
    }
  };

  const activeFuncionarios = funcionarios.filter(f => f.ativo !== false);

  return (
    <div>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Folha & Comissões 💵</h2>
          <p className="text-surface-500">
            Calcule e registre o pagamento mensal de salários fixos e comissões de instrutores.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
          <p className="font-medium">Carregando folha de colaboradores...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="glass-card p-6 border-l-4 border-l-indigo-600 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-2xl font-display font-bold text-brand-dark">{activeFuncionarios.length}</h4>
                <p className="text-xs font-semibold text-surface-400">Colaboradores Ativos</p>
              </div>
            </div>
            <div className="glass-card p-6 border-l-4 border-l-emerald-600 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-2xl font-display font-bold text-brand-dark">
                  R$ {activeFuncionarios.reduce((acc, f) => acc + f.salario_base, 0).toFixed(2).replace('.', ',')}
                </h4>
                <p className="text-xs font-semibold text-surface-400">Total Salários Fixos</p>
              </div>
            </div>
            <div className="glass-card p-6 border-l-4 border-l-amber-500 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-2xl font-display font-bold text-brand-dark">
                  R$ {activeFuncionarios.reduce((acc, f) => {
                    const { comissao } = calculateProfessionalSalary(f);
                    return acc + comissao;
                  }, 0).toFixed(2).replace('.', ',')}
                </h4>
                <p className="text-xs font-semibold text-surface-400">Total Comissões Estimadas</p>
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-50 border-b border-surface-200">
                    <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Profissional</th>
                    <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Salário Fixo</th>
                    <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Alunos Vinculados</th>
                    <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Faturamento Alunos</th>
                    <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Comissão</th>
                    <th className="px-6 py-4 text-sm font-semibold text-brand-dark">Total Líquido</th>
                    <th className="px-6 py-4 text-sm font-semibold text-brand-dark text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 text-sm text-surface-600">
                  {activeFuncionarios.length > 0 ? (
                    activeFuncionarios.map((f) => {
                      const { countStudents, faturamentoAlunos, comissao, totalPagar } = calculateProfessionalSalary(f);

                      return (
                        <tr key={f.id} className="hover:bg-surface-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-bold text-brand-dark">{f.nome}</p>
                              <p className="text-xs text-surface-400 capitalize">{f.funcao.replace('_', ' ')}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-brand-dark">
                            R$ {f.salario_base.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="px-6 py-4">
                            {f.funcao === 'personal_trainer' ? (
                              <span className="font-bold text-brand-dark">{countStudents} {countStudents === 1 ? 'aluno' : 'alunos'}</span>
                            ) : (
                              <span className="text-surface-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-semibold text-brand-dark">
                            {f.funcao === 'personal_trainer' ? (
                              <span>R$ {faturamentoAlunos.toFixed(2).replace('.', ',')}</span>
                            ) : (
                              <span className="text-surface-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-semibold text-indigo-600">
                            {f.funcao === 'personal_trainer' ? (
                              <span>R$ {comissao.toFixed(2).replace('.', ',')} <span className="text-xs text-surface-400">({f.comissao_percentual}%)</span></span>
                            ) : (
                              <span className="text-surface-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-600">
                            R$ {totalPagar.toFixed(2).replace('.', ',')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end items-center gap-3">
                              {successPayId === f.id ? (
                                <span className="flex items-center gap-1.5 text-green-600 font-semibold animate-fade-in text-xs">
                                  <CheckCircle className="w-4 h-4" />
                                  Pago no Caixa!
                                </span>
                              ) : (
                                <button 
                                  onClick={() => handlePagarFuncionario(f)}
                                  disabled={loadingPayId === f.id}
                                  className="btn-primary py-2 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 disabled:opacity-50"
                                >
                                  {loadingPayId === f.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Registrando...
                                    </>
                                  ) : (
                                    <>
                                      Registrar Pagamento
                                      <ChevronRight className="w-3.5 h-3.5" />
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
                      <td colSpan={7} className="px-6 py-12 text-center text-surface-400 font-medium">
                        Nenhum colaborador ativo cadastrado para a folha.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FolhaComissoes;
