import { doc, runTransaction, collection } from 'firebase/firestore';
import { db } from '../firebase';
import type { Produto, MovimentoEstoque, TipoMovimentoEstoque } from '../../types/estoque';

/**
 * Obter próximo código sequencial de produto usando contadores/produtos no Firestore
 */
export async function obterProximoCodigoProduto(): Promise<number> {
  const contadorRef = doc(db, 'contadores', 'produtos');
  const novoCodigo = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(contadorRef);
    let atual = 1001; // código inicial
    if (snap.exists()) {
      atual = (snap.data().val || 1000) + 1;
    }
    transaction.set(contadorRef, { val: atual, updated_at: Date.now() }, { merge: true });
    return atual;
  });
  return novoCodigo;
}

interface RegistrarMovimentoParams {
  produtoId: string;
  tipo: TipoMovimentoEstoque;
  qtd: number;
  custoUnit: number;
  origemTipo: MovimentoEstoque['origem_tipo'];
  origemId?: string;
  usuarioId?: string;
  usuarioNome?: string;
  observacao?: string;
}

/**
 * Registra movimento no Kardex e atualiza o saldo e custo médio do produto.
 */
export async function registrarMovimentoEstoque(params: RegistrarMovimentoParams): Promise<{ novosaldo: number; novoCustoMedio: number }> {
  const { produtoId, tipo, qtd, custoUnit, origemTipo, origemId, usuarioId, usuarioNome, observacao } = params;
  const produtoRef = doc(db, 'produtos', produtoId);
  const movimentoRef = doc(collection(db, 'estoque_movimentos'));

  let novoSaldo = 0;
  let novoCustoMedio = custoUnit;

  await runTransaction(db, async (transaction) => {
    const prodSnap = await transaction.get(produtoRef);
    if (!prodSnap.exists()) {
      throw new Error(`Produto não encontrado com ID: ${produtoId}`);
    }

    const prodData = prodSnap.data() as Produto;
    const saldoAtual = prodData.saldo || 0;
    const custoAtual = prodData.custo_medio || 0;

    let eEntrada = tipo.startsWith('ENTRADA');
    let eSaida = tipo.startsWith('SAIDA');
    let regime: 'PROVISORIO' | 'REGULAR' = 'REGULAR';

    if (eEntrada) {
      novoSaldo = saldoAtual + qtd;
      if (saldoAtual + qtd > 0) {
        // Custo médio ponderado móvel
        const baseCalculo = Math.max(0, saldoAtual);
        novoCustoMedio = ((baseCalculo * custoAtual) + (qtd * custoUnit)) / (baseCalculo + qtd);
      } else {
        novoCustoMedio = custoAtual || custoUnit;
      }
    } else if (eSaida) {
      novoSaldo = saldoAtual - qtd;
      novoCustoMedio = custoAtual; // Saída mantém o custo médio existente
      if (novoSaldo < 0) {
        regime = 'PROVISORIO';
      }
    } else {
      // AJUSTE_CUSTO
      novoSaldo = saldoAtual;
      novoCustoMedio = custoUnit;
    }

    // Grava no Kardex (append-only)
    const movData: Omit<MovimentoEstoque, 'id'> = {
      produto_id: produtoId,
      produto_descricao: prodData.descricao,
      tipo,
      qtd,
      custo_unit: custoUnit,
      saldo_apos: novoSaldo,
      origem_tipo: origemTipo,
      origem_id: origemId || '',
      usuario_id: usuarioId || '',
      usuario_nome: usuarioNome || '',
      regime,
      observacao: observacao || '',
      data: Date.now()
    };

    transaction.set(movimentoRef, movData);

    // Atualiza saldo e custo_medio no produto
    transaction.update(produtoRef, {
      saldo: novoSaldo,
      custo_medio: Math.round(novoCustoMedio * 100) / 100,
      updated_at: Date.now()
    });
  });

  return { novosaldo: novoSaldo, novoCustoMedio };
}
