import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, Dumbbell, AlertTriangle, Info } from 'lucide-react';
import type { Aluno } from '../types/database';

interface Exercicios {
  id: string;
  nome: string;
  tipo: string;
  series: number;
  reps: string;
  carga: string;
  justificativa?: string;
}

export const TreinoMobile = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [treinos, setTreinos] = useState<{ A: Exercicios[], B: Exercicios[], C: Exercicios[] } | null>(null);
  const [blocoAtivo, setBlocoAtivo] = useState<'A'|'B'|'C'>('A');

  useEffect(() => {
    const fetchTreino = async () => {
      if (!id) return;
      try {
        // Busca aluno
        const alunoDoc = await getDoc(doc(db, 'alunos', id));
        if (!alunoDoc.exists()) {
          setErro(true);
          return;
        }
        setAluno({ id: alunoDoc.id, ...alunoDoc.data() } as Aluno);

        // Busca Ficha
        const treinoDoc = await getDoc(doc(db, 'treinos_ativos', id));
        if (treinoDoc.exists()) {
          setTreinos(treinoDoc.data() as any);
        } else {
          setErro(true);
        }
      } catch (err) {
        console.error(err);
        setErro(true);
      } finally {
        setLoading(false);
      }
    };

    fetchTreino();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-brand-medium mb-4" />
        <p>Carregando sua ficha...</p>
      </div>
    );
  }

  if (erro || !treinos || !aluno) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl text-white font-bold mb-2">Treino não encontrado</h2>
        <p>Não foi possível localizar sua ficha ativa no Aello Studio. Peça ao seu treinador para atualizar seu link.</p>
      </div>
    );
  }

  const exerciciosAtuais = treinos[blocoAtivo] || [];
  const blocosDisponiveis = [];
  if (treinos.A?.length > 0) blocosDisponiveis.push('A');
  if (treinos.B?.length > 0) blocosDisponiveis.push('B');
  if (treinos.C?.length > 0) blocosDisponiveis.push('C');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20 font-sans">
      
      {/* HEADER HERO */}
      <div className="bg-gradient-to-b from-brand-dark to-slate-950 pt-12 pb-6 px-6 shadow-xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-medium/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4"></div>
        
        <div className="relative z-10">
          <p className="text-brand-medium font-bold tracking-widest text-xs uppercase mb-2">Aello Studio</p>
          <h1 className="text-3xl text-white font-display font-black leading-tight mb-2">
            Olá, {aluno.nome.split(' ')[0]} ⚡
          </h1>
          <p className="text-slate-400 text-sm">Seu objetivo: <span className="text-white font-bold">{aluno.objetivo.replace('_', ' ').toUpperCase()}</span></p>
        </div>
      </div>

      {/* SELETOR DE BLOCO */}
      <div className="px-5 mt-4 sticky top-4 z-40">
        <div className="bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl flex gap-2 border border-slate-800 shadow-2xl">
          {blocosDisponiveis.map(b => (
            <button
              key={b}
              onClick={() => setBlocoAtivo(b as 'A'|'B'|'C')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300 ${
                blocoAtivo === b 
                  ? 'bg-brand-medium text-white shadow-lg shadow-brand-medium/25' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              TREINO {b}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA DE EXERCÍCIOS */}
      <div className="px-5 mt-8 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-brand-medium" /> 
            Lista de Exercícios
          </h2>
          <span className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1 rounded-full">
            {exerciciosAtuais.length} itens
          </span>
        </div>

        {exerciciosAtuais.map((ex, index) => {
          let badgeColor = "bg-slate-800 text-slate-300";
          if (ex.tipo === 'FIXO') badgeColor = "bg-green-950/60 text-green-400 border border-green-900/50";
          if (ex.tipo === 'AQUEC') badgeColor = "bg-blue-950/60 text-blue-400 border border-blue-900/50";
          if (ex.tipo === 'ROTATIVO') badgeColor = "bg-yellow-950/60 text-yellow-500 border border-yellow-900/50";

          return (
            <div key={ex.id || index} className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4">
                  <div className="text-4xl font-black text-slate-800 mt-1">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg leading-tight uppercase pr-4">{ex.nome}</h3>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${badgeColor}`}>
                      {ex.tipo}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/30">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Séries</p>
                  <p className="text-2xl font-black text-white">{ex.series}x</p>
                </div>
                <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/30">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Repetições</p>
                  <p className="text-xl font-bold text-brand-medium">{ex.reps}</p>
                </div>
              </div>

              {ex.justificativa && ex.justificativa !== 'None' && ex.justificativa !== '' && (
                <div className="mt-4 bg-blue-950/20 rounded-xl p-3 flex gap-3 items-start border border-blue-900/20">
                  <Info className="w-4 h-4 text-brand-medium shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 leading-relaxed italic">{ex.justificativa}</p>
                </div>
              )}
            </div>
          );
        })}
        
        {exerciciosAtuais.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            Nenhum exercício cadastrado neste bloco.
          </div>
        )}
      </div>

    </div>
  );
};
