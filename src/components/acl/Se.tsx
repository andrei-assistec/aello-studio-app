import React from 'react';
import { usePermissao } from '../../hooks/usePermissao';

interface SeProps {
  pode: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Componente de guarda visual para ACL.
 * Renderiza os filhos APENAS se o usuário possuir a permissão especificada.
 * Caso não possua, NÃO renderiza nada (não fica cinza, não fica desabilitado).
 */
export const Se: React.FC<SeProps> = ({ pode, children, fallback = null }) => {
  const { pode: verificarPode } = usePermissao();

  if (!verificarPode(pode)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};
