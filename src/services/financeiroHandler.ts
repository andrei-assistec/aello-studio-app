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

  // Localiza ou fallback da categoria 2.6
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
