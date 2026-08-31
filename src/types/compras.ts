export interface ItemCompra {
  produto_id?: string;
  cod_fornecedor?: string;
  ean?: string;
  descricao_origem: string;
  ncm?: string;
  qtd: number;
  valor_unitario: number;
  rateio_frete_desconto: number; // valor ajustado final unitário
  valor_total: number;
  vinculado: boolean;
}

export interface ParcelaCompra {
  numero: number;
  vencimento: string; // YYYY-MM-DD
  valor: number;
}

export interface Compra {
  id: string;
  numero_nota?: string;
  serie?: string;
  chave_nfe?: string; // 44 dígitos
  cfop?: string;
  data_emissao?: string;

  fornecedor_id: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;

  itens: ItemCompra[];

  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_total: number;

  parcelas: ParcelaCompra[];

  status: 'PENDENTE_VINCULO' | 'CONFIRMADA' | 'CANCELADA';
  origem: 'XML' | 'MANUAL';
  
  despesas_ids?: string[]; // IDs das despesas geradas no financeiro (categoria 2.6)

  created_at: number;
  created_by?: string;
}

export interface CompraDepara {
  id: string;
  fornecedor_id: string;
  cod_fornecedor: string;
  ean?: string;
  descricao_origem: string;
  produto_id: string;
  aprendido_em: number;
  aprendido_por?: string;
}
