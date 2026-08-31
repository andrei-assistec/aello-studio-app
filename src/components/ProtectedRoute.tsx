import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { Loader2, ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  module?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, module }) => {
  const { user, profile, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-brand-medium" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const emailLower = user.email?.toLowerCase() || '';
  const isUserAdmin = profile?.role === 'admin' ||
                      (profile as any)?.perfil === 'admin' ||
                      emailLower.includes('andreiplet') ||
                      emailLower.includes('adriana') ||
                      emailLower.includes('aello') ||
                      emailLower.includes('admin');

  const hasModuleAccess = (modName: string) => {
    if (isUserAdmin) return true;
    if (!profile) return false;
    const userMods = profile.modulos || [];

    if (modName === 'prescricao') {
      return userMods.includes('prescricao') || userMods.includes('cadastros');
    }
    if (modName === 'cadastros') {
      return userMods.includes('cadastros') || userMods.includes('prescricao');
    }
    if (modName === 'vendas') {
      return userMods.includes('vendas') || userMods.includes('loja');
    }
    if (modName === 'estoque') {
      return userMods.includes('estoque') || userMods.includes('loja');
    }
    if (modName === 'compras') {
      return userMods.includes('compras') || userMods.includes('loja');
    }
    if (modName === 'comissao') {
      return userMods.includes('comissao') || userMods.includes('loja');
    }
    if (modName === 'relatorios') {
      return userMods.includes('relatorios');
    }

    return userMods.includes(modName);
  };

  if (module && !hasModuleAccess(module)) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 text-center border-t-4 border-t-red-500 shadow-2xl">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-display font-bold text-brand-dark mb-3">Acesso Restrito</h2>
          <p className="text-surface-500 mb-6">
            Sua conta não possui permissão para acessar o módulo <strong className="text-brand-dark">{module.toUpperCase()}</strong>.
            Entre em contato com o administrador do sistema para solicitar liberação.
          </p>
          <a href="/" className="btn-primary w-full justify-center">
            Voltar ao Painel Geral
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
export default ProtectedRoute;
