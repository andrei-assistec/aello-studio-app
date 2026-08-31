import React, { useState } from 'react';
import { X, Upload, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { parseNFeXML } from '../../lib/compras/nfeParser';
import type { ParsedNFeResult } from '../../lib/compras/nfeParser';
import type { ItemCompra, CompraDepara } from '../../types/compras';
import type { Produto, Fornecedor } from '../../types/estoque';
import { registrarMovimentoEstoque } from '../../lib/estoque/movimentos';
import { criarDespesaCompra } from '../../services/financeiroHandler';
import { useAuth } from '../../hooks/useAuth';

interface ComprarXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  produtos: Produto[];
  fornecedores: Fornecedor[];
}

export const ComprarXmlModal: React.FC<ComprarXmlModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  produtos,
  fornecedores
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'UPLOAD' | 'CONFERENCIA'>('UPLOAD');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedNFe, setParsedNFe] = useState<ParsedNFeResult | null>(null);
  const [fornecedorId, setFornecedorId] = useState<string>('');
  const [itensVinculados, setItensVinculados] = useState<(ItemCompra & { produto_id?: string })[]>([]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const text = await file.text();
      const res = parseNFeXML(text);
      setParsedNFe(res);

      // Localiza ou prepara o fornecedor pelo CNPJ
      let fMatch = fornecedores.find(f => f.cnpj.replace(/\D/g, '') === res.emitente.cnpj.replace(/\D/g, ''));
      let fId = fMatch?.id || '';

      if (!fMatch && res.emitente.cnpj) {
        // Cadastra fornecedor automaticamente se não existir
        const fDoc = await addDoc(collection(db, 'fornecedores'), {
          razao_social: res.emitente.nome,
          cnpj: res.emitente.cnpj,
          ie: res.emitente.ie,
          ativo: true,
          created_at: Date.now()
        });
        fId = fDoc.id;
      }
      setFornecedorId(fId);

      // Tenta de-para automático com compras_depara
      const deparaSnap = await getDocs(collection(db, 'compras_depara'));
      const deparaList: CompraDepara[] = [];
      deparaSnap.forEach(d => deparaList.push({ ...(d.data() as CompraDepara), id: d.id }));

      const itensComVinc = res.itens.map(item => {
        let matchedProdId: string | undefined = undefined;

        // 1. Busca por fornecedor + cod_fornecedor
        const matchCod = deparaList.find(dp => dp.fornecedor_id === fId && dp.cod_fornecedor === item.cod_fornecedor);
        if (matchCod) matchedProdId = matchCod.produto_id;

        // 2. Busca por EAN se não achou pelo código
        if (!matchedProdId && item.ean) {
          const matchEan = produtos.find(p => p.ean_fabricante === item.ean || p.ean_interno === item.ean);
          if (matchEan) matchedProdId = matchEan.id;
        }

        // 3. Busca por descrição exata
        if (!matchedProdId) {
          const matchDesc = produtos.find(p => p.descricao.toLowerCase().trim() === item.descricao_origem.toLowerCase().trim());
          if (matchDesc) matchedProdId = matchDesc.id;
        }

        return {
          ...item,
          produto_id: matchedProdId,
          vinculado: !!matchedProdId
        };
      });

      setItensVinculados(itensComVinc);
      setStep('CONFERENCIA');
    } catch (err: any) {
      console.error('Erro ao ler XML:', err);
      alert(err.message || 'Erro ao processar o arquivo XML da NF-e.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVincularProduto = (index: number, produtoId: string) => {
    const clone = [...itensVinculados];
    clone[index].produto_id = produtoId || undefined;
    clone[index].vinculado = !!produtoId;
    setItensVinculados(clone);
  };

  const handleConfirmarCompra = async () => {
    if (!parsedNFe) return;

    const pendentes = itensVinculados.filter(i => !i.produto_id);
    if (pendentes.length > 0) {
      alert(`Atenção: Existem ${pendentes.length} item(ns) pendentes de vínculo. Vincule todos os itens a produtos existentes antes de confirmar.`);
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Salva ou atualiza compras_depara para os itens vinculados (Autoaprendizado)
      for (const item of itensVinculados) {
        if (item.produto_id && item.cod_fornecedor) {
          const q = query(
            collection(db, 'compras_depara'),
            where('fornecedor_id', '==', fornecedorId),
            where('cod_fornecedor', '==', item.cod_fornecedor)
          );
          const snap = await getDocs(q);
          if (snap.empty) {
            await addDoc(collection(db, 'compras_depara'), {
              fornecedor_id: fornecedorId,
              cod_fornecedor: item.cod_fornecedor,
              ean: item.ean || null,
              descricao_origem: item.descricao_origem,
              produto_id: item.produto_id,
              aprendido_em: Date.now(),
              aprendido_por: user?.email || 'Admin'
            });
          }
        }

        // Se o produto não tinha NCM, grava o NCM vindo do XML no cadastro do produto
        if (item.produto_id && item.ncm) {
          const prodObj = produtos.find(p => p.id === item.produto_id);
          if (prodObj && !prodObj.ncm) {
            await updateDoc(doc(db, 'produtos', item.produto_id), { ncm: item.ncm });
          }
        }
      }

      // 2. Registra movimentos de entrada no estoque (ENTRADA_COMPRA)
      for (const item of itensVinculados) {
        await registrarMovimentoEstoque({
          produtoId: item.produto_id!,
          tipo: 'ENTRADA_COMPRA',
          qtd: item.qtd,
          custoUnit: item.rateio_frete_desconto,
          origemTipo: 'COMPRA',
          origemId: parsedNFe.chave_nfe || parsedNFe.numero_nota,
          usuarioId: user?.uid,
          usuarioNome: user?.displayName || user?.email || 'Admin',
          observacao: `Entrada NF-e #${parsedNFe.numero_nota} (${parsedNFe.emitente.nome})`
        });
      }

      // 3. Lança despesas a pagar para cada parcela da NF-e via evento PAGAR_CRIAR
      const despesasIds: string[] = [];
      for (const parc of parsedNFe.parcelas) {
        const dId = await criarDespesaCompra({
          descricao: `Compra NF-e #${parsedNFe.numero_nota} — ${parsedNFe.emitente.nome} (${parc.numero}/${parsedNFe.parcelas.length})`,
          valor: parc.valor,
          vencimento: parc.vencimento,
          formaPagamento: 'Boleto'
        });
        despesasIds.push(dId);
      }

      // 5. Grava documento final na coleção compras
      await addDoc(collection(db, 'compras'), {
        numero_nota: parsedNFe.numero_nota,
        serie: parsedNFe.serie,
        chave_nfe: parsedNFe.chave_nfe,
        cfop: parsedNFe.cfop,
        data_emissao: parsedNFe.data_emissao,

        fornecedor_id: fornecedorId,
        fornecedor_nome: parsedNFe.emitente.nome,
        fornecedor_cnpj: parsedNFe.emitente.cnpj,

        itens: itensVinculados,

        valor_produtos: parsedNFe.valor_produtos,
        valor_frete: parsedNFe.valor_frete,
        valor_seguro: parsedNFe.valor_seguro,
        valor_desconto: parsedNFe.valor_desconto,
        valor_total: parsedNFe.valor_total,

        parcelas: parsedNFe.parcelas,

        status: 'CONFIRMADA',
        origem: 'XML',
        despesas_ids: despesasIds,

        created_at: Date.now(),
        created_by: user?.email || 'Admin'
      });

      alert('Compra via XML confirmada com sucesso! Estoque e contas a pagar atualizados.');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao confirmar compra XML:', err);
      alert('Ocorreu um erro ao processar a confirmação da compra.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-surface-200 my-8">
        <div className="flex items-center justify-between p-6 bg-surface-50 border-b border-surface-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-800 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-brand-dark">Importar Compra via XML da NF-e</h2>
              <p className="text-xs text-surface-500 font-medium">Autoaprendizado de De-Para, entrada no estoque e geração de parcelas a pagar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'UPLOAD' ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 border border-indigo-200">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-base font-bold text-brand-dark mb-1">Selecione o arquivo XML da NF-e de Compra</h3>
            <p className="text-xs text-surface-500 max-w-md mb-6">
              O sistema fará a leitura automática dos itens, valores unitários com rateio de frete e despesas a pagar.
            </p>

            <label className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl cursor-pointer shadow-md inline-flex items-center gap-2 transition-all">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Carregar Arquivo XML (.xml)
              <input type="file" accept=".xml" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Resumo da NF-e */}
            {parsedNFe && (
              <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-surface-500 block uppercase font-bold">Nota Fiscal</span>
                  <span className="font-bold text-brand-dark text-sm">#{parsedNFe.numero_nota} (Série {parsedNFe.serie})</span>
                </div>
                <div>
                  <span className="text-surface-500 block uppercase font-bold">Emitente</span>
                  <span className="font-bold text-brand-dark text-sm">{parsedNFe.emitente.nome}</span>
                  <span className="text-[10px] text-surface-400 block font-mono">CNPJ: {parsedNFe.emitente.cnpj}</span>
                </div>
                <div>
                  <span className="text-surface-500 block uppercase font-bold">Data Emissão</span>
                  <span className="font-bold text-brand-dark text-sm">{parsedNFe.data_emissao}</span>
                </div>
                <div>
                  <span className="text-surface-500 block uppercase font-bold">Valor Total NF-e</span>
                  <span className="font-black text-emerald-700 text-sm">R$ {parsedNFe.valor_total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Lista de Itens para De-Para */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-surface-600 mb-3 flex items-center justify-between">
                <span>Conferência de Itens & Vínculo de Estoque (De-Para)</span>
                <span className="text-surface-400 text-[11px]">
                  {itensVinculados.filter(i => i.vinculado).length} de {itensVinculados.length} vinculados
                </span>
              </h4>

              <div className="border border-surface-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-50 border-b border-surface-200 font-bold uppercase text-surface-500">
                    <tr>
                      <th className="p-3">Item na NF-e</th>
                      <th className="p-3 text-center">Qtd</th>
                      <th className="p-3 text-right">Custo Rateado</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3">Vínculo Produto Studio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                    {itensVinculados.map((item, idx) => (
                      <tr key={idx} className={item.vinculado ? 'bg-emerald-50/30' : 'bg-amber-50/40'}>
                        <td className="p-3">
                          <div className="font-bold text-brand-dark">{item.descricao_origem}</div>
                          <div className="text-[10px] text-surface-400 font-mono">Cód: {item.cod_fornecedor} {item.ncm ? `| NCM: ${item.ncm}` : ''}</div>
                        </td>
                        <td className="p-3 text-center font-bold">{item.qtd}</td>
                        <td className="p-3 text-right font-mono font-semibold">R$ {item.rateio_frete_desconto.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-bold text-brand-dark">R$ {item.valor_total.toFixed(2)}</td>
                        <td className="p-3">
                          <select
                            value={item.produto_id || ''}
                            onChange={e => handleVincularProduto(idx, e.target.value)}
                            className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold ${
                              item.vinculado ? 'border-emerald-300 text-emerald-900 bg-white' : 'border-amber-400 text-amber-900 bg-amber-50'
                            }`}
                          >
                            <option value="">-- Selecione o Produto no Studio --</option>
                            {produtos.map(p => (
                              <option key={p.id} value={p.id}>
                                #{p.codigo} - {p.descricao} (Atual: R$ {p.custo_medio.toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Parcelas a Pagar */}
            {parsedNFe && parsedNFe.parcelas.length > 0 && (
              <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-surface-600 mb-2">
                  Parcelas a Pagar Geradas ({parsedNFe.parcelas.length}x)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {parsedNFe.parcelas.map(p => (
                    <div key={p.numero} className="px-3 py-1.5 bg-white border border-surface-200 rounded-lg text-xs font-semibold">
                      <span>Parcela {p.numero}: </span>
                      <span className="font-bold text-brand-dark">{p.vencimento}</span>
                      <span className="text-emerald-700 font-mono font-bold ml-2">R$ {p.valor.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-surface-600 hover:bg-surface-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarCompra}
                disabled={isProcessing || itensVinculados.some(i => !i.produto_id)}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar Compra & Atualizar Estoque
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
