import { useState, useEffect } from 'react';
import { X, Save, Loader2, FileText, Phone, MapPin, User, Stethoscope, Plus, Trash2, CalendarDays, Layers, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection } from '../../hooks/useFirestore';
import { logActivity } from '../../services/logger';
import type { ObjetivoModel, Aluno, Plano, HorarioFixoSlot, PlanoContratadoItem } from '../../types/database';
import { getPlanosDoAluno } from '../../types/database';
import type { Funcionario } from '../funcionarios/FuncionarioFormModal';

interface AlunoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  alunoToEdit?: Aluno | null;
}

const DIAS_OPCOES: HorarioFixoSlot['dia_semana'][] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const HORARIOS_OPCOES = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
];

const DEFAULT_DAYS_MAP: Record<number, HorarioFixoSlot['dia_semana'][]> = {
  1: ['Segunda'],
  2: ['Segunda', 'Quarta'],
  3: ['Segunda', 'Quarta', 'Sexta'],
  4: ['Segunda', 'Terça', 'Quinta', 'Sexta'],
  5: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
};

function cleanObjectForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObjectForFirestore(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = cleanObjectForFirestore(val);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Função utilitária para garantir que a quantidade de slots da agenda
 * corresponda exatamente à frequência semanal contratada (N aulas pré-abertas).
 */
function syncSlotsWithFrequency(
  currentSlots: HorarioFixoSlot[],
  targetFreq: number,
  personalId?: string,
  personalNome?: string,
  planoNome?: string,
  planoId?: string
): HorarioFixoSlot[] {
  const defaultDays = DEFAULT_DAYS_MAP[targetFreq] || ['Segunda'];
  const result: HorarioFixoSlot[] = [...currentSlots];

  if (result.length < targetFreq) {
    for (let i = result.length; i < targetFreq; i++) {
      const defaultDay = defaultDays[i] || 'Segunda';
      result.push({
        dia_semana: defaultDay,
        horario: '08:00',
        personal_id: personalId || '',
        personal_nome: personalNome || '',
        plano_nome: planoNome,
        plano_id: planoId
      });
    }
  } else if (result.length > targetFreq) {
    result.splice(targetFreq);
  }

  return result;
}

export const AlunoFormModal = ({ isOpen, onClose, onSuccess, alunoToEdit }: AlunoFormModalProps) => {
  const [isSaving, setIsSaving] = useState(false);
  
  const { data: colaboradores } = useCollection<Funcionario>('funcionarios', 'nome');
  const trainers = colaboradores.filter(c => c.funcao === 'personal_trainer' && c.ativo !== false);
  
  const { data: planos } = useCollection<Plano>('planos');
  const activePlanos = planos.filter(p => p.ativo);

  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    cpf: '',
    telefone: '',
    cep: '',
    endereco: '',
    numero: '',
    bairro: '',
    cidade: '',
    objetivo: 'saúde_geral' as ObjetivoModel,
    restricoes: '',
    frequencia_semanal: '3',
    personal_id: '',
    modalidade: 'musculacao' as 'musculacao' | 'funcional' | 'ambas',
    creditos_reposicao: '0',
    plano_id: '',
    vencimento_plano: '',
    valor_mensalidade: '0'
  });

  const [temMultiplosPlanos, setTemMultiplosPlanos] = useState(false);
  const [planosContratados, setPlanosContratados] = useState<PlanoContratadoItem[]>([]);
  const [activePlanoTab, setActivePlanoTab] = useState(0);

  // States para horários fixos de plano único
  const [horariosFixos, setHorariosFixos] = useState<HorarioFixoSlot[]>([]);

  // Preenche dados ao abrir se estiver em modo de edição
  useEffect(() => {
    if (alunoToEdit) {
      const temMulti = Boolean(alunoToEdit.tem_multiplos_planos);
      setTemMultiplosPlanos(temMulti);
      
      const rawPlanos = getPlanosDoAluno(alunoToEdit);
      // Assegura que cada plano possui horários sincronizados com a frequência
      const syncedPlanos = rawPlanos.map(p => ({
        ...p,
        horarios_fixos: syncSlotsWithFrequency(
          p.horarios_fixos || [],
          p.frequencia_semanal || 2,
          p.personal_id,
          p.personal_nome,
          p.plano_nome,
          p.id
        )
      }));

      setPlanosContratados(syncedPlanos);
      setActivePlanoTab(0);

      const singleFreq = alunoToEdit.frequencia_semanal || 3;
      setFormData({
        nome: alunoToEdit.nome || '',
        sobrenome: alunoToEdit.sobrenome || '',
        cpf: alunoToEdit.cpf || '',
        telefone: alunoToEdit.telefone || '',
        cep: alunoToEdit.cep || '',
        endereco: alunoToEdit.endereco || '',
        numero: alunoToEdit.numero || '',
        bairro: alunoToEdit.bairro || '',
        cidade: alunoToEdit.cidade || '',
        objetivo: alunoToEdit.objetivo || 'saúde_geral',
        restricoes: (alunoToEdit.restricoes === 'None' ? '' : alunoToEdit.restricoes) || '',
        frequencia_semanal: singleFreq.toString(),
        personal_id: alunoToEdit.personal_id || '',
        modalidade: alunoToEdit.modalidade || 'musculacao',
        creditos_reposicao: (alunoToEdit.creditos_reposicao ?? 0).toString(),
        plano_id: alunoToEdit.plano_id || '',
        vencimento_plano: alunoToEdit.vencimento_plano || '',
        valor_mensalidade: (alunoToEdit.valor_mensalidade ?? 0).toString()
      });

      setHorariosFixos(
        syncSlotsWithFrequency(
          alunoToEdit.horarios_fixos || [],
          singleFreq,
          alunoToEdit.personal_id,
          alunoToEdit.personal_nome
        )
      );
    } else {
      setTemMultiplosPlanos(false);

      const firstPlano = activePlanos.length > 0 ? activePlanos[0] : null;
      const initialFreq = firstPlano ? firstPlano.frequencia_semanal : 3;

      const initialPlano: PlanoContratadoItem = {
        id: Math.random().toString(36).substring(2, 9),
        plano_id: firstPlano ? firstPlano.id : '',
        plano_nome: firstPlano ? firstPlano.nome : 'Plano Mensal',
        valor_mensalidade: firstPlano ? firstPlano.valor : 150,
        dia_vencimento: 5,
        modalidade: firstPlano ? firstPlano.modalidade : 'musculacao',
        frequencia_semanal: initialFreq,
        horarios_fixos: syncSlotsWithFrequency([], initialFreq),
        ativo: true
      };

      setPlanosContratados([initialPlano]);
      setActivePlanoTab(0);

      setFormData({
        nome: '',
        sobrenome: '',
        cpf: '',
        telefone: '',
        cep: '',
        endereco: '',
        numero: '',
        bairro: '',
        cidade: '',
        objetivo: 'saúde_geral',
        restricoes: '',
        frequencia_semanal: initialFreq.toString(),
        personal_id: '',
        modalidade: 'musculacao',
        creditos_reposicao: '0',
        plano_id: firstPlano ? firstPlano.id : '',
        vencimento_plano: '',
        valor_mensalidade: firstPlano ? firstPlano.valor.toString() : '0'
      });

      setHorariosFixos(syncSlotsWithFrequency([], initialFreq));
    }
  }, [alunoToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'frequencia_semanal') {
      const newFreq = parseInt(value, 10) || 1;
      setHorariosFixos(prev => syncSlotsWithFrequency(prev, newFreq, formData.personal_id));
    }
  };

  const handleAddPlanoContratado = () => {
    const nextIndex = planosContratados.length;
    const firstPlano = activePlanos.length > 0 ? activePlanos[0] : null;
    const targetFreq = firstPlano ? firstPlano.frequencia_semanal : 2;

    const newPlano: PlanoContratadoItem = {
      id: Math.random().toString(36).substring(2, 9),
      plano_id: firstPlano ? firstPlano.id : '',
      plano_nome: firstPlano ? firstPlano.nome : `Plano ${nextIndex + 1}`,
      valor_mensalidade: firstPlano ? firstPlano.valor : 150,
      dia_vencimento: 10,
      modalidade: firstPlano ? firstPlano.modalidade : 'musculacao',
      frequencia_semanal: targetFreq,
      horarios_fixos: syncSlotsWithFrequency([], targetFreq),
      ativo: true
    };

    setPlanosContratados(prev => [...prev, newPlano]);
    setActivePlanoTab(nextIndex);
  };

  const handleRemovePlanoContratado = (index: number) => {
    setPlanosContratados(prev => prev.filter((_, idx) => idx !== index));
    setActivePlanoTab(prev => Math.max(0, prev - 1));
  };

  const handleUpdatePlanoItem = (index: number, field: keyof PlanoContratadoItem, value: any) => {
    setPlanosContratados(prev => {
      const copy = [...prev];
      const updated = { ...copy[index], [field]: value };

      if (field === 'frequencia_semanal') {
        const newFreq = parseInt(value, 10) || 1;
        updated.horarios_fixos = syncSlotsWithFrequency(
          updated.horarios_fixos || [],
          newFreq,
          updated.personal_id,
          updated.personal_nome,
          updated.plano_nome,
          updated.id
        );
      }

      copy[index] = updated;
      return copy;
    });
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      alert("O Nome do aluno é obrigatório.");
      return;
    }

    if (temMultiplosPlanos && planosContratados.length === 0) {
      alert("Adicione pelo menos 1 plano contratado ao aluno.");
      return;
    }

    // VERIFICAÇÃO: Checa se a quantidade de aulas bate com a frequência semanal contratada
    const warnings: string[] = [];

    if (temMultiplosPlanos) {
      planosContratados.forEach((p, idx) => {
        const reqF = p.frequencia_semanal || 1;
        const actualF = (p.horarios_fixos || []).length;
        if (actualF !== reqF) {
          warnings.push(`• Plano #${idx + 1} (${p.plano_nome || 'Sem Nome'}): Frequência de ${reqF}x/semana, mas possui ${actualF} aula(s) configurada(s).`);
        }
      });
    } else {
      const reqF = parseInt(formData.frequencia_semanal) || 1;
      const actualF = horariosFixos.length;
      if (actualF !== reqF) {
        warnings.push(`• Plano Fixo: Frequência de ${reqF}x/semana, mas possui ${actualF} aula(s) configurada(s).`);
      }
    }

    if (warnings.length > 0) {
      const confirma = window.confirm(
        `Atenção! A quantidade de aulas configuradas na agenda não coincide com a frequência semanal do contrato:\n\n` +
        warnings.join('\n') +
        `\n\nDeseja salvar a ficha mesmo assim?`
      );
      if (!confirma) return;
    }

    setIsSaving(true);
    try {
      const personalSelecionado = trainers.find(t => t.id === formData.personal_id);
      const planoSelecionado = activePlanos.find(p => p.id === formData.plano_id);

      let primaryPlanoNome = planoSelecionado ? planoSelecionado.nome : 'Plano Mensal';
      let primaryValor = parseFloat(formData.valor_mensalidade) || (planoSelecionado ? planoSelecionado.valor : 0);
      let primaryPersonalId = formData.personal_id || '';
      let primaryPersonalNome = personalSelecionado ? personalSelecionado.nome : '';

      if (temMultiplosPlanos && planosContratados.length > 0) {
        const p1 = planosContratados[0];
        primaryPlanoNome = p1.plano_nome || primaryPlanoNome;
        primaryValor = p1.valor_mensalidade || primaryValor;
        primaryPersonalId = p1.personal_id || primaryPersonalId;
        primaryPersonalNome = p1.personal_nome || primaryPersonalNome;
      }

      const reqFreq = temMultiplosPlanos 
        ? planosContratados.reduce((acc, p) => acc + (p.frequencia_semanal || 0), 0)
        : parseInt(formData.frequencia_semanal) || 3;

      let consolidatedHorariosFixos: HorarioFixoSlot[] = [];

      if (temMultiplosPlanos && planosContratados.length > 0) {
        planosContratados.forEach(p => {
          if (p.horarios_fixos && p.horarios_fixos.length > 0) {
            p.horarios_fixos.forEach(hf => {
              consolidatedHorariosFixos.push({
                ...hf,
                plano_nome: p.plano_nome || 'Plano Mensal',
                plano_id: p.id || '',
                personal_id: hf.personal_id || p.personal_id || primaryPersonalId || '',
                personal_nome: hf.personal_nome || p.personal_nome || primaryPersonalNome || ''
              });
            });
          }
        });
      } else {
        consolidatedHorariosFixos = horariosFixos;
      }

      const cleanedPlanos = (temMultiplosPlanos ? planosContratados : [{
        id: `primary-${alunoToEdit?.id || 'new'}`,
        plano_id: formData.plano_id || '',
        plano_nome: primaryPlanoNome,
        valor_mensalidade: primaryValor,
        dia_vencimento: formData.vencimento_plano ? (parseInt(formData.vencimento_plano.split('-')[2], 10) || 5) : 5,
        personal_id: primaryPersonalId,
        personal_nome: primaryPersonalNome,
        frequencia_semanal: reqFreq,
        horarios_fixos: horariosFixos,
        modalidade: formData.modalidade,
        ativo: true
      }]).map(p => ({
        id: p.id || Math.random().toString(36).substring(2, 9),
        plano_id: p.plano_id || '',
        plano_nome: p.plano_nome || 'Plano Mensal',
        valor_mensalidade: typeof p.valor_mensalidade === 'number' ? p.valor_mensalidade : (parseFloat(p.valor_mensalidade as any) || 0),
        dia_vencimento: p.dia_vencimento || 5,
        personal_id: p.personal_id || '',
        personal_nome: p.personal_nome || '',
        frequencia_semanal: p.frequencia_semanal || 1,
        modalidade: p.modalidade || 'musculacao',
        ativo: p.ativo !== false,
        horarios_fixos: (p.horarios_fixos || []).map(hf => ({
          dia_semana: hf.dia_semana || 'Segunda',
          horario: hf.horario || '08:00',
          personal_id: hf.personal_id || p.personal_id || '',
          personal_nome: hf.personal_nome || p.personal_nome || '',
          plano_nome: hf.plano_nome || p.plano_nome || '',
          plano_id: hf.plano_id || p.id || ''
        }))
      }));

      const cleanedHorariosFixos = consolidatedHorariosFixos.map(hf => ({
        dia_semana: hf.dia_semana || 'Segunda',
        horario: hf.horario || '08:00',
        personal_id: hf.personal_id || '',
        personal_nome: hf.personal_nome || '',
        plano_nome: hf.plano_nome || '',
        plano_id: hf.plano_id || ''
      }));

      const novadata = {
        nome: formData.nome.trim(),
        sobrenome: formData.sobrenome.trim(),
        cpf: formData.cpf.trim(),
        telefone: formData.telefone.trim(),
        cep: formData.cep.trim(),
        endereco: formData.endereco.trim(),
        numero: formData.numero.trim(),
        bairro: formData.bairro.trim(),
        cidade: formData.cidade.trim(),
        objetivo: formData.objetivo || 'saúde_geral',
        restricoes: formData.restricoes.trim() || 'None',
        frequencia_semanal: (reqFreq > 5 ? 5 : reqFreq < 1 ? 1 : reqFreq) as 1 | 2 | 3 | 4 | 5,
        horarios_fixos: cleanedHorariosFixos,
        modalidade: formData.modalidade || 'musculacao',
        creditos_reposicao: parseInt(formData.creditos_reposicao) || 0,
        plano_id: formData.plano_id || '',
        plano_nome: primaryPlanoNome,
        valor_mensalidade: primaryValor,
        vencimento_plano: formData.vencimento_plano || '',
        personal_id: primaryPersonalId,
        personal_nome: primaryPersonalNome,
        tem_multiplos_planos: temMultiplosPlanos,
        planos_contratados: cleanedPlanos,
        updated_at: Date.now()
      };

      const finalDataToSave = cleanObjectForFirestore(novadata);

      if (alunoToEdit) {
        await updateDoc(doc(db, 'alunos', alunoToEdit.id), finalDataToSave);
        await logActivity({
          action: 'UPDATE',
          resource_type: 'aluno',
          resource_id: alunoToEdit.id,
          resource_name: novadata.nome,
          details: `Atualizou dados do aluno ${novadata.nome}${temMultiplosPlanos ? ` (${planosContratados.length} planos contratados)` : ''}`
        });
      } else {
        const docRef = await addDoc(collection(db, 'alunos'), cleanObjectForFirestore({
          ...finalDataToSave,
          ativo: true,
          data_inicio: new Date().toLocaleDateString('pt-BR'),
          created_at: Date.now()
        }));
        await logActivity({
          action: 'CREATE',
          resource_type: 'aluno',
          resource_id: docRef.id,
          resource_name: novadata.nome,
          details: `Cadastrou o aluno ${novadata.nome}${temMultiplosPlanos ? ` (${planosContratados.length} planos contratados)` : ''}`
        });
      }
      
      onSuccess();
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar o aluno: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-brand-dark/20 flex flex-col max-h-[90vh] animate-fade-in border border-white/50">
        
        {/* Header Fixo */}
        <div className="flex items-center justify-between p-6 border-b border-surface-200">
          <div>
            <h2 className="text-2xl font-display text-brand-dark font-bold">
              {alunoToEdit ? 'Editar Aluno' : 'Novo Aluno'}
            </h2>
            <p className="text-surface-500 text-sm">Ficha de matrícula Aello Studio</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface-100 rounded-xl text-surface-400 hover:text-red-500 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Corpo Rolável */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
          
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 flex items-center gap-2">
              <User className="w-4 h-4" /> Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Nome <span className="text-red-500">*</span></label>
                <input type="text" name="nome" value={formData.nome} onChange={handleChange} placeholder="Ex: Andrei" className="input-field" autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Sobrenome</label>
                <input type="text" name="sobrenome" value={formData.sobrenome} onChange={handleChange} placeholder="Ex: Pletsch" className="input-field" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark flex items-center gap-2"><FileText className="w-4 h-4 text-surface-400"/> CPF</label>
                <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" className="input-field" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark flex items-center gap-2"><Phone className="w-4 h-4 text-surface-400"/> Telefone / WhatsApp</label>
                <input type="tel" name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(55) 9 9999-9999" className="input-field" />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-surface-200 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Endereço Completo
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">CEP</label>
                <input type="text" name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" className="input-field" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-semibold text-brand-dark">Rua / Logradouro</label>
                <input type="text" name="endereco" value={formData.endereco} onChange={handleChange} placeholder="Ex: Rua das Flores" className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Número</label>
                <input type="text" name="numero" value={formData.numero} onChange={handleChange} placeholder="Ex: 123" className="input-field" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Bairro</label>
                <input type="text" name="bairro" value={formData.bairro} onChange={handleChange} placeholder="Ex: Centro" className="input-field" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Cidade</label>
                <input type="text" name="cidade" value={formData.cidade} onChange={handleChange} placeholder="Ex: Ijuí" className="input-field" />
              </div>
            </div>
          </div>

          {/* PERFIL CLÍNICO & PLANOS CONTRATADOS */}
          <div className="space-y-6 border-t border-surface-200 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400 flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> Perfil Clínico e Contratos
              </h3>
            </div>

            {/* SELETOR DE MÚLTIPLOS PLANOS */}
            <div className="p-4 bg-brand-50/70 border border-brand-200 rounded-2xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-dark flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-medium" /> Possui Múltiplos Planos Contratados
                </h4>
                <p className="text-xs text-surface-500 mt-0.5">
                  Marque caso o aluno possua 2 ou mais planos/modalidades ativas (ex: Musculação + Pilates / Personal Exclusivo).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                <input 
                  type="checkbox" 
                  checked={temMultiplosPlanos}
                  onChange={(e) => setTemMultiplosPlanos(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-medium"></div>
              </label>
            </div>

            {/* SE FOR PLANO ÚNICO */}
            {!temMultiplosPlanos ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Plano Contratado</label>
                    <select 
                      name="plano_id" 
                      value={formData.plano_id} 
                      onChange={(e) => {
                        const pid = e.target.value;
                        const selectedPlano = activePlanos.find(p => p.id === pid);
                        let nextRenewalStr = '';
                        const targetFreq = selectedPlano ? selectedPlano.frequencia_semanal : parseInt(formData.frequencia_semanal) || 3;

                        if (selectedPlano) {
                          const d = new Date();
                          d.setMonth(d.getMonth() + (selectedPlano.duracao_meses || 1));
                          nextRenewalStr = d.toISOString().split('T')[0];
                        }

                        setFormData(prev => ({
                          ...prev,
                          plano_id: pid,
                          frequencia_semanal: targetFreq.toString(),
                          modalidade: selectedPlano ? selectedPlano.modalidade : prev.modalidade,
                          vencimento_plano: nextRenewalStr || prev.vencimento_plano,
                          valor_mensalidade: selectedPlano ? selectedPlano.valor.toString() : '0'
                        }));

                        setHorariosFixos(prev => syncSlotsWithFrequency(prev, targetFreq, formData.personal_id));
                      }} 
                      className="input-field"
                    >
                      <option value="">-- Sem Plano --</option>
                      {activePlanos.map(p => (
                        <option key={p.id} value={p.id}>{p.nome} - R$ {p.valor.toFixed(2)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Valor Mensalidade (R$)</label>
                    <input 
                      type="number" 
                      name="valor_mensalidade" 
                      step="0.01"
                      value={formData.valor_mensalidade} 
                      onChange={handleChange} 
                      className="input-field" 
                      placeholder="0,00"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Próximo Vencimento</label>
                    <input 
                      type="date" 
                      name="vencimento_plano" 
                      value={formData.vencimento_plano} 
                      onChange={handleChange} 
                      className="input-field" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Objetivo Principal</label>
                    <select name="objetivo" value={formData.objetivo} onChange={handleChange} className="input-field">
                      <option value="saúde_geral">Saúde e Bem-estar</option>
                      <option value="hipertrofia">Hipertrofia</option>
                      <option value="emagrecimento">Emagrecimento</option>
                      <option value="reabilitação">Reabilitação / Fisioterapia</option>
                      <option value="condicionamento">Condicionamento Físico</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Frequência Semanal</label>
                    <select name="frequencia_semanal" value={formData.frequencia_semanal} onChange={handleChange} className="input-field">
                      <option value="1">1x por semana</option>
                      <option value="2">2x por semana</option>
                      <option value="3">3x por semana</option>
                      <option value="4">4x por semana</option>
                      <option value="5">5x por semana</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Modalidade do Plano</label>
                    <select name="modalidade" value={formData.modalidade} onChange={handleChange} className="input-field">
                      <option value="musculacao">Musculação</option>
                      <option value="funcional">Funcional</option>
                      <option value="ambas">Ambas (Musc + Func)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Personal Responsável</label>
                    <select name="personal_id" value={formData.personal_id} onChange={handleChange} className="input-field">
                      <option value="">-- Sem Personal Vinculado --</option>
                      {trainers.map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Aulas em Haver (Reposição)</label>
                    <input 
                      type="number" 
                      name="creditos_reposicao" 
                      value={formData.creditos_reposicao} 
                      onChange={handleChange} 
                      className="input-field" 
                      min="0"
                    />
                  </div>
                </div>

                {/* Horários Fixos Únicos (PRÉ-ABERTOS DE ACORDO COM A FREQUÊNCIA) */}
                <div className="space-y-3 p-4 bg-brand-dark/5 border border-brand-medium/20 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-dark flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-brand-medium" /> Horários Fixos na Agenda ({horariosFixos.length} de {formData.frequencia_semanal}x/semana)
                    </h4>
                    {horariosFixos.length === parseInt(formData.frequencia_semanal) && (
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Frequência OK
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {horariosFixos.map((hf, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 p-2.5 bg-white rounded-xl border border-surface-200 shadow-sm text-xs">
                        <span className="font-extrabold text-brand-dark min-w-[55px]">Aula #{idx + 1}:</span>

                        <select 
                          value={hf.dia_semana} 
                          onChange={(e) => {
                            const updated = [...horariosFixos];
                            updated[idx] = { ...updated[idx], dia_semana: e.target.value as any };
                            setHorariosFixos(updated);
                          }}
                          className="input-field py-1 text-xs font-semibold w-auto bg-surface-50"
                        >
                          {DIAS_OPCOES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        <select 
                          value={hf.horario} 
                          onChange={(e) => {
                            const updated = [...horariosFixos];
                            updated[idx] = { ...updated[idx], horario: e.target.value };
                            setHorariosFixos(updated);
                          }}
                          className="input-field py-1 text-xs font-semibold w-auto bg-surface-50"
                        >
                          {HORARIOS_OPCOES.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>

                        <select 
                          value={hf.personal_id || formData.personal_id} 
                          onChange={(e) => {
                            const tId = e.target.value;
                            const trainerObj = trainers.find(t => t.id === tId);
                            const updated = [...horariosFixos];
                            updated[idx] = { 
                              ...updated[idx], 
                              personal_id: tId, 
                              personal_nome: trainerObj ? trainerObj.nome : '' 
                            };
                            setHorariosFixos(updated);
                          }}
                          className="input-field py-1 text-xs font-semibold w-auto bg-surface-50"
                        >
                          <option value="">-- Personal Geral --</option>
                          {trainers.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* SE FOR MÚLTIPLOS PLANOS (Abas Navegáveis com Horários por Plano) */
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark">Objetivo Principal do Aluno</label>
                  <select name="objetivo" value={formData.objetivo} onChange={handleChange} className="input-field">
                    <option value="saúde_geral">Saúde e Bem-estar</option>
                    <option value="hipertrofia">Hipertrofia</option>
                    <option value="emagrecimento">Emagrecimento</option>
                    <option value="reabilitação">Reabilitação / Fisioterapia</option>
                    <option value="condicionamento">Condicionamento Físico</option>
                  </select>
                </div>

                {/* NAVEGAÇÃO EM ABAS DOS PLANOS */}
                <div className="flex items-center gap-2 border-b border-surface-200 pb-2 overflow-x-auto custom-scrollbar">
                  {planosContratados.map((planoItem, index) => (
                    <button
                      key={planoItem.id || index}
                      type="button"
                      onClick={() => setActivePlanoTab(index)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        activePlanoTab === index
                          ? 'bg-brand-medium text-white shadow-md shadow-brand-medium/20 font-extrabold'
                          : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Plano #{index + 1}: {planoItem.plano_nome || 'Sem Nome'}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddPlanoContratado}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-50 text-brand-medium hover:bg-brand-100 transition-colors flex items-center gap-1.5 whitespace-nowrap border border-brand-200 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Novo Plano
                  </button>
                </div>

                {/* CONTEÚDO DA ABA ATIVA */}
                {planosContratados[activePlanoTab] && (() => {
                  const index = activePlanoTab;
                  const planoItem = planosContratados[index];
                  const planoHorarios = planoItem.horarios_fixos || [];

                  return (
                    <div key={planoItem.id || index} className="p-5 bg-surface-50 border border-surface-200 rounded-2xl space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-surface-200 pb-3">
                        <span className="text-xs font-extrabold uppercase text-brand-medium tracking-wide flex items-center gap-1.5">
                          <Layers className="w-4 h-4" /> Configurando Contrato #{index + 1}
                        </span>
                        {planosContratados.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemovePlanoContratado(index)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 text-xs font-bold flex items-center gap-1 transition-colors border border-red-200 bg-white cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" /> Excluir Este Plano
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-2">
                            <label className="text-xs font-bold text-brand-dark mb-1 block">Plano Contratado (Catálogo)</label>
                            <select 
                              value={planoItem.plano_id || ''} 
                              onChange={(e) => {
                                const pid = e.target.value;
                                const selectedPlano = activePlanos.find(p => p.id === pid);
                                const targetFreq = selectedPlano ? selectedPlano.frequencia_semanal : (planoItem.frequencia_semanal || 2);

                                setPlanosContratados(prev => {
                                  const copy = [...prev];
                                  copy[index] = {
                                    ...copy[index],
                                    plano_id: pid,
                                    plano_nome: selectedPlano ? selectedPlano.nome : copy[index].plano_nome,
                                    valor_mensalidade: selectedPlano ? selectedPlano.valor : copy[index].valor_mensalidade,
                                    frequencia_semanal: targetFreq,
                                    modalidade: selectedPlano ? selectedPlano.modalidade : copy[index].modalidade,
                                    horarios_fixos: syncSlotsWithFrequency(
                                      copy[index].horarios_fixos || [],
                                      targetFreq,
                                      copy[index].personal_id,
                                      copy[index].personal_nome,
                                      selectedPlano ? selectedPlano.nome : copy[index].plano_nome,
                                      copy[index].id
                                    )
                                  };
                                  return copy;
                                });
                              }} 
                              className="input-field text-xs font-semibold bg-white border-brand-300"
                            >
                              <option value="">-- Selecione do Catálogo --</option>
                              {activePlanos.map(p => (
                                <option key={p.id} value={p.id}>{p.nome} - R$ {p.valor.toFixed(2)}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-brand-dark mb-1 block">Dia Vencimento (1-31)</label>
                            <input 
                              type="number" 
                              min="1"
                              max="31"
                              value={planoItem.dia_vencimento} 
                              onChange={(e) => handleUpdatePlanoItem(index, 'dia_vencimento', parseInt(e.target.value, 10) || 5)} 
                              className="input-field text-xs font-semibold" 
                              placeholder="Ex: 5, 10, 15"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-brand-dark mb-1 block">Nome do Plano / Descrição</label>
                            <input 
                              type="text" 
                              value={planoItem.plano_nome} 
                              onChange={(e) => handleUpdatePlanoItem(index, 'plano_nome', e.target.value)} 
                              placeholder="Ex: Musculação 3x na semana" 
                              className="input-field text-xs font-semibold"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-brand-dark mb-1 block">Valor Mensalidade (R$)</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              value={planoItem.valor_mensalidade} 
                              onChange={(e) => handleUpdatePlanoItem(index, 'valor_mensalidade', parseFloat(e.target.value) || 0)} 
                              className="input-field text-xs font-bold text-emerald-700" 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-bold text-brand-dark mb-1 block">Personal Responsável</label>
                          <select 
                            value={planoItem.personal_id || ''} 
                            onChange={(e) => {
                              const tId = e.target.value;
                              const trainerObj = trainers.find(t => t.id === tId);
                              handleUpdatePlanoItem(index, 'personal_id', tId);
                              handleUpdatePlanoItem(index, 'personal_nome', trainerObj ? trainerObj.nome : '');
                            }} 
                            className="input-field text-xs"
                          >
                            <option value="">-- Sem Personal Vinculado --</option>
                            {trainers.map(t => (
                              <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-brand-dark mb-1 block">Modalidade</label>
                          <select 
                            value={planoItem.modalidade || 'musculacao'} 
                            onChange={(e) => handleUpdatePlanoItem(index, 'modalidade', e.target.value)} 
                            className="input-field text-xs"
                          >
                            <option value="musculacao">Musculação</option>
                            <option value="funcional">Funcional</option>
                            <option value="ambas">Ambas</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-brand-dark mb-1 block">Frequência Semanal</label>
                          <select 
                            value={planoItem.frequencia_semanal || 2} 
                            onChange={(e) => handleUpdatePlanoItem(index, 'frequencia_semanal', parseInt(e.target.value, 10) || 2)} 
                            className="input-field text-xs"
                          >
                            <option value={1}>1x por semana</option>
                            <option value={2}>2x por semana</option>
                            <option value={3}>3x por semana</option>
                            <option value={4}>4x por semana</option>
                            <option value={5}>5x por semana</option>
                          </select>
                        </div>
                      </div>

                      {/* HORÁRIOS FIXOS PRÉ-ABERTOS DAS AULAS DESTE PLANO */}
                      <div className="space-y-3 p-4 bg-brand-dark/5 border border-brand-medium/20 rounded-2xl mt-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-dark flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-brand-medium" /> Horários Fixos na Agenda ({planoHorarios.length} de {planoItem.frequencia_semanal || 1}x/semana)
                          </h4>
                          {planoHorarios.length === (planoItem.frequencia_semanal || 1) && (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Frequência OK
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {planoHorarios.map((hf, hfIdx) => (
                            <div key={hfIdx} className="flex flex-wrap items-center gap-2 p-2.5 bg-white rounded-xl border border-surface-200 shadow-sm text-xs">
                              <span className="font-extrabold text-brand-dark min-w-[55px]">Aula #{hfIdx + 1}:</span>

                              <select 
                                value={hf.dia_semana} 
                                onChange={(e) => {
                                  const updated = [...planoHorarios];
                                  updated[hfIdx] = { ...updated[hfIdx], dia_semana: e.target.value as any };
                                  handleUpdatePlanoItem(index, 'horarios_fixos', updated);
                                }}
                                className="input-field py-1 text-xs font-semibold w-auto bg-surface-50"
                              >
                                {DIAS_OPCOES.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>

                              <select 
                                value={hf.horario} 
                                onChange={(e) => {
                                  const updated = [...planoHorarios];
                                  updated[hfIdx] = { ...updated[hfIdx], horario: e.target.value };
                                  handleUpdatePlanoItem(index, 'horarios_fixos', updated);
                                }}
                                className="input-field py-1 text-xs font-semibold w-auto bg-surface-50"
                              >
                                {HORARIOS_OPCOES.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>

                              <select 
                                value={hf.personal_id || planoItem.personal_id || ''} 
                                onChange={(e) => {
                                  const tId = e.target.value;
                                  const trainerObj = trainers.find(t => t.id === tId);
                                  const updated = [...planoHorarios];
                                  updated[hfIdx] = { 
                                    ...updated[hfIdx], 
                                    personal_id: tId, 
                                    personal_nome: trainerObj ? trainerObj.nome : '' 
                                  };
                                  handleUpdatePlanoItem(index, 'horarios_fixos', updated);
                                }}
                                className="input-field py-1 text-xs font-semibold w-auto bg-surface-50"
                              >
                                <option value="">-- Personal do Plano --</option>
                                {trainers.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-semibold text-brand-dark">Restrições Médicas / Observações Fisiológicas</label>
              <textarea 
                name="restricoes" 
                value={formData.restricoes} 
                onChange={handleChange} 
                rows={3} 
                placeholder="Ex: Hérnia de disco L4-L5, cirurgia de joelho, dor nos ombros..." 
                className="input-field" 
              />
            </div>
          </div>
        </div>

        {/* Footer Fixo */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-surface-200 bg-surface-50/50">
          <button 
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando Aluno...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {alunoToEdit ? 'Atualizar Ficha' : 'Concluir Matrícula'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
