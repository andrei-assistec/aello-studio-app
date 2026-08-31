import React, { useState } from 'react';
import { X, Printer, Grid } from 'lucide-react';
import type { Produto, EtiquetaModelo } from '../../types/estoque';

interface ImprimirEtiquetasModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: Produto | null;
}

const MODELO_PADRAO_A4: EtiquetaModelo = {
  id: 'padrao-a4',
  nome: 'Padrão A4 (5 × 13 = 65 etiquetas)',
  margem_lateral: 4,
  margem_superior: 10,
  distancia_vertical: 22,
  distancia_horizontal: 40,
  largura: 40,
  altura: 21,
  etiquetas_por_linha: 5,
  linhas_por_pagina: 13,
  codigo_barras: 'EAN13',
  mostrar_nome: true,
  mostrar_preco: true,
  mostrar_tamanho: true,
  altura_codigo: 2,
  fonte: 7
};

export const ImprimirEtiquetasModal: React.FC<ImprimirEtiquetasModalProps> = ({
  isOpen,
  onClose,
  produto
}) => {
  const [qtdEtiquetas, setQtdEtiquetas] = useState('5');
  const [linhaInicial, setLinhaInicial] = useState('1');
  const [colunaInicial, setColunaInicial] = useState('1');

  if (!isOpen || !produto) return null;

  const handlePrint = () => {
    const windowPrint = window.open('', '_blank');
    if (!windowPrint) {
      alert('Por favor, permita pop-ups para imprimir as etiquetas.');
      return;
    }

    const totalImpressas = parseInt(qtdEtiquetas, 10) || 1;
    const lInicial = (parseInt(linhaInicial, 10) || 1) - 1;
    const cInicial = (parseInt(colunaInicial, 10) || 1) - 1;

    const offsetInicial = lInicial * MODELO_PADRAO_A4.etiquetas_por_linha + cInicial;

    let htmlEtiquetas = '';

    // Espaços em branco para reaproveitamento da folha A4
    for (let i = 0; i < offsetInicial; i++) {
      htmlEtiquetas += `<div class="etiqueta em-branco"></div>`;
    }

    // Etiquetas reais do produto
    for (let i = 0; i < totalImpressas; i++) {
      htmlEtiquetas += `
        <div class="etiqueta">
          <div class="header font-bold">AELLO STUDIO</div>
          <div class="descricao">${produto.nome_curto || produto.descricao}</div>
          ${produto.tamanho ? `<div class="detalhe">Tam: ${produto.tamanho} ${produto.cor ? `| ${produto.cor}` : ''}</div>` : ''}
          <div class="preco font-bold">R$ ${produto.preco_venda.toFixed(2)}</div>
          <div class="codigo-barras">${produto.ean_interno}</div>
        </div>
      `;
    }

    windowPrint.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas - ${produto.descricao}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: ${MODELO_PADRAO_A4.margem_superior}mm ${MODELO_PADRAO_A4.margem_lateral}mm;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
            }
            .grid-a4 {
              display: grid;
              grid-template-columns: repeat(${MODELO_PADRAO_A4.etiquetas_por_linha}, ${MODELO_PADRAO_A4.largura}mm);
              grid-auto-rows: ${MODELO_PADRAO_A4.altura}mm;
              gap: 1mm;
            }
            .etiqueta {
              width: ${MODELO_PADRAO_A4.largura}mm;
              height: ${MODELO_PADRAO_A4.altura}mm;
              border: 1px dashed #ccc;
              box-sizing: border-box;
              padding: 1.5mm;
              text-align: center;
              font-size: ${MODELO_PADRAO_A4.fonte}pt;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
            }
            .etiqueta.em-branco {
              border: none;
            }
            .font-bold { font-weight: bold; }
            .header { font-size: 6pt; color: #555; }
            .descricao { font-size: 7.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .detalhe { font-size: 6.5pt; color: #444; }
            .preco { font-size: 8.5pt; color: #000; }
            .codigo-barras { font-family: monospace; font-size: 7pt; tracking: 1px; }
            @media print {
              .etiqueta { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="grid-a4">
            ${htmlEtiquetas}
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    windowPrint.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-surface-200">
        <div className="flex items-center justify-between p-5 bg-surface-50 border-b border-surface-200">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-brand-dark">Imprimir Etiquetas A4</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-surface-400 hover:text-surface-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl text-xs font-semibold border border-emerald-200">
            <span className="font-bold block">{produto.descricao}</span>
            <span className="font-mono text-[11px]">EAN Interno: #{produto.ean_interno} | R$ {produto.preco_venda.toFixed(2)}</span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
              Quantidade de Etiquetas
            </label>
            <input
              type="number"
              min="1"
              max="65"
              value={qtdEtiquetas}
              onChange={e => setQtdEtiquetas(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-600 flex items-center gap-1.5">
              <Grid className="w-4 h-4 text-emerald-600" /> Reaproveitamento de Folha Parcial
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-surface-600 mb-1">Linha Inicial (1-13)</label>
                <input
                  type="number"
                  min="1"
                  max="13"
                  value={linhaInicial}
                  onChange={e => setLinhaInicial(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-surface-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-surface-600 mb-1">Coluna Inicial (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={colunaInicial}
                  onChange={e => setColunaInicial(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-surface-300 rounded-lg bg-white"
                />
              </div>
            </div>
            <p className="text-[11px] text-surface-500">
              Inicia a impressão a partir da posição escolhida para não desperdiçar folhas A4 usadas anteriormente.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-surface-600 hover:bg-surface-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Gerar / Imprimir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
