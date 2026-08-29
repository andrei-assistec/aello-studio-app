import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Check, 
  MessageSquare,
  Loader2,
  Trash2,
  Edit2,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import { ReceitaFormModal } from './ReceitaFormModal';
import type { Receita } from './ReceitaFormModal';
import { syncMonthlyFinance } from '../../services/monthlyFinanceGenerator';

const getFiltroMeses = () => {
  const options = [];
  const currentDate = new Date();
  
  for (let i = -6; i <= 12; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
    options.push({ value, label: capitalizedLabel });
  }
  return options;
};

export const ContasReceber = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'a_receber' | 'pago' | 'atrasado' | 'todos'>('a_receber');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [receitaToEdit, setReceitaToEdit] = useState<Receita | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Ordenação Excel por colunas
  const [sortField, setSortField] = useState<string>('vencimento');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const { data: receitas, loading } = useCollection<Receita>('receitas', 'vencimento', 'desc');

  useEffect(() => {
    syncMonthlyFinance(selectedMonth !== 'todos' ? selectedMonth : undefined);
  }, [selectedMonth]);

  const getItemDueStr = (item: Receita): string => {
    return item.vencimento || item.data_vencimento || '';
  };

  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  const formatPaidDate = (dataPagamento?: number | string | null) => {
    if (!dataPagamento) return null;
    try {
      if (typeof dataPagamento === 'number') {
        return new Date(dataPagamento).toLocaleDateString('pt-BR');
      }
      if (typeof dataPagamento === 'string' && dataPagamento.length >= 10) {
        const datePart = dataPagamento.substring(0, 10);
        const parts = datePart.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return new Date(dataPagamento).toLocaleDateString('pt-BR');
      }
    } catch {
      return null;
    }
    return null;
  };

  const handleMarcarComoPago = async (receita: Receita) => {
    const todayStr = new Date().toISOString().split('T')[0];
    setReceitaToEdit({
      ...receita,
      status: 'pago',
      data_pagamento: receita.data_pagamento || todayStr,
      forma_pagamento: receita.forma_pagamento && receita.forma_pagamento !== '-' ? receita.forma_pagamento : 'Pix'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (receita: Receita) => {
    setReceitaToEdit(receita);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setReceitaToEdit(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (receita: Receita) => {
    const name = receita.aluno_nome || receita.descricao || 'Receita';
    if (window.confirm(`Deseja excluir permanentemente o lançamento de R$ ${(receita.valor || 0).toFixed(2)} de ${name}?`)) {
      try {
        await deleteDoc(doc(db, 'receitas', receita.id));
        await logActivity({
          action: 'DELETE',
          resource_type: 'prescricao',
          details: `Excluiu recebimento de ${name} no valor de R$ ${(receita.valor || 0).toFixed(2)}`
        });
      } catch (error) {
        console.error("Erro ao excluir recebimento:", error);
      }
    }
  };

  // 1. Filtrar pelo mês de referência primeiro
  const receitasDoMes = receitas.filter(item => {
    const dueStr = getItemDueStr(item);
    return selectedMonth === 'todos' || dueStr.startsWith(selectedMonth);
  });

  // KPI Totais do mês
  const aReceberList = receitasDoMes.filter(r => (r.status || 'pendente').toLowerCase() !== 'pago');
  const pagasList = receitasDoMes.filter(r => (r.status || 'pendente').toLowerCase() === 'pago');
  const atrasadasList = receitasDoMes.filter(r => (r.status || 'pendente').toLowerCase() === 'atrasado');

  const totalAReceberVal = aReceberList.reduce((acc, r) => acc + (r.valor || 0), 0);
  const totalPagasVal = pagasList.reduce((acc, r) => acc + (r.valor || 0), 0);
  const totalAtrasadasVal = atrasadasList.reduce((acc, r) => acc + (r.valor || 0), 0);

  // 2. Filtrar pela busca e pelo status
  const filtered = receitasDoMes.filter(item => {
    const name = item.aluno_nome || item.descricao || '';
    const planoStr = item.plano || (item as any).categoria || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          planoStr.toLowerCase().includes(searchTerm.toLowerCase());
    
    const statusNorm = (item.status || 'pendente').toLowerCase();
    
    let matchesStatus = true;
    if (statusFilter === 'a_receber') {
      matchesStatus = statusNorm !== 'pago';
    } else if (statusFilter === 'pago') {
      matchesStatus = statusNorm === 'pago';
    } else if (statusFilter === 'atrasado') {
      matchesStatus = statusNorm === 'atrasado';
    }

    return matchesSearch && matchesStatus;
  });

  // 3. Aplicar ordenação por colunas (Estilo Excel)
  const sortedFiltered = [...filtered].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    switch (sortField) {
      case 'id':
        valA = (a.id || '').toLowerCase();
        valB = (b.id || '').toLowerCase();
        break;
      case 'aluno_nome':
        valA = (a.aluno_nome || a.descricao || '').toLowerCase();
        valB = (b.aluno_nome || b.descricao || '').toLowerCase();
        break;
      case 'plano':
        valA = (a.plano || (a as any).categoria || '').toLowerCase();
        valB = (b.plano || (b as any).categoria || '').toLowerCase();
        break;
      case 'vencimento':
        valA = a.vencimento || a.data_vencimento || '';
        valB = b.vencimento || b.data_vencimento || '';
        break;
      case 'data_pagamento':
        valA = a.data_pagamento ? (typeof a.data_pagamento === 'number' ? a.data_pagamento : new Date(a.data_pagamento).getTime()) : 0;
        valB = b.data_pagamento ? (typeof b.data_pagamento === 'number' ? b.data_pagamento : new Date(b.data_pagamento).getTime()) : 0;
        break;
      case 'valor':
        valA = a.valor || 0;
        valB = b.valor || 0;
        break;
      case 'forma_pagamento':
        valA = (a.forma_pagamento || '').toLowerCase();
        valB = (b.forma_pagamento || '').toLowerCase();
        break;
      case 'status':
        valA = (a.status || '').toLowerCase();
        valB = (b.status || '').toLowerCase();
        break;
      default:
        valA = a.vencimento || '';
        valB = b.vencimento || '';
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortHeader = (label: string, field: string) => (
    <th 
      onClick={() => handleSort(field)}
      className="p-4 cursor-pointer hover:bg-surface-100 transition-colors select-none group"
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <span className="text-[10px] text-surface-400 group-hover:text-brand-dark">
          {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      <ReceitaFormModal 
        isOpen={isModalOpen}
        receitaToEdit={receitaToEdit}
        onClose={() => {
          setIsModalOpen(false);
          setReceitaToEdit(null);
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          setReceitaToEdit(null);
        }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Contas a Receber 📈</h2>
          <p className="text-surface-500 text-sm">Gerenciamento e cobrança de mensalidades e recebimentos do studio.</p>
        </div>
        <button className="btn-primary bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10 flex items-center gap-2 text-xs font-bold py-2.5" onClick={handleCreateNew}>
          <Plus className="w-5 h-5" />
          Nova Conta a Receber
        </button>
      </div>

      {/* KPI Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-700 uppercase">A Receber (Pendente)</span>
            <h3 className="text-2xl font-bold text-brand-dark mt-1">R$ {totalAReceberVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-[11px] text-surface-400 mt-1">{aReceberList.length} lançamentos pendentes</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-green-500 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-green-700 uppercase">Recebido (Pago)</span>
            <h3 className="text-2xl font-bold text-brand-dark mt-1">R$ {totalPagasVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-[11px] text-surface-400 mt-1">{pagasList.length} recebimentos efetuados</p>
          </div>
          <div className="p-3 bg-green-50 rounded-xl text-green-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-red-500 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-red-700 uppercase">Inadimplência (Atrasado)</span>
            <h3 className="text-2xl font-bold text-brand-dark mt-1">R$ {totalAtrasadasVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-[11px] text-surface-400 mt-1">{atrasadasList.length} mensalidades em atraso</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Busca e Filtros */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Buscar por aluno ou plano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-surface-200 rounded-xl py-2.5 pl-12 pr-4 text-brand-dark focus:ring-2 focus:ring-brand-medium focus:border-transparent outline-none transition-all text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-surface-500 whitespace-nowrap">Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-surface-200 rounded-xl px-3 py-2 text-brand-dark font-semibold focus:ring-2 focus:ring-brand-medium focus:border-transparent outline-none transition-all cursor-pointer text-xs"
            >
              <option value="todos">Todos os Meses</option>
              {getFiltroMeses().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Abas de Filtro por Status */}
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button
            onClick={() => setStatusFilter('a_receber')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'a_receber' 
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' 
                : 'bg-white border border-surface-200 text-surface-600 hover:bg-surface-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            A Receber ({aReceberList.length})
          </button>

          <button
            onClick={() => setStatusFilter('pago')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'pago' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'bg-white border border-surface-200 text-surface-600 hover:bg-surface-50'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Pagas ({pagasList.length})
          </button>

          <button
            onClick={() => setStatusFilter('atrasado')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'atrasado' 
                ? 'bg-red-500 text-white shadow-md shadow-red-500/20' 
                : 'bg-white border border-surface-200 text-surface-600 hover:bg-surface-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Atrasadas ({atrasadasList.length})
          </button>

          <button
            onClick={() => setStatusFilter('todos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'todos' 
                ? 'bg-brand-dark text-white shadow-md shadow-brand-dark/20' 
                : 'bg-white border border-surface-200 text-surface-600 hover:bg-surface-50'
            }`}
          >
            Todas ({receitasDoMes.length})
          </button>
        </div>
      </div>

      {/* Tabela de Recebimentos */}
      <div className="glass-card overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="font-medium">Carregando recebimentos...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-bold uppercase tracking-wider">
                  {renderSortHeader('Cód. Conta', 'id')}
                  {renderSortHeader('Aluno / Lançamento', 'aluno_nome')}
                  {renderSortHeader('Plano / Categoria', 'plano')}
                  {renderSortHeader('Data Vencimento', 'vencimento')}
                  {renderSortHeader('Data Pagamento', 'data_pagamento')}
                  {renderSortHeader('Valor (R$)', 'valor')}
                  {renderSortHeader('Forma PGTO', 'forma_pagamento')}
                  {renderSortHeader('Status', 'status')}
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                {sortedFiltered.length > 0 ? (
                  sortedFiltered.map((item) => {
                    const statusNorm = (item.status || 'pendente').toLowerCase();
                    const name = item.aluno_nome || item.descricao || 'Receita';
                    const categoryStr = item.plano || (item as any).categoria || 'Mensalidade';
                    const dueStr = getItemDueStr(item);
                    const paidDateStr = formatPaidDate(item.data_pagamento);

                    return (
                      <tr key={item.id} className="hover:bg-surface-50/50 transition-colors">
                        <td className="p-4 whitespace-nowrap">
                          <span 
                            className="font-mono text-[11px] font-bold text-surface-600 bg-surface-100 hover:bg-surface-200 px-2 py-0.5 rounded border border-surface-200 select-all cursor-pointer transition-colors"
                            title={`ID Completo: ${item.id} (Clique para copiar)`}
                            onClick={() => {
                              navigator.clipboard.writeText(item.id);
                              alert(`Código copiado: ${item.id}`);
                            }}
                          >
                            #{item.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-brand-dark">{name}</div>
                          {item.justificativa_desconto && (
                            <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <span>🏷️ Desconto: {item.justificativa_desconto}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-semibold">{categoryStr}</td>
                        <td className="p-4 whitespace-nowrap font-semibold text-brand-dark">
                          {formatDateStr(dueStr)}
                        </td>
                        <td className="p-4 whitespace-nowrap font-semibold">
                          {statusNorm === 'pago' && paidDateStr ? (
                            <span className="text-emerald-700 font-bold">{paidDateStr}</span>
                          ) : (
                            <span className="text-surface-400">-</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-brand-dark whitespace-nowrap">
                          <div>R$ {(item.valor || 0).toFixed(2).replace('.', ',')}</div>
                          {item.valor_original && item.valor_original > item.valor && (
                            <div className="text-[10px] text-surface-400 font-normal line-through">
                              Original: R$ {item.valor_original.toFixed(2).replace('.', ',')}
                            </div>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">{item.forma_pagamento || '-'}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            statusNorm === 'pago' 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : statusNorm === 'atrasado' 
                              ? 'bg-red-100 text-red-700 border border-red-200' 
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {statusNorm === 'pago' ? 'Pago' : statusNorm === 'atrasado' ? 'Atrasado' : 'A Receber'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {statusNorm !== 'pago' && (
                              <button 
                                onClick={() => handleMarcarComoPago(item)}
                                className="p-1.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="Confirmar Recebimento"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            {statusNorm === 'atrasado' && (
                              <button 
                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="Enviar Cobrança WhatsApp"
                                onClick={() => alert(`Enviando mensagem de cobrança para ${name}`)}
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Editar Lançamento"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(item)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Excluir Lançamento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-surface-400 font-medium">
                      Nenhum recebimento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
