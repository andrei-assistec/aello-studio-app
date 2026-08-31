import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useCollection } from './useFirestore';
import type { Funcionario } from '../types/database';
import { PERMISSOES_INSTRUTOR_PADRAO } from '../lib/acl/permissoes';
import type { PerfilUsuario, MapaPermissoes } from '../lib/acl/permissoes';

export interface UsePermissaoReturn {
  pode: (permissaoId: string) => boolean;
  escopoDe: (permissaoId: string) => string;
  limiteDe: (permissaoId: string) => number;
  ehAdmin: boolean;
  userPerfil: PerfilUsuario;
  userUid: string | null;
  funcionarioAtual: Funcionario | null;
}

export function usePermissao(): UsePermissaoReturn {
  const { user } = useAuth();
  const { data: funcionarios } = useCollection<Funcionario>('funcionarios');

  const userUid = user?.uid || null;

  // Encontra o funcionário associado ao usuário logado
  const funcionarioAtual = useMemo(() => {
    if (!userUid || !funcionarios) return null;
    return funcionarios.find(f => f.uid === userUid || (user?.email && f.email === user.email)) || null;
  }, [userUid, user?.email, funcionarios]);

  // Se o email/token for da Adriana ou perfil === 'admin', ehAdmin = true
  const ehAdmin = useMemo(() => {
    if (!user) return false;
    if (funcionarioAtual?.perfil === 'admin') return true;
    // Fallback de administrador principal
    if (user.email && (user.email.toLowerCase().includes('aello') || user.email.toLowerCase().includes('adriana') || user.email.toLowerCase().includes('admin'))) {
      return true;
    }
    return false;
  }, [user, funcionarioAtual]);

  const userPerfil: PerfilUsuario = ehAdmin ? 'admin' : 'instrutor';

  // Mapa consolidado de permissões para o usuário atual
  const mapaPermissoes = useMemo<MapaPermissoes>(() => {
    if (ehAdmin) {
      return {}; // Admin tem permissão irrestrita total
    }

    // Parte do perfil padrão do instrutor + overrides cadastrados no funcionário
    const base = { ...PERMISSOES_INSTRUTOR_PADRAO };
    if (funcionarioAtual?.overrides_permissoes) {
      Object.assign(base, funcionarioAtual.overrides_permissoes);
    }
    return base;
  }, [ehAdmin, funcionarioAtual]);

  const pode = (permissaoId: string): boolean => {
    if (ehAdmin) return true;

    const val = mapaPermissoes[permissaoId];
    if (val === undefined || val === false) return false;
    if (val === true) return true;
    if (typeof val === 'object' && val !== null) return true;
    return false;
  };

  const escopoDe = (permissaoId: string): string => {
    if (ehAdmin) return 'todos';

    const val = mapaPermissoes[permissaoId];
    if (typeof val === 'object' && val !== null && 'escopo' in val) {
      return (val as any).escopo || 'proprios';
    }
    if (val === true) return 'todos';
    return 'proprios';
  };

  const limiteDe = (permissaoId: string): number => {
    if (ehAdmin) return 100; // Admin sem limite

    if (permissaoId === 'vendas.desconto') {
      return funcionarioAtual?.desconto_venda_teto_pct ?? 0;
    }

    return 0;
  };

  return {
    pode,
    escopoDe,
    limiteDe,
    ehAdmin,
    userPerfil,
    userUid,
    funcionarioAtual
  };
}
