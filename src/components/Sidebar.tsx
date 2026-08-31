import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  DollarSign, 
  ChevronRight,
  LogOut,
  ClipboardList,
  Settings,
  LayoutDashboard,
  BarChart3,
  X,
  FolderPlus,
  ShoppingBag
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { logActivity } from '../services/logger';
import { useUser } from '../contexts/UserContext';
import { usePermissao } from '../hooks/usePermissao';
import { clsx } from 'clsx';

const SidebarSubItem = ({ to, label, end, onClick }: { to: string; label: string; end?: boolean; onClick?: () => void }) => (
  <NavLink 
    to={to} 
    end={end}
    onClick={onClick}
    className={({ isActive }) => clsx(
      "flex items-center pl-8 pr-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all",
      isActive 
        ? "text-brand-medium bg-brand-medium/10 border-l-2 border-brand-medium pl-[30px]" 
        : "text-surface-500 hover:text-brand-dark hover:bg-surface-50 border-l border-surface-200"
    )}
  >
    {label}
  </NavLink>
);

const SidebarGroupHeader = ({ 
  label, 
  icon, 
  isExpanded, 
  isActive,
  onClick 
}: { 
  label: string; 
  icon: React.ReactNode; 
  isExpanded: boolean; 
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={clsx(
      "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all font-semibold text-xs cursor-pointer group",
      isActive 
        ? "bg-brand-dark/5 text-brand-dark font-bold border-l-3 border-brand-medium pl-2.5" 
        : "text-surface-600 hover:bg-surface-100 hover:text-brand-dark"
    )}
  >
    <div className="flex items-center gap-2.5">
      <div className={clsx(isActive ? "text-brand-medium" : "text-surface-400 group-hover:text-brand-dark")}>
        {icon}
      </div>
      <span>{label}</span>
    </div>
    <div className={clsx("transition-transform duration-200", isExpanded && "rotate-90")}>
      <ChevronRight className="w-3.5 h-3.5 text-surface-400" />
    </div>
  </button>
);

export const Sidebar = ({ 
  isMobileOpen = false, 
  onMobileClose 
}: { 
  isMobileOpen?: boolean; 
  onMobileClose?: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUser();
  const path = location.pathname;

  const isCadastrosActive = path.startsWith('/cadastros') || 
    path.startsWith('/prescricao/alunos') || 
    path.startsWith('/prescricao/exercicios') || 
    path.startsWith('/prescricao/equipamentos') || 
    path.startsWith('/mensalidades/planos') || 
    path.startsWith('/financeiro/funcionarios') || 
    path.startsWith('/financeiro/planodecontas');

  const isFinanceiroActive = path.startsWith('/financeiro') && 
    !path.startsWith('/financeiro/funcionarios') && 
    !path.startsWith('/financeiro/planodecontas');

  const isPrescricaoActive = (path.startsWith('/prescricao') && 
    !path.startsWith('/prescricao/alunos') && 
    !path.startsWith('/prescricao/exercicios') && 
    !path.startsWith('/prescricao/equipamentos')) || path === '/prescricao';

  const isMensalidadesActive = path.startsWith('/mensalidades') && !path.startsWith('/mensalidades/planos');

  const isLojaActive = path.startsWith('/vendas') || 
    path.startsWith('/estoque') || 
    path.startsWith('/compras') || 
    path.startsWith('/comissoes');

  const isRelatoriosActive = path.startsWith('/relatorios');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    agenda: path.startsWith('/agenda'),
    cadastros: isCadastrosActive,
    financeiro: isFinanceiroActive,
    mensalidades: isMensalidadesActive,
    prescricao: isPrescricaoActive,
    loja: isLojaActive,
    relatorios: isRelatoriosActive
  });

  const toggleGroup = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (path.startsWith('/agenda')) {
      setExpanded(prev => ({ ...prev, agenda: true }));
    } else if (isCadastrosActive) {
      setExpanded(prev => ({ ...prev, cadastros: true }));
    } else if (isFinanceiroActive) {
      setExpanded(prev => ({ ...prev, financeiro: true }));
    } else if (isMensalidadesActive) {
      setExpanded(prev => ({ ...prev, mensalidades: true }));
    } else if (isPrescricaoActive) {
      setExpanded(prev => ({ ...prev, prescricao: true }));
    } else if (isLojaActive) {
      setExpanded(prev => ({ ...prev, loja: true }));
    } else if (isRelatoriosActive) {
      setExpanded(prev => ({ ...prev, relatorios: true }));
    }
  }, [path]);

  const { ehAdmin: isAclAdmin, pode } = usePermissao();

  const emailLower = profile?.email?.toLowerCase() || auth.currentUser?.email?.toLowerCase() || '';
  const isUserAdmin = isAclAdmin ||
                      profile?.role === 'admin' ||
                      (profile as any)?.perfil === 'admin' ||
                      emailLower.includes('andreiplet') ||
                      emailLower.includes('adriana') ||
                      emailLower.includes('aello') ||
                      emailLower.includes('admin');

  const hasAccess = (moduleName: string) => {
    if (isUserAdmin) return true;
    if (moduleName === 'vendas' || moduleName === 'loja') return pode('vendas.ver') || pode('estoque.ver');
    if (moduleName === 'estoque') return pode('estoque.ver');
    if (moduleName === 'compras') return pode('compras.ver');
    if (moduleName === 'comissao') return pode('comissao.ver');
    if (moduleName === 'cadastros') return pode('alunos.ver');
    if (moduleName === 'relatorios') return pode('relatorios.ver');
    return profile?.modulos?.includes(moduleName) || false;
  };

  const handleLinkClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <aside className={clsx(
      "fixed left-0 top-0 h-screen w-64 bg-white border-r border-surface-200 flex flex-col z-50 overflow-hidden transition-transform duration-300 lg:translate-x-0 shadow-sm",
      isMobileOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Header Compacto */}
      <div className="p-3 pb-2 flex items-center justify-between border-b border-surface-100">
        <div className="flex items-center gap-2.5 px-1">
          <img 
            src="/icons/icon-192.png" 
            className="w-8 h-8 object-contain rounded-full shadow-sm shadow-brand-dark/20 border border-brand-dark/10" 
            alt="Aello Studio Logo" 
          />
          <div>
            <h1 className="text-base font-display font-bold leading-tight text-brand-dark">Aello Studio</h1>
            <p className="text-[9px] uppercase tracking-wider text-surface-400 font-bold">Gestão Studio</p>
          </div>
        </div>
        {onMobileClose && (
          <button 
            onClick={onMobileClose}
            className="lg:hidden p-1.5 text-surface-400 hover:text-brand-dark hover:bg-surface-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navegação Compacta */}
      <nav className="flex-1 px-2.5 py-3 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar">
        
        {/* 1. Dashboard Geral (Nomenclatura padronizada: Dashboard) */}
        <NavLink
          to="/"
          onClick={handleLinkClick}
          className={({ isActive }) => clsx(
            "flex items-center px-3 py-2 rounded-lg transition-all font-semibold text-xs cursor-pointer group",
            isActive 
              ? "bg-brand-dark/5 text-brand-dark font-bold border-l-3 border-brand-medium pl-2.5" 
              : "text-surface-600 hover:bg-surface-100 hover:text-brand-dark"
          )}
        >
          {({ isActive }) => (
            <div className="flex items-center gap-2.5 flex-1">
              <div className={clsx(isActive ? "text-brand-medium" : "text-surface-400 group-hover:text-brand-dark")}>
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span>Dashboard Geral</span>
            </div>
          )}
        </NavLink>

        {/* 2. Agenda (Renomeado para Agenda e posicionado em 2º lugar, abaixo do Dashboard Geral) */}
        {hasAccess('agenda') && (
          <div className="space-y-0.5">
            <SidebarGroupHeader 
              label="Agenda"
              icon={<Calendar className="w-4 h-4" />}
              isExpanded={expanded.agenda}
              isActive={path.startsWith('/agenda')}
              onClick={() => toggleGroup('agenda')}
            />
            {expanded.agenda && (
              <div className="pl-1 space-y-0.5 animate-fade-in">
                <SidebarSubItem to="/agenda" end label="Calendário de Aulas" onClick={handleLinkClick} />
                <SidebarSubItem to="/agenda/agendamentos" label="Agendamentos" onClick={handleLinkClick} />
                <SidebarSubItem to="/agenda/saldo-aulas" label="Controle de Saldo de Aulas" onClick={handleLinkClick} />
                <SidebarSubItem to="/agenda/configuracao" label="Configurar Horários" onClick={handleLinkClick} />
              </div>
            )}
          </div>
        )}

        {/* 3. Cadastros */}
        {hasAccess('cadastros') && (
          <div className="space-y-0.5">
            <SidebarGroupHeader 
              label="Cadastros"
              icon={<FolderPlus className="w-4 h-4" />}
              isExpanded={expanded.cadastros}
              isActive={isCadastrosActive}
              onClick={() => toggleGroup('cadastros')}
            />
            {expanded.cadastros && (
              <div className="pl-1 space-y-0.5 animate-fade-in">
                <SidebarSubItem to="/prescricao/alunos" label="Cadastro de Alunos" onClick={handleLinkClick} />
                {hasAccess('admin') && <SidebarSubItem to="/financeiro/funcionarios" label="Colaboradores & Profissionais" onClick={handleLinkClick} />}
                {hasAccess('admin') && <SidebarSubItem to="/mensalidades/planos" label="Planos & Valores" onClick={handleLinkClick} />}
                {hasAccess('admin') && <SidebarSubItem to="/financeiro/planodecontas" label="Plano de Contas" onClick={handleLinkClick} />}
                <SidebarSubItem to="/prescricao/exercicios" label="Banco de Exercícios" onClick={handleLinkClick} />
                <SidebarSubItem to="/prescricao/equipamentos" label="Equipamentos" onClick={handleLinkClick} />
              </div>
            )}
          </div>
        )}

        {/* 4. Financeiro */}
        {hasAccess('financeiro') && (
          <div className="space-y-0.5">
            <SidebarGroupHeader 
              label="Financeiro"
              icon={<DollarSign className="w-4 h-4" />}
              isExpanded={expanded.financeiro}
              isActive={isFinanceiroActive}
              onClick={() => toggleGroup('financeiro')}
            />
            {expanded.financeiro && (
              <div className="pl-1 space-y-0.5 animate-fade-in">
                <SidebarSubItem to="/financeiro" end label="Dashboard Financeiro" onClick={handleLinkClick} />
                <SidebarSubItem to="/financeiro/receitas" label="Contas a Receber" onClick={handleLinkClick} />
                <SidebarSubItem to="/financeiro/despesas" label="Contas a Pagar" onClick={handleLinkClick} />
                <SidebarSubItem to="/financeiro/caixa" label="Fluxo de Caixa" onClick={handleLinkClick} />
                <SidebarSubItem to="/financeiro/contas-fixas" label="Contas Fixas" onClick={handleLinkClick} />
                <SidebarSubItem to="/financeiro/prolabore" label="Pro Labore" onClick={handleLinkClick} />
                <SidebarSubItem to="/financeiro/folha" label="Comissões" onClick={handleLinkClick} />
                <SidebarSubItem to="/financeiro/conciliacao" label="Conciliação Bancária" onClick={handleLinkClick} />
              </div>
            )}
          </div>
        )}

        {/* 5. Prescrição de Treinos */}
        {hasAccess('prescricao') && (
          <div className="space-y-0.5">
            <SidebarGroupHeader 
              label="Prescrição de Treinos"
              icon={<ClipboardList className="w-4 h-4" />}
              isExpanded={expanded.prescricao}
              isActive={isPrescricaoActive}
              onClick={() => toggleGroup('prescricao')}
            />
            {expanded.prescricao && (
              <div className="pl-1 space-y-0.5 animate-fade-in">
                <SidebarSubItem to="/prescricao" end label="Dashboard Treinos" onClick={handleLinkClick} />
                <SidebarSubItem to="/prescricao/avaliacao" label="Avaliação Física" onClick={handleLinkClick} />
                <SidebarSubItem to="/prescricao/motor" label="Prescrições" onClick={handleLinkClick} />
                <SidebarSubItem to="/prescricao/importador" label="Importador de PDFs" onClick={handleLinkClick} />
              </div>
            )}
          </div>
        )}

        {/* 6. Loja & Estoque (Grupo Expansível) */}
        {hasAccess('loja') && (
          <div className="space-y-0.5">
            <SidebarGroupHeader 
              label="Loja & Estoque"
              icon={<ShoppingBag className="w-4 h-4" />}
              isExpanded={expanded.loja}
              isActive={isLojaActive}
              onClick={() => toggleGroup('loja')}
            />
            {expanded.loja && (
              <div className="pl-1 space-y-0.5 animate-fade-in">
                {hasAccess('vendas') && <SidebarSubItem to="/vendas" label="Vendas (PDV Balcão)" onClick={handleLinkClick} />}
                {hasAccess('estoque') && <SidebarSubItem to="/estoque" label="Estoque de Produtos" onClick={handleLinkClick} />}
                {hasAccess('compras') && <SidebarSubItem to="/compras" label="Compras & NF-e" onClick={handleLinkClick} />}
                {hasAccess('comissao') && <SidebarSubItem to="/comissoes" label="Comissões sobre Vendas" onClick={handleLinkClick} />}
              </div>
            )}
          </div>
        )}

        {/* 7. Relatórios & Análises (Grupo Expansível) */}
        {hasAccess('relatorios') && (
          <div className="space-y-0.5">
            <SidebarGroupHeader 
              label="Relatórios & Análises"
              icon={<BarChart3 className="w-4 h-4" />}
              isExpanded={expanded.relatorios}
              isActive={isRelatoriosActive}
              onClick={() => toggleGroup('relatorios')}
            />
            {expanded.relatorios && (
              <div className="pl-1 space-y-0.5 animate-fade-in">
                <SidebarSubItem to="/relatorios/estoque-vendas" label="Curva ABC & Giro" onClick={handleLinkClick} />
                <SidebarSubItem to="/relatorios" end label="Relatórios Gerais" onClick={handleLinkClick} />
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Controles do Rodapé */}
      <div className="p-2.5 border-t border-surface-100 flex flex-col gap-1">
        <button 
          onClick={() => { handleLinkClick(); navigate('/configuracoes'); }}
          className={clsx(
            "flex items-center gap-2.5 px-3 py-2 w-full rounded-lg transition-all font-medium text-xs cursor-pointer",
            path.startsWith('/configuracoes')
              ? "bg-brand-dark/5 text-brand-dark font-bold"
              : "text-surface-600 hover:bg-surface-100"
          )}
        >
          <Settings className="w-4 h-4 text-surface-500" />
          <span>Configurações</span>
        </button>

        <button 
          onClick={async () => {
            handleLinkClick();
            await logActivity({
              action: 'LOGOUT',
              resource_type: 'auth',
              details: 'Usuário encerrou a sessão'
            });
            auth.signOut();
            navigate('/login');
          }}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-red-500 hover:bg-red-50 transition-all font-medium text-xs cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
