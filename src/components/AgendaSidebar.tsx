import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Users, 
  LogOut,
  ChevronRight,
  Grid
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { logActivity } from '../services/logger';
import { clsx } from 'clsx';

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}

const SidebarItem = ({ to, icon, label, end }: SidebarItemProps) => (
  <NavLink 
    to={to} 
    end={end}
    className={({ isActive }) => clsx("nav-link", isActive && "active")}
  >
    {icon}
    <span className="flex-1">{label}</span>
    <ChevronRight className="w-4 h-4 opacity-0 transition-opacity group-hover:opacity-100" />
  </NavLink>
);

export const AgendaSidebar = () => {
  const navigate = useNavigate();

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-white border-r border-surface-200 flex flex-col z-50">
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold leading-tight text-brand-dark">Aello Studio</h1>
            <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Agenda & Aulas</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-8 flex flex-col gap-2">
        <SidebarItem to="/agenda" end icon={<Calendar className="w-5 h-5" />} label="Calendário de Aulas" />
        <SidebarItem to="/agenda/configuracao" icon={<Clock className="w-5 h-5" />} label="Configurar Horários" />
        <SidebarItem to="/agenda/agendamentos" icon={<Users className="w-5 h-5" />} label="Agendamentos" />
        <SidebarItem to="/agenda/profissionais" icon={<Users className="w-5 h-5" />} label="Profissionais" />
      </nav>

      <div className="p-4 border-t border-surface-100 flex flex-col gap-2">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-surface-600 hover:bg-surface-100 transition-all font-medium text-sm"
        >
          <Grid className="w-5 h-5 text-surface-500" />
          <span>Painel de Módulos</span>
        </button>

        <button 
          onClick={async () => {
            await logActivity({
              action: 'LOGOUT',
              resource_type: 'auth',
              details: 'Usuário encerrou a sessão a partir do menu lateral da Agenda'
            });
            auth.signOut();
            navigate('/login');
          }}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium text-sm"
        >
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
};
export default AgendaSidebar;
