import { useState } from 'react';
import {
  Search, Plus, Dumbbell, Weight, Bike, Settings2,
  Power, PowerOff, Pencil, X, Check, Loader2, PackageSearch, ChevronDown
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import type { Equipamento } from '../../types/database';
import clsx from 'clsx';

// ── Carga inicial de equipamentos comuns ────────────────────────────────────
const EQUIPAMENTOS_INICIAIS: Omit<Equipamento, 'id'>[] = [
  // Aparelhos de musculação
  { nome: 'Smith Machine', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Leg Press 45°', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Mesa Flexora (Isquiotibial)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Cadeira Extensora (Quadríceps)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Cadeira Adutora', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Cadeira Abdutora', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Pec Deck (Voador)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Supino (Banco ajustável c/ suporte)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Remada Cavalinho', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Pulley Alto (Puxador Costas)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Hack Machine (Agachamento)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Panturrilha em Pé (Machine)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Rosca Scott (Banco Scott)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Tríceps Testa (Banco + Barra)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Glúteo 4 Apoios (Kick Back)', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', ativo: true },
  // Cabo e Cross
  { nome: 'Crossover (Cabo duplo)', categoria: 'cabo_cross', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Polia Alta (Tríceps / Costas)', categoria: 'cabo_cross', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Polia Baixa (Rosca / Remada)', categoria: 'cabo_cross', quantidade: 1, estado: 'bom', ativo: true },
  // Pesos Livres
  { nome: 'Halteres (par 2–20 kg)', categoria: 'halter_barra', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Halteres (par 22–40 kg)', categoria: 'halter_barra', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Barra Olímpica 20 kg', categoria: 'halter_barra', quantidade: 2, estado: 'bom', ativo: true },
  { nome: 'Barra EZ (Rosca/Tríceps)', categoria: 'halter_barra', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Anilhas em Borracha (conjunto)', categoria: 'halter_barra', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Kettlebells (variados)', categoria: 'halter_barra', quantidade: 1, estado: 'bom', ativo: true },
  // Cardio
  { nome: 'Esteira Elétrica', categoria: 'cardio', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Bike Ergométrica', categoria: 'cardio', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Elíptico', categoria: 'cardio', quantidade: 1, estado: 'bom', ativo: true },
  // Acessórios
  { nome: 'Banco Regulável (Flat/Incline)', categoria: 'acessório', quantidade: 2, estado: 'bom', ativo: true },
  { nome: 'Step / Plataforma', categoria: 'acessório', quantidade: 2, estado: 'bom', ativo: true },
  { nome: 'TRX / Fita de Suspensão', categoria: 'acessório', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Elásticos de Resistência (kit)', categoria: 'acessório', quantidade: 1, estado: 'bom', ativo: true },
  { nome: 'Bola Suíça', categoria: 'acessório', quantidade: 2, estado: 'bom', ativo: true },
  { nome: 'Colchonete', categoria: 'acessório', quantidade: 4, estado: 'bom', ativo: true },
];

// ── Configs de UI ────────────────────────────────────────────────────────────
const CATEGORIA_CONFIG: Record<Equipamento['categoria'], { label: string; icon: React.ReactNode; color: string }> = {
  aparelho_musculação: { label: 'Aparelhos', icon: <Dumbbell className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  cabo_cross:         { label: 'Cabo / Cross', icon: <Settings2 className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  halter_barra:       { label: 'Pesos Livres', icon: <Weight className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  cardio:             { label: 'Cardio', icon: <Bike className="w-4 h-4" />, color: 'bg-green-100 text-green-700 border-green-200' },
  acessório:          { label: 'Acessórios', icon: <PackageSearch className="w-4 h-4" />, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  livre:              { label: 'Livre', icon: <Dumbbell className="w-4 h-4" />, color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const ESTADO_CONFIG = {
  bom:        { label: 'Bom estado', dot: 'bg-green-500' },
  manutenção: { label: 'Manutenção', dot: 'bg-amber-500' },
  inativo:    { label: 'Inativo',    dot: 'bg-red-400' },
};

// ── Formulário inline ────────────────────────────────────────────────────────
interface FormData {
  nome: string;
  categoria: Equipamento['categoria'];
  quantidade: number;
  estado: Equipamento['estado'];
  observacoes: string;
}

const EMPTY_FORM: FormData = {
  nome: '', categoria: 'aparelho_musculação', quantidade: 1, estado: 'bom', observacoes: ''
};

// ── Componente ───────────────────────────────────────────────────────────────
export const EquipamentosList = () => {
  const { data: equipamentos, loading, add, update } = useCollection<Equipamento>('equipamentos', 'nome');

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('todos');
  const [showOnlyAtivo, setShowOnlyAtivo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [seedProgress, setSeedProgress] = useState(0);

  // Filtro
  const filtered = equipamentos.filter(eq => {
    const matchSearch = eq.nome.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'todos' || eq.categoria === catFilter;
    const matchAtivo = !showOnlyAtivo || eq.ativo;
    return matchSearch && matchCat && matchAtivo;
  });

  const ativos = equipamentos.filter(e => e.ativo).length;

  // Seed da carga inicial
  const handleSeedData = async () => {
    if (!confirmSeed) {
      setConfirmSeed(true);
      setTimeout(() => setConfirmSeed(false), 5000);
      return;
    }
    setSeeding(true);
    setConfirmSeed(false);
    setSeedProgress(0);
    try {
      for (let i = 0; i < EQUIPAMENTOS_INICIAIS.length; i++) {
        await add(EQUIPAMENTOS_INICIAIS[i] as Omit<Equipamento, 'id'>);
        setSeedProgress(i + 1);
      }
    } catch (e) {
      console.error('[Seed] Erro ao carregar equipamentos:', e);
    } finally {
      setSeeding(false);
      setSeedProgress(0);
    }
  };

  // Toggle ativo/inativo
  const handleToggleAtivo = async (eq: Equipamento) => {
    await update(eq.id, { ativo: !eq.ativo });
  };

  // Abrir formulário de novo
  const handleNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  // Abrir formulário de edição
  const handleEdit = (eq: Equipamento) => {
    setEditingId(eq.id);
    setForm({
      nome: eq.nome,
      categoria: eq.categoria,
      quantidade: eq.quantidade,
      estado: eq.estado,
      observacoes: eq.observacoes || ''
    });
    setShowForm(true);
  };

  // Salvar
  const handleSave = async () => {
    if (!form.nome.trim()) { alert('Informe o nome do equipamento.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await update(editingId, { ...form });
      } else {
        await add({ ...form, ativo: true } as Omit<Equipamento, 'id'>);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (e) {
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Inventário de Equipamentos</h2>
          <p className="text-surface-500">
            {loading ? 'Carregando...' : `${ativos} equipamentos ativos · ${equipamentos.length} total`}
          </p>
        </div>
        <div className="flex gap-3">
          {equipamentos.length === 0 && !loading && (
            <button
              className={clsx(
                'btn-secondary transition-all',
                confirmSeed && 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
              )}
              onClick={handleSeedData}
              disabled={seeding}
            >
              {seeding
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {seedProgress}/{EQUIPAMENTOS_INICIAIS.length}...</>
                : confirmSeed
                  ? <><Check className="w-4 h-4" /> Confirmar carga?</>
                  : <><PackageSearch className="w-4 h-4" /> Carregar Lista Padrão</>
              }
            </button>
          )}
          <button className="btn-primary" onClick={handleNew}>
            <Plus className="w-5 h-5" />
            Novo Equipamento
          </button>
        </div>
      </div>

      {/* ── Formulário inline ── */}
      {showForm && (
        <div className="glass-card p-6 border-l-4 border-l-brand-medium animate-fade-in">
          <h3 className="font-bold text-brand-dark mb-4">
            {editingId ? 'Editar Equipamento' : 'Novo Equipamento'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-surface-500 mb-1 uppercase">Nome *</label>
              <input
                className="input-field"
                placeholder="Ex: Leg Press 45°"
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-500 mb-1 uppercase">Categoria</label>
              <div className="relative">
                <select
                  className="input-field appearance-none pr-8"
                  value={form.categoria}
                  onChange={e => setForm(p => ({ ...p, categoria: e.target.value as Equipamento['categoria'] }))}
                >
                  {Object.entries(CATEGORIA_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-500 mb-1 uppercase">Qtd.</label>
              <input
                type="number" min={1} className="input-field"
                value={form.quantidade}
                onChange={e => setForm(p => ({ ...p, quantidade: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-500 mb-1 uppercase">Estado</label>
              <div className="relative">
                <select
                  className="input-field appearance-none pr-8"
                  value={form.estado}
                  onChange={e => setForm(p => ({ ...p, estado: e.target.value as Equipamento['estado'] }))}
                >
                  <option value="bom">Bom estado</option>
                  <option value="manutenção">Em manutenção</option>
                  <option value="inativo">Inativo</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-surface-500 mb-1 uppercase">Observações</label>
              <input
                className="input-field"
                placeholder="Opcional: marca, capacidade, localização..."
                value={form.observacoes}
                onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4 justify-end">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar equipamento..."
            className="input-field pl-12"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtro por categoria */}
        {(['todos', ...Object.keys(CATEGORIA_CONFIG)] as string[]).map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
              catFilter === cat
                ? 'bg-brand-dark text-white border-brand-dark'
                : 'bg-white text-surface-500 border-surface-200 hover:border-brand-medium'
            )}
          >
            {cat === 'todos' ? 'Todos' : CATEGORIA_CONFIG[cat as Equipamento['categoria']].label}
          </button>
        ))}

        {/* Mostrar só ativos */}
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-surface-600">
          <div
            onClick={() => setShowOnlyAtivo(v => !v)}
            className={clsx(
              'w-10 h-5 rounded-full transition-all relative',
              showOnlyAtivo ? 'bg-brand-medium' : 'bg-surface-200'
            )}
          >
            <div className={clsx(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
              showOnlyAtivo ? 'left-5' : 'left-1'
            )} />
          </div>
          Só ativos
        </label>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-surface-400 gap-4 glass-card">
          <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
          <p className="font-medium">Sincronizando inventário...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center text-surface-400 flex flex-col items-center gap-4">
          <PackageSearch className="w-12 h-12 text-surface-300" />
          <div>
            <p className="font-semibold text-lg text-surface-500">
              {equipamentos.length === 0 ? 'Nenhum equipamento cadastrado' : 'Nenhum resultado encontrado'}
            </p>
            {equipamentos.length === 0 && (
              <p className="text-sm mt-1">
                Clique em <strong>"Carregar Lista Padrão"</strong> para começar com os equipamentos mais comuns,
                ou adicione manualmente.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(eq => {
            const cat = CATEGORIA_CONFIG[eq.categoria];
            const estado = ESTADO_CONFIG[eq.estado] || ESTADO_CONFIG.bom;

            return (
              <div
                key={eq.id}
                className={clsx(
                  'glass-card p-5 flex flex-col gap-3 transition-all hover:shadow-lg animate-fade-in',
                  !eq.ativo && 'opacity-50 grayscale'
                )}
              >
                {/* Top: categoria + estado */}
                <div className="flex justify-between items-start">
                  <span className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border', cat.color)}>
                    {cat.icon} {cat.label}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-surface-500">
                    <span className={clsx('w-2 h-2 rounded-full', estado.dot)} />
                    {estado.label}
                  </span>
                </div>

                {/* Nome */}
                <div className="flex-1">
                  <h4 className="font-bold text-brand-dark leading-tight">{eq.nome}</h4>
                  {eq.quantidade > 1 && (
                    <p className="text-xs text-surface-400 mt-0.5">{eq.quantidade} unidades</p>
                  )}
                  {eq.observacoes && (
                    <p className="text-xs text-surface-400 mt-1 italic">{eq.observacoes}</p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-3 border-t border-surface-100">
                  <button
                    onClick={() => handleEdit(eq)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-surface-500 bg-surface-50 hover:bg-surface-100 rounded-lg transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleToggleAtivo(eq)}
                    title={eq.ativo ? 'Inativar (IA não usará este equipamento)' : 'Ativar'}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
                      eq.ativo
                        ? 'text-red-500 bg-red-50 hover:bg-red-100'
                        : 'text-green-600 bg-green-50 hover:bg-green-100'
                    )}
                  >
                    {eq.ativo
                      ? <><PowerOff className="w-3.5 h-3.5" /> Inativar</>
                      : <><Power className="w-3.5 h-3.5" /> Ativar</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
