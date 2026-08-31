import type { Venda } from '../../types/vendas';
import type { Produto, MovimentoEstoque } from '../../types/estoque';

export interface ItemCurvaABC {
  produto_id: string;
  codigo: number;
  descricao: string;
  qtd_vendida: number;
  faturamento: number;
  lucro_bruto: number;
  participacao_pct: number;
  acumulado_pct: number;
  classe: 'A' | 'B' | 'C';
}

export function calcularCurvaABC(vendas: Venda[], produtos: Produto[]): ItemCurvaABC[] {
  const mapa = new Map<string, { qtd: number; faturamento: number; custo: number }>();

  vendas.forEach(v => {
    if (v.status !== 'CONCLUIDA') return;
    v.itens.forEach(item => {
      const atual = mapa.get(item.produto_id) || { qtd: 0, faturamento: 0, custo: 0 };
      atual.qtd += item.qtd;
      atual.faturamento += item.total;
      atual.custo += item.qtd * (item.custo_unit_snapshot || 0);
      mapa.set(item.produto_id, atual);
    });
  });

  const totalFaturamento = Array.from(mapa.values()).reduce((acc, i) => acc + i.faturamento, 0) || 1;

  const itensOrdenados = Array.from(mapa.entries()).map(([pId, data]) => {
    const prodObj = produtos.find(p => p.id === pId);
    const lucroBruto = Math.max(0, data.faturamento - data.custo);
    const partPct = Math.round((data.faturamento / totalFaturamento) * 10000) / 100;

    return {
      produto_id: pId,
      codigo: prodObj?.codigo || 0,
      descricao: prodObj?.descricao || 'Produto Indefinido',
      qtd_vendida: data.qtd,
      faturamento: data.faturamento,
      lucro_bruto: lucroBruto,
      participacao_pct: partPct,
      acumulado_pct: 0,
      classe: 'C' as const
    };
  }).sort((a, b) => b.faturamento - a.faturamento);

  let acumulado = 0;
  return itensOrdenados.map(item => {
    acumulado += item.participacao_pct;
    let classe: 'A' | 'B' | 'C' = 'C';
    if (acumulado <= 80) classe = 'A';
    else if (acumulado <= 95) classe = 'B';

    return {
      ...item,
      acumulado_pct: Math.round(acumulado * 100) / 100,
      classe
    };
  });
}

export interface ItemGiroCobertura {
  produto_id: string;
  codigo: number;
  descricao: string;
  saldo_atual: number;
  qtd_minima: number;
  consumo_diario: number;
  dias_cobertura: number; // Saldo / Consumo diário
  status_cobertura: 'RUPTURA_IMINENTE' | 'ALERTA' | 'OK' | 'EXCESSO';
}

export function calcularGiroCobertura(
  produtos: Produto[],
  movimentos: MovimentoEstoque[],
  diasAnalise: number = 30
): ItemGiroCobertura[] {
  const agora = Date.now();
  const limiteTempo = agora - (diasAnalise * 24 * 60 * 60 * 1000);
  const consumoMapa = new Map<string, number>();

  movimentos.forEach(m => {
    if (m.tipo === 'SAIDA_VENDA' && m.data >= limiteTempo) {
      consumoMapa.set(m.produto_id, (consumoMapa.get(m.produto_id) || 0) + m.qtd);
    }
  });

  return produtos.map(prod => {
    const consumoTotalPeriodo = consumoMapa.get(prod.id) || 0;
    const consumoDiario = consumoTotalPeriodo / diasAnalise;
    const saldo = prod.saldo || 0;

    let diasCobertura = 999;
    if (consumoDiario > 0) {
      diasCobertura = Math.round(saldo / consumoDiario);
    }

    let status_cobertura: ItemGiroCobertura['status_cobertura'] = 'OK';
    if (saldo <= 0) status_cobertura = 'RUPTURA_IMINENTE';
    else if (diasCobertura <= 7) status_cobertura = 'ALERTA';
    else if (diasCobertura > 90) status_cobertura = 'EXCESSO';

    return {
      produto_id: prod.id,
      codigo: prod.codigo,
      descricao: prod.descricao,
      saldo_atual: saldo,
      qtd_minima: prod.qtd_minima || 2,
      consumo_diario: Math.round(consumoDiario * 100) / 100,
      dias_cobertura: diasCobertura,
      status_cobertura
    };
  });
}
