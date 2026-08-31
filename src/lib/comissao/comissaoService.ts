import type { Venda } from '../../types/vendas';
import type { Funcionario } from '../../types/database';

export interface ResumoComissaoVendedor {
  vendedor_id: string;
  vendedor_nome: string;
  total_vendas_valor: number;
  total_vendas_qtd: number;
  comissao_pct_media: number;
  comissao_valor_total: number;
}

export function calcularComissoesVendedores(
  vendas: Venda[],
  _funcionarios: Funcionario[],
  dataInicio: number,
  dataFim: number,
  vendedorIdFiltro?: string
): ResumoComissaoVendedor[] {
  const mapa = new Map<string, ResumoComissaoVendedor>();

  vendas.forEach(venda => {
    // Filtra por período e status válido (apenas CONCLUIDA soma comissão)
    if (venda.status !== 'CONCLUIDA') return;
    if (venda.data < dataInicio || venda.data > dataFim) return;
    if (vendedorIdFiltro && vendedorIdFiltro !== 'todos' && venda.vendedor_id !== vendedorIdFiltro) return;

    const vId = venda.vendedor_id || 'nao-identificado';
    const vNome = venda.vendedor_nome || 'Vendedor N/A';

    const atual = mapa.get(vId) || {
      vendedor_id: vId,
      vendedor_nome: vNome,
      total_vendas_valor: 0,
      total_vendas_qtd: 0,
      comissao_pct_media: venda.comissao_pct || 0,
      comissao_valor_total: 0
    };

    atual.total_vendas_valor += venda.total || 0;
    atual.total_vendas_qtd += 1;
    atual.comissao_valor_total += venda.comissao_valor || 0;

    mapa.set(vId, atual);
  });

  return Array.from(mapa.values());
}
