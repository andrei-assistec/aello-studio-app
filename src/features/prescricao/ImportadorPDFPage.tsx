import React, { useState } from 'react';
import { Upload, CheckCircle2, Loader2, Dumbbell, Sparkles } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import type { Aluno } from '../../types/database';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';

interface ExtractedExercise {
  id: string;
  nome: string;
  tipo: 'FIXO' | 'ROTATIVO' | 'AQUEC';
  series: number;
  reps: string;
  carga: string;
}

export const ImportadorPDFPage = () => {
  const { data: alunos } = useCollection<Aluno>('alunos', 'nome');
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>('');
  const [pdfText, setPdfText] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [importedStatus, setImportedStatus] = useState<string | null>(null);

  const [extractedTreinos, setExtractedTreinos] = useState<{
    A: ExtractedExercise[];
    B: ExtractedExercise[];
    C: ExtractedExercise[];
  }>({ A: [], B: [], C: [] });

  // Processa o texto extraído do PDF/documento
  const processTextToWorkout = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const treinos: { A: ExtractedExercise[]; B: ExtractedExercise[]; C: ExtractedExercise[] } = { A: [], B: [], C: [] };
    let currentBloco: 'A' | 'B' | 'C' | null = null;

    lines.forEach((line) => {
      if (/^Treino\s+A/i.test(line)) {
        currentBloco = 'A';
      } else if (/^Treino\s+B/i.test(line)) {
        currentBloco = 'B';
      } else if (/^Treino\s+C/i.test(line)) {
        currentBloco = 'C';
      } else if (currentBloco) {
        if (
          !['Treino Muscular', 'Exercício', 'Obs:', 'Nome:', 'Peso:'].includes(line) &&
          !line.startsWith('Serie/') &&
          !line.startsWith('Carga') &&
          !line.startsWith('Data') &&
          !/^\d+x/i.test(line) &&
          line.length > 3
        ) {
          treinos[currentBloco].push({
            id: `ex_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            nome: line,
            tipo: line.toLowerCase().includes('mobilidade') || line.toLowerCase().includes('aquecer') ? 'AQUEC' : 'ROTATIVO',
            series: 3,
            reps: '12',
            carga: '0'
          });
        }
      }
    });

    setExtractedTreinos(treinos);
  };

  const handleTextPaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPdfText(text);
    if (text.length > 10) {
      processTextToWorkout(text);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setImportedStatus(null);

    try {
      // Usar a API nativa FileReader para extrair texto bruto se for arquivo texto/pdf extraído
      const text = await file.text();
      setPdfText(text);
      processTextToWorkout(text);
    } catch (err) {
      console.error("Erro ao ler arquivo:", err);
    }
  };

  const handleSaveImportedWorkout = async () => {
    if (!selectedAlunoId) {
      alert("Por favor, selecione o aluno para vincular a ficha importada.");
      return;
    }

    const alunoObj = alunos.find(a => a.id === selectedAlunoId);
    if (!alunoObj) return;

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      await setDoc(doc(db, 'treinos_ativos', selectedAlunoId), {
        aluno_id: selectedAlunoId,
        aluno_nome: `${alunoObj.nome} ${alunoObj.sobrenome || ''}`.trim(),
        A: extractedTreinos.A,
        B: extractedTreinos.B,
        C: extractedTreinos.C,
        updatedAt: nowIso,
        source: 'Importador Automático Inteligente'
      }, { merge: true });

      await logActivity({
        action: 'UPDATE',
        resource_type: 'prescricao',
        details: `Importou nova ficha de treino via Importador Inteligente para ${alunoObj.nome}`
      });

      setImportedStatus(`Ficha importada com sucesso para ${alunoObj.nome}!`);
      alert(`Treino de ${alunoObj.nome} atualizado com sucesso!`);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar treino importado: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-display text-brand-dark flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-amber-500" />
            Importador Automático de PDFs & Fichas 📄
          </h2>
          <p className="text-surface-500">
            Importe facilmente arquivos de treinos em PDF ou texto para atualizar automaticamente as fichas dos alunos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Painel de Entrada de Arquivo / Texto */}
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-lg font-bold text-brand-dark flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-medium" />
            1. Selecionar Aluno & Conteúdo
          </h3>

          <div>
            <label className="block text-sm font-semibold text-brand-dark mb-1.5">Selecione o Aluno</label>
            <select 
              value={selectedAlunoId}
              onChange={(e) => setSelectedAlunoId(e.target.value)}
              className="input-field"
            >
              <option value="">-- Selecione o Aluno --</option>
              {alunos.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nome} {a.sobrenome || ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-dark mb-1.5">
              Upload de Arquivo (PDF ou TXT)
            </label>
            <input 
              type="file" 
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              className="w-full text-sm text-surface-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-medium/10 file:text-brand-medium hover:file:bg-brand-medium/20 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-dark mb-1.5">
              Ou Cole o Conteúdo do Treino Aqui
            </label>
            <textarea 
              rows={8}
              value={pdfText}
              onChange={handleTextPaste}
              placeholder="Cole o texto copiado do PDF do treino aqui (ex: Treino A, Mobilidade, Puxada...)"
              className="w-full bg-surface-50 border border-surface-200 rounded-xl p-4 text-xs font-mono text-brand-dark focus:ring-2 focus:ring-brand-medium focus:border-transparent outline-none transition-all resize-none"
            />
          </div>
        </div>

        {/* Pré-visualização dos Exercícios Extraídos */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-brand-dark mb-4 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-indigo-600" />
              2. Pré-visualização dos Blocos Identificados
            </h3>

            {importedStatus && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                {importedStatus}
              </div>
            )}

            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {(['A', 'B', 'C'] as const).map(bloco => {
                const exList = extractedTreinos[bloco];
                return (
                  <div key={bloco} className="border border-surface-200 rounded-xl p-4 bg-surface-50">
                    <h4 className="font-bold text-sm text-brand-dark mb-2 flex items-center justify-between">
                      <span>Treino {bloco}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-dark/10 text-brand-dark">
                        {exList.length} exercícios
                      </span>
                    </h4>

                    {exList.length > 0 ? (
                      <ul className="space-y-1 text-xs text-surface-600">
                        {exList.map((ex, idx) => (
                          <li key={idx} className="flex items-center justify-between py-1 border-b border-surface-150 last:border-0">
                            <span className="font-medium text-brand-dark">{ex.nome}</span>
                            <span className="text-surface-400 font-mono">{ex.series}x{ex.reps}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-surface-400 italic">Nenhum exercício identificado para o bloco {bloco}.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-surface-150 mt-6">
            <button
              onClick={handleSaveImportedWorkout}
              disabled={isSaving || !selectedAlunoId || (extractedTreinos.A.length === 0 && extractedTreinos.B.length === 0 && extractedTreinos.C.length === 0)}
              className="btn-primary w-full bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 py-3 text-sm font-bold flex justify-center items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando Ficha no Banco...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Salvar Ficha do Aluno
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
