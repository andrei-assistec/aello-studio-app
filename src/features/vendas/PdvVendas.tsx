import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShoppingBag, Search, Trash2, User, UserPlus, CreditCard,
  CheckCircle2, ArrowLeft, Loader2
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection } from '../../hooks/useFirestore';
import { usePermissao } from '../../hooks/usePermissao';
import type { Aluno } from '../../types/database';
import type { Produto } from '../../types/estoque';
import type { Cliente, CompradorRef, ItemVenda, ParcelaVenda, Credito } from '../../types/vendas';
import { concluirVenda } from '../../lib/vendas/vendasService';

interface PdvVendasProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const PdvVendas: React.FC<PdvVendasProps> = ({ onClose, onSuccess }) => {
  const { limiteDe, funcionarioAtual, userUid } = usePermissao();
  const { data: alunos } = useCollection<Aluno>('alunos');
  const { data: clientes } = useCollection<Cliente>('clientes');
  const { data: produtos } = useCollection<Produto>('produtos');
  const { data: creditos } = useCollection<Credito>('creditos');

  // Estados do Comprador
  const [compradorSearch, setCompradorSearch] = useState('');
  const [compradorSelecionado, setCompradorSelecionado] = useState<CompradorRef | null>(null);
  const [isNovoClienteModalOpen, setIsNovoClienteModalOpen] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');

  // Estados dos Itens e Busca de Produtos
  const [produtoSearch, setProdutoSearch] = useState('');
  const [carrinho, setCarrinho] = useState<ItemVenda[]>([]);
  const produtoInputRef = useRef<HTMLInputElement>(null);

  // Estados Financeiros
  const [descontoGeral, setDescontoGeral] = useState('0.00');
  const [usarCredito, setUsarCredito] = useState(false);
  const [condicao, setCondicao] = useState<'A_VISTA' | 'A_PRAZO'>('A_VISTA');
  const [formaPagamento, setFormaPagamento] = useState<'Pix' | 'Dinheiro' | 'Cartão Crédito' | 'Cartão Débito' | 'Transferência' | 'Boleto'>('Pix');
  const [qtdParcelas, setQtdParcelas] = useState(1);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [parcelasCustom, setParcelasCustom] = useState<ParcelaVenda[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [isFinalizando, setIsFinalizando] = useState(false);

  // Foco automático no campo de busca de produto
  useEffect(() => {
    if (produtoInputRef.current) {
      produtoInputRef.current.focus();
    }
  }, []);

  // Lista unificada de compradores (alunos + clientes)
  const listaCompradores = useMemo(() => {
    const res: CompradorRef[] = [];
    if (alunos) {
      alunos.filter(a => a.ativo !== false).forEach(a => {
        res.push({
          tipo: 'ALUNO',
          id: a.id,
          nome: `${a.nome} ${a.sobrenome || ''}`.trim()
        });
      });
    }
    if (clientes) {
      clientes.forEach(c => {
        res.push({
          tipo: 'CLIENTE',
          id: c.id,
          nome: c.nome
        });
      });
    }
    return res;
  }, [alunos, clientes]);

  const compradoresFiltrados = useMemo(() => {
    if (!compradorSearch.trim()) return [];
    const term = compradorSearch.toLowerCase();
    return listaCompradores.filter(c => c.nome.toLowerCase().includes(term)).slice(0, 8);
  }, [listaCompradores, compradorSearch]);

  // Crédito disponível para o comprador selecionado
  const creditoDisponivelObj = useMemo(() => {
    if (!compradorSelecionado || !creditos) return null;
    return creditos.find(c => c.ativo !== false && c.comprador.id === compradorSelecionado.id && c.valor_disponivel > 0) || null;
  }, [compradorSelecionado, creditos]);

  // Produtos filtrados na busca
  const produtosFiltrados = useMemo(() => {
    if (!produtoSearch.trim() || !produtos) return [];
    const term = produtoSearch.toLowerCase().trim();
    return produtos.filter(p =>
      p.ativo !== false && (
        p.descricao.toLowerCase().includes(term) ||
        String(p.codigo).includes(term) ||
        p.ean_interno.includes(term) ||
        (p.ean_fabricante && p.ean_fabricante.includes(term))
      )
    ).slice(0, 6);
  }, [produtos, produtoSearch]);

  // Adicionar produto ao carrinho
  const handleAdicionarProduto = (produto: Produto) => {
    const itemExistente = carrinho.find(i => i.produto_id === produto.id);
    if (itemExistente) {
      setCarrinho(carrinho.map(i => i.produto_id === produto.id
        ? { ...i, qtd: i.qtd + 1, total: (i.qtd + 1) * i.preco_unit }
        : i
      ));
    } else {
      setCarrinho([...carrinho, {
        produto_id: produto.id,
        descricao: produto.nome_curto || produto.descricao,
        qtd: 1,
        preco_unit: produto.preco_venda,
        desconto: 0,
        total: produto.preco_venda,
        custo_unit_snapshot: produto.custo_medio || 0
      }]);
    }
    setProdutoSearch('');
    if (produtoInputRef.current) produtoInputRef.current.focus();
  };

  // Suporte a leitor USB (pressionar Enter na busca)
  const handleKeyDownProduto = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && produtosFiltrados.length > 0) {
      e.preventDefault();
      handleAdicionarProduto(produtosFiltrados[0]);
    }
  };

  const handleQtdChange = (produtoId: string, delta: number) => {
    setCarrinho(carrinho.map(i => {
      if (i.produto_id === produtoId) {
        const novaQtd = Math.max(1, i.qtd + delta);
        return { ...i, qtd: novaQtd, total: novaQtd * i.preco_unit };
      }
      return i;
    }));
  };

  const handleRemoverItem = (produtoId: string) => {
    setCarrinho(carrinho.filter(i => i.produto_id !== produtoId));
  };

  // Cálculos do Totais
  const subtotal = carrinho.reduce((acc, i) => acc + i.total, 0);
  const valDescontoNum = parseFloat(descontoGeral) || 0;
  const valCreditoAbatido = (usarCredito && creditoDisponivelObj) ? Math.min(subtotal - valDescontoNum, creditoDisponivelObj.valor_disponivel) : 0;
  const totalFinal = Math.max(0, subtotal - valDescontoNum - valCreditoAbatido);

  // Recalcular parcelas a prazo dinamicamente
  useEffect(() => {
    if (condicao === 'A_PRAZO' && totalFinal > 0) {
      const valorBase = Math.floor((totalFinal / qtdParcelas) * 100) / 100;
      const residuo = Math.round((totalFinal - (valorBase * qtdParcelas)) * 100) / 100;

      const baseDate = new Date(primeiroVencimento);
      const novasParcelas: ParcelaVenda[] = [];

      for (let i = 0; i < qtdParcelas; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        const valParc = i === qtdParcelas - 1 ? Math.round((valorBase + residuo) * 100) / 100 : valorBase;

        novasParcelas.push({
          numero: i + 1,
          vencimento: d.toISOString().slice(0, 10),
          valor: valParc
        });
      }
      setParcelasCustom(novasParcelas);
    }
  }, [condicao, totalFinal, qtdParcelas, primeiroVencimento]);

  // Cadastro rápido de cliente não-aluno
  const handleCadastrarRapidoCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoClienteNome.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'clientes'), {
        nome: novoClienteNome.trim(),
        telefone: novoClienteTelefone.trim() || undefined,
        created_at: Date.now()
      });
      setCompradorSelecionado({
        tipo: 'CLIENTE',
        id: docRef.id,
        nome: novoClienteNome.trim()
      });
      setIsNovoClienteModalOpen(false);
      setNovoClienteNome('');
      setNovoClienteTelefone('');
    } catch (err) {
      console.error('Erro ao cadastrar cliente rápido:', err);
    }
  };

  // Conclusão da Venda
  const handleFinalizarVenda = async () => {
    if (!compradorSelecionado) {
      alert('Por favor, selecione um comprador (aluno ou cliente) para realizar a venda.');
      return;
    }
    if (carrinho.length === 0) {
      alert('Selecione pelo menos um produto no carrinho.');
      return;
    }

    setIsFinalizando(true);
    try {
      const comissaoPct = funcionarioAtual?.comissao_venda_pct ?? 5; // 5% default

      await concluirVenda({
        comprador: compradorSelecionado,
        itens: carrinho,
        subtotal,
        descontoGeral: valDescontoNum,
        total: totalFinal,
        formaPagamento,
        condicao,
        parcelas: condicao === 'A_PRAZO' ? parcelasCustom : undefined,
        vendedorId: userUid || 'admin',
        vendedorNome: funcionarioAtual?.nome || 'Admin',
        comissaoPct,
        creditoUsado: valCreditoAbatido,
        creditoId: creditoDisponivelObj?.id,
        observacoes
      });

      alert('Venda finalizada com sucesso!');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao finalizar venda:', err);
      alert('Ocorreu um erro ao finalizar a venda.');
    } finally {
      setIsFinalizando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-100 flex flex-col overflow-hidden">
      {/* Header PDV */}
      <div className="bg-white border-b border-surface-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl text-surface-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-brand-dark">Ponto de Venda — PDV Aello</h2>
              <p className="text-xs text-surface-500 font-medium">Caixa rápido de vestuário e produtos</p>
            </div>
          </div>
        </div>

        {/* Comprador Selecionado Header Card */}
        {compradorSelecionado ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
            <User className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-emerald-900">{compradorSelecionado.nome}</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800">
              {compradorSelecionado.tipo}
            </span>
            <button onClick={() => setCompradorSelecionado(null)} className="text-xs text-red-600 underline font-semibold ml-2">
              Trocar
            </button>
          </div>
        ) : (
          <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
            ⚠️ Selecione o Comprador
          </span>
        )}
      </div>

      {/* Main Grid 2 Colunas */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        {/* Coluna Esquerda: Busca Comprador + Carrinho + Busca Produtos */}
        <div className="lg:col-span-7 flex flex-col space-y-4 overflow-hidden">
          {/* Busca de Comprador */}
          {!compradorSelecionado && (
            <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm relative">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-surface-600">
                  1. Buscar Comprador (Aluno ou Cliente)
                </label>
                <button
                  onClick={() => setIsNovoClienteModalOpen(true)}
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> + Cadastrar Não-Aluno
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-surface-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Digite o nome do aluno ou cliente..."
                  value={compradorSearch}
                  onChange={e => setCompradorSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {compradoresFiltrados.length > 0 && (
                <div className="absolute left-4 right-4 top-20 z-20 bg-white border border-surface-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-surface-100">
                  {compradoresFiltrados.map(c => (
                    <button
                      key={`${c.tipo}-${c.id}`}
                      onClick={() => {
                        setCompradorSelecionado(c);
                        setCompradorSearch('');
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-surface-50 flex items-center justify-between"
                    >
                      <span className="font-bold text-brand-dark">{c.nome}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-100 text-surface-600">
                        {c.tipo}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Banner de Crédito Disponível */}
          {creditoDisponivelObj && (
            <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-700" />
                <span>
                  <strong className="text-indigo-900">{compradorSelecionado?.nome}</strong> possui{' '}
                  <strong className="text-indigo-900 font-mono">R$ {creditoDisponivelObj.valor_disponivel.toFixed(2)}</strong> de crédito na loja.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUsarCredito(!usarCredito)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  usarCredito ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-300'
                }`}
              >
                {usarCredito ? '✓ Usando Crédito' : 'Usar Crédito'}
              </button>
            </div>
          )}

          {/* Busca Leitor de Código de Barras / Produtos */}
          <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-sm relative">
            <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-2">
              2. Adicionar Produto (Código, Nome ou Leitor USB)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-surface-400 absolute left-3 top-3" />
              <input
                ref={produtoInputRef}
                type="text"
                placeholder="Passe o leitor ou digite o nome/código do produto..."
                value={produtoSearch}
                onChange={e => setProdutoSearch(e.target.value)}
                onKeyDown={handleKeyDownProduto}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-surface-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            {produtosFiltrados.length > 0 && (
              <div className="absolute left-4 right-4 top-20 z-20 bg-white border border-surface-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-surface-100">
                {produtosFiltrados.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAdicionarProduto(p)}
                    className="w-full px-4 py-2.5 text-left text-xs hover:bg-emerald-50 flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-brand-dark group-hover:text-emerald-800">{p.descricao}</div>
                      <div className="text-[10px] text-surface-400 font-mono">
                        #{p.codigo} {p.tamanho ? `| Tam: ${p.tamanho}` : ''} | Saldo: {p.saldo} UN
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 text-sm">R$ {p.preco_venda.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabela do Carrinho */}
          <div className="flex-1 bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 bg-surface-50 border-b border-surface-200 font-bold text-xs uppercase tracking-wider text-surface-600 flex justify-between items-center">
              <span>Itens Selecionados ({carrinho.length})</span>
              <button onClick={() => setCarrinho([])} className="text-[11px] text-red-600 hover:underline">Limpar Carrinho</button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-surface-100 p-2">
              {carrinho.length > 0 ? (
                carrinho.map(item => (
                  <div key={item.produto_id} className="p-3 flex items-center justify-between gap-3 hover:bg-surface-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-brand-dark text-xs truncate">{item.descricao}</div>
                      <div className="text-[11px] text-surface-500 font-mono">
                        R$ {item.preco_unit.toFixed(2)} / un
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQtdChange(item.produto_id, -1)}
                        className="w-7 h-7 bg-surface-100 text-surface-700 rounded-lg font-bold hover:bg-surface-200"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-bold text-xs">{item.qtd}</span>
                      <button
                        onClick={() => handleQtdChange(item.produto_id, 1)}
                        className="w-7 h-7 bg-surface-100 text-surface-700 rounded-lg font-bold hover:bg-surface-200"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-24 text-right font-mono font-bold text-brand-dark text-xs">
                      R$ {item.total.toFixed(2)}
                    </div>

                    <button onClick={() => handleRemoverItem(item.produto_id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-surface-400 text-xs font-medium">
                  Carrinho vazio. Adicione produtos na busca acima.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Resumo Financeiro, Desconto e Pagamento */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-surface-200 shadow-sm p-6 flex flex-col justify-between overflow-y-auto space-y-6">
          <div className="space-y-5">
            <h3 className="text-base font-bold text-brand-dark border-b border-surface-200 pb-3">
              3. Resumo & Pagamento
            </h3>

            {/* Totais */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-surface-600">
                <span>Subtotal dos Produtos:</span>
                <span className="font-mono font-semibold">R$ {subtotal.toFixed(2)}</span>
              </div>

              {/* Desconto com teto */}
              <div className="flex items-center justify-between">
                <span className="text-surface-600">Desconto Geral (R$):</span>
                <div className="w-28">
                  <input
                    type="number"
                    step="0.01"
                    max={subtotal * (limiteDe('vendas.desconto') / 100)}
                    value={descontoGeral}
                    onChange={e => setDescontoGeral(e.target.value)}
                    className="w-full px-2 py-1 text-xs text-right border border-surface-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              {usarCredito && valCreditoAbatido > 0 && (
                <div className="flex justify-between text-indigo-700 font-semibold">
                  <span>Abatimento Crédito na Loja:</span>
                  <span className="font-mono font-bold">- R$ {valCreditoAbatido.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-surface-200 flex justify-between items-center">
                <span className="text-sm font-black uppercase tracking-wider text-brand-dark">TOTAL FINAL:</span>
                <span className="text-2xl font-black text-emerald-700 font-mono">R$ {totalFinal.toFixed(2)}</span>
              </div>
            </div>

            {/* Condição de Pagamento (À vista vs A prazo) */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600">
                Condição de Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCondicao('A_VISTA')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    condicao === 'A_VISTA'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-500 shadow-sm'
                      : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                  }`}
                >
                  À Vista
                </button>
                <button
                  type="button"
                  onClick={() => setCondicao('A_PRAZO')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    condicao === 'A_PRAZO'
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-500 shadow-sm'
                      : 'border-surface-200 text-surface-600 hover:bg-surface-50'
                  }`}
                >
                  A Prazo (até 12x)
                </button>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-[11px] font-bold text-surface-600 mb-1">Forma de Pagamento</label>
                <select
                  value={formaPagamento}
                  onChange={e => setFormaPagamento(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-surface-300 rounded-xl font-bold bg-white"
                >
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão Crédito">Cartão de Crédito</option>
                  <option value="Cartão Débito">Cartão de Débito</option>
                  <option value="Transferência">Transferência Bancária</option>
                  <option value="Boleto">Boleto</option>
                </select>
              </div>

              {/* Parcelas A Prazo */}
              {condicao === 'A_PRAZO' && (
                <div className="p-3 bg-surface-50 rounded-xl border border-surface-200 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-surface-600 mb-1">Nº Parcelas</label>
                      <select
                        value={qtdParcelas}
                        onChange={e => setQtdParcelas(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2 py-1.5 text-xs border border-surface-300 rounded-lg bg-white font-bold"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-surface-600 mb-1">1º Vencimento</label>
                      <input
                        type="date"
                        value={primeiroVencimento}
                        onChange={e => setPrimeiroVencimento(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-surface-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                    {parcelasCustom.map(p => (
                      <div key={p.numero} className="flex justify-between items-center text-[11px] bg-white p-1.5 rounded border border-surface-200 font-mono">
                        <span>{p.numero}ª parcela ({p.vencimento})</span>
                        <span className="font-bold text-emerald-800">R$ {p.valor.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-surface-600 mb-1">
                Observações da Venda
              </label>
              <textarea
                rows={2}
                placeholder="Observações internas..."
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-surface-300 rounded-xl"
              />
            </div>
          </div>

          {/* Botão Finalizar */}
          <div className="pt-4 border-t border-surface-200">
            <button
              onClick={handleFinalizarVenda}
              disabled={isFinalizando || carrinho.length === 0 || !compradorSelecionado}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isFinalizando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Finalizar Venda (R$ {totalFinal.toFixed(2)})
            </button>
          </div>
        </div>
      </div>

      {/* Modal Cadastro Rápido Não-Aluno */}
      {isNovoClienteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-brand-dark">Cadastrar Cliente Não-Aluno</h3>
            <form onSubmit={handleCadastrarRapidoCliente} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do cliente"
                  value={novoClienteNome}
                  onChange={e => setNovoClienteNome(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-600 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(54) 99999-0000"
                  value={novoClienteTelefone}
                  onChange={e => setNovoClienteTelefone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNovoClienteModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-surface-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl"
                >
                  Cadastrar & Selecionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
