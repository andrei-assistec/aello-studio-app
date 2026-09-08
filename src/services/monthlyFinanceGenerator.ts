import { collection, getDocs, addDoc, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Aluno } from '../types/database';
import { getPlanosDoAluno } from '../types/database';
import type { Receita } from '../features/financeiro/ReceitaFormModal';
import type { PlanoConta } from '../features/financeiro/PlanoDeContasPage';

/**
 * Atualiza todas as contas a receber PENDENTES de um aluno a partir do mês atual/da troca,
 * refletindo o novo plano, novo valor e novo personal, SEM alterar o histórico de contas pagas.
 */
export const updateStudentPendingReceivables = async (
  alunoId: string,
  newPlanName: string,
  newPlanValue: number,
  newPlanoId?: string,
  newPersonalId?: string | null,
  startFromYearMonth?: string
) => {
  try {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const minYM = startFromYearMonth || currentYM;

    const q = query(collection(db, 'receitas'), where('aluno_id', '==', alunoId));
    const snap = await getDocs(q);

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const status = (data.status || 'pendente').toLowerCase();
      const vencimento = data.vencimento || data.data_vencimento || '';

      // Apenas receitas PENDENTES com vencimento a partir do mês da troca/atual
      if (status === 'pendente' && vencimento) {
        const ym = parseYearMonth(vencimento);
        if (ym && ym >= minYM) {
          const updatePayload: any = {
            plano: newPlanName,
            valor: newPlanValue,
            updated_at: Date.now()
          };

          if (newPlanoId) {
            updatePayload.plano_contratado_id = newPlanoId;
          }
          if (newPersonalId !== undefined) {
            updatePayload.personal_id = newPersonalId;
          }

          await updateDoc(doc(db, 'receitas', docSnap.id), updatePayload);
        }
      }
    }
  } catch (err) {
    console.error("Erro ao atualizar contas pendentes do aluno:", err);
  }
};

/**
 * Converte qualquer formato de data (string DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, ISO, timestamp)
 * em uma string no formato 'YYYY-MM'.
 */
export const parseYearMonth = (val: any): string | null => {
  if (!val) return null;

  if (typeof val === 'number') {
    const dt = new Date(val);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    return null;
  }

  const str = String(val).trim();
  if (!str) return null;

  // Timestamp numérico em string (ex: "1787775105520")
  if (/^\d{12,15}$/.test(str)) {
    const num = parseInt(str, 10);
    const dt = new Date(num);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
  }

  // Formato YYYY-MM-DD ou YYYY-MM
  if (/^\d{4}-\d{1,2}/.test(str)) {
    const parts = str.split('-');
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    return `${year}-${month}`;
  }

  // Formato DD/MM/YYYY ou D/M/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const year = parts[2].trim().substring(0, 4);
      const month = parts[1].trim().padStart(2, '0');
      if (year.length === 4 && !isNaN(Number(year))) {
        return `${year}-${month}`;
      }
    }
  }

  // Formato DD-MM-YYYY ou D-M-YYYY
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parts[2].trim().substring(0, 4);
      const month = parts[1].trim().padStart(2, '0');
      if (year.length === 4 && !isNaN(Number(year))) {
        return `${year}-${month}`;
      }
    }
  }

  // Tenta o construtor Date do JS
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  return null;
};

/**
 * Retorna o mês/ano (formato YYYY-MM) em que a matrícula do aluno se tornou ativa no sistema
 * (considerando data_reativacao, data_inicio, data_cadastro, vencimento_plano ou created_at).
 */
export const getStudentStartYearMonth = (aluno: Aluno): string | null => {
  if (aluno.data_reativacao) {
    const ym = parseYearMonth(aluno.data_reativacao);
    if (ym) return ym;
  }

  if (aluno.data_inicio) {
    const ym = parseYearMonth(aluno.data_inicio);
    if (ym) return ym;
  }

  if (aluno.data_cadastro) {
    const ym = parseYearMonth(aluno.data_cadastro);
    if (ym) return ym;
  }

  if (aluno.vencimento_plano) {
    const ym = parseYearMonth(aluno.vencimento_plano);
    if (ym) return ym;
  }

  if (aluno.created_at) {
    const ym = parseYearMonth(aluno.created_at);
    if (ym) return ym;
  }

  return null;
};

/**
 * Retorna o mês/ano (formato YYYY-MM) em que a matrícula do aluno foi inativada, se houver.
 */
export const getStudentInactivationYearMonth = (aluno: Aluno): string | null => {
  if (aluno.inativado_em) {
    const ym = parseYearMonth(aluno.inativado_em);
    if (ym) return ym;
  }
  if (aluno.motivo_inativacao && aluno.updated_at) {
    const ym = parseYearMonth(aluno.updated_at);
    if (ym) return ym;
  }
  return null;
};

export const generateSingleStudentMonthFinance = async (aluno: Aluno, targetYearMonth?: string) => {
  const now = new Date();
  const yearMonth = targetYearMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const startYM = getStudentStartYearMonth(aluno);
  if (startYM && yearMonth < startYM) {
    return;
  }

  if (aluno.ativo === false) {
    const inactYM = getStudentInactivationYearMonth(aluno);
    if (inactYM && yearMonth > inactYM) {
      return;
    }
  }

  try {
    const planoContasSnap = await getDocs(collection(db, 'plano_contas'));
    const planoContas: (PlanoConta & { id: string })[] = [];
    planoContasSnap.forEach(docSnap => {
      planoContas.push({ ...(docSnap.data() as PlanoConta), id: docSnap.id });
    });

    const catMensalidadeId = planoContas.find(c => c.codigo === '1.1')?.id || '';

    const receitasSnap = await getDocs(collection(db, 'receitas'));
    const receitasMes: (Receita & { id: string; plano_contratado_id?: string })[] = [];
    receitasSnap.forEach(docSnap => {
      const data = docSnap.data() as any;
      if (data.vencimento && data.vencimento.startsWith(yearMonth)) {
        receitasMes.push({ ...data, id: docSnap.id });
      }
    });

    const planosDoAluno = getPlanosDoAluno(aluno);
    if (planosDoAluno.length === 0) return;

    const alunoNome = `${aluno.nome} ${aluno.sobrenome || ''}`.trim();

    for (const planoItem of planosDoAluno) {
      if (!planoItem.valor_mensalidade || planoItem.valor_mensalidade <= 0) continue;

      const alreadyHasReceita = receitasMes.some(r => 
        (r.aluno_id === aluno.id || (r.aluno_nome && r.aluno_nome.toLowerCase().includes(aluno.nome.toLowerCase()))) && 
        (r.plano === planoItem.plano_nome || r.plano_contratado_id === planoItem.id || (planosDoAluno.length === 1 && !r.plano_contratado_id))
      );

      if (!alreadyHasReceita) {
        let dueDay = String(planoItem.dia_vencimento || '10').padStart(2, '0');
        const vencimentoDate = `${yearMonth}-${dueDay}`;

        await addDoc(collection(db, 'receitas'), {
          aluno_id: aluno.id,
          aluno_nome: alunoNome,
          plano: planoItem.plano_nome,
          plano_contratado_id: planoItem.id,
          categoria_id: catMensalidadeId,
          valor: planoItem.valor_mensalidade,
          vencimento: vencimentoDate,
          data_vencimento: vencimentoDate,
          status: 'pendente',
          forma_pagamento: '-',
          personal_id: planoItem.personal_id || aluno.personal_id || null,
          vendedor_id: null,
          origem: 'MENSALIDADE',
          created_at: Date.now()
        });
      }
    }
  } catch (err) {
    console.error("Erro ao gerar mensalidade para aluno:", err);
  }
};

export const syncMonthlyFinance = async (targetYearMonth?: string) => {
  const now = new Date();
  const yearMonth = targetYearMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    // 1. Fetch plano_contas to resolve category IDs
    const planoContasSnap = await getDocs(collection(db, 'plano_contas'));
    const planoContas: (PlanoConta & { id: string })[] = [];
    planoContasSnap.forEach(docSnap => {
      planoContas.push({ ...(docSnap.data() as PlanoConta), id: docSnap.id });
    });

    const catMensalidadeId = planoContas.find(c => c.codigo === '1.1')?.id || '';

    // 2. Fetch Alunos
    const alunosSnap = await getDocs(collection(db, 'alunos'));
    const alunos: (Aluno & { id: string })[] = [];
    alunosSnap.forEach(docSnap => {
      alunos.push({ ...(docSnap.data() as Aluno), id: docSnap.id });
    });

    // 3. Fetch Receitas for the target month
    const receitasSnap = await getDocs(collection(db, 'receitas'));
    const receitasMes: (Receita & { id: string; plano_contratado_id?: string })[] = [];
    receitasSnap.forEach(docSnap => {
      const data = docSnap.data() as any;
      if (data.vencimento && data.vencimento.startsWith(yearMonth)) {
        receitasMes.push({ ...data, id: docSnap.id });
      }
    });

    // 4. Generate pending tuition receivables for active students
    const activeAlunos = alunos.filter(a => a.ativo !== false);

    for (const aluno of activeAlunos) {
      const startYM = getStudentStartYearMonth(aluno);
      if (startYM && yearMonth < startYM) {
        continue;
      }

      const inactYM = getStudentInactivationYearMonth(aluno);
      if (inactYM && yearMonth > inactYM) {
        continue;
      }

      const planosDoAluno = getPlanosDoAluno(aluno);
      if (planosDoAluno.length === 0) continue;

      const alunoNome = `${aluno.nome} ${aluno.sobrenome || ''}`.trim();

      for (const planoItem of planosDoAluno) {
        if (!planoItem.valor_mensalidade || planoItem.valor_mensalidade <= 0) continue;

        // Check if there is already a receita generated for this student and this plan in this month
        const alreadyHasReceita = receitasMes.some(r => 
          (r.aluno_id === aluno.id || (r.aluno_nome && r.aluno_nome.toLowerCase().includes(aluno.nome.toLowerCase()))) && 
          (r.plano === planoItem.plano_nome || r.plano_contratado_id === planoItem.id || (planosDoAluno.length === 1 && !r.plano_contratado_id))
        );

        if (!alreadyHasReceita) {
          let dueDay = String(planoItem.dia_vencimento || '10').padStart(2, '0');
          const vencimentoDate = `${yearMonth}-${dueDay}`;

          await addDoc(collection(db, 'receitas'), {
            aluno_id: aluno.id,
            aluno_nome: alunoNome,
            plano: planoItem.plano_nome,
            plano_contratado_id: planoItem.id,
            categoria_id: catMensalidadeId,
            valor: planoItem.valor_mensalidade,
            vencimento: vencimentoDate,
            data_vencimento: vencimentoDate,
            status: 'pendente',
            forma_pagamento: '-',
            personal_id: planoItem.personal_id || aluno.personal_id || null,
            vendedor_id: null,
            origem: 'MENSALIDADE',
            created_at: Date.now()
          });
        }
      }
    }

  } catch (err) {
    console.error("Erro ao sincronizar finanças do mês:", err);
  }
};
