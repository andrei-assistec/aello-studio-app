import React, { useState } from 'react';
import { useCollection } from '../../hooks/useFirestore';
import { collection, addDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Upload, 
  FileText, 
  Save, 
  Brain, 
  CheckCircle, 
  X, 
  Loader2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  UserCheck,
  Check,
  Crown
} from 'lucide-react';
import type { Aluno } from '../../types/database';
import type { Receita } from './ReceitaFormModal';
import type { Despesa } from './DespesaFormModal';
import type { PlanoConta } from './PlanoDeContasPage';
import { logActivity } from '../../services/logger';

interface OFXTransaction {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'credito' | 'debito';
  status: 'pendente' | 'conciliado' | 'ignorado';
  categoriaId: string;
  alunoId: string;
  vinculoTipo: 'novo' | 'vincular' | 'ignorar';
  vinculoId: string;
  recorrente: boolean;
  isProLabore?: boolean;
  matchOrigin?: 'regra' | 'nome' | 'prolabore' | 'nenhum';
  learnedSaved?: boolean;
}

interface ConciliacaoRegra {
  id: string;
  descricao_chave: string;
  categoria_id: string;
  aluno_id?: string;
  tipo: 'receita' | 'despesa';
  is_learned?: boolean;
}

export const ConciliacaoBancaria: React.FC = () => {
  const { data: alunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: planoContas } = useCollection<PlanoConta>('plano_contas', 'codigo');
  const { data: receitasAbertas } = useCollection<Receita>('receitas');
  const { data: despesasAbertas } = useCollection<Despesa>('despesas');
  const { data: regras } = useCollection<ConciliacaoRegra>('conciliacao_regras');

  const [transactions, setTransactions] = useState<OFXTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const categoriasReceita = planoContas.filter(c => c.ativo && c.tipo === 'receita');
  const categoriasDespesa = planoContas.filter(c => c.ativo && c.tipo === 'despesa');

  // Parser OFX
  const parseOFXFile = (text: string): OFXTransaction[] => {
    const cleanText = text.replace(/[\r\n]+/g, ' ');
    const txBlocks = cleanText.split('<STMTTRN>');
    txBlocks.shift();

    return txBlocks.map((block, index) => {
      const getTagValue = (tag: string) => {
        const regex = new RegExp(`<${tag}>([^<]+)`);
        const match = block.match(regex);
        return match ? match[1].trim() : '';
      };

      const dtposted = getTagValue('DTPOSTED');
      const trnamt = getTagValue('TRNAMT');
      const fitid = getTagValue('FITID');
      const memo = getTagValue('MEMO') || getTagValue('NAME');

      let formattedDate = new Date().toISOString().split('T')[0];
      if (dtposted && dtposted.length >= 8) {
        formattedDate = `${dtposted.substring(0, 4)}-${dtposted.substring(4, 6)}-${dtposted.substring(6, 8)}`;
      }

      const rawAmount = parseFloat(trnamt) || 0;
      const valor = Math.abs(rawAmount);
      const tipo = rawAmount >= 0 ? ('credito' as const) : ('debito' as const);

      return {
        id: fitid || `ofx-tx-${index}-${Date.now()}`,
        data: formattedDate,
        descricao: memo || 'Transação Bancária',
        valor,
        tipo,
        status: 'pendente' as const,
        categoriaId: '',
        alunoId: '',
        vinculoTipo: 'novo' as const,
        vinculoId: '',
        recorrente: false
      };
    });
  };

  // Motor de Aprendizado & Sugestão Inteligente
  const applyMatchingEngine = (txList: OFXTransaction[]) => {
    const defaultRecCat = categoriasReceita.find(c => c.codigo === '1.1')?.id || categoriasReceita[0]?.id || '';
    const proLaboreCat = categoriasDespesa.find(c => c.nome.toLowerCase().includes('pró-labore') || c.nome.toLowerCase().includes('pro-labore') || c.codigo === '2.4')?.id || categoriasDespesa[0]?.id || '';

    return txList.map(tx => {
      const descUpper = tx.descricao.toUpperCase();

      // A. Detecção Automática de Pró-Labore / Sócia (Adriana Minello)
      if (descUpper.includes('ADRIANA MINELLO') || descUpper.includes('PROLABORE') || descUpper.includes('PRO-LABORE') || descUpper.includes('PRÓ-LABORE')) {
        return {
          ...tx,
          categoriaId: proLaboreCat,
          isProLabore: true,
          matchOrigin: 'prolabore' as const,
          alunoId: '',
          vinculoTipo: 'novo' as const
        };
      }

      // B. Checar Regras de Aprendizado Salvas em Firestore (conciliacao_regras)
      const txTipoMapped = tx.tipo === 'credito' ? 'receita' : 'despesa';
      const regraCorrespondente = regras.find(r => 
        txTipoMapped === r.tipo && descUpper.includes(r.descricao_chave.toUpperCase())
      );

      if (regraCorrespondente) {
        return {
          ...tx,
          categoriaId: regraCorrespondente.categoria_id || (tx.tipo === 'credito' ? defaultRecCat : ''),
          alunoId: regraCorrespondente.aluno_id || '',
          matchOrigin: 'regra' as const,
          vinculoTipo: 'novo' as const
        };
      }

      // C. Se for Receito (Crédito): Match por Nome de Aluno no Cadastro
      if (tx.tipo === 'credito') {
        const alunoMatched = alunos.find(al => {
          const nomeClean = al.nome.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const sobrenomeClean = (al.sobrenome || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const descClean = descUpper.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          return (
            (descClean.includes(nomeClean) && nomeClean.length >= 3) ||
            (sobrenomeClean && descClean.includes(sobrenomeClean) && sobrenomeClean.length >= 3)
          );
        });

        if (alunoMatched) {
          const receitaPendente = receitasAbertas.find(r => 
            r.aluno_id === alunoMatched.id && 
            r.status !== 'pago' && 
            Math.abs(r.valor - tx.valor) < 5
          );

          return {
            ...tx,
            alunoId: alunoMatched.id,
            categoriaId: defaultRecCat,
            matchOrigin: 'nome' as const,
            vinculoTipo: receitaPendente ? ('vincular' as const) : ('novo' as const),
            vinculoId: receitaPendente ? receitaPendente.id : ''
          };
        }

        return {
          ...tx,
          categoriaId: defaultRecCat,
          matchOrigin: 'nenhum' as const
        };
      }

      // D. Se for Débito (Despesa)
      if (tx.tipo === 'debito') {
        const despesaPendente = despesasAbertas.find(d => 
          d.status !== 'pago' && 
          Math.abs(d.valor - tx.valor) < 0.1 && 
          Math.abs(new Date(d.vencimento || d.data_vencimento || tx.data).getTime() - new Date(tx.data).getTime()) < 5 * 24 * 60 * 60 * 1000
        );

        let suggestedCat = categoriasDespesa.find(c => c.codigo === '2.8')?.id || categoriasDespesa[0]?.id || '';
        if (descUpper.includes('ALUGUEL') || descUpper.includes('CONDOMINIO')) {
          suggestedCat = categoriasDespesa.find(c => c.codigo === '2.1')?.id || suggestedCat;
        } else if (descUpper.includes('TELEFONE') || descUpper.includes('INTERNET') || descUpper.includes('CLARO') || descUpper.includes('VIVO')) {
          suggestedCat = categoriasDespesa.find(c => c.codigo === '2.2')?.id || suggestedCat;
        } else if (descUpper.includes('ENERGIA') || descUpper.includes('LUZ') || descUpper.includes('RGE') || descUpper.includes('CORSAN')) {
          suggestedCat = categoriasDespesa.find(c => c.codigo === '2.2')?.id || suggestedCat;
        } else if (descUpper.includes('CONTAB') || descUpper.includes('CONTADOR')) {
          suggestedCat = categoriasDespesa.find(c => c.codigo === '2.3')?.id || suggestedCat;
        }

        return {
          ...tx,
          categoriaId: suggestedCat,
          vinculoTipo: despesaPendente ? ('vincular' as const) : ('novo' as const),
          vinculoId: despesaPendente ? despesaPendente.id : ''
        };
      }

      return tx;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseOFXFile(text);
        const matched = applyMatchingEngine(parsed);
        setTransactions(matched);
        setSuccessCount(null);
      } catch (err) {
        console.error(err);
        alert("Erro ao ler arquivo OFX. Verifique se o formato está correto.");
      }
    };
    reader.readAsText(file);
  };

  // Salvar Aprendizado de Aluno / Regra de Conciliação no Firestore
  const handleSaveLearningRule = async (tx: OFXTransaction, alunoIdToSave: string) => {
    if (!alunoIdToSave) {
      alert("Selecione um aluno para salvar o aprendizado.");
      return;
    }

    // Extrair chave descritiva do PIX
    const words = tx.descricao.split(' ').filter(w => w.length > 3 && !/\d/.test(w));
    const chave = words.slice(0, 3).join(' ') || tx.descricao.substring(0, 20);

    try {
      await addDoc(collection(db, 'conciliacao_regras'), {
        descricao_chave: chave,
        aluno_id: alunoIdToSave,
        categoria_id: tx.categoriaId || categoriasReceita[0]?.id,
        tipo: tx.tipo === 'credito' ? 'receita' : 'despesa',
        is_learned: true,
        created_at: Date.now()
      });

      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, learnedSaved: true, matchOrigin: 'regra' } : t));

      const alunoObj = alunos.find(a => a.id === alunoIdToSave);
      alert(`🧠 Regra aprendida com sucesso!\n\nSempre que o extrato contiver "${chave}", o sistema vinculará automaticamente a "${alunoObj?.nome}".`);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar regra de aprendizado.");
    }
  };

  const handleFieldChange = (id: string, field: keyof OFXTransaction, value: any) => {
    setTransactions(prev => prev.map(tx => {
      if (tx.id !== id) return tx;

      if (field === 'alunoId' && tx.tipo === 'credito') {
        const recAberta = receitasAbertas.find(r => 
          r.aluno_id === value && 
          r.status !== 'pago' && 
          Math.abs(r.valor - tx.valor) < 5
        );
        return {
          ...tx,
          alunoId: value,
          vinculoTipo: recAberta ? 'vincular' : 'novo',
          vinculoId: recAberta ? recAberta.id : ''
        };
      }

      if (field === 'vinculoTipo' && value === 'novo') {
        return { ...tx, [field]: value, vinculoId: '' };
      }

      return { ...tx, [field]: value };
    }));
  };

  const handleProcessReconciliation = async () => {
    const pendentes = transactions.filter(t => t.status === 'pendente');
    if (pendentes.length === 0) {
      alert("Nenhum lançamento pendente de conciliação.");
      return;
    }

    setIsProcessing(true);
    let conciliadosCount = 0;

    try {
      const batch = writeBatch(db);

      for (const tx of pendentes) {
        if (tx.vinculoTipo === 'ignorar') {
          continue;
        }

        const catObj = planoContas.find(c => c.id === tx.categoriaId);
        const catNome = catObj ? catObj.nome : (tx.isProLabore ? 'Salários & Pró-Labore' : 'Outros');
        const dataPagamentoMs = new Date(tx.data + 'T12:00:00').getTime();

        if (tx.vinculoTipo === 'vincular' && tx.vinculoId) {
          if (tx.tipo === 'credito') {
            const recRef = doc(db, 'receitas', tx.vinculoId);
            batch.update(recRef, {
              status: 'PAGO',
              data_pagamento: tx.data,
              forma_pagamento: 'PIX/Transferência',
              banco: 'Sicredi'
            });
          } else {
            const despRef = doc(db, 'despesas', tx.vinculoId);
            batch.update(despRef, {
              status: 'PAGO',
              data_pagamento: tx.data,
              forma_pagamento: 'Débito/PIX',
              banco: 'Sicredi'
            });
          }
        } else {
          if (tx.tipo === 'credito') {
            const alunoObj = alunos.find(a => a.id === tx.alunoId);
            const newRecRef = doc(collection(db, 'receitas'));
            batch.set(newRecRef, {
              descricao: tx.alunoId && alunoObj ? `Mensalidade - ${alunoObj.nome} ${alunoObj.sobrenome || ''}` : tx.descricao,
              aluno_id: tx.alunoId || '',
              categoria: catNome,
              categoria_id: tx.categoriaId,
              valor: tx.valor,
              data_vencimento: tx.data,
              status: 'PAGO',
              forma_pagamento: 'PIX/Transferência',
              banco: 'Sicredi',
              data_pagamento: dataPagamentoMs,
              created_at: Date.now()
            });
          } else {
            const newDespRef = doc(collection(db, 'despesas'));
            batch.set(newDespRef, {
              descricao: tx.isProLabore ? `Pró-Labore / Retirada de Sócia - Adriana Minello` : tx.descricao,
              categoria: catNome,
              categoria_id: tx.categoriaId,
              valor: tx.valor,
              vencimento: tx.data,
              data_vencimento: tx.data,
              status: 'PAGO',
              data_pagamento: dataPagamentoMs,
              is_pro_labore: tx.isProLabore || false,
              created_at: Date.now()
            });
          }
        }

        conciliadosCount++;
      }

      await batch.commit();

      await logActivity({
        action: 'CREATE',
        resource_type: 'receita',
        details: `Processada conciliação bancária de ${conciliadosCount} lançamentos via OFX.`
      });

      setSuccessCount(conciliadosCount);
      setTransactions([]);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar conciliações.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display text-brand-dark">Conciliação Bancária & IA 🧠</h2>
        <p className="text-surface-500">
          Importador inteligente de extratos OFX com detecção de Pró-Labore, vinculação de alunos e aprendizado contínuo.
        </p>
      </div>

      {/* Upload e Estatísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col items-center justify-center border-dashed border-2 border-surface-300 hover:border-brand-medium transition-all text-center">
          <Upload className="w-10 h-10 text-brand-medium mb-4 animate-bounce" />
          <p className="font-bold text-brand-dark mb-1">Upload de Extrato OFX</p>
          <p className="text-xs text-surface-400 mb-4">Arraste ou clique para selecionar o arquivo .ofx</p>
          <input 
            type="file" 
            accept=".ofx" 
            onChange={handleFileUpload} 
            className="hidden" 
            id="ofx-file-upload" 
          />
          <label htmlFor="ofx-file-upload" className="btn-primary py-2 px-4 text-xs font-semibold cursor-pointer">
            Selecionar Arquivo
          </label>
        </div>

        <div className="glass-card p-6 flex items-center justify-between border-l-4 border-l-green-500">
          <div>
            <p className="text-xs font-bold text-green-700 uppercase">Regras de Aprendizado Salvas</p>
            <p className="text-3xl font-display font-extrabold text-brand-dark mt-1">{regras.length}</p>
            <p className="text-xs text-surface-400 mt-2">Classificação automática inteligente</p>
          </div>
          <Brain className="w-12 h-12 text-green-500 opacity-60" />
        </div>

        <div className="glass-card p-6 flex items-center justify-between border-l-4 border-l-brand-medium">
          <div>
            <p className="text-xs font-bold text-brand-medium uppercase">Lançamentos Conciliados</p>
            <p className="text-3xl font-display font-extrabold text-brand-dark mt-1">
              {successCount !== null ? successCount : '---'}
            </p>
            <p className="text-xs text-surface-400 mt-2">Salvos no fluxo de caixa real</p>
          </div>
          <CheckCircle className="w-12 h-12 text-brand-medium opacity-60" />
        </div>
      </div>

      {/* Tabela de Conciliação */}
      {transactions.length > 0 && (
        <div className="glass-card p-6 animate-fade-in space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-medium" />
              Auditoria de Extrato Importado ({transactions.length} lançamentos)
            </h3>
            <div className="flex gap-3">
              <button 
                onClick={() => setTransactions([])}
                className="btn-secondary !text-red-600 hover:!bg-red-50 flex items-center gap-1.5 text-xs"
              >
                <X className="w-4 h-4" />
                Limpar Extrato
              </button>
              <button 
                onClick={handleProcessReconciliation}
                disabled={isProcessing}
                className="btn-primary flex items-center gap-1.5 text-xs font-bold"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Confirmar Conciliações
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-200 text-surface-400 font-bold uppercase">
                  <th className="py-3 px-3">Data / Tipo</th>
                  <th className="py-3 px-3">Descrição Original</th>
                  <th className="py-3 px-3">Associação / Auditoria de Aluno</th>
                  <th className="py-3 px-3">Plano de Contas</th>
                  <th className="py-3 px-3">Valor</th>
                  <th className="py-3 px-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                {transactions.map(tx => {
                  const isCredit = tx.tipo === 'credito';
                  const availableBills = isCredit 
                    ? receitasAbertas.filter(r => r.aluno_id === tx.alunoId && r.status !== 'pago')
                    : despesasAbertas.filter(d => d.status !== 'pago');

                  return (
                    <tr key={tx.id} className="hover:bg-surface-50/50 transition-colors">
                      {/* Data / Tipo */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg flex items-center justify-center ${
                            isCredit ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                          }`}>
                            {isCredit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </span>
                          <div>
                            <p className="font-bold text-brand-dark">{new Date(tx.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                            <span className="text-[10px] uppercase font-bold text-surface-400">
                              {isCredit ? 'Crédito' : 'Débito'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Descrição */}
                      <td className="py-3 px-3">
                        <p className="font-bold text-brand-dark truncate max-w-xs" title={tx.descricao}>
                          {tx.descricao}
                        </p>
                        {tx.isProLabore && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Crown className="w-3 h-3 text-amber-600" /> Pró-Labore Sócia
                          </span>
                        )}
                      </td>

                      {/* Associação / Auditoria de Aluno */}
                      <td className="py-3 px-3">
                        {isCredit ? (
                          <div className="space-y-1.5 min-w-[210px]">
                            {/* Badges de Origem do Match */}
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-surface-400 uppercase">Aluno Vinculado</span>
                              {tx.matchOrigin === 'regra' && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                                  <Brain className="w-3 h-3" /> Aprendido
                                </span>
                              )}
                              {tx.matchOrigin === 'nome' && (
                                <span className="text-[9px] font-bold text-brand-medium bg-brand-50 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-brand-200">
                                  <UserCheck className="w-3 h-3" /> Match Nome
                                </span>
                              )}
                              {tx.matchOrigin === 'nenhum' && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                                  ⚠️ Auditar Aluno
                                </span>
                              )}
                            </div>

                            <select
                              value={tx.alunoId}
                              onChange={(e) => handleFieldChange(tx.id, 'alunoId', e.target.value)}
                              className="input-field py-1 text-xs font-semibold"
                            >
                              <option value="">Desconhecido / Outro</option>
                              {alunos.map(a => (
                                <option key={a.id} value={a.id}>{a.nome} {a.sobrenome || ''}</option>
                              ))}
                            </select>

                            {/* Botão de Salvar Aprendizado se o aluno estiver selecionado */}
                            {tx.alunoId && !tx.learnedSaved && (
                              <button
                                onClick={() => handleSaveLearningRule(tx, tx.alunoId)}
                                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 mt-1 hover:underline"
                              >
                                <Sparkles className="w-3 h-3" /> Salvar regra p/ próximos OFXs
                              </button>
                            )}

                            {tx.learnedSaved && (
                              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Regra salva!
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-2">
                            <input
                              type="checkbox"
                              id={`recorrente-${tx.id}`}
                              checked={tx.recorrente}
                              onChange={(e) => handleFieldChange(tx.id, 'recorrente', e.target.checked)}
                              className="w-4 h-4 rounded text-brand-medium focus:ring-brand-medium"
                            />
                            <label htmlFor={`recorrente-${tx.id}`} className="text-xs font-bold text-surface-500 uppercase cursor-pointer">
                              Despesa Fixa (Projetar)
                            </label>
                          </div>
                        )}
                      </td>

                      {/* Plano de Contas */}
                      <td className="py-3 px-3">
                        <div className="space-y-1 min-w-[170px]">
                          <label className="text-[10px] font-bold text-surface-400 uppercase">Categoria</label>
                          <select
                            value={tx.categoriaId}
                            onChange={(e) => handleFieldChange(tx.id, 'categoriaId', e.target.value)}
                            className="input-field py-1 text-xs"
                          >
                            <option value="">Selecione...</option>
                            {isCredit 
                              ? categoriasReceita.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)
                              : categoriasDespesa.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)
                            }
                          </select>
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`font-bold text-sm ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                          {isCredit ? '+' : '-'} R$ {tx.valor.toFixed(2).replace('.', ',')}
                        </span>
                      </td>

                      {/* Tipo Ação */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1 min-w-[130px]">
                          <select
                            value={tx.vinculoTipo}
                            onChange={(e) => handleFieldChange(tx.id, 'vinculoTipo', e.target.value)}
                            className="input-field py-1 text-xs font-semibold"
                          >
                            <option value="novo">Lançar Novo</option>
                            {availableBills.length > 0 && (
                              <option value="vincular">Vincular/Liquidar</option>
                            )}
                            <option value="ignorar">Ignorar</option>
                          </select>

                          {tx.vinculoTipo === 'vincular' && availableBills.length > 0 && (
                            <select
                              value={tx.vinculoId}
                              onChange={(e) => handleFieldChange(tx.id, 'vinculoId', e.target.value)}
                              className="input-field py-1 text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50/50"
                            >
                              <option value="">Escolher conta...</option>
                              {availableBills.map(b => (
                                <option key={b.id} value={b.id}>
                                  Venc: {new Date(b.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')} - R$ {b.valor}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConciliacaoBancaria;
