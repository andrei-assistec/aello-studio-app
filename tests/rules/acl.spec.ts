import { describe, it, expect } from 'vitest';
import { CATALOGO, PERMISSOES_INSTRUTOR_PADRAO } from '../../src/lib/acl/permissoes';

describe('ACL — Validação do Catálogo de Permissões e Regras de Acesso', () => {
  it('Catálogo de permissões deve conter todos os módulos obrigatórios com IDs válidos', () => {
    const modulosEsperados = [
      'alunos', 'agenda', 'financeiro', 'comissao',
      'vendas', 'estoque', 'compras', 'prescricao',
      'cadastros', 'sistema'
    ];

    const idsPresentes = CATALOGO.map(g => g.id);
    modulosEsperados.forEach(modId => {
      expect(idsPresentes).toContain(modId);
    });
  });

  it('Todas as permissões marcadas como critica: true devem estar bloqueadas para o perfil instrutor por padrão', () => {
    const permissoesCriticas: string[] = [];
    CATALOGO.forEach(grupo => {
      grupo.perms.forEach(perm => {
        if (perm.critica) {
          permissoesCriticas.push(perm.id);
        }
      });
    });

    expect(permissoesCriticas.length).toBeGreaterThan(10);

    // Nenhuma permissão crítica deve estar true ou liberada no perfil padrão do instrutor
    permissoesCriticas.forEach(permId => {
      const val = PERMISSOES_INSTRUTOR_PADRAO[permId];
      expect(val).toBeFalsy(); // undefined ou false
    });
  });

  it('Instrutor não deve ter permissão para ver despesas, ver compras ou ver fluxo de caixa', () => {
    expect(PERMISSOES_INSTRUTOR_PADRAO['financeiro.despesas_ver']).toBeFalsy();
    expect(PERMISSOES_INSTRUTOR_PADRAO['financeiro.caixa']).toBeFalsy();
    expect(PERMISSOES_INSTRUTOR_PADRAO['compras.ver']).toBeFalsy();
    expect(PERMISSOES_INSTRUTOR_PADRAO['estoque.ver_custo']).toBeFalsy();
  });

  it('Instrutor deve ter escopo restrito (proprios/proprias) para alunos, receitas, vendas e treinos', () => {
    expect(PERMISSOES_INSTRUTOR_PADRAO['alunos.ver']).toEqual({ escopo: 'proprios' });
    expect(PERMISSOES_INSTRUTOR_PADRAO['financeiro.receitas_ver']).toEqual({ escopo: 'proprias' });
    expect(PERMISSOES_INSTRUTOR_PADRAO['vendas.ver']).toEqual({ escopo: 'proprias' });
    expect(PERMISSOES_INSTRUTOR_PADRAO['prescricao.ver']).toEqual({ escopo: 'proprias' });
  });

  it('Instrutor não deve ter permissão para cancelar vendas ou realizar estornos diretamente', () => {
    expect(PERMISSOES_INSTRUTOR_PADRAO['vendas.cancelar']).toBeFalsy();
    expect(PERMISSOES_INSTRUTOR_PADRAO['financeiro.estorno']).toBeFalsy();
    expect(PERMISSOES_INSTRUTOR_PADRAO['vendas.solicitar_cancelamento']).toBeTruthy();
  });
});
