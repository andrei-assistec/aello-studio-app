import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CriarDespesaCompraParams {
  descricao: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  formaPagamento?: string;
}

/**
 * Handler de evento PAGAR_CRIAR para compras
 * Grava despesa contábil em 'despesas' sob a categoria '2.6 Compra de Mercadoria'
 */
export async function criarDespesaCompra(params: CriarDespesaCompraParams): Promise<string> {
  const { descricao, valor, vencimento, formaPagamento = 'Boleto' } = params;

  const planoContasSnap = await getDocs(collection(db, 'plano_contas'));
  let catCompraId = '';
  planoContasSnap.forEach(d => {
    if (d.data().codigo === '2.6') catCompraId = d.id;
  });

  const docRef = await addDoc(collection(db, 'despesas'), {
    descricao,
    categoria: '2.6 Compra de Mercadoria',
    categoria_id: catCompraId,
    valor,
    vencimento,
    data_vencimento: vencimento,
    status: 'pendente',
    forma_pagamento: formaPagamento,
    created_at: Date.now()
  });

  return docRef.id;
}

export interface CriarReceitaVendaParams {
  alunoId?: string;
  alunoNome: string;
  descricao: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  status: 'pago' | 'pendente';
  formaPagamento: string;
  vendedorId: string | null;
  vendaId: string;
  dataPagamento?: number;
}

/**
 * Handler de evento RECEBER_CRIAR para vendas
 * Grava receita em 'receitas' sob a categoria '1.3 Vendas de Produtos'
 */
export async function criarReceitaVenda(params: CriarReceitaVendaParams): Promise<string> {
  const { alunoId, alunoNome, descricao, valor, vencimento, status, formaPagamento, vendedorId, vendaId, dataPagamento } = params;

  const planoContasSnap = await getDocs(collection(db, 'plano_contas'));
  let catVendaId = '';
  planoContasSnap.forEach(d => {
    if (d.data().codigo === '1.3') catVendaId = d.id;
  });

  const docRef = await addDoc(collection(db, 'receitas'), {
    aluno_id: alunoId || '',
    aluno_nome: alunoNome,
    descricao,
    plano: 'Venda de Produtos',
    categoria_id: catVendaId,
    valor,
    vencimento,
    data_vencimento: vencimento,
    status,
    forma_pagamento: formaPagamento,
    data_pagamento: status === 'pago' ? (dataPagamento || Date.now()) : null,
    personal_id: null,
    vendedor_id: vendedorId,
    origem: 'VENDA',
    venda_id: vendaId,
    created_at: Date.now()
  });

  return docRef.id;
}

export interface CriarDespesaEstornoParams {
  descricao: string;
  valor: number;
  vencimento: string;
  formaPagamento: string;
}

/**
 * Handler para estornos em dinheiro de devolução de vendas
 */
export async function criarDespesaEstorno(params: CriarDespesaEstornoParams): Promise<string> {
  const { descricao, valor, vencimento, formaPagamento } = params;

  const docRef = await addDoc(collection(db, 'despesas'), {
    descricao,
    categoria: 'Estorno de Venda',
    valor,
    vencimento,
    data_vencimento: vencimento,
    status: 'pago',
    data_pagamento: Date.now(),
    forma_pagamento: formaPagamento,
    created_at: Date.now()
  });

  return docRef.id;
}
