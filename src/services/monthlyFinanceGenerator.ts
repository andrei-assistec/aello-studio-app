import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Aluno } from '../types/database';
import { getPlanosDoAluno } from '../types/database';
import type { Receita } from '../features/financeiro/ReceitaFormModal';
import type { PlanoConta } from '../features/financeiro/PlanoDeContasPage';

/**
 * Retorna o mês/ano (formato YYYY-MM) em que a matrícula do aluno se tornou ativa no sistema
 * (considerando data_reativacao, data_inicio ou created_at).
 */
export const getStudentStartYearMonth = (aluno: Aluno): string | null => {
  if (aluno.data_reativacao) {
    return aluno.data_reativacao;
  }

  if (aluno.data_inicio) {
    const str = aluno.data_inicio.trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const year = parts[2];
        const month = parts[1].padStart(2, '0');
        return `${year}-${month}`;
      }
    } else if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length >= 2) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        return `${year}-${month}`;
      }
    }
  }

  if (aluno.created_at) {
    const dt = new Date(aluno.created_at);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
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
          created_at: Date.now()
        });
      }
    }
  } catch (err) {
    console.error("Erro ao gerar mensalidade para aluno reativado:", err);
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

    // 4. Generate pending tuition receivables for active students (supporting multiple plans)
    const activeAlunos = alunos.filter(a => a.ativo !== false);

    for (const aluno of activeAlunos) {
      const startYM = getStudentStartYearMonth(aluno);
      if (startYM && yearMonth < startYM) {
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
            created_at: Date.now()
          });
        }
      }
    }

    // 5. Generate fixed expenses for the target month
    const despesasSnap = await getDocs(collection(db, 'despesas'));
    const despesasMes: any[] = [];
    despesasSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.vencimento && data.vencimento.startsWith(yearMonth)) {
        despesasMes.push(data);
      }
    });

    const contasFixasSnap = await getDocs(collection(db, 'contas_fixas'));
    contasFixasSnap.forEach(async (cfDoc) => {
      const cf = cfDoc.data();
      if (!cf.ativo) return;

      const alreadyHasDespesa = despesasMes.some(d => d.descricao === cf.nome);

      if (!alreadyHasDespesa) {
        let dueDay = String(cf.dia_vencimento || '10').padStart(2, '0');
        const vencimentoDate = `${yearMonth}-${dueDay}`;

        await addDoc(collection(db, 'despesas'), {
          descricao: cf.nome,
          categoria: cf.categoria || 'Contas Fixas',
          categoria_id: cf.categoria_id || '',
          valor: cf.valor_estimado || 0,
          vencimento: vencimentoDate,
          data_vencimento: vencimentoDate,
          status: 'pendente',
          forma_pagamento: '-',
          created_at: Date.now()
        });
      }
    });

  } catch (err) {
    console.error("Erro ao sincronizar finanças do mês:", err);
  }
};
