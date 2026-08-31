/**
 * Gera um EAN-13 interno de circulação restrita (prefixo 2)
 * Faixa reservada pelo GS1 para uso interno em estabelecimentos.
 */
export function gerarEanInterno(codigoProduto: number): string {
  // 2 (prefixo interno) + 00000 (reserva) + código com 6 dígitos = 12 dígitos base
  const base = '2' + '00000' + String(codigoProduto).padStart(6, '0');
  return base + digitoVerificadorEan13(base);
}

/**
 * Calcula o dígito verificador módulo 10 para uma string EAN-13 de 12 dígitos.
 */
export function digitoVerificadorEan13(doze: string): string {
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += Number(doze[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (soma % 10)) % 10);
}
