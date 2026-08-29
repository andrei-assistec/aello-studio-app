import React, { useState } from 'react';
import { 
  Activity, 
  Ruler, 
  Camera, 
  TrendingUp, 
  Plus, 
  Printer, 
  Image as ImageIcon, 
  Save, 
  X,
  Clock
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import type { Aluno } from '../../types/database';

export interface AvaliacaoFisica {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  data_avaliacao: string;
  avaliador_nome?: string;
  estatura: number; // m
  peso: number; // kg
  imc?: number;
  rcq?: number;
  percentual_gordura?: number;
  peso_gordo?: number;
  peso_magro?: number;
  flexibilidade?: number; // cm
  origem_arquivo?: string;
  medidas?: {
    braco_direito?: number;
    braco_esquerdo?: number;
    torax?: number;
    cintura?: number;
    abdomen?: number;
    quadril?: number;
    coxa_direita_acima?: number;
    coxa_esquerda_acima?: number;
    coxa_direita_abaixo?: number;
    coxa_esquerda_abaixo?: number;
    perna_direita?: number;
    perna_esquerda?: number;
  };
  fotos?: {
    frente?: string;
    costas?: string;
    lado_direito?: string;
    lado_esquerdo?: string;
  };
  observacoes?: string;
  created_at?: number;
}

export const AvaliacaoFisicaPage = () => {
  const { data: alunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: avaliacoes, remove: deleteAvaliacao } = useCollection<AvaliacaoFisica>('avaliacoes_fisicas');

  const [selectedAlunoId, setSelectedAlunoId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'resumo' | 'antropometria' | 'fotos' | 'graficos'>('resumo');

  // Comparador de Fotos
  const [photoBeforeId, setPhotoBeforeId] = useState<string>('');
  const [photoAfterId, setPhotoAfterId] = useState<string>('');

  // Modal Nova Avaliação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    aluno_id: '',
    data_avaliacao: new Date().toISOString().split('T')[0],
    avaliador_nome: 'Prof. Andrei Pletsch',
    estatura: '1.75',
    peso: '75.0',
    percentual_gordura: '15.0',
    flexibilidade: '35',
    braco_direito: '32',
    braco_esquerdo: '32',
    torax: '98',
    cintura: '82',
    abdomen: '85',
    quadril: '98',
    coxa_direita_acima: '56',
    coxa_esquerda_acima: '56',
    coxa_direita_abaixo: '44',
    coxa_esquerda_abaixo: '44',
    perna_direita: '36',
    perna_esquerda: '36',
    foto_frente: '',
    foto_costas: '',
    foto_lado_direito: '',
    foto_lado_esquerdo: '',
    observacoes: ''
  });

  // Filtrar aluno selecionado
  const activeAluno = alunos.find(a => a.id === selectedAlunoId) || (alunos.length > 0 ? alunos[0] : null);
  const currentAlunoId = activeAluno ? activeAluno.id : '';

  // Avaliações do aluno selecionado
  const alunoAvaliacoes = avaliacoes
    .filter(av => av.aluno_id === currentAlunoId || (activeAluno && av.aluno_nome && av.aluno_nome.toLowerCase().includes(activeAluno.nome.toLowerCase())))
    .sort((a, b) => new Date(b.data_avaliacao).getTime() - new Date(a.data_avaliacao).getTime());

  const latestEval = alunoAvaliacoes.length > 0 ? alunoAvaliacoes[0] : null;

  // Calculadores de IMC e Classificação
  const calcIMC = (peso: number, estatura: number) => {
    if (!estatura || estatura <= 0) return 0;
    return parseFloat((peso / (estatura * estatura)).toFixed(2));
  };

  const getClassificacaoIMC = (imc: number) => {
    if (imc < 18.5) return { label: 'Abaixo do Peso', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (imc <= 24.9) return { label: 'Eutrófico (Peso Normal)', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    if (imc <= 29.9) return { label: 'Sobrepeso', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (imc <= 34.9) return { label: 'Obesidade Grau I', color: 'text-rose-600 bg-rose-50 border-rose-200' };
    return { label: 'Obesidade Severa', color: 'text-red-700 bg-red-100 border-red-300' };
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.aluno_id) {
      alert('Selecione o aluno para a avaliação.');
      return;
    }

    const est = parseFloat(newForm.estatura) || 1.70;
    const p = parseFloat(newForm.peso) || 70;
    const bfVal = parseFloat(newForm.percentual_gordura) || 15;

    const pesoGordo = parseFloat((p * (bfVal / 100)).toFixed(2));
    const pesoMagro = parseFloat((p - pesoGordo).toFixed(2));
    const imcVal = calcIMC(p, est);

    const cint = parseFloat(newForm.cintura) || 0;
    const quad = parseFloat(newForm.quadril) || 0;
    const rcqVal = (cint > 0 && quad > 0) ? parseFloat((cint / quad).toFixed(2)) : 0;

    const alunoObj = alunos.find(a => a.id === newForm.aluno_id);

    try {
      await addDoc(collection(db, 'avaliacoes_fisicas'), {
        aluno_id: newForm.aluno_id,
        aluno_nome: alunoObj ? `${alunoObj.nome} ${alunoObj.sobrenome || ''}`.trim() : '',
        data_avaliacao: newForm.data_avaliacao,
        avaliador_nome: newForm.avaliador_nome,
        estatura: est,
        peso: p,
        imc: imcVal,
        rcq: rcqVal,
        percentual_gordura: bfVal,
        peso_gordo: pesoGordo,
        peso_magro: pesoMagro,
        flexibilidade: parseFloat(newForm.flexibilidade) || 0,
        medidas: {
          braco_direito: parseFloat(newForm.braco_direito) || 0,
          braco_esquerdo: parseFloat(newForm.braco_esquerdo) || 0,
          torax: parseFloat(newForm.torax) || 0,
          cintura: cint,
          abdomen: parseFloat(newForm.abdomen) || 0,
          quadril: quad,
          coxa_direita_acima: parseFloat(newForm.coxa_direita_acima) || 0,
          coxa_esquerda_acima: parseFloat(newForm.coxa_esquerda_acima) || 0,
          coxa_direita_abaixo: parseFloat(newForm.coxa_direita_abaixo) || 0,
          coxa_esquerda_abaixo: parseFloat(newForm.coxa_esquerda_abaixo) || 0,
          perna_direita: parseFloat(newForm.perna_direita) || 0,
          perna_esquerda: parseFloat(newForm.perna_esquerda) || 0,
        },
        fotos: {
          frente: newForm.foto_frente || '',
          costas: newForm.foto_costas || '',
          lado_direito: newForm.foto_lado_direito || '',
          lado_esquerdo: newForm.foto_lado_esquerdo || ''
        },
        observacoes: newForm.observacoes,
        created_at: Date.now()
      });

      await logActivity({
        action: 'CREATE',
        resource_type: 'prescricao',
        resource_name: alunoObj?.nome,
        details: `Realizou nova Avaliação Física para ${alunoObj?.nome}`
      });

      setIsModalOpen(false);
      alert('Avaliação física salva com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar avaliação física.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Avaliação Física & Antropometria 📏</h2>
          <p className="text-surface-500 text-sm">
            Laudos antropométricos profissionais, composição corporal e evolução fotográfica.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Seletor de Aluno */}
          <div className="relative min-w-[240px]">
            <select 
              value={selectedAlunoId || currentAlunoId}
              onChange={e => setSelectedAlunoId(e.target.value)}
              className="input-field py-2 text-xs font-bold"
            >
              {alunos.map(a => (
                <option key={a.id} value={a.id}>
                  👤 {a.nome} {a.sobrenome || ''}
                </option>
              ))}
            </select>
          </div>

          <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5 py-2 text-xs">
            <Printer className="w-4 h-4" />
            Imprimir Laudo
          </button>

          <button 
            onClick={() => {
              if (activeAluno) {
                setNewForm(prev => ({ ...prev, aluno_id: activeAluno.id }));
              }
              setIsModalOpen(true);
            }} 
            className="btn-primary flex items-center gap-1.5 py-2 text-xs"
          >
            <Plus className="w-4 h-4" />
            Nova Avaliação
          </button>
        </div>
      </div>

      {/* Navegação de Abas */}
      <div className="flex border-b border-surface-200 gap-4 text-sm font-bold print:hidden">
        <button 
          onClick={() => setActiveTab('resumo')}
          className={`pb-3 px-1 transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'resumo' ? 'border-brand-medium text-brand-dark' : 'border-transparent text-surface-400 hover:text-brand-dark'
          }`}
        >
          <Activity className="w-4 h-4" /> Resumo & Diagnóstico
        </button>

        <button 
          onClick={() => setActiveTab('antropometria')}
          className={`pb-3 px-1 transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'antropometria' ? 'border-brand-medium text-brand-dark' : 'border-transparent text-surface-400 hover:text-brand-dark'
          }`}
        >
          <Ruler className="w-4 h-4" /> Perímetros & Composição
        </button>

        <button 
          onClick={() => setActiveTab('fotos')}
          className={`pb-3 px-1 transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'fotos' ? 'border-brand-medium text-brand-dark' : 'border-transparent text-surface-400 hover:text-brand-dark'
          }`}
        >
          <Camera className="w-4 h-4" /> Fotometria (Antes x Depois)
        </button>

        <button 
          onClick={() => setActiveTab('graficos')}
          className={`pb-3 px-1 transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'graficos' ? 'border-brand-medium text-brand-dark' : 'border-transparent text-surface-400 hover:text-brand-dark'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Evolução Histórica
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. RESUMO & DIAGNÓSTICO */}
      {/* ========================================================= */}
      {activeTab === 'resumo' && (
        <div className="space-y-6">
          {latestEval ? (
            <>
              {/* Header do Aluno Avaliado */}
              <div className="glass-card p-6 bg-gradient-to-r from-brand-dark to-slate-900 text-white rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <span className="text-xs text-brand-medium font-bold uppercase tracking-wider">Última Avaliação Registrada</span>
                  <h3 className="text-2xl font-bold font-display mt-1">{latestEval.aluno_nome}</h3>
                  <p className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                    <span>📅 Data: <strong>{latestEval.data_avaliacao}</strong></span>
                    <span>📏 Estatura: <strong>{latestEval.estatura} m</strong></span>
                    <span>👨‍⚕️ Avaliador: <strong>{latestEval.avaliador_nome || 'Prof. Andrei Pletsch'}</strong></span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {latestEval.imc && (
                    <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md text-center min-w-[120px]">
                      <span className="text-[10px] text-slate-300 block font-semibold uppercase">IMC Atual</span>
                      <span className="text-xl font-bold text-emerald-400">{latestEval.imc}</span>
                      <span className={`text-[9px] font-bold block mt-1 px-1.5 py-0.5 rounded-full ${getClassificacaoIMC(latestEval.imc).color}`}>
                        {getClassificacaoIMC(latestEval.imc).label}
                      </span>
                    </div>
                  )}

                  {latestEval.percentual_gordura && (
                    <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md text-center min-w-[100px]">
                      <span className="text-[10px] text-slate-300 block font-semibold uppercase">% Gordura</span>
                      <span className="text-xl font-bold text-amber-400">{latestEval.percentual_gordura}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* KPIs de Resultados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-5">
                  <span className="text-xs text-surface-400 font-semibold">Peso Corporal</span>
                  <h4 className="text-2xl font-bold text-brand-dark mt-1">{latestEval.peso} kg</h4>
                  <p className="text-[10px] text-surface-400 mt-1">Massa Total em Balança</p>
                </div>

                <div className="glass-card p-5">
                  <span className="text-xs text-surface-400 font-semibold">Massa Magra (Livre de Gordura)</span>
                  <h4 className="text-2xl font-bold text-emerald-600 mt-1">{latestEval.peso_magro || (latestEval.peso * (1 - (latestEval.percentual_gordura || 15)/100)).toFixed(1)} kg</h4>
                  <p className="text-[10px] text-emerald-600 mt-1">Músculos + Ossos + Órgãos</p>
                </div>

                <div className="glass-card p-5">
                  <span className="text-xs text-surface-400 font-semibold">Massa Gorda</span>
                  <h4 className="text-2xl font-bold text-amber-600 mt-1">{latestEval.peso_gordo || (latestEval.peso * ((latestEval.percentual_gordura || 15)/100)).toFixed(1)} kg</h4>
                  <p className="text-[10px] text-amber-600 mt-1">Tecido Adiposo Total</p>
                </div>

                <div className="glass-card p-5">
                  <span className="text-xs text-surface-400 font-semibold">Flexibilidade (Wells)</span>
                  <h4 className="text-2xl font-bold text-indigo-600 mt-1">{latestEval.flexibilidade || 35} cm</h4>
                  <p className="text-[10px] text-indigo-600 mt-1">Sentar e Alcançar</p>
                </div>
              </div>

              {/* Tabela de Histórico Recente de Avaliações */}
              <div className="glass-card p-6">
                <h4 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-brand-medium" />
                  Histórico de Avaliações do Aluno ({alunoAvaliacoes.length} registradas)
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-50 border-b border-surface-200 font-bold text-brand-dark uppercase">
                      <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3">Peso (kg)</th>
                        <th className="p-3">% Gordura</th>
                        <th className="p-3">Massa Magra</th>
                        <th className="p-3">IMC</th>
                        <th className="p-3">RCQ</th>
                        <th className="p-3">Arquivo Origem</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100 font-medium text-surface-700">
                      {alunoAvaliacoes.map(av => (
                        <tr key={av.id} className="hover:bg-surface-50/50">
                          <td className="p-3 font-bold text-brand-dark">{av.data_avaliacao}</td>
                          <td className="p-3">{av.peso} kg</td>
                          <td className="p-3 font-bold text-amber-700">{av.percentual_gordura ? `${av.percentual_gordura}%` : '-'}</td>
                          <td className="p-3 font-bold text-emerald-700">{av.peso_magro ? `${av.peso_magro} kg` : '-'}</td>
                          <td className="p-3">{av.imc || '-'}</td>
                          <td className="p-3">{av.rcq || '-'}</td>
                          <td className="p-3 text-surface-400 text-[10px]">{av.origem_arquivo || 'Lançamento Manual'}</td>
                          <td className="p-3 text-right">
                            <button 
                              onClick={() => deleteAvaliacao(av.id)}
                              className="text-red-500 hover:text-red-700 font-bold"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card p-12 text-center text-surface-400 space-y-3">
              <Activity className="w-12 h-12 mx-auto text-surface-300" />
              <h4 className="text-lg font-bold text-brand-dark">Nenhuma avaliação física cadastrada para este aluno.</h4>
              <p className="text-xs">Clique no botão "Nova Avaliação" para cadastrar os perímetros e a composição corporal.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PERÍMETROS & COMPOSIÇÃO CORPORAL */}
      {/* ========================================================= */}
      {activeTab === 'antropometria' && (
        <div className="space-y-6">
          {latestEval && latestEval.medidas ? (
            <div className="glass-card p-6 space-y-6">
              <h4 className="text-xl font-bold text-brand-dark flex items-center gap-2">
                <Ruler className="w-6 h-6 text-brand-medium" />
                Perímetros Antropométricos (cm) - Avaliação de {latestEval.data_avaliacao}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs text-surface-500 font-semibold">Tórax</span>
                  <h5 className="text-xl font-bold text-brand-dark mt-1">{latestEval.medidas.torax || '-'} cm</h5>
                </div>

                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs text-surface-500 font-semibold">Cintura</span>
                  <h5 className="text-xl font-bold text-brand-dark mt-1">{latestEval.medidas.cintura || '-'} cm</h5>
                </div>

                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs text-surface-500 font-semibold">Abdômen</span>
                  <h5 className="text-xl font-bold text-brand-dark mt-1">{latestEval.medidas.abdomen || '-'} cm</h5>
                </div>

                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs text-surface-500 font-semibold">Quadril</span>
                  <h5 className="text-xl font-bold text-brand-dark mt-1">{latestEval.medidas.quadril || '-'} cm</h5>
                </div>

                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs text-surface-500 font-semibold">Braço Direito</span>
                  <h5 className="text-xl font-bold text-brand-dark mt-1">{latestEval.medidas.braco_direito || '-'} cm</h5>
                </div>

                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs text-surface-500 font-semibold">Braço Esquerdo</span>
                  <h5 className="text-xl font-bold text-brand-dark mt-1">{latestEval.medidas.braco_esquerdo || '-'} cm</h5>
                </div>

                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs text-surface-500 font-semibold">Coxa Direita (Proximal / Distal)</span>
                  <h5 className="text-xl font-bold text-brand-dark mt-1">
                    {latestEval.medidas.coxa_direita_acima || '-'} / {latestEval.medidas.coxa_direita_abaixo || '-'} cm
                  </h5>
                </div>

                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs text-surface-500 font-semibold">Coxa Esquerda (Proximal / Distal)</span>
                  <h5 className="text-xl font-bold text-brand-dark mt-1">
                    {latestEval.medidas.coxa_esquerda_acima || '-'} / {latestEval.medidas.coxa_esquerda_abaixo || '-'} cm
                  </h5>
                </div>

                <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200">
                  <span className="text-xs text-surface-500 font-semibold">Panturrilhas (D / E)</span>
                  <h5 className="text-xl font-bold text-brand-dark mt-1">
                    {latestEval.medidas.perna_direita || '-'} / {latestEval.medidas.perna_esquerda || '-'} cm
                  </h5>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-surface-400">Sem dados antropométricos cadastrados.</div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. FOTOMETRIA (ANTES X DEPOIS) */}
      {/* ========================================================= */}
      {activeTab === 'fotos' && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h4 className="text-xl font-bold text-brand-dark mb-2 flex items-center gap-2">
              <Camera className="w-6 h-6 text-brand-medium" />
              Comparador de Fotometria Postural (Antes x Depois)
            </h4>
            <p className="text-xs text-surface-500 mb-6">Selecione duas avaliações para comparar lado a lado a evolução postural do aluno.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Foto Antes */}
              <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200 space-y-3">
                <span className="text-xs font-bold text-brand-dark block">📌 Foto Inicial (Antes)</span>
                <select 
                  value={photoBeforeId} 
                  onChange={e => setPhotoBeforeId(e.target.value)}
                  className="input-field text-xs py-1.5"
                >
                  <option value="">-- Selecione a data inicial --</option>
                  {alunoAvaliacoes.map(av => (
                    <option key={av.id} value={av.id}>{av.data_avaliacao} ({av.peso}kg)</option>
                  ))}
                </select>

                <div className="aspect-[3/4] bg-surface-200 rounded-xl flex items-center justify-center overflow-hidden relative">
                  <ImageIcon className="w-12 h-12 text-surface-400" />
                  <span className="absolute bottom-3 text-[10px] text-surface-500 font-bold">Foto Postural Frente / Lado</span>
                </div>
              </div>

              {/* Foto Depois */}
              <div className="p-4 bg-surface-50 rounded-2xl border border-surface-200 space-y-3">
                <span className="text-xs font-bold text-brand-dark block">🌟 Foto Atual (Depois)</span>
                <select 
                  value={photoAfterId} 
                  onChange={e => setPhotoAfterId(e.target.value)}
                  className="input-field text-xs py-1.5"
                >
                  <option value="">-- Selecione a data atual --</option>
                  {alunoAvaliacoes.map(av => (
                    <option key={av.id} value={av.id}>{av.data_avaliacao} ({av.peso}kg)</option>
                  ))}
                </select>

                <div className="aspect-[3/4] bg-surface-200 rounded-xl flex items-center justify-center overflow-hidden relative">
                  <ImageIcon className="w-12 h-12 text-surface-400" />
                  <span className="absolute bottom-3 text-[10px] text-surface-500 font-bold">Foto Postural Frente / Lado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Avaliação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl border border-surface-200 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-dark">Nova Avaliação Física & Antropometria</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-surface-100 rounded-xl text-surface-400 hover:text-red-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvaluation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-brand-dark">Aluno</label>
                  <select 
                    value={newForm.aluno_id} 
                    onChange={e => setNewForm({ ...newForm, aluno_id: e.target.value })} 
                    className="input-field text-xs"
                  >
                    <option value="">-- Selecione --</option>
                    {alunos.map(a => <option key={a.id} value={a.id}>{a.nome} {a.sobrenome || ''}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-brand-dark">Data da Avaliação</label>
                  <input 
                    type="date" 
                    value={newForm.data_avaliacao} 
                    onChange={e => setNewForm({ ...newForm, data_avaliacao: e.target.value })} 
                    className="input-field text-xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-brand-dark">Estatura (m)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={newForm.estatura} 
                    onChange={e => setNewForm({ ...newForm, estatura: e.target.value })} 
                    className="input-field text-xs" 
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-brand-dark">Peso Total (kg)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={newForm.peso} 
                    onChange={e => setNewForm({ ...newForm, peso: e.target.value })} 
                    className="input-field text-xs" 
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-brand-dark">% Gordura Corporal</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={newForm.percentual_gordura} 
                    onChange={e => setNewForm({ ...newForm, percentual_gordura: e.target.value })} 
                    className="input-field text-xs" 
                  />
                </div>
              </div>

              <div className="border-t border-surface-100 pt-4">
                <h4 className="font-bold text-brand-dark text-xs mb-3">Perímetros Antropométricos (cm)</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-surface-500">Tórax</label>
                    <input type="number" step="0.5" value={newForm.torax} onChange={e => setNewForm({ ...newForm, torax: e.target.value })} className="input-field text-xs py-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-surface-500">Cintura</label>
                    <input type="number" step="0.5" value={newForm.cintura} onChange={e => setNewForm({ ...newForm, cintura: e.target.value })} className="input-field text-xs py-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-surface-500">Abdômen</label>
                    <input type="number" step="0.5" value={newForm.abdomen} onChange={e => setNewForm({ ...newForm, abdomen: e.target.value })} className="input-field text-xs py-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-surface-500">Quadril</label>
                    <input type="number" step="0.5" value={newForm.quadril} onChange={e => setNewForm({ ...newForm, quadril: e.target.value })} className="input-field text-xs py-1" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary flex items-center gap-1">
                  <Save className="w-4 h-4" /> Salvar Avaliação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
