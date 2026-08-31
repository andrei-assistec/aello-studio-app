import type { ItemCompra, ParcelaCompra } from '../../types/compras';

export interface ParsedNFeResult {
  numero_nota: string;
  serie: string;
  chave_nfe: string;
  cfop: string;
  data_emissao: string;
  emitente: {
    cnpj: string;
    nome: string;
    ie: string;
  };
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_total: number;
  itens: ItemCompra[];
  parcelas: ParcelaCompra[];
}

export function parseNFeXML(xmlContent: string): ParsedNFeResult {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Arquivo XML inválido ou corrompido.');
  }

  // Tag NFe / infNFe
  const infNFe = xmlDoc.querySelector('infNFe');
  const chave_nfe = infNFe?.getAttribute('Id')?.replace(/^NFe/, '') || '';

  // Cabeçalho ide
  const ide = xmlDoc.querySelector('ide');
  const numero_nota = ide?.querySelector('nNF')?.textContent || '';
  const serie = ide?.querySelector('serie')?.textContent || '';
  const data_emissao = ide?.querySelector('dhEmi')?.textContent?.slice(0, 10) || ide?.querySelector('dEmi')?.textContent?.slice(0, 10) || new Date().toISOString().slice(0, 10);

  // Emitente
  const emit = xmlDoc.querySelector('emit');
  const cnpj = emit?.querySelector('CNPJ')?.textContent || emit?.querySelector('CPF')?.textContent || '';
  const nome = emit?.querySelector('xNome')?.textContent || 'Fornecedor NFe';
  const ie = emit?.querySelector('IE')?.textContent || '';

  // Totais
  const total = xmlDoc.querySelector('total > ICMSTot');
  const valor_produtos = parseFloat(total?.querySelector('vProd')?.textContent || '0');
  const valor_frete = parseFloat(total?.querySelector('vFrete')?.textContent || '0');
  const valor_seguro = parseFloat(total?.querySelector('vSeg')?.textContent || '0');
  const valor_desconto = parseFloat(total?.querySelector('vDesc')?.textContent || '0');
  const valor_total = parseFloat(total?.querySelector('vNF')?.textContent || '0');

  // Itens
  const dets = Array.from(xmlDoc.querySelectorAll('det'));
  let cfopPrimeiro = '';

  const rawItens = dets.map((det) => {
    const prod = det.querySelector('prod');
    const cod_fornecedor = prod?.querySelector('cProd')?.textContent || '';
    const ean = prod?.querySelector('cEAN')?.textContent;
    const descricao_origem = prod?.querySelector('xProd')?.textContent || 'Item NFe';
    const ncm = prod?.querySelector('NCM')?.textContent || '';
    const cfop = prod?.querySelector('CFOP')?.textContent || '';
    if (!cfopPrimeiro && cfop) cfopPrimeiro = cfop;

    const qtd = parseFloat(prod?.querySelector('qCom')?.textContent || '1');
    const valor_unitario = parseFloat(prod?.querySelector('vUnCom')?.textContent || '0');
    const vProdItem = parseFloat(prod?.querySelector('vProd')?.textContent || String(qtd * valor_unitario));

    return {
      cod_fornecedor,
      ean: ean && ean !== 'SEM GTIN' ? ean : undefined,
      descricao_origem,
      ncm,
      qtd,
      valor_unitario,
      valor_total_item: vProdItem
    };
  });

  // Rateio proporcional do frete, seguro e desconto por item
  const acréscimoTotal = valor_frete + valor_seguro - valor_desconto;
  const somaProdutos = rawItens.reduce((acc, i) => acc + i.valor_total_item, 0) || 1;

  const itens: ItemCompra[] = rawItens.map((item) => {
    const proporção = item.valor_total_item / somaProdutos;
    const rateioItem = item.valor_total_item + (acréscimoTotal * proporção);
    const custoUnitFinal = Math.round((rateioItem / (item.qtd || 1)) * 100) / 100;

    return {
      cod_fornecedor: item.cod_fornecedor,
      ean: item.ean,
      descricao_origem: item.descricao_origem,
      ncm: item.ncm,
      qtd: item.qtd,
      valor_unitario: item.valor_unitario,
      rateio_frete_desconto: custoUnitFinal,
      valor_total: Math.round(rateioItem * 100) / 100,
      vinculado: false
    };
  });

  // Parcelas (dup / cobr)
  const dups = Array.from(xmlDoc.querySelectorAll('cobr > dup'));
  const parcelas: ParcelaCompra[] = dups.map((dup, index) => {
    const num = parseInt(dup.querySelector('nDup')?.textContent || String(index + 1), 10) || (index + 1);
    const venc = dup.querySelector('dVenc')?.textContent || data_emissao;
    const val = parseFloat(dup.querySelector('vDup')?.textContent || '0');
    return {
      numero: num,
      vencimento: venc,
      valor: val
    };
  });

  // Se não houver parcelas no XML, gera 1 parcela padrão à vista/30d
  if (parcelas.length === 0 && valor_total > 0) {
    parcelas.push({
      numero: 1,
      vencimento: data_emissao,
      valor: valor_total
    });
  }

  return {
    numero_nota,
    serie,
    chave_nfe,
    cfop: cfopPrimeiro || '5102',
    data_emissao,
    emitente: {
      cnpj,
      nome,
      ie
    },
    valor_produtos,
    valor_frete,
    valor_seguro,
    valor_desconto,
    valor_total,
    itens,
    parcelas
  };
}
