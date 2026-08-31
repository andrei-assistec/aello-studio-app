export interface PermissaoItem {
  id: string;
  label: string;
  escopos?: ('proprios' | 'proprias' | 'propria' | 'todos' | 'todas' | 'ate_limite' | 'livre')[];
  critica?: boolean;
}

export interface PermissaoGrupo {
  id: string;
  nome: string;
  perms: PermissaoItem[];
}

export const CATALOGO: PermissaoGrupo[] = [
  {
    id: 'alunos',
    nome: 'Alunos',
    perms: [
      { id: 'alunos.ver', label: 'Ver alunos', escopos: ['proprios', 'todos'] },
      { id: 'alunos.criar', label: 'Cadastrar aluno' },
      { id: 'alunos.editar', label: 'Editar aluno', escopos: ['proprios', 'todos'] },
      { id: 'alunos.desativar', label: 'Desativar matrícula', critica: true },
      { id: 'alunos.ver_contato', label: 'Ver telefone e CPF' },
      { id: 'alunos.ver_restricoes', label: 'Ver restrições médicas' },
    ]
  },
  {
    id: 'agenda',
    nome: 'Agenda',
    perms: [
      { id: 'agenda.ver', label: 'Ver agenda', escopos: ['propria', 'todas'] },
      { id: 'agenda.lancar', label: 'Lançar aula e presença' },
      { id: 'agenda.editar_fixos', label: 'Alterar horários fixos' },
      { id: 'agenda.reposicao', label: 'Marcar reposição' },
    ]
  },
  {
    id: 'financeiro',
    nome: 'Financeiro',
    perms: [
      { id: 'financeiro.receitas_ver', label: 'Ver contas a receber', escopos: ['proprias', 'todas'] },
      { id: 'financeiro.receitas_baixar', label: 'Registrar pagamento' },
      { id: 'financeiro.receitas_criar', label: 'Lançar receita avulsa' },
      { id: 'financeiro.desconto_mensalidade', label: 'Desconto em mensalidade', critica: true },
      { id: 'financeiro.despesas_ver', label: 'Ver contas a pagar', critica: true },
      { id: 'financeiro.despesas_lancar', label: 'Lançar despesa', critica: true },
      { id: 'financeiro.caixa', label: 'Ver fluxo de caixa', critica: true },
      { id: 'financeiro.conciliacao', label: 'Conciliação bancária', critica: true },
      { id: 'financeiro.prolabore', label: 'Pró-labore', critica: true },
      { id: 'financeiro.estorno', label: 'Devolver dinheiro ao cliente', critica: true },
    ]
  },
  {
    id: 'comissao',
    nome: 'Comissão',
    perms: [
      { id: 'comissao.ver', label: 'Ver comissão', escopos: ['propria', 'todas'] },
      { id: 'comissao.configurar', label: 'Configurar percentuais', critica: true },
      { id: 'comissao.fechar', label: 'Fechar competência', critica: true },
    ]
  },
  {
    id: 'vendas',
    nome: 'Vendas',
    perms: [
      { id: 'vendas.ver', label: 'Ver vendas', escopos: ['proprias', 'todas'] },
      { id: 'vendas.criar', label: 'Registrar venda' },
      { id: 'vendas.a_prazo', label: 'Vender a prazo' },
      { id: 'vendas.desconto', label: 'Conceder desconto', escopos: ['ate_limite', 'livre'] },
      { id: 'vendas.devolucao', label: 'Registrar devolução ou troca' },
      { id: 'vendas.credito_conceder', label: 'Conceder crédito na loja' },
      { id: 'vendas.cancelar', label: 'Cancelar venda', critica: true },
      { id: 'vendas.solicitar_cancelamento', label: 'Solicitar cancelamento' },
    ]
  },
  {
    id: 'estoque',
    nome: 'Estoque',
    perms: [
      { id: 'estoque.ver', label: 'Consultar estoque e preço' },
      { id: 'estoque.ver_custo', label: 'Ver custo e margem', critica: true },
      { id: 'estoque.criar_produto', label: 'Cadastrar produto', critica: true },
      { id: 'estoque.editar_produto', label: 'Editar produto', critica: true },
      { id: 'estoque.ajustar', label: 'Ajustar saldo', critica: true },
      { id: 'estoque.etiquetas', label: 'Imprimir etiquetas' },
    ]
  },
  {
    id: 'compras',
    nome: 'Compras',
    perms: [
      { id: 'compras.ver', label: 'Ver compras', critica: true },
      { id: 'compras.lancar', label: 'Lançar compra', critica: true },
      { id: 'compras.importar_xml', label: 'Importar XML de NF-e', critica: true },
    ]
  },
  {
    id: 'prescricao',
    nome: 'Treinos',
    perms: [
      { id: 'prescricao.ver', label: 'Ver prescrições', escopos: ['proprias', 'todas'] },
      { id: 'prescricao.criar', label: 'Prescrever treino' },
      { id: 'prescricao.avaliacao', label: 'Registrar avaliação física' },
      { id: 'prescricao.ia', label: 'Usar motor de IA' },
    ]
  },
  {
    id: 'cadastros',
    nome: 'Cadastros',
    perms: [
      { id: 'cadastros.planos', label: 'Editar planos e valores', critica: true },
      { id: 'cadastros.plano_contas', label: 'Editar plano de contas', critica: true },
      { id: 'cadastros.funcionarios', label: 'Editar funcionários', critica: true },
      { id: 'cadastros.exercicios', label: 'Editar banco de exercícios' },
      { id: 'cadastros.equipamentos', label: 'Editar equipamentos' },
    ]
  },
  {
    id: 'sistema',
    nome: 'Sistema',
    perms: [
      { id: 'sistema.usuarios', label: 'Gerenciar usuários e permissões', critica: true },
      { id: 'sistema.relatorios', label: 'Relatórios gerenciais', critica: true },
      { id: 'sistema.dashboard', label: 'Dashboard geral', critica: true },
    ]
  },
];

export type PerfilUsuario = 'admin' | 'instrutor';

export type PermissaoValor = boolean | { escopo: string };

export type MapaPermissoes = Record<string, PermissaoValor>;

export const PERMISSOES_INSTRUTOR_PADRAO: MapaPermissoes = {
  'alunos.ver': { escopo: 'proprios' },
  'alunos.editar': { escopo: 'proprios' },
  'alunos.ver_contato': true,
  'alunos.ver_restricoes': true,

  'agenda.ver': { escopo: 'propria' },
  'agenda.lancar': true,
  'agenda.reposicao': true,

  'financeiro.receitas_ver': { escopo: 'proprias' },
  'financeiro.receitas_baixar': true,

  'comissao.ver': { escopo: 'propria' },

  'vendas.ver': { escopo: 'proprias' },
  'vendas.criar': true,
  'vendas.a_prazo': true,
  'vendas.desconto': { escopo: 'ate_limite' },
  'vendas.devolucao': true,
  'vendas.credito_conceder': true,
  'vendas.solicitar_cancelamento': true,

  'estoque.ver': true,
  'estoque.etiquetas': true,

  'prescricao.ver': { escopo: 'proprias' },
  'prescricao.criar': true,
  'prescricao.avaliacao': true,
  'prescricao.ia': true,
};
