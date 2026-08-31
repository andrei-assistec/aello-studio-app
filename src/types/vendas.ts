export interface CompradorRef {
  tipo: 'ALUNO' | 'CLIENTE';
  id: string;
  nome: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  cpf?: string;
  virou_aluno?: string; // id do aluno caso tenha se matriculado
  created_at: number;
}

export interface ItemVenda {
  produto_id: string;
  descricao: string;
  qtd: number;
  preco_unit: number;
  desconto: number;
  total: number;
  custo_unit_snapshot: number; // custo médio no momento da venda
}

export interface ParcelaVenda {
  numero: number;
  vencimento: string; // YYYY-MM-DD
  valor: number;
}

export type StatusVenda =
  | 'CONCLUIDA'
  | 'CANCELAMENTO_SOLICITADO'
  | 'CANCELADA'
  | 'DEVOLVIDA_PARCIAL'
  | 'DEVOLVIDA_TOTAL';

export interface Venda {
  id: string;
  numero: number; // sequencial via contadores/vendas
  comprador: CompradorRef;
  itens: ItemVenda[];
  subtotal: number;
  desconto_geral: number;
  total: number;

  forma_pagamento: 'Pix' | 'Dinheiro' | 'Cartão Crédito' | 'Cartão Débito' | 'Transferência' | 'Boleto';
  condicao: 'A_VISTA' | 'A_PRAZO';
  parcelas?: ParcelaVenda[];

  vendedor_id: string;
  vendedor_nome: string;
  comissao_pct: number; // snapshot do % no momento da venda
  comissao_valor: number; // valor congelado da comissão

  credito_usado?: number;

  status: StatusVenda;
  receitas_ids: string[];
  data: number;
  observacoes?: string;

  // Cancelamento
  solicitado_por?: string;
  solicitado_em?: number;
  motivo_cancelamento?: string;
  recusado_por?: string;
  recusado_em?: number;
  motivo_recusa?: string;
}

export interface Credito {
  id: string;
  comprador: CompradorRef;
  valor_original: number;
  valor_usado: number;
  valor_disponivel: number;
  origem_venda_id: string;
  concedido_por: string;
  concedido_em: number;
  validade?: string | null;
  ativo: boolean;
}
