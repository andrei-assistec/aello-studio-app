export interface Produto {
  id: string;
  codigo: number;
  descricao: string;
  nome_curto?: string;
  marca?: string;
  categoria?: string; // 'Legging' | 'Top' | 'Camiseta' | 'Acessório'
  tamanho?: string;   // 'P' | 'M' | 'G'
  cor?: string;       // 'Preta'
  agrupador?: string; // 'Legging Suplex'

  ean_fabricante?: string;
  ean_interno: string;

  custo_medio: number;
  preco_venda: number;
  pct_lucro?: number; // derivado (preco_venda - custo_medio) / custo_medio * 100
  saldo: number;
  qtd_minima: number;
  unidade: string;    // 'UN'
  localizacao?: string;
  foto_url?: string;
  ativo: boolean;

  // FISCAL
  ncm?: string;
  cfop_padrao?: string;
  cst_csosn?: string;
  origem_mercadoria?: string;
  unidade_tributavel?: string;

  created_at?: number;
  updated_at?: number;
}

export type TipoMovimentoEstoque =
  | 'ENTRADA_COMPRA'
  | 'ENTRADA_DEVOLUCAO'
  | 'ENTRADA_AJUSTE'
  | 'SAIDA_VENDA'
  | 'SAIDA_AJUSTE'
  | 'AJUSTE_CUSTO';

export interface MovimentoEstoque {
  id: string;
  produto_id: string;
  produto_descricao?: string;
  tipo: TipoMovimentoEstoque;
  qtd: number;
  custo_unit: number;
  saldo_apos: number;
  origem_tipo: 'COMPRA' | 'VENDA' | 'DEVOLUCAO' | 'AJUSTE_INVENTARIO' | 'SISTEMA';
  origem_id?: string;
  usuario_id?: string;
  usuario_nome?: string;
  regime?: 'PROVISORIO' | 'REGULAR';
  observacao?: string;
  data: number;
}

export interface EtiquetaModelo {
  id: string;
  nome: string;
  margem_lateral: number;
  margem_superior: number;
  distancia_vertical: number;
  distancia_horizontal: number;
  largura: number;
  altura: number;
  etiquetas_por_linha: number;
  linhas_por_pagina: number;
  codigo_barras: 'EAN13' | 'CODE128' | 'NENHUM';
  mostrar_nome: boolean;
  mostrar_preco: boolean;
  mostrar_tamanho: boolean;
  altura_codigo: number;
  fonte: number;
}

export interface Fornecedor {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  ie?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  ativo: boolean;
  created_at?: number;
}
