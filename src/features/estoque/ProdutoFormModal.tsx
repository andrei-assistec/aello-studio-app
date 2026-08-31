import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Package, Tag, FileText } from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Produto } from '../../types/estoque';
import { gerarEanInterno } from '../../lib/estoque/ean';
import { obterProximoCodigoProduto, registrarMovimentoEstoque } from '../../lib/estoque/movimentos';
import { useAuth } from '../../hooks/useAuth';

interface ProdutoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  produtoToEdit?: Produto | null;
}

const CATEGORIAS_PADRAO = ['Legging', 'Top', 'Camiseta', 'Shorts', 'Regata', 'Acessório', 'Suplemento', 'Outros'];

export const ProdutoFormModal: React.FC<ProdutoFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  produtoToEdit
}) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    descricao: '',
    nome_curto: '',
    marca: '',
    categoria: 'Legging',
    tamanho: '',
    cor: '',
    agrupador: '',
    ean_fabricante: '',
    preco_venda: '',
    custo_medio: '',
    saldo: '0',
    qtd_minima: '2',
    unidade: 'UN',
    localizacao: '',
    foto_url: '',
    ativo: true,

    // FISCAL
    ncm: '',
    cfop_padrao: '5102',
    cst_csosn: '0102',
    origem_mercadoria: '0',
    unidade_tributavel: 'UN'
  });

  useEffect(() => {
    if (produtoToEdit) {
      setFormData({
        descricao: produtoToEdit.descricao || '',
        nome_curto: produtoToEdit.nome_curto || '',
        marca: produtoToEdit.marca || '',
        categoria: produtoToEdit.categoria || 'Legging',
        tamanho: produtoToEdit.tamanho || '',
        cor: produtoToEdit.cor || '',
        agrupador: produtoToEdit.agrupador || '',
        ean_fabricante: produtoToEdit.ean_fabricante || '',
        preco_venda: String(produtoToEdit.preco_venda || 0),
        custo_medio: String(produtoToEdit.custo_medio || 0),
        saldo: String(produtoToEdit.saldo || 0),
        qtd_minima: String(produtoToEdit.qtd_minima ?? 2),
        unidade: produtoToEdit.unidade || 'UN',
        localizacao: produtoToEdit.localizacao || '',
        foto_url: produtoToEdit.foto_url || '',
        ativo: produtoToEdit.ativo !== false,

        ncm: produtoToEdit.ncm || '',
        cfop_padrao: produtoToEdit.cfop_padrao || '5102',
        cst_csosn: produtoToEdit.cst_csosn || '0102',
        origem_mercadoria: produtoToEdit.origem_mercadoria || '0',
        unidade_tributavel: produtoToEdit.unidade_tributavel || 'UN'
      });
    } else {
      setFormData({
        descricao: '',
        nome_curto: '',
        marca: '',
        categoria: 'Legging',
        tamanho: '',
        cor: '',
        agrupador: '',
        ean_fabricante: '',
        preco_venda: '',
        custo_medio: '',
        saldo: '0',
        qtd_minima: '2',
        unidade: 'UN',
        localizacao: '',
        foto_url: '',
        ativo: true,

        ncm: '',
        cfop_padrao: '5102',
        cst_csosn: '0102',
        origem_mercadoria: '0',
        unidade_tributavel: 'UN'
      });
    }
  }, [produtoToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao.trim()) {
      alert('Por favor, informe a descrição do produto.');
      return;
    }

    const precoVenda = parseFloat(formData.preco_venda) || 0;
    const custoMedio = parseFloat(formData.custo_medio) || 0;
    const saldoInicial = parseInt(formData.saldo, 10) || 0;
    const qtdMinima = parseInt(formData.qtd_minima, 10) || 0;

    if (precoVenda <= 0) {
      alert('Por favor, informe um preço de venda válido maior que zero.');
      return;
    }

    setIsSaving(true);
    try {
      if (produtoToEdit) {
        // Atualizar produto existente
        const prodRef = doc(db, 'produtos', produtoToEdit.id);
        const updatePayload: Partial<Produto> = {
          descricao: formData.descricao.trim(),
          nome_curto: formData.nome_curto.trim() || undefined,
          marca: formData.marca.trim() || undefined,
          categoria: formData.categoria,
          tamanho: formData.tamanho.trim() || undefined,
          cor: formData.cor.trim() || undefined,
          agrupador: formData.agrupador.trim() || undefined,
          ean_fabricante: formData.ean_fabricante.trim() || undefined,
          preco_venda: precoVenda,
          custo_medio: custoMedio,
          qtd_minima: qtdMinima,
          unidade: formData.unidade.trim() || 'UN',
          localizacao: formData.localizacao.trim() || undefined,
          foto_url: formData.foto_url.trim() || undefined,
          ativo: formData.ativo,

          ncm: formData.ncm.trim() || undefined,
          cfop_padrao: formData.cfop_padrao.trim() || '5102',
          cst_csosn: formData.cst_csosn.trim() || '0102',
          origem_mercadoria: formData.origem_mercadoria.trim() || '0',
          unidade_tributavel: formData.unidade_tributavel.trim() || 'UN',
          updated_at: Date.now()
        };

        await updateDoc(prodRef, updatePayload);
      } else {
        // Criar novo produto com código sequencial e EAN interno
        const novoCodigo = await obterProximoCodigoProduto();
        const eanInterno = gerarEanInterno(novoCodigo);

        const novoProdutoPayload: Omit<Produto, 'id'> = {
          codigo: novoCodigo,
          descricao: formData.descricao.trim(),
          nome_curto: formData.nome_curto.trim() || undefined,
          marca: formData.marca.trim() || undefined,
          categoria: formData.categoria,
          tamanho: formData.tamanho.trim() || undefined,
          cor: formData.cor.trim() || undefined,
          agrupador: formData.agrupador.trim() || undefined,
          ean_fabricante: formData.ean_fabricante.trim() || undefined,
          ean_interno: eanInterno,
          custo_medio: custoMedio,
          preco_venda: precoVenda,
          saldo: 0, // será ajustado via movimento se houver saldo inicial
          qtd_minima: qtdMinima,
          unidade: formData.unidade.trim() || 'UN',
          localizacao: formData.localizacao.trim() || undefined,
          foto_url: formData.foto_url.trim() || undefined,
          ativo: formData.ativo,

          ncm: formData.ncm.trim() || undefined,
          cfop_padrao: formData.cfop_padrao.trim() || '5102',
          cst_csosn: formData.cst_csosn.trim() || '0102',
          origem_mercadoria: formData.origem_mercadoria.trim() || '0',
          unidade_tributavel: formData.unidade_tributavel.trim() || 'UN',
          created_at: Date.now(),
          updated_at: Date.now()
        };

        const docRef = await addDoc(collection(db, 'produtos'), novoProdutoPayload);

        // Se informou saldo inicial > 0, cria o movimento no Kardex
        if (saldoInicial > 0) {
          await registrarMovimentoEstoque({
            produtoId: docRef.id,
            tipo: 'ENTRADA_AJUSTE',
            qtd: saldoInicial,
            custoUnit: custoMedio,
            origemTipo: 'AJUSTE_INVENTARIO',
            origemId: docRef.id,
            usuarioId: user?.uid,
            usuarioNome: user?.displayName || user?.email || 'Admin',
            observacao: 'Saldo inicial no cadastro de produto'
          });
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert('Ocorreu um erro ao salvar o produto. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden my-8 border border-surface-200">
        <div className="flex items-center justify-between p-6 bg-surface-50 border-b border-surface-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-brand-dark">
                {produtoToEdit ? `Editar Produto #${produtoToEdit.codigo}` : 'Novo Produto de Estoque'}
              </h2>
              <p className="text-xs text-surface-500 font-medium">
                {produtoToEdit ? 'Atualize as informações operacionais e fiscais' : 'Cadastre um novo item no catálogo de vestuário e produtos'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-600 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dados Principais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Descrição do Produto *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Legging Suplex Cintura Alta Feminina"
                value={formData.descricao}
                onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Categoria
              </label>
              <select
                value={formData.categoria}
                onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {CATEGORIAS_PADRAO.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Nome Curto, Marca e EAN Fabricante */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Nome Curto (PDV)
              </label>
              <input
                type="text"
                placeholder="Ex: Legging Suplex P"
                value={formData.nome_curto}
                onChange={e => setFormData({ ...formData, nome_curto: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Marca / Fabricante
              </label>
              <input
                type="text"
                placeholder="Ex: Aello Fit"
                value={formData.marca}
                onChange={e => setFormData({ ...formData, marca: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                EAN Fabricante (Opcional)
              </label>
              <input
                type="text"
                placeholder="7891234567890"
                value={formData.ean_fabricante}
                onChange={e => setFormData({ ...formData, ean_fabricante: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Atributos Opcionais de Vestuário */}
          <div className="p-4 bg-surface-50 rounded-xl border border-surface-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" /> Atributos de Vestuário / Grade
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-surface-600 mb-1">Tamanho</label>
                <input
                  type="text"
                  placeholder="P, M, G, GG, 38..."
                  value={formData.tamanho}
                  onChange={e => setFormData({ ...formData, tamanho: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-surface-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-surface-600 mb-1">Cor</label>
                <input
                  type="text"
                  placeholder="Preta, Azul, Grafite..."
                  value={formData.cor}
                  onChange={e => setFormData({ ...formData, cor: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-surface-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-surface-600 mb-1">Agrupador de Família</label>
                <input
                  type="text"
                  placeholder="Legging Suplex Baixa"
                  value={formData.agrupador}
                  onChange={e => setFormData({ ...formData, agrupador: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-surface-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Preço, Custo e Estoque */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Preço de Venda (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="129.90"
                value={formData.preco_venda}
                onChange={e => setFormData({ ...formData, preco_venda: e.target.value })}
                className="w-full px-3 py-2 text-sm font-bold text-emerald-800 border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Custo Médio / Inicial (R$)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="65.00"
                value={formData.custo_medio}
                onChange={e => setFormData({ ...formData, custo_medio: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                {produtoToEdit ? 'Estoque Mínimo' : 'Saldo Inicial'}
              </label>
              <input
                type="number"
                disabled={!!produtoToEdit}
                value={produtoToEdit ? formData.qtd_minima : formData.saldo}
                onChange={e => {
                  if (!produtoToEdit) setFormData({ ...formData, saldo: e.target.value });
                  else setFormData({ ...formData, qtd_minima: e.target.value });
                }}
                className={`w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none ${produtoToEdit ? 'bg-surface-100' : ''}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Qtd Mínima (Aviso)
              </label>
              <input
                type="number"
                value={formData.qtd_minima}
                onChange={e => setFormData({ ...formData, qtd_minima: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Localização e Foto URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Localização Física no Studio
              </label>
              <input
                type="text"
                placeholder="Ex: Prateleira 2 / Gaveta A"
                value={formData.localizacao}
                onChange={e => setFormData({ ...formData, localizacao: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                URL da Foto da Peça
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={formData.foto_url}
                onChange={e => setFormData({ ...formData, foto_url: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Campos Fiscais (Preparação Futura) */}
          <details className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <summary className="cursor-pointer font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-600" /> Parâmetros Fiscais (NCM / Impostos)
              </span>
              <span className="text-[11px] text-slate-500">Clique para expandir</span>
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">NCM</label>
                <input
                  type="text"
                  placeholder="6104.62.00"
                  value={formData.ncm}
                  onChange={e => setFormData({ ...formData, ncm: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">CFOP Padrão</label>
                <input
                  type="text"
                  value={formData.cfop_padrao}
                  onChange={e => setFormData({ ...formData, cfop_padrao: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">CST / CSOSN</label>
                <input
                  type="text"
                  value={formData.cst_csosn}
                  onChange={e => setFormData({ ...formData, cst_csosn: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Origem Mercadoria</label>
                <select
                  value={formData.origem_mercadoria}
                  onChange={e => setFormData({ ...formData, origem_mercadoria: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="0">0 - Nacional</option>
                  <option value="1">1 - Estrangeira Direta</option>
                  <option value="2">2 - Estrangeira Mercado Interno</option>
                </select>
              </div>
            </div>
          </details>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-surface-600 hover:bg-surface-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {produtoToEdit ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
