import { doc, runTransaction, collection, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Venda, ItemVenda, ParcelaVenda, CompradorRef, Credito } from '../../types/vendas';
import { registrarMovimentoEstoque } from '../estoque/movimentos';
import { criarReceitaVenda } from '../../services/financeiroHandler';

export async function obterProximoNumeroVenda(): Promise<number> {
  const contadorRef = doc(db, 'contadores', 'vendas');
  const novoNumero = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(contadorRef);
    let atual = 101;
    if (snap.exists()) {
      atual = (snap.data().val || 100) + 1;
    }
    transaction.set(contadorRef, { val: atual, updated_at: Date.now() }, { merge: true });
    return atual;
  });
  return novoNumero;
}

export interface ConcluirVendaParams {
  comprador: CompradorRef;
  itens: ItemVenda[];
  subtotal: number;
  descontoGeral: number;
  total: number;
  formaPagamento: Venda['forma_pagamento'];
  condicao: Venda['condicao'];
  parcelas?: ParcelaVenda[];
  vendedorId: string;
  vendedorNome: string;
  comissaoPct: number;
  creditoUsado?: number;
  creditoId?: string;
  observacoes?: string;
}

export async function concluirVenda(params: ConcluirVendaParams): Promise<string> {
  const {
    comprador,
    itens,
    subtotal,
    descontoGeral,
    total,
    formaPagamento,
    condicao,
    parcelas,
    vendedorId,
    vendedorNome,
    comissaoPct,
    creditoUsado = 0,
    creditoId,
    observacoes
  } = params;

  const numeroVenda = await obterProximoNumeroVenda();
  const comissaoValor = Math.round((total * (comissaoPct / 100)) * 100) / 100;

  // 1. Registra movimentos de saída no estoque (SAIDA_VENDA)
  for (const item of itens) {
    await registrarMovimentoEstoque({
      produtoId: item.produto_id,
      tipo: 'SAIDA_VENDA',
      qtd: item.qtd,
      custoUnit: item.custo_unit_snapshot,
      origemTipo: 'VENDA',
      origemId: String(numeroVenda),
      usuarioId: vendedorId,
      usuarioNome: vendedorNome,
      observacao: `Venda #${numeroVenda} (${comprador.nome})`
    });
  }

  // 2. Se usou crédito na loja, abata do documento de crédito
  if (creditoUsado > 0 && creditoId) {
    const credRef = doc(db, 'creditos', creditoId);
    const credSnap = await getDoc(credRef);
    if (credSnap.exists()) {
      const cData = credSnap.data() as Credito;
      const novoUsado = (cData.valor_usado || 0) + creditoUsado;
      const novoDisponivel = Math.max(0, (cData.valor_original || 0) - novoUsado);
      await updateDoc(credRef, {
        valor_usado: novoUsado,
        valor_disponivel: novoDisponivel,
        ativo: novoDisponivel > 0
      });
    }
  }

  // 3. Prepara documento de Venda
  const vendaRef = doc(collection(db, 'vendas'));
  const hojeStr = new Date().toISOString().slice(0, 10);
  const receitasIds: string[] = [];

  if (condicao === 'A_VISTA') {
    // 1 Receita quitada (status: 'pago')
    const rId = await criarReceitaVenda({
      alunoId: comprador.tipo === 'ALUNO' ? comprador.id : undefined,
      alunoNome: comprador.nome,
      descricao: `Venda #${numeroVenda} — ${comprador.nome}`,
      valor: total,
      vencimento: hojeStr,
      status: 'pago',
      formaPagamento,
      vendedorId,
      vendaId: vendaRef.id,
      dataPagamento: Date.now()
    });
    receitasIds.push(rId);
  } else {
    // A PRAZO: 1 Receita por parcela (status: 'pendente')
    const listaParcelas = parcelas && parcelas.length > 0 ? parcelas : [{ numero: 1, vencimento: hojeStr, valor: total }];
    for (let i = 0; i < listaParcelas.length; i++) {
      const p = listaParcelas[i];
      const rId = await criarReceitaVenda({
        alunoId: comprador.tipo === 'ALUNO' ? comprador.id : undefined,
        alunoNome: comprador.nome,
        descricao: `Venda #${numeroVenda} — parcela ${p.numero}/${listaParcelas.length}`,
        valor: p.valor,
        vencimento: p.vencimento,
        status: 'pendente',
        formaPagamento,
        vendedorId,
        vendaId: vendaRef.id
      });
      receitasIds.push(rId);
    }
  }

  const vendaPayload: Omit<Venda, 'id'> = {
    numero: numeroVenda,
    comprador,
    itens,
    subtotal,
    desconto_geral: descontoGeral,
    total,
    forma_pagamento: formaPagamento,
    condicao,
    parcelas: condicao === 'A_PRAZO' ? parcelas : undefined,
    vendedor_id: vendedorId,
    vendedor_nome: vendedorNome,
    comissao_pct: comissaoPct,
    comissao_valor: comissaoValor,
    credito_usado: creditoUsado > 0 ? creditoUsado : undefined,
    status: 'CONCLUIDA',
    receitas_ids: receitasIds,
    data: Date.now(),
    observacoes: observacoes || undefined
  };

  await runTransaction(db, async (t) => {
    t.set(vendaRef, vendaPayload);
  });

  return vendaRef.id;
}

export async function solicitarCancelamentoVenda(vendaId: string, solicitadoPor: string, motivo: string): Promise<void> {
  const vRef = doc(db, 'vendas', vendaId);
  await updateDoc(vRef, {
    status: 'CANCELAMENTO_SOLICITADO',
    solicitado_por: solicitadoPor,
    solicitado_em: Date.now(),
    motivo_cancelamento: motivo
  });
}

export async function aprovarCancelamentoVenda(venda: Venda, aprovadoPor: string): Promise<void> {
  // 1. Devolução de estoque (ENTRADA_DEVOLUCAO)
  for (const item of venda.itens) {
    await registrarMovimentoEstoque({
      produtoId: item.produto_id,
      tipo: 'ENTRADA_DEVOLUCAO',
      qtd: item.qtd,
      custoUnit: item.custo_unit_snapshot,
      origemTipo: 'DEVOLUCAO',
      origemId: String(venda.numero),
      usuarioId: aprovadoPor,
      observacao: `Cancelamento Venda #${venda.numero}`
    });
  }

  // 2. Cancela receitas pendentes no financeiro
  if (venda.receitas_ids && venda.receitas_ids.length > 0) {
    for (const rId of venda.receitas_ids) {
      const rRef = doc(db, 'receitas', rId);
      const rSnap = await getDoc(rRef);
      if (rSnap.exists() && rSnap.data().status !== 'pago') {
        await updateDoc(rRef, { status: 'cancelado', justificativa_desconto: 'Venda Cancelada' });
      }
    }
  }

  // 3. Atualiza status da venda
  const vRef = doc(db, 'vendas', venda.id);
  await updateDoc(vRef, {
    status: 'CANCELADA',
    updated_at: Date.now()
  });
}
