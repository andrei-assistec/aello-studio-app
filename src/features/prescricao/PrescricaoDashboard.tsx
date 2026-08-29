import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../hooks/useFirestore';
import type { Aluno } from '../../types/database';
import { 
  ClipboardList, 
  Users, 
  BarChart3, 
  Settings, 
  Calendar 
} from 'lucide-react';

const StatCard = ({ label, value, change, icon }: { label: string, value: string, change: string, icon: React.ReactNode }) => (
  <div className="glass-card p-6 border-l-4 border-l-brand-medium hover:translate-y-[-4px] transition-all cursor-default">
    <div className="flex justify-between items-start mb-4">
      <p className="text-sm font-medium text-surface-400">{label}</p>
      <div className="p-2 bg-brand-dark/5 rounded-lg text-brand-medium">
        {icon}
      </div>
    </div>
    <h4 className="text-3xl font-display text-brand-dark mb-2">{value}</h4>
    <p className="text-xs text-brand-medium font-semibold">{change}</p>
  </div>
);

export const PrescricaoDashboard = () => {
  const { data: alunos } = useCollection<Aluno>('alunos');
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Olá, Adriana! 👋</h2>
          <p className="text-surface-500">Aqui está o que está acontecendo no seu studio hoje.</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/prescricao/motor')}>
          <ClipboardList className="w-5 h-5" />
          Prescrever Novo Treino
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard label="Alunos Ativos" value={alunos.length.toString()} icon={<Users className="w-5 h-5" />} change="+2 este mês" />
        <StatCard label="Treinos Prescritos" value="12" icon={<ClipboardList className="w-5 h-5" />} change="Meta: 20" />
        <StatCard label="Renovações" value="04" icon={<Calendar className="w-5 h-5" />} change="Próximos 30 dias" />
        <StatCard label="Média RPE" value="7.4" icon={<BarChart3 className="w-5 h-5" />} change="Intensidade ideal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-medium" />
            Últimos Alunos Atendidos
          </h3>
          <div className="space-y-4">
            {[
              { name: 'Andrei Pletsch', workout: 'Treino A', time: 'Há 2 horas', initials: 'AP' },
              { name: 'Mariana Souza', workout: 'Treino B', time: 'Há 5 horas', initials: 'MS' },
              { name: 'Roberto Silva', workout: 'Treino C', time: 'Ontem', initials: 'RS' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-50 transition-all border border-transparent hover:border-surface-200 group">
                <div className="w-12 h-12 bg-brand-dark/5 rounded-full flex items-center justify-center text-brand-dark font-bold group-hover:bg-brand-dark group-hover:text-white transition-colors">
                  {item.initials}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-brand-dark">{item.name}</p>
                  <p className="text-sm text-surface-400">{item.workout} • {item.time}</p>
                </div>
                <div className="text-right text-sm">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">Concluído</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-medium" />
            Próximas Renovações
          </h3>
          <div className="space-y-4">
            {[
              { name: 'Mariana Souza', days: 5, month: 'Janeiro' },
              { name: 'Juliana Costa', days: 12, month: 'Janeiro' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 group cursor-pointer">
                <div className="w-1.5 h-12 bg-brand-medium rounded-full opacity-30 group-hover:opacity-100 group-hover:bg-red-400 transition-all" />
                <div>
                  <p className="font-semibold text-brand-dark leading-none mb-1 group-hover:text-brand-medium transition-colors">{item.name}</p>
                  <p className="text-xs text-surface-400">Vence em {item.days} dias • {item.month}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 btn-secondary text-sm" onClick={() => navigate('/prescricao/alunos')}>
            Ver Todas as Renovações
          </button>
        </div>
      </div>
    </div>
  );
};
export default PrescricaoDashboard;
