import { useState } from 'react';
import { Search, Plus, Filter, MoreVertical, Dumbbell, Loader2 } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import type { Exercicio } from '../../types/database';

const TIPO_COLORS = {
  FIXO: 'bg-green-100 text-green-700',
  ROTATIVO: 'bg-yellow-100 text-yellow-700',
  AQUEC: 'bg-blue-100 text-blue-700'
};

export const ExerciciosList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: exercicios, loading } = useCollection<Exercicio>('exercicios', 'nome');

  const filteredExercicios = exercicios.filter(ex => 
    ex.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ex.grupo_muscular.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Banco de Exercícios</h2>
          <p className="text-surface-500">
            {loading ? 'Carregando...' : `Gerencie os ${exercicios.length} exercícios cadastrados.`}
          </p>
        </div>
        <button className="btn-primary">
          <Plus className="w-5 h-5" />
          Novo Exercício
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input 
            type="text" 
            placeholder="Buscar por exercício ou grupo muscular..." 
            className="input-field pl-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-secondary flex gap-2">
          <Filter className="w-5 h-5" />
          Filtrar Grupo
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4 glass-card">
          <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
          <p className="font-medium">Sincronizando banco de dados...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExercicios.map((ex) => (
            <div key={ex.id} className="glass-card p-6 hover:shadow-2xl hover:shadow-brand-dark/5 transition-all group animate-fade-in">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-brand-dark/5 rounded-xl text-brand-dark group-hover:bg-brand-dark group-hover:text-white transition-colors">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <button className="p-1 hover:bg-surface-100 rounded-lg text-surface-400">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
              
              <h4 className="text-xl font-bold text-brand-dark mb-1 h-14 overflow-hidden">{ex.nome}</h4>
              <p className="text-sm text-surface-500 mb-4">{ex.grupo_muscular}</p>
              
              <div className="flex flex-wrap gap-2 pt-4 border-t border-surface-100">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${TIPO_COLORS[ex.tipo as keyof typeof TIPO_COLORS] || 'bg-surface-100 text-surface-600'}`}>
                  {ex.tipo || 'PADRÃO'}
                </span>
                <span className="px-3 py-1 bg-surface-100 text-surface-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {ex.nivel}
                </span>
              </div>
            </div>
          ))}
          {filteredExercicios.length === 0 && (
            <div className="col-span-full py-12 text-center text-surface-400">
              Nenhum exercício encontrado para sua busca.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
