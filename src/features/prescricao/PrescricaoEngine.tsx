import { useState, useEffect } from 'react';
import { 
  Plus, 
  Sparkles, 
  Trash2, 
  GripVertical, 
  Save, 
  Loader2,
  Calendar,
  Clock,
  FileDown,
  Share2,
  ExternalLink
} from 'lucide-react';
import { clsx } from 'clsx';
import { useCollection } from '../../hooks/useFirestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Aluno, Equipamento, Exercicio } from '../../types/database';
import { sugerirTreinoComGemini } from '../../services/gemini';
import { exportTreinoPDF } from '../../lib/pdfExport';

interface PrescriptionExercicio {
  id: string;
  nome: string;
  tipo: 'FIXO' | 'ROTATIVO' | 'AQUEC';
  series: number;
  reps: string;
  carga: string;
  justificativa?: string;
}

export const PrescricaoEngine = () => {
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>('');
  const [bloco, setBloco] = useState<'A' | 'B' | 'C'>('A');
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTreino, setIsLoadingTreino] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [copyingLink, setCopyingLink] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Guardamos os treinos completos do aluno (A, B e C)
  const [treinos, setTreinos] = useState<{
    A: PrescriptionExercicio[];
    B: PrescriptionExercicio[];
    C: PrescriptionExercicio[];
  }>({ A: [], B: [], C: [] });

  const { data: alunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: equipamentos } = useCollection<Equipamento>('equipamentos');
  const { data: exercicios } = useCollection<Exercicio>('exercicios', 'nome');

  const selectedAluno = alunos.find(a => a.id === selectedAlunoId);
  const treino = treinos[bloco]; // Atalho para o treino que está renderizando

  // Carrega o treino salvo do Firestore quando muda o Aluno
  useEffect(() => {
    if (!selectedAlunoId) {
      setTreinos({ A: [], B: [], C: [] });
      setLastSavedAt(null);
      setHasUnsavedChanges(false);
      return;
    }

    const fetchTreinoSalvo = async () => {
      setIsLoadingTreino(true);
      try {
        const treinoRef = doc(db, 'treinos_ativos', selectedAlunoId);
        const docSnap = await getDoc(treinoRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTreinos({
            A: data.A || [],
            B: data.B || [],
            C: data.C || []
          });
          setLastSavedAt(data.updatedAt || null);
        } else {
          setTreinos({ A: [], B: [], C: [] });
          setLastSavedAt(null);
        }
        setHasUnsavedChanges(false);
      } catch (e) {
        console.error("Erro ao carregar treino:", e);
      } finally {
        setIsLoadingTreino(false);
      }
    };

    fetchTreinoSalvo();
  }, [selectedAlunoId]);

  // Função para salvar a Ficha no Banco
  const handleSalvarTreino = async () => {
    if (!selectedAlunoId) return;
    setIsSaving(true);
    try {
      const isoDate = new Date().toISOString();
      const treinoRef = doc(db, 'treinos_ativos', selectedAlunoId);
      await setDoc(treinoRef, {
        A: treinos.A,
        B: treinos.B,
        C: treinos.C,
        updatedAt: isoDate
      });
      setLastSavedAt(isoDate);
      setHasUnsavedChanges(false);
      alert(`Treino de ${selectedAluno?.nome} salvo com sucesso!`);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar o treino.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = () => {
    if (!selectedAluno) return;
    exportTreinoPDF(selectedAluno, treinos);
  };

  const handleCopyMobileLink = async () => {
    if (!selectedAlunoId) return;
    setCopyingLink(true);
    const link = `${window.location.origin}/meutreino/${selectedAlunoId}`;
    try {
      await navigator.clipboard.writeText(link);
      alert("Link do treino mobile copiado para o clipboard!");
    } catch (err) {
      console.error("Erro ao copiar link:", err);
      alert("Não foi possível copiar o link automaticamente.");
    } finally {
      setCopyingLink(false);
    }
  };

  // Atualiza um exercício no bloco atual
  const setTreino = (newTreinoBlock: PrescriptionExercicio[]) => {
    setTreinos(prev => ({
      ...prev,
      [bloco]: newTreinoBlock
    }));
    setHasUnsavedChanges(true);
  };

  const handleAISuggestion = async () => {
    if (!selectedAluno) return;

    setIsAISuggesting(true);
    try {
      // Envia para a IA apenas equipamentos ATIVOS e em bom estado
      const equipList = equipamentos
        .filter(e => e.ativo && e.estado !== 'inativo')
        .map(e => e.nome);

      console.log(`[IA] Enviando ${equipList.length} equipamentos ativos ao Gemini:`, equipList);
      
      const result = await sugerirTreinoComGemini({
        aluno: {
          nome: selectedAluno.nome,
          objetivo: selectedAluno.objetivo,
          restricoes: selectedAluno.restricoes,
          frequencia: selectedAluno.frequencia_semanal,
          peso: selectedAluno.peso_kg?.toString(),
        },
        historico: [], // TODO: Buscar treinos passados para usar como base real (Reps, Cargas)
        equipamentos: equipList
      });

      const mapEx = (ex: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        nome: ex.exercicio || ex.nome || '(sem nome)',
        tipo: (['FIXO', 'ROTATIVO', 'AQUEC'].includes(ex.tipo) ? ex.tipo : 'ROTATIVO') as 'FIXO' | 'ROTATIVO' | 'AQUEC',
        series: Number(ex.series) || 3,
        reps: String(ex.reps || '12'),
        carga: String(ex.carga || '0'),
        justificativa: ex.justificativa || ''
      });

      const novoA = (result.treino_A || []).map(mapEx);
      const novoB = (result.treino_B || []).map(mapEx);
      const novoC = (result.treino_C || []).map(mapEx);

      console.log(`[IA] Treino 1: ${novoA.length} ex | Treino 2: ${novoB.length} ex | Treino 3: ${novoC.length} ex`);

      setTreinos({ A: novoA, B: novoB, C: novoC });
      setBloco('A'); // Força visualização no Bloco A onde o resultado está
      setHasUnsavedChanges(true);
    } catch (error: any) {
      alert(`Erro no Gemini: ${error.message}`);
      console.error(error);
    } finally {
      setIsAISuggesting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Prescrição */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 glass-card p-6">
        <div className="flex-1 space-y-4">
          <label className="text-sm font-bold text-surface-400 uppercase tracking-wider flex items-center gap-2">
            Selecionar Aluno 
            {isLoadingTreino && <Loader2 className="w-3 h-3 animate-spin text-brand-medium" />}
          </label>
          <select 
            className="input-field text-xl font-display text-brand-dark"
            value={selectedAlunoId}
            onChange={(e) => setSelectedAlunoId(e.target.value)}
          >
            <option value="">Selecione um aluno...</option>
            {alunos.map(a => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
          {selectedAluno && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex gap-4 text-xs font-medium">
                <div className="bg-surface-100 text-surface-600 px-3 py-1.5 rounded-lg flex items-center gap-2" title="Mês estipulado para a renovação">
                  <Calendar className="w-3.5 h-3.5 text-brand-medium" />
                  Renovação: <span className="text-brand-dark font-bold">{selectedAluno.mes_renovacao || '---'}</span>
                </div>
                <div className="bg-surface-100 text-surface-600 px-3 py-1.5 rounded-lg flex items-center gap-2" title="Data da última vez que uma ficha foi salva para este aluno">
                  <Clock className="w-3.5 h-3.5 text-brand-medium" />
                  Última Ficha: <span className="text-brand-dark font-bold">
                    {lastSavedAt ? new Date(lastSavedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' }) : 'Sem registro'}
                  </span>
                </div>
              </div>
              
              {selectedAluno.restricoes && selectedAluno.restricoes.toLowerCase() !== 'none' && (
                <div className="flex flex-wrap gap-1 border-t border-surface-200/50 pt-2 mt-1">
                  <span className="text-[10px] uppercase font-bold text-red-500 mr-2 flex items-center">Atenção:</span>
                  {selectedAluno.restricoes.split(',').map((rest, i) => (
                    <span key={i} className="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                      {rest.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-2 w-full md:w-auto">
            {/* Status badge — padrão Google Docs / Notion */}
            {selectedAlunoId && (
              <div className="flex justify-center">
                {hasUnsavedChanges ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block"></span>
                    Alterações não salvas
                  </span>
                ) : lastSavedAt ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                    Salvo — {new Date(lastSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"></span>
                    Nova ficha — sem registro
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button 
                onClick={handleAISuggestion}
                disabled={!selectedAlunoId || isAISuggesting}
                className="btn-secondary !bg-brand-dark/5 !text-brand-dark border-none hover:!bg-brand-dark hover:!text-white disabled:opacity-50 flex-1 md:flex-none md:min-w-[160px]"
              >
                {isAISuggesting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Pensando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    IA Gemini
                  </>
                )}
              </button>
              <button 
                className={clsx(
                  "btn-primary flex-1 md:flex-none md:min-w-[160px] transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                  hasUnsavedChanges && "ring-2 ring-brand-medium ring-offset-2"
                )}
                disabled={!selectedAlunoId || isSaving || !hasUnsavedChanges}
                title={!hasUnsavedChanges ? "Nenhuma alteração para salvar" : "Salvar as alterações da ficha"}
                onClick={handleSalvarTreino}
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSaving ? 'Salvando...' : 'Salvar Ficha'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto justify-end">
            <button 
              onClick={handleExportPDF}
              disabled={!selectedAlunoId || !lastSavedAt || hasUnsavedChanges}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              title={hasUnsavedChanges ? "Salve as alterações para habilitar a impressão" : "Exportar PDF A4 para Impressão"}
            >
              <FileDown className="w-4 h-4" />
              Imprimir
            </button>
            <button 
              onClick={handleCopyMobileLink}
              disabled={!selectedAlunoId || !lastSavedAt || copyingLink || hasUnsavedChanges}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
              title={hasUnsavedChanges ? "Salve as alterações para habilitar o compartilhamento" : "Copiar Link para o Aluno ver no Celular"}
            >
              {copyingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              Ficha Mobile
            </button>
            {selectedAlunoId && lastSavedAt && !hasUnsavedChanges && (
              <a 
                href={`/meutreino/${selectedAlunoId}`} 
                target="_blank" 
                rel="noreferrer"
                className="p-2.5 bg-brand-light text-brand-medium rounded-xl hover:bg-brand-medium hover:text-white transition-all shadow-sm"
                title="Prévisualizar Ficha Mobile"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Selector de Treino */}
      <div className="flex gap-2 bg-brand-dark/5 p-1.5 rounded-2xl w-fit">
        {['A', 'B', 'C'].map((b, index) => (
          <button
            key={b}
            onClick={() => setBloco(b as any)}
            className={clsx(
              "px-8 py-2.5 rounded-xl font-bold transition-all",
              bloco === b ? "bg-brand-dark text-white shadow-lg shadow-brand-dark/20" : "text-surface-500 hover:text-brand-dark"
            )}
          >
            Treino {index + 1}
          </button>
        ))}
      </div>

      {/* Lista de Exercícios */}
      <div className="space-y-4">
        {treino.length > 0 ? treino.map((ex) => (
          <div key={ex.id} className="glass-card p-4 group animate-slide-up">
            <div className="flex items-center gap-6">
              <GripVertical className="w-5 h-5 text-surface-200 cursor-grab" />
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={clsx(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    ex.tipo === 'FIXO' ? "bg-green-100 text-green-700" : 
                    ex.tipo === 'AQUEC' ? "bg-blue-100 text-blue-700" : 
                    "bg-yellow-100 text-yellow-700"
                  )}>
                    {ex.tipo}
                  </span>
                  <input 
                    type="text"
                    list="exercicios-lista"
                    value={ex.nome}
                    onChange={(e) => {
                      const newTreino = [...treino];
                      const idx = newTreino.findIndex(t => t.id === ex.id);
                      if (idx !== -1) {
                        newTreino[idx].nome = e.target.value;
                        // Auto-preencher o tipo se o exercício existir no banco
                        const found = exercicios.find(bdEx => bdEx.nome.toLowerCase() === e.target.value.toLowerCase());
                        if (found) {
                          newTreino[idx].tipo = (found.tipo as 'FIXO' | 'ROTATIVO' | 'AQUEC') || 'ROTATIVO';
                        }
                        setTreino(newTreino);
                      }
                    }}
                    placeholder="Nome do exercício..."
                    className="font-bold text-brand-dark bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-base w-full max-w-[300px]"
                  />
                </div>
                {ex.justificativa && (
                  <div className="flex items-start gap-2 text-xs text-brand-medium bg-brand-light/5 p-2 rounded-lg italic">
                    <Sparkles className="w-3 h-3 mt-0.5" />
                    <span>Gemini: {ex.justificativa}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold text-surface-400 mb-1">Séries</p>
                  <input 
                    type="number" 
                    value={ex.series} 
                    onChange={(e) => {
                      const newTreino = [...treino];
                      const idx = newTreino.findIndex(t => t.id === ex.id);
                      if (idx !== -1) {
                        newTreino[idx].series = parseInt(e.target.value) || 0;
                        setTreino(newTreino);
                      }
                    }}
                    className="w-12 text-center font-bold text-brand-dark border-b border-surface-200 focus:border-brand-medium outline-none" 
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold text-surface-400 mb-1">Reps</p>
                  <input 
                    type="text" 
                    value={ex.reps} 
                    onChange={(e) => {
                      const newTreino = [...treino];
                      const idx = newTreino.findIndex(t => t.id === ex.id);
                      if (idx !== -1) {
                        newTreino[idx].reps = e.target.value;
                        setTreino(newTreino);
                      }
                    }}
                    className="w-20 text-center font-bold text-brand-dark border-b border-surface-200 focus:border-brand-medium outline-none" 
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold text-surface-400 mb-1">Carga</p>
                  <input 
                    type="text" 
                    value={ex.carga} 
                    onChange={(e) => {
                      const newTreino = [...treino];
                      const idx = newTreino.findIndex(t => t.id === ex.id);
                      if (idx !== -1) {
                        newTreino[idx].carga = e.target.value;
                        setTreino(newTreino);
                      }
                    }}
                    className="w-16 text-center font-bold text-brand-dark border-b border-surface-200 focus:border-brand-medium outline-none" 
                  />
                </div>
                <button 
                  onClick={() => setTreino(treino.filter(t => t.id !== ex.id))}
                  className="p-2 text-surface-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )) : (
          <div className="px-6 py-20 text-center border-2 border-dashed border-surface-200 rounded-3xl text-surface-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">Nenhum exercício neste treino.</p>
            <p className="text-sm">Selecione um aluno e use o Gemini para começar.</p>
          </div>
        )}

        <button 
          onClick={() => setTreino([...treino, { id: Math.random().toString(), nome: '', tipo: 'ROTATIVO', series: 3, reps: '12', carga: '0' }])}
          className="w-full py-4 border-2 border-dashed border-surface-200 rounded-2xl text-surface-400 hover:border-brand-dark hover:text-brand-dark transition-all flex items-center justify-center gap-2 font-bold group"
        >
          <Plus className="w-5 h-5 group-hover:scale-120 transition-transform" />
          Adicionar Exercício Manualmente
        </button>

        {/* Datalist invisível usado pelo Autocomplete do Input */}
        <datalist id="exercicios-lista">
          {exercicios.map(ex => (
            <option key={ex.id} value={ex.nome} />
          ))}
        </datalist>
      </div>
    </div>
  );
};

import { ClipboardList } from 'lucide-react';
