export type ObjetivoModel = 'hipertrofia' | 'emagrecimento' | 'condicionamento' | 'reabilitação' | 'saúde_geral';
export type TipoExercicio = 'FIXO' | 'ROTATIVO' | 'AQUEC';
export type GrupoMuscular = 
  | 'Quadríceps' | 'Isquiotibial' | 'Glúteo' | 'Adutores' | 'Panturrilha'
  | 'Peito' | 'Costas' | 'Ombros' | 'Bíceps' | 'Tríceps' | 'Abdômen'
  | 'Aquecimento' | 'Mobilidade';

export interface HorarioFixoSlot {
  dia_semana: 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado';
  horario: string; // e.g. "07:00", "08:00", "17:00"
  personal_id?: string;
  personal_nome?: string;
  plano_nome?: string;
  plano_id?: string;
}

export interface PlanoContratadoItem {
  id: string;
  plano_id?: string;
  plano_nome: string;
  valor_mensalidade: number;
  dia_vencimento: number | string;
  personal_id?: string;
  personal_nome?: string;
  frequencia_semanal?: 1 | 2 | 3 | 4 | 5 | number;
  dias_semana?: string[];
  horarios_fixos?: HorarioFixoSlot[];
  modalidade?: 'musculacao' | 'funcional' | 'ambas' | string;
  ativo?: boolean;
}

export interface Aluno {
  id: string;
  nome: string;
  sobrenome?: string;
  cpf?: string;
  telefone?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  data_nascimento: string;
  altura_cm: number;
  peso_kg: number;
  frequencia_semanal: 1 | 2 | 3 | 4 | 5;
  horarios_fixos?: HorarioFixoSlot[];
  modalidade: 'musculacao' | 'funcional' | 'ambas';
  creditos_reposicao: number;
  plano_id?: string;
  plano_nome?: string;
  valor_mensalidade?: number;
  vencimento_plano?: string; // YYYY-MM-DD
  tem_multiplos_planos?: boolean;
  planos_contratados?: PlanoContratadoItem[];
  objetivo: ObjetivoModel;
  restricoes: string;
  mes_renovacao: string;
  data_inicio: string;
  data_reativacao?: string;
  ativo: boolean;
  foto_url?: string;
  personal_id?: string;
  personal_nome?: string;
  personal_ids?: string[];
  created_at: number;
  updated_at: number;
}

export function derivarPersonalIds(planos?: PlanoContratadoItem[], legacyPersonalId?: string): string[] {
  const set = new Set<string>();
  if (legacyPersonalId && legacyPersonalId.trim() !== '') {
    set.add(legacyPersonalId.trim());
  }
  if (planos && Array.isArray(planos)) {
    planos.forEach(p => {
      if (p.personal_id && p.personal_id.trim() !== '') {
        set.add(p.personal_id.trim());
      }
      if (p.horarios_fixos && Array.isArray(p.horarios_fixos)) {
        p.horarios_fixos.forEach(h => {
          if (h.personal_id && h.personal_id.trim() !== '') {
            set.add(h.personal_id.trim());
          }
        });
      }
    });
  }
  return Array.from(set);
}

export function getPlanosDoAluno(aluno: Aluno): PlanoContratadoItem[] {
  if (aluno.tem_multiplos_planos && aluno.planos_contratados && aluno.planos_contratados.length > 0) {
    return aluno.planos_contratados.filter(p => p.ativo !== false);
  }
  
  if (!aluno.plano_nome && (!aluno.valor_mensalidade || aluno.valor_mensalidade <= 0)) {
    return [];
  }

  let dueDay: number | string = 10;
  if (aluno.vencimento_plano) {
    const parts = aluno.vencimento_plano.split('-');
    if (parts.length === 3) dueDay = parseInt(parts[2], 10) || 10;
  }

  return [{
    id: `legacy-${aluno.id}`,
    plano_id: aluno.plano_id,
    plano_nome: aluno.plano_nome || 'Plano Padrão',
    valor_mensalidade: aluno.valor_mensalidade || 0,
    dia_vencimento: dueDay,
    personal_id: aluno.personal_id,
    personal_nome: aluno.personal_nome,
    frequencia_semanal: aluno.frequencia_semanal,
    horarios_fixos: aluno.horarios_fixos,
    modalidade: aluno.modalidade,
    ativo: true
  }];
}

export interface Exercicio {
  id: string;
  nome: string;
  grupo_muscular: GrupoMuscular;
  equipamentos_ids: string[];
  tipo: TipoExercicio;
  nivel: 'iniciante' | 'intermediário' | 'avançado';
  eh_bilateral: boolean;
  padrao_movimento: 'empurrar_horizontal' | 'empurrar_vertical' | 'puxar_horizontal' | 'puxar_vertical' | 'squat' | 'hinge' | 'carry' | 'core' | 'mobilidade';
  variacoes?: string;
  observacoes?: string;
  ativo: boolean;
}

export interface Equipamento {
  id: string;
  nome: string;
  categoria: 'aparelho_musculação' | 'cabo_cross' | 'halter_barra' | 'cardio' | 'acessório' | 'livre';
  quantidade: number;
  capacidade_max_kg?: number;
  marca_modelo?: string;
  estado: 'bom' | 'manutenção' | 'inativo';
  observacoes?: string;
  ativo: boolean;
}

export interface Mesociclo {
  id: string;
  aluno_id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  objetivo_meso: string;
  observacoes: string;
  status: 'ativo' | 'concluído' | 'cancelado';
  ia_sugestao_usada: boolean;
  created_at: number;
}

export interface Prescricao {
  id: string;
  mesociclo_id: string;
  aluno_id: string;
  treino_bloco: 'A' | 'B' | 'C';
  ordem: number;
  exercicio_id: string;
  series: number;
  repeticoes: string;
  carga_referencia: number;
  tempo_descanso_s: number;
  cadencia: string;
  tecnica_especial: 'nenhuma' | 'drop_set' | 'bi_set' | 'tri_set' | 'rest_pause' | 'cluster';
  observacoes: string;
  tipo: TipoExercicio;
}

export interface Execucao {
  id: string;
  prescricao_id: string;
  aluno_id: string;
  data_execucao: string;
  carga_executada: number;
  repeticoes_realizadas: string;
  percepcao_esforco: number; // 1-10 RPE
  observacoes: string;
  created_at: number;
}

export interface AgendamentoFixo {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  personal_id: string;
  personal_nome: string;
  dias: string[]; // ['Seg', 'Qua']
  hora: string; // '08:30'
  modalidade: 'musculacao' | 'funcional';
  ativo: boolean;
  created_at: number;
}

export interface AulaSessao {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  personal_id: string;
  personal_nome: string;
  data: string; // 'YYYY-MM-DD'
  hora: string; // '08:30'
  status: 'confirmado' | 'presenca' | 'falta' | 'cancelado';
  tipo: 'recorrente' | 'avulso' | 'reposicao';
  origem_recorrencia_id?: string;
  data_original?: string;
}

export interface Plano {
  id: string;
  nome: string;
  duracao_meses: number;
  valor: number;
  frequencia_semanal: 1 | 2 | 3 | 4 | 5;
  modalidade: 'musculacao' | 'funcional' | 'ambas';
  descricao?: string;
  ativo: boolean;
  created_at: number;
}

export interface Renovacao {
  id: string;
  aluno_id: string;
  aluno_nome: string;
  plano_id: string;
  plano_nome: string;
  valor_pago: number;
  data_renovacao: string; // YYYY-MM-DD
  operador: string;
  created_at: number;
}

export interface LogEntry {
  id: string;
  user_email: string;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  resource_type: 'aluno' | 'exercicio' | 'equipamento' | 'prescricao' | 'auth' | 'agenda' | 'plano' | 'receita';
  resource_id?: string;
  resource_name?: string;
  details: string;
  created_at: number;
}

export interface Receita {
  id: string;
  aluno_id?: string;
  aluno_nome?: string;
  descricao?: string;
  plano?: string;
  plano_contratado_id?: string;
  categoria_id?: string;
  valor: number;
  valor_original?: number;
  tem_desconto?: boolean;
  justificativa_desconto?: string;
  vencimento?: string;
  data_vencimento?: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado' | string;
  forma_pagamento?: string;
  data_pagamento?: number | string;
  personal_id?: string | null;
  vendedor_id?: string | null;
  origem?: 'MENSALIDADE' | 'AVULSA' | 'VENDA' | string;
  venda_id?: string;
  created_at?: number;
}

export interface Funcionario {
  id: string;
  nome: string;
  cpf?: string;
  telefone?: string;
  email?: string;
  cargo?: string;
  ativo: boolean;
  uid?: string | null;
  perfil?: 'admin' | 'instrutor';
  comissao_aula_pct?: number;
  comissao_venda_pct?: number;
  desconto_venda_teto_pct?: number;
  overrides_permissoes?: Record<string, any>;
  created_at?: number;
}

