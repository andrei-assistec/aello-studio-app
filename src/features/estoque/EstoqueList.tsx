import React, { useState, useMemo } from 'react';
import {
  Package, Plus, Search, Filter, AlertTriangle, AlertCircle, CheckCircle2,
  Printer, Edit2, SlidersHorizontal, Loader2, ArrowUpDown
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { Se } from '../../components/acl/Se';
import type { Produto } from '../../types/estoque';
import { ProdutoFormModal } from './ProdutoFormModal';
import { AjustarEstoqueModal } from './AjustarEstoqueModal';
import { ImprimirEtiquetasModal } from './ImprimirEtiquetasModal';

export const EstoqueList: React.FC = () => {
  const { data: produtos, loading } = useCollection<Produto>('produtos');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'zerados' | 'baixo' | 'ok'>('todos');
  const [sortField, setSortField] = useState<'codigo' | 'descricao' | 'saldo' | 'preco_venda'>('descricao');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modais State
  const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false);
  const [produtoToEdit, setProdutoToEdit] = useState<Produto | null>(null);

  const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false);
  const [produtoToAdjust, setProdutoToAdjust] = useState<Produto | null>(null);

  const [isEtiquetasModalOpen, setIsEtiquetasModalOpen] = useState(false);
  const [produtoToPrint, setProdutoToPrint] = useState<Produto | null>(null);

  // Extrai lista única de categorias existentes
  const categoriasExistentes = useMemo(() => {
    if (!produtos) return [];
    const set = new Set<string>();
    produtos.forEach(p => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort();
  }, [produtos]);

  // Filtragem
  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];

    return produtos.filter(item => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        item.descricao.toLowerCase().includes(term) ||
        String(item.codigo).includes(term) ||
        item.ean_interno.includes(term) ||
        (item.ean_fabricante && item.ean_fabricante.includes(term)) ||
        (item.categoria && item.categoria.toLowerCase().includes(term));

      const matchCategory = selectedCategoria === 'todas' || item.categoria === selectedCategoria;

      let matchStatus = true;
      const saldo = item.saldo || 0;
      const min = item.qtd_minima ?? 2;

      if (statusFilter === 'zerados') matchStatus = saldo <= 0;
      else if (statusFilter === 'baixo') matchStatus = saldo > 0 && saldo <= min;
      else if (statusFilter === 'ok') matchStatus = saldo > min;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [produtos, searchTerm, selectedCategoria, statusFilter]);

  // Ordenação
  const produtosOrdenados = useMemo(() => {
    return [...produtosFiltrados].sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [produtosFiltrados, sortField, sortDirection]);

  // Métricas rápidas
  const totalItens = produtos?.length || 0;
  const totalZerados = produtos?.filter(p => (p.saldo || 0) <= 0).length || 0;
  const totalAbaixoMinimo = produtos?.filter(p => (p.saldo || 0) > 0 && (p.saldo || 0) <= (p.qtd_minima ?? 2)).length || 0;

  const handleSort = (field: 'codigo' | 'descricao' | 'saldo' | 'preco_venda') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-dark tracking-tight flex items-center gap-2">
            <Package className="w-7 h-7 text-emerald-600" /> Gestão de Estoque & Produtos
          </h1>
          <p className="text-sm text-surface-500 font-medium">
            Catálogo unificado de vestuário, suplementos e controle de saldo via Kardex
          </p>
        </div>

        <Se pode="estoque.criar_produto">
          <button
            onClick={() => {
              setProdutoToEdit(null);
              setIsProdutoModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </Se>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-surface-500">Total de Produtos</p>
            <h3 className="text-2xl font-black text-brand-dark mt-1">{totalItens}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Abaixo do Mínimo</p>
            <h3 className="text-2xl font-black text-amber-900 mt-1">{totalAbaixoMinimo}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">Estoque Zerado</p>
            <h3 className="text-2xl font-black text-red-900 mt-1">{totalZerados}</h3>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Bar de Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Busca Geral */}
          <div className="relative">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por descrição, código ou EAN..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-surface-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Filtro Categoria */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-surface-400" />
            <select
              value={selectedCategoria}
              onChange={e => setSelectedCategoria(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todas">Todas as Categorias</option>
              {categoriasExistentes.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Filtro Status Semáforo */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-surface-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">Todos os Status</option>
              <option value="ok">Estoque Normal (OK)</option>
              <option value="baixo">Abaixo do Mínimo</option>
              <option value="zerados">Estoque Zerado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-surface-500 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="font-medium">Carregando estoque de produtos...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                  <th onClick={() => handleSort('codigo')} className="p-4 cursor-pointer hover:bg-surface-100 select-none">
                    <div className="flex items-center gap-1">
                      <span>Cód.</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="p-4">Foto</th>
                  <th onClick={() => handleSort('descricao')} className="p-4 cursor-pointer hover:bg-surface-100 select-none">
                    <div className="flex items-center gap-1">
                      <span>Descrição / Produto</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="p-4">Categoria</th>
                  <th onClick={() => handleSort('saldo')} className="p-4 text-center cursor-pointer hover:bg-surface-100 select-none">
                    <div className="flex items-center justify-center gap-1">
                      <span>Saldo</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="p-4 text-center">Status</th>
                  <th onClick={() => handleSort('preco_venda')} className="p-4 text-right cursor-pointer hover:bg-surface-100 select-none">
                    <div className="flex items-center justify-end gap-1">
                      <span>Preço Venda</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  
                  {/* Colunas restritas com permissão estoque.ver_custo */}
                  <Se pode="estoque.ver_custo">
                    <th className="p-4 text-right">Custo Médio</th>
                    <th className="p-4 text-right">Margem (%)</th>
                  </Se>

                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                {produtosOrdenados.length > 0 ? (
                  produtosOrdenados.map((item) => {
                    const saldo = item.saldo || 0;
                    const min = item.qtd_minima ?? 2;
                    const custo = item.custo_medio || 0;
                    const preco = item.preco_venda || 0;
                    const margemPct = custo > 0 ? Math.round(((preco - custo) / custo) * 100) : 0;

                    let semaforo = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> OK ({saldo})
                      </span>
                    );

                    if (saldo <= 0) {
                      semaforo = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                          <AlertCircle className="w-3 h-3" /> Zerado
                        </span>
                      );
                    } else if (saldo <= min) {
                      semaforo = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> Baixo ({saldo}/{min})
                        </span>
                      );
                    }

                    return (
                      <tr key={item.id} className="hover:bg-surface-50/60 transition-colors">
                        {/* Código */}
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-mono text-[11px] font-bold text-surface-600 bg-surface-100 px-2 py-0.5 rounded border border-surface-200">
                            #{item.codigo}
                          </span>
                        </td>

                        {/* Foto Thumb */}
                        <td className="p-4">
                          {item.foto_url ? (
                            <img src={item.foto_url} alt={item.descricao} className="w-9 h-9 rounded-lg object-cover border border-surface-200" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-surface-100 border border-surface-200 flex items-center justify-center text-surface-400">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                        </td>

                        {/* Descrição */}
                        <td className="p-4">
                          <div className="font-bold text-brand-dark">{item.descricao}</div>
                          <div className="text-[10px] text-surface-400 font-mono flex items-center gap-2 mt-0.5">
                            <span>EAN: {item.ean_interno}</span>
                            {item.tamanho && <span className="bg-surface-100 px-1 rounded text-surface-600">Tam: {item.tamanho}</span>}
                            {item.cor && <span className="bg-surface-100 px-1 rounded text-surface-600">{item.cor}</span>}
                          </div>
                        </td>

                        {/* Categoria */}
                        <td className="p-4 whitespace-nowrap font-semibold text-surface-600">
                          {item.categoria || 'Geral'}
                        </td>

                        {/* Saldo */}
                        <td className="p-4 text-center whitespace-nowrap font-bold text-sm text-brand-dark">
                          {saldo} {item.unidade || 'UN'}
                        </td>

                        {/* Semáforo Status */}
                        <td className="p-4 text-center whitespace-nowrap">
                          {semaforo}
                        </td>

                        {/* Preço Venda */}
                        <td className="p-4 text-right whitespace-nowrap font-bold text-emerald-800 text-sm">
                          R$ {preco.toFixed(2)}
                        </td>

                        {/* Custo & Margem (Restrito) */}
                        <Se pode="estoque.ver_custo">
                          <td className="p-4 text-right whitespace-nowrap font-mono text-surface-600">
                            R$ {custo.toFixed(2)}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap font-bold">
                            <span className={margemPct > 40 ? 'text-emerald-600' : 'text-amber-600'}>
                              {margemPct}%
                            </span>
                          </td>
                        </Se>

                        {/* Ações */}
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <Se pode="estoque.ajustar">
                              <button
                                onClick={() => {
                                  setProdutoToAdjust(item);
                                  setIsAjusteModalOpen(true);
                                }}
                                className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg transition-all"
                                title="Ajustar Estoque / Kardex"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                            </Se>

                            <Se pode="estoque.etiquetas">
                              <button
                                onClick={() => {
                                  setProdutoToPrint(item);
                                  setIsEtiquetasModalOpen(true);
                                }}
                                className="p-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                                title="Imprimir Etiquetas A4"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </Se>

                            <Se pode="estoque.editar_produto">
                              <button
                                onClick={() => {
                                  setProdutoToEdit(item);
                                  setIsProdutoModalOpen(true);
                                }}
                                className="p-1.5 bg-surface-100 text-surface-600 hover:bg-surface-700 hover:text-white rounded-lg transition-all"
                                title="Editar Produto"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </Se>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-surface-400 font-medium">
                      Nenhum produto encontrado no estoque.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais */}
      <ProdutoFormModal
        isOpen={isProdutoModalOpen}
        onClose={() => setIsProdutoModalOpen(false)}
        onSuccess={() => {}}
        produtoToEdit={produtoToEdit}
      />

      <AjustarEstoqueModal
        isOpen={isAjusteModalOpen}
        onClose={() => setIsAjusteModalOpen(false)}
        onSuccess={() => {}}
        produto={produtoToAdjust}
      />

      <ImprimirEtiquetasModal
        isOpen={isEtiquetasModalOpen}
        onClose={() => setIsEtiquetasModalOpen(false)}
        produto={produtoToPrint}
      />
    </div>
  );
};
