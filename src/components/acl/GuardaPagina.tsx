import React from 'react';
import { usePermissao } from '../../hooks/usePermissao';
import { ShieldAlert } from 'lucide-react';

interface GuardaPaginaProps {
  pode: string;
  children: React.ReactNode;
}

/**
 * Componente de guarda para páginas inteiras.
 * Bloqueia o acesso a rotas quando o usuário não possui permissão.
 */
export const GuardaPagina: React.FC<GuardaPaginaProps> = ({ pode, children }) => {
  const { pode: verificarPode } = usePermissao();

  if (!verificarPode(pode)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-white rounded-xl border border-surface-200 shadow-sm m-4">
        <div className="p-4 bg-amber-50 text-amber-600 rounded-full mb-4 border border-amber-200">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-brand-dark mb-2">Acesso Restrito</h2>
        <p className="text-surface-600 max-w-md text-sm">
          Você não possui permissão para acessar esta seção. Entre em contato com a administração do estúdio se precisar deste acesso.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
