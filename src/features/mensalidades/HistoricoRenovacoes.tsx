import { useState } from 'react';
import { Search, Calendar, Check, Loader2 } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import type { Renovacao } from '../../types/database';

export const HistoricoRenovacoes = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch renewals history from Firestore
  const { data: historico, loading } = useCollection<Renovacao>('renovacoes', 'created_at', 'desc');

  const filtered = historico.filter(item => 
    item.aluno_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.plano_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Histórico de Renovações 📜</h2>
          <p className="text-surface-500">Histórico de planos contratados e renovações de matrículas.</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="glass-card p-6">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar por nome do aluno ou plano..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-surface-200 rounded-xl py-3 pl-12 pr-4 text-brand-dark focus:ring-2 focus:ring-brand-medium focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>

      {/* Tabela Histórico */}
      <div className="glass-card overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-surface-400">
            <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
            <p>Carregando histórico de renovações...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200 text-surface-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-5">Aluno</th>
                  <th className="p-5">Plano Contratado</th>
                  <th className="p-5">Data Renovação</th>
                  <th className="p-5">Valor Pago</th>
                  <th className="p-5">Operador</th>
                  <th className="p-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm text-surface-600">
                {filtered.length > 0 ? (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="p-5 font-bold text-brand-dark">{item.aluno_nome}</td>
                      <td className="p-5">{item.plano_nome}</td>
                      <td className="p-5">
                        <div className="flex items-center gap-1.5 py-1">
                          <Calendar className="w-4 h-4 text-brand-medium" />
                          {item.data_renovacao ? new Date(item.data_renovacao + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                        </div>
                      </td>
                      <td className="p-5 font-bold text-emerald-600">
                        R$ {item.valor_pago.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="p-5">{item.operador}</td>
                      <td className="p-5">
                        <div className="flex items-center justify-center gap-1 text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-0.5 text-xs font-bold w-fit mx-auto">
                          <Check className="w-3.5 h-3.5" />
                          Concluído
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-surface-400 italic">
                      Nenhum registro de renovação encontrado.
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

export default HistoricoRenovacoes;
