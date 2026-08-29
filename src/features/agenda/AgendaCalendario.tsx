import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock,
  AlertTriangle,
  X,
  MoreVertical,
  Save,
  RotateCcw,
  Info,
  CalendarDays,
  CheckCircle2,
  Trash2,
  Edit2
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { doc, getDoc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import type { AgendamentoFixo, AulaSessao, Aluno } from '../../types/database';
import type { Funcionario } from '../funcionarios/FuncionarioFormModal';

export const AgendaCalendario = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modais
  const [isNewSessaoModalOpen, setIsNewSessaoModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);

  // States para novos agendamentos/reposições
  const [newSessaoForm, setNewSessaoForm] = useState({
    aluno_id: '',
    personal_id: '',
    tipo: 'avulso' as 'avulso' | 'reposicao' | 'recorrente',
    data: '',
    hora: '08:00',
    dias: [] as string[],
    modalidade: 'musculacao' as 'musculacao' | 'funcional'
  });

  // States para editar agendamento fixo
  const [isEditFixoModalOpen, setIsEditFixoModalOpen] = useState(false);
  const [fixoToEdit, setFixoToEdit] = useState<AgendamentoFixo | null>(null);
  const [editFixoForm, setEditFixoForm] = useState({
    personal_id: '',
    dias: [] as string[],
    hora: '08:00',
    modalidade: 'musculacao' as 'musculacao' | 'funcional'
  });

  // State para remarcação pontual (exceção)
  const [sessaoToReschedule, setSessaoToReschedule] = useState<{
    aluno_id: string;
    aluno_nome: string;
    personal_id: string;
    personal_nome: string;
    originalDateStr: string;
    originalHora: string;
    recId?: string;
    overrideId?: string;
  } | null>(null);

  const [rescheduleForm, setRescheduleForm] = useState({
    targetDate: '',
    targetHora: '08:00'
  });

  // Collections
  const { data: agendamentosFixos } = useCollection<AgendamentoFixo>('agendamentos_fixos');
  const { data: agendaAulas, remove: deleteSessao } = useCollection<AulaSessao>('agenda_aulas');
  const { data: alunos } = useCollection<Aluno>('alunos', 'nome');
  const { data: colaboradores } = useCollection<Funcionario>('funcionarios', 'nome');
  const rawTrainers = colaboradores.filter(c => c.funcao === 'personal_trainer' && c.ativo !== false);
  const trainers = [...rawTrainers].sort((a, b) => {
    const getScore = (p: Funcionario) => {
      if (p.ordem_apresentacao !== undefined && p.ordem_apresentacao !== null) {
        return p.ordem_apresentacao;
      }
      const n = p.nome.toLowerCase();
      if (n.includes('adriana')) return 1;
      if (n.includes('maristela')) return 2;
      if (n.includes('ana')) return 3;
      return 99;
    };
    const scoreA = getScore(a);
    const scoreB = getScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.nome.localeCompare(b.nome);
  });

  // Config do Studio
  const [maxCapacity, setMaxCapacity] = useState(3);
  useEffect(() => {
    const loadCapacity = async () => {
      const snap = await getDoc(doc(db, 'config', 'agenda'));
      if (snap.exists()) {
        setMaxCapacity(snap.data().max_alunos_slot ?? 3);
      }
    };
    loadCapacity();
  }, []);

  const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const diasAbrev = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  
  const slotsHorarios = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
    '20:00', '20:30', '21:00', '21:30'
  ];

  // Determinar datas da semana ativa
  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Segunda-feira
    const monday = new Date(start.setDate(diff));
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  
  // Agrupar sessões por profissional / personal trainer
  const groupSessoesByTrainer = (slotSessoes: any[]) => {
    const groups: Record<string, any[]> = {};
    slotSessoes.forEach(s => {
      const key = s.personal_nome ? s.personal_nome : 'Sem Profissional Definido';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  };

  const getMonthDaysGrid = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    let startDayOfWeek = (firstDay.getDay() + 6) % 7; // Segunda = 0

    for (let i = startDayOfWeek; i > 0; i--) {
      days.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    while (days.length % 7 !== 0) {
      const nextD: Date = new Date(year, month + 1, days.length - lastDay.getDate() - startDayOfWeek + 1);
      days.push({ date: nextD, isCurrentMonth: false });
    }
    return days;
  };

  const weekDays = getWeekDays(currentDate);

  
  const navigateDay = (days: number) => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + days);
    setCurrentDate(nextDate);
  };

  const navigateMonth = (months: number) => {
    const nextDate = new Date(currentDate);
    nextDate.setMonth(currentDate.getMonth() + months);
    setCurrentDate(nextDate);
  };

  const navigateWeek = (weeks: number) => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + weeks * 7);
    setCurrentDate(nextDate);
  };

  const formatDateLabel = () => {
    const monday = weekDays[0];
    const friday = weekDays[4];
    return `${monday.getDate()} de ${monday.toLocaleString('pt-BR', { month: 'short' })} - ${friday.getDate()} de ${friday.toLocaleString('pt-BR', { month: 'short' })}`;
  };

  const incrementStudentCredits = async (alunoId: string, increment: number) => {
    try {
      const alunoRef = doc(db, 'alunos', alunoId);
      const snap = await getDoc(alunoRef);
      if (snap.exists()) {
        const currentCredits = snap.data().creditos_reposicao ?? 0;
        await updateDoc(alunoRef, {
          creditos_reposicao: Math.max(0, currentCredits + increment)
        });
      }
    } catch (err) {
      console.error('Erro ao atualizar créditos do aluno:', err);
    }
  };

  const mapDiaAbrevToFull: Record<string, 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado'> = {
    'Seg': 'Segunda',
    'Ter': 'Terça',
    'Qua': 'Quarta',
    'Qui': 'Quinta',
    'Sex': 'Sexta'
  };

  // Resolver os agendamentos de uma célula (Dia + Hora)
  const getSessoesSlot = (diaAbrev: string, dateStr: string, hora: string) => {
    const diaFull = mapDiaAbrevToFull[diaAbrev];

    // 1. Aulas recorrentes da tabela agendamentosFixos
    const recorrentes = agendamentosFixos
      .filter(rec => rec.dias.includes(diaAbrev) && rec.hora === hora && rec.ativo)
      .map(rec => {
        const override = agendaAulas.find(a => a.data === dateStr && a.hora === hora && a.aluno_id === rec.aluno_id);
        
        return {
          id: `rec-${rec.id}`,
          aluno_id: rec.aluno_id,
          aluno_nome: rec.aluno_nome,
          personal_id: rec.personal_id,
          personal_nome: rec.personal_nome,
          hora: rec.hora,
          status: override ? override.status : ('confirmado' as const),
          tipo: 'recorrente' as const,
          overrideId: override ? override.id : undefined,
          recId: rec.id
        };
      });

    // 2. Aulas de alunos cadastrados com horarios_fixos em seu perfil (suportando múltiplos planos)
    const alunosFixos: any[] = [];
    alunos.forEach(aluno => {
      if (aluno.ativo === false) return;

      let slotsDoAluno: any[] = [];

      if (aluno.tem_multiplos_planos && aluno.planos_contratados && aluno.planos_contratados.length > 0) {
        aluno.planos_contratados.forEach(p => {
          if (p.ativo !== false && p.horarios_fixos) {
            p.horarios_fixos.forEach(hf => {
              slotsDoAluno.push({
                ...hf,
                plano_nome: p.plano_nome,
                plano_id: p.id,
                personal_id: hf.personal_id || p.personal_id || aluno.personal_id,
                personal_nome: hf.personal_nome || p.personal_nome || aluno.personal_nome
              });
            });
          }
        });
      }

      if (slotsDoAluno.length === 0 && aluno.horarios_fixos) {
        aluno.horarios_fixos.forEach(hf => {
          slotsDoAluno.push({
            ...hf,
            plano_nome: hf.plano_nome || aluno.plano_nome,
            personal_id: hf.personal_id || aluno.personal_id,
            personal_nome: hf.personal_nome || aluno.personal_nome
          });
        });
      }

      const matchingSlots = slotsDoAluno.filter(hf => hf.dia_semana === diaFull && hf.horario === hora);

      matchingSlots.forEach((slot, slotIdx) => {
        if (recorrentes.some(r => r.aluno_id === aluno.id && r.personal_id === slot.personal_id)) {
          return;
        }

        const override = agendaAulas.find(a => a.data === dateStr && a.hora === hora && a.aluno_id === aluno.id);
        alunosFixos.push({
          id: `aluno-fixo-${aluno.id}-${slot.plano_id || slotIdx}-${diaFull}-${hora}`,
          aluno_id: aluno.id,
          aluno_nome: `${aluno.nome} ${aluno.sobrenome || ''}`.trim(),
          personal_id: slot.personal_id || aluno.personal_id || '',
          personal_nome: slot.personal_nome || aluno.personal_nome || '',
          plano_nome: slot.plano_nome || aluno.plano_nome || '',
          hora: hora,
          status: override ? override.status : ('confirmado' as const),
          tipo: 'recorrente' as const,
          overrideId: override ? override.id : undefined,
          recId: undefined
        });
      });
    });

    // 3. Aulas avulsas ou de reposição (Encaixes)
    const avulsas = agendaAulas
      .filter(a => a.data === dateStr && a.hora === hora && a.tipo !== 'recorrente')
      .map(a => ({
        id: a.id,
        aluno_id: a.aluno_id,
        aluno_nome: a.aluno_nome,
        personal_id: a.personal_id,
        personal_nome: a.personal_nome,
        hora: a.hora,
        status: a.status,
        tipo: a.tipo,
        overrideId: a.id,
        recId: undefined
      }));

    return [...recorrentes, ...alunosFixos, ...avulsas];
  };

  const getStatusStyle = (status: AulaSessao['status']) => {
    switch(status) {
      case 'presenca':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'falta':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'cancelado':
        return 'bg-surface-100 text-surface-400 border-surface-200 line-through';
      default:
        return 'bg-brand-medium/5 text-brand-dark border-brand-medium/20';
    }
  };

  // Ações de alteração de status
  const handleMarkPresenca = async (sessao: any, dateStr: string, hora: string) => {
    try {
      if (sessao.overrideId) {
        // Se era falta/cancelado e mudou para presença, reajusta créditos
        if (sessao.status === 'falta' || sessao.status === 'cancelado') {
          await incrementStudentCredits(sessao.aluno_id, -1);
        }
        await updateDoc(doc(db, 'agenda_aulas', sessao.overrideId), { status: 'presenca' });
      } else {
        await addDoc(collection(db, 'agenda_aulas'), {
          aluno_id: sessao.aluno_id,
          aluno_nome: sessao.aluno_nome,
          personal_id: sessao.personal_id,
          personal_nome: sessao.personal_nome,
          data: dateStr,
          hora: hora,
          status: 'presenca',
          tipo: sessao.tipo,
          origem_recorrencia_id: sessao.recId || ''
        });
      }
      await logActivity({
        action: 'UPDATE',
        resource_type: 'agenda',
        resource_name: sessao.aluno_nome,
        details: `Confirmou presença do aluno ${sessao.aluno_nome} na aula de ${dateStr} às ${hora}`
      });
      setActiveMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkFalta = async (sessao: any, dateStr: string, hora: string) => {
    try {
      if (sessao.overrideId) {
        if (sessao.status !== 'falta' && sessao.status !== 'cancelado') {
          await incrementStudentCredits(sessao.aluno_id, 1);
        }
        await updateDoc(doc(db, 'agenda_aulas', sessao.overrideId), { status: 'falta' });
      } else {
        await addDoc(collection(db, 'agenda_aulas'), {
          aluno_id: sessao.aluno_id,
          aluno_nome: sessao.aluno_nome,
          personal_id: sessao.personal_id,
          personal_nome: sessao.personal_nome,
          data: dateStr,
          hora: hora,
          status: 'falta',
          tipo: sessao.tipo,
          origem_recorrencia_id: sessao.recId || ''
        });
        await incrementStudentCredits(sessao.aluno_id, 1);
      }
      await logActivity({
        action: 'UPDATE',
        resource_type: 'agenda',
        resource_name: sessao.aluno_nome,
        details: `Registrou FALTA (com crédito de reposição gerado) para ${sessao.aluno_nome} na aula de ${dateStr} às ${hora}`
      });
      setActiveMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelSessao = async (sessao: any, dateStr: string, hora: string) => {
    try {
      if (sessao.overrideId) {
        if (sessao.status !== 'falta' && sessao.status !== 'cancelado') {
          await incrementStudentCredits(sessao.aluno_id, 1);
        }
        await updateDoc(doc(db, 'agenda_aulas', sessao.overrideId), { status: 'cancelado' });
      } else {
        await addDoc(collection(db, 'agenda_aulas'), {
          aluno_id: sessao.aluno_id,
          aluno_nome: sessao.aluno_nome,
          personal_id: sessao.personal_id,
          personal_nome: sessao.personal_nome,
          data: dateStr,
          hora: hora,
          status: 'cancelado',
          tipo: sessao.tipo,
          origem_recorrencia_id: sessao.recId || ''
        });
        await incrementStudentCredits(sessao.aluno_id, 1);
      }
      await logActivity({
        action: 'UPDATE',
        resource_type: 'agenda',
        resource_name: sessao.aluno_nome,
        details: `Desmarcou a aula de ${sessao.aluno_nome} na data ${dateStr} às ${hora} (crédito em haver gerado)`
      });
      setActiveMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevertStatus = async (sessao: any) => {
    try {
      if (sessao.overrideId) {
        if (sessao.status === 'falta' || sessao.status === 'cancelado') {
          await incrementStudentCredits(sessao.aluno_id, -1);
        }
        
        if (sessao.tipo === 'recorrente') {
          // Deleta o override para reverter ao padrão 'confirmado' recorrente
          await deleteSessao(sessao.overrideId);
        } else {
          // Deleta sessões avulsas ou de reposição inteiramente
          if (sessao.tipo === 'reposicao') {
            await incrementStudentCredits(sessao.aluno_id, 1); // Devolve o crédito
          }
          await deleteSessao(sessao.overrideId);
        }
      }
      await logActivity({
        action: 'UPDATE',
        resource_type: 'agenda',
        resource_name: sessao.aluno_nome,
        details: `Restaurou status original da aula de ${sessao.aluno_nome} às ${sessao.hora}`
      });
      setActiveMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Agendamento rápido clicando no slot
  const handleQuickAdd = (data: string, hora: string) => {
    setNewSessaoForm({
      aluno_id: '',
      personal_id: '',
      tipo: 'avulso',
      data: data,
      hora: hora,
      dias: [],
      modalidade: 'musculacao'
    });
    setIsNewSessaoModalOpen(true);
  };

  // Abrir edição de agendamento fixo
  const handleOpenEditFixo = (recId: string) => {
    const item = agendamentosFixos.find(g => g.id === recId);
    if (item) {
      setFixoToEdit(item);
      setEditFixoForm({
        personal_id: item.personal_id,
        dias: item.dias || [],
        hora: item.hora,
        modalidade: item.modalidade || 'musculacao'
      });
      setIsEditFixoModalOpen(true);
    }
    setActiveMenuId(null);
  };

  // Salvar alteração de agendamento fixo
  const handleSaveEditFixo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixoToEdit) return;
    if (!editFixoForm.personal_id || editFixoForm.dias.length === 0) {
      alert("Selecione o Personal Trainer e ao menos 1 dia da semana.");
      return;
    }
    const personalSel = trainers.find(t => t.id === editFixoForm.personal_id);
    try {
      await updateDoc(doc(db, 'agendamentos_fixos', fixoToEdit.id), {
        personal_id: editFixoForm.personal_id,
        personal_nome: personalSel ? personalSel.nome : (fixoToEdit.personal_nome || ''),
        dias: editFixoForm.dias,
        hora: editFixoForm.hora,
        modalidade: editFixoForm.modalidade
      });

      // Sincroniza também no Cadastro do Aluno (horarios_fixos)
      if (fixoToEdit.aluno_id) {
        const mapAbToFull: Record<string, 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado'> = {
          'Seg': 'Segunda', 'Ter': 'Terça', 'Qua': 'Quarta', 'Qui': 'Quinta', 'Sex': 'Sexta'
        };
        const newSlots = editFixoForm.dias.map(dAb => ({
          dia_semana: mapAbToFull[dAb] || (dAb as any),
          horario: editFixoForm.hora,
          personal_id: editFixoForm.personal_id,
          personal_nome: personalSel ? personalSel.nome : ''
        }));

        await updateDoc(doc(db, 'alunos', fixoToEdit.aluno_id), {
          horarios_fixos: newSlots,
          personal_id: editFixoForm.personal_id,
          personal_nome: personalSel ? personalSel.nome : ''
        });
      }

      await logActivity({
        action: 'UPDATE',
        resource_type: 'agenda',
        resource_id: fixoToEdit.id,
        resource_name: fixoToEdit.aluno_nome,
        details: `Atualizou agendamento fixo de ${fixoToEdit.aluno_nome} para ${editFixoForm.dias.join(', ')} às ${editFixoForm.hora}`
      });
      setIsEditFixoModalOpen(false);
      setFixoToEdit(null);
      alert('Grade fixa e cadastro do aluno atualizados com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar agendamento fixo.');
    }
  };

  // Excluir agendamento fixo
  const handleDeleteFixo = async (recId: string, alunoNome: string) => {
    if (window.confirm(`Remover permanentemente a grade horária fixa (Todos os horários) de ${alunoNome}?`)) {
      try {
        await deleteDoc(doc(db, 'agendamentos_fixos', recId));
        await logActivity({
          action: 'DELETE',
          resource_type: 'agenda',
          resource_id: recId,
          resource_name: alunoNome,
          details: `Removeu a grade horária fixa de ${alunoNome} via calendário`
        });
        alert('Grade fixa removida com sucesso!');
      } catch (err) {
        console.error(err);
        alert('Erro ao remover grade fixa.');
      }
    }
    setActiveMenuId(null);
  };

  // Salvar reposição / aula avulsa / fixa recorrente
  const handleSaveNewSessao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessaoForm.aluno_id || !newSessaoForm.personal_id) {
      alert("Preencha todos os campos obrigatórios do agendamento.");
      return;
    }

    const alunoSel = alunos.find(a => a.id === newSessaoForm.aluno_id);
    const personalSel = trainers.find(t => t.id === newSessaoForm.personal_id);

    if (newSessaoForm.tipo === 'recorrente' && newSessaoForm.dias.length === 0) {
      alert("Selecione ao menos 1 dia da semana para o agendamento recorrente.");
      return;
    }

    if (newSessaoForm.tipo !== 'recorrente' && !newSessaoForm.data) {
      alert("Preencha a data do agendamento.");
      return;
    }

    if (newSessaoForm.tipo === 'reposicao' && (!alunoSel || (alunoSel.creditos_reposicao ?? 0) <= 0)) {
      alert("Este aluno não possui créditos de reposição em haver.");
      return;
    }

    try {
      if (newSessaoForm.tipo === 'recorrente') {
        await addDoc(collection(db, 'agendamentos_fixos'), {
          aluno_id: newSessaoForm.aluno_id,
          aluno_nome: alunoSel ? `${alunoSel.nome} ${alunoSel.sobrenome || ''}`.trim() : '',
          personal_id: newSessaoForm.personal_id,
          personal_nome: personalSel ? personalSel.nome : '',
          dias: newSessaoForm.dias,
          hora: newSessaoForm.hora,
          modalidade: newSessaoForm.modalidade,
          ativo: true,
          created_at: Date.now()
        });

        // Sincroniza também no perfil do Aluno (horarios_fixos)
        if (alunoSel) {
          const mapAbToFull: Record<string, 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado'> = {
            'Seg': 'Segunda', 'Ter': 'Terça', 'Qua': 'Quarta', 'Qui': 'Quinta', 'Sex': 'Sexta'
          };
          const currentSlots = alunoSel.horarios_fixos || [];
          const newSlots = [...currentSlots];

          newSessaoForm.dias.forEach(dAb => {
            const dFull = mapAbToFull[dAb] || (dAb as any);
            if (!newSlots.some(s => s.dia_semana === dFull && s.horario === newSessaoForm.hora)) {
              newSlots.push({
                dia_semana: dFull,
                horario: newSessaoForm.hora,
                personal_id: newSessaoForm.personal_id,
                personal_nome: personalSel ? personalSel.nome : ''
              });
            }
          });

          await updateDoc(doc(db, 'alunos', alunoSel.id), {
            horarios_fixos: newSlots,
            personal_id: newSessaoForm.personal_id,
            personal_nome: personalSel ? personalSel.nome : ''
          });
        }

        await logActivity({
          action: 'CREATE',
          resource_type: 'agenda',
          resource_name: alunoSel?.nome,
          details: `Criou novo agendamento fixo para ${alunoSel?.nome} em ${newSessaoForm.dias.join(', ')} às ${newSessaoForm.hora}`
        });
      } else {
        // Lotação alerta
        const sessoesSlotCount = getSessoesSlot('', newSessaoForm.data, newSessaoForm.hora).filter(s => s.status !== 'cancelado').length;
        if (sessoesSlotCount >= maxCapacity) {
          const confirm = window.confirm(`Aviso: O horário das ${newSessaoForm.hora} do dia ${newSessaoForm.data} já atingiu a lotação limite de ${maxCapacity} alunos. Deseja agendar mesmo assim?`);
          if (!confirm) return;
        }

        await addDoc(collection(db, 'agenda_aulas'), {
          aluno_id: newSessaoForm.aluno_id,
          aluno_nome: alunoSel ? `${alunoSel.nome} ${alunoSel.sobrenome || ''}`.trim() : '',
          personal_id: newSessaoForm.personal_id,
          personal_nome: personalSel ? personalSel.nome : '',
          data: newSessaoForm.data,
          hora: newSessaoForm.hora,
          status: 'confirmado',
          tipo: newSessaoForm.tipo
        });

        if (newSessaoForm.tipo === 'reposicao') {
          await incrementStudentCredits(newSessaoForm.aluno_id, -1);
        }

        await logActivity({
          action: 'CREATE',
          resource_type: 'agenda',
          resource_name: alunoSel?.nome,
          details: `Agendou aula de ${newSessaoForm.tipo.toUpperCase()} para ${alunoSel?.nome} em ${newSessaoForm.data} às ${newSessaoForm.hora}`
        });
      }

      setIsNewSessaoModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao agendar aula.');
    }
  };

  // Abrir remarcação pontual
  const handleOpenReschedule = (sessao: any, dateStr: string) => {
    setSessaoToReschedule({
      aluno_id: sessao.aluno_id,
      aluno_nome: sessao.aluno_nome,
      personal_id: sessao.personal_id,
      personal_nome: sessao.personal_nome,
      originalDateStr: dateStr,
      originalHora: sessao.hora,
      recId: sessao.recId,
      overrideId: sessao.overrideId
    });
    setRescheduleForm({
      targetDate: dateStr,
      targetHora: sessao.hora
    });
    setIsRescheduleModalOpen(true);
    setActiveMenuId(null);
  };

  // Salvar remarcação pontual (exceção)
  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessaoToReschedule) return;

    const { originalDateStr, originalHora, aluno_id, aluno_nome, personal_id, personal_nome, recId, overrideId } = sessaoToReschedule;
    const { targetDate, targetHora } = rescheduleForm;

    if (originalDateStr === targetDate && originalHora === targetHora) {
      alert("Selecione uma data ou horário diferente do original.");
      return;
    }

    try {
      // 1. Cancelar aula original
      if (overrideId) {
        await updateDoc(doc(db, 'agenda_aulas', overrideId), { status: 'cancelado' });
      } else {
        await addDoc(collection(db, 'agenda_aulas'), {
          aluno_id,
          aluno_nome,
          personal_id,
          personal_nome,
          data: originalDateStr,
          hora: originalHora,
          status: 'cancelado',
          tipo: 'recorrente',
          origem_recorrencia_id: recId || ''
        });
      }

      // 2. Criar nova aula avulsa no slot de destino
      await addDoc(collection(db, 'agenda_aulas'), {
        aluno_id,
        aluno_nome,
        personal_id,
        personal_nome,
        data: targetDate,
        hora: targetHora,
        status: 'confirmado',
        tipo: 'avulso',
        data_original: originalDateStr
      });

      await logActivity({
        action: 'UPDATE',
        resource_type: 'agenda',
        resource_name: aluno_nome,
        details: `Remarcou aula de ${aluno_nome} de ${originalDateStr} às ${originalHora} para ${targetDate} às ${targetHora} (Apenas hoje)`
      });

      setIsRescheduleModalOpen(false);
      setSessaoToReschedule(null);
      alert('Aula remarcada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao remarcar aula.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controles de Visualização */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Grade & Agenda de Aulas 📅</h2>
          <p className="text-surface-500 text-sm">
            Gerencie horários fixos, reposições e visualização por profissional (dia, semana e mês).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Seletor de Visão (Dia, Semana, Mês) */}
          <div className="flex bg-surface-100 p-1 rounded-xl border border-surface-200 text-xs font-bold shadow-inner">
            <button 
              onClick={() => setViewMode('dia')} 
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'dia' ? 'bg-white text-brand-dark shadow-sm font-extrabold' : 'text-surface-500 hover:text-brand-dark'
              }`}
            >
              📅 Dia
            </button>
            <button 
              onClick={() => setViewMode('semana')} 
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'semana' ? 'bg-white text-brand-dark shadow-sm font-extrabold' : 'text-surface-500 hover:text-brand-dark'
              }`}
            >
              🗓️ Semana
            </button>
            <button 
              onClick={() => setViewMode('mes')} 
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'mes' ? 'bg-white text-brand-dark shadow-sm font-extrabold' : 'text-surface-500 hover:text-brand-dark'
              }`}
            >
              📆 Mês
            </button>
          </div>

          {/* Navegação da Data */}
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-2 bg-white border border-surface-200 hover:bg-surface-50 text-brand-dark font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-all flex items-center gap-1"
            title="Voltar para a data de hoje"
          >
            Hoje
          </button>

          <div className="flex items-center gap-1 bg-white border border-surface-200 rounded-xl p-1 shadow-sm">
            <button 
              onClick={() => {
                if (viewMode === 'dia') navigateDay(-1);
                else if (viewMode === 'semana') navigateWeek(-1);
                else navigateMonth(-1);
              }} 
              className="p-2 hover:bg-surface-50 rounded-lg text-surface-600 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <span className="text-xs font-bold text-brand-dark px-3 min-w-[140px] text-center">
              {viewMode === 'dia' ? (
                currentDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
              ) : viewMode === 'semana' ? (
                formatDateLabel()
              ) : (
                currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
              )}
            </span>

            <button 
              onClick={() => {
                if (viewMode === 'dia') navigateDay(1);
                else if (viewMode === 'semana') navigateWeek(1);
                else navigateMonth(1);
              }} 
              className="p-2 hover:bg-surface-50 rounded-lg text-surface-600 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

      {/* Banner da Regra de Confirmação Automática */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between text-xs text-emerald-950 font-medium shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-600 text-white rounded-xl">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span>
            <strong>Confirmação Automática Ativa:</strong> Agendamentos não desmarcados ou reagendados previamente são <strong>automaticamente confirmados/realizados ao fim do dia</strong>. Ausências não notificados não geram créditos de reposição.
          </span>
        </div>
      </div>

          <button 
            onClick={() => {
              setNewSessaoForm({
                aluno_id: '',
                personal_id: '',
                tipo: 'avulso',
                data: currentDate.toISOString().split('T')[0],
                hora: '08:00',
                dias: [],
                modalidade: 'musculacao'
              });
              setIsNewSessaoModalOpen(true);
            }} 
            className="btn-primary"
          >
            <Plus className="w-5 h-5" />
            Novo Agendamento / Encaixe
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. VISÃO DIA (ANALÍTICA POR PROFISSIONAL) */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'dia' && (
        <div className="glass-card p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header com os Profissionais lado a lado */}
              <div className="grid grid-cols-4 border-b border-surface-200 pb-4 mb-2 text-center font-display font-bold text-brand-dark text-sm">
                <div className="text-left pl-4 text-surface-400 self-center">Horário</div>
                {trainers.length > 0 ? (
                  trainers.map((t) => (
                    <div key={t.id} className="flex flex-col items-center justify-center p-2 bg-brand-dark/5 rounded-xl border border-brand-medium/10">
                      <span className="text-brand-dark font-extrabold">{t.nome}</span>
                      <span className="text-[10px] text-surface-400 font-semibold uppercase">Personal Trainer</span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-center text-surface-400 italic text-xs">Nenhum personal trainer cadastrado.</div>
                )}
              </div>

              {/* Linhas de horários */}
              <div className="divide-y divide-surface-100 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1">
                {slotsHorarios.map((hora) => {
                  const dateStr = currentDate.toISOString().split('T')[0];
                  const dayOfWeekNum = currentDate.getDay();
                  const diasAbrevMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  const diaAbrev = diasAbrevMap[dayOfWeekNum];
                  const slotSessoes = getSessoesSlot(diaAbrev, dateStr, hora);

                  return (
                    <div key={hora} className="grid grid-cols-4 items-stretch min-h-[80px] hover:bg-surface-50/10">
                      {/* Hora */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-surface-500 py-3 pl-2">
                        <Clock className="w-3.5 h-3.5 text-brand-medium" />
                        {hora}
                      </div>

                      {/* Coluna de cada Trainer */}
                      {trainers.map((trainer) => {
                        const trainerSessoes = slotSessoes.filter(s => s.personal_id === trainer.id || s.personal_nome === trainer.nome);
                        return (
                          <div key={trainer.id} className="border-l border-surface-100 p-2 flex flex-col gap-1.5 relative group/slot">
                            {trainerSessoes.length > 0 ? (
                              trainerSessoes.map(sessao => (
                                <div key={sessao.id} className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-sm ${getStatusStyle(sessao.status)}`}>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-brand-dark">{sessao.aluno_nome}</span>
                                    <span className="text-[10px] opacity-80">{sessao.tipo === 'reposicao' ? '⚡ Encaixe' : sessao.tipo === 'avulso' ? '📌 Avulso' : '🟢 Fixo'}</span>
                                  </div>
                                  
                                  <button onClick={() => setActiveMenuId(activeMenuId === sessao.id ? null : sessao.id)} className="p-1 hover:bg-black/5 rounded">
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>

                                  {activeMenuId === sessao.id && (
                                    <div className="absolute right-0 top-5 w-48 bg-white border border-surface-200 shadow-xl rounded-xl z-30 overflow-hidden text-left font-normal">
                                      <button 
                                        onClick={() => handleMarkPresenca(sessao, dateStr, hora)}
                                        className="w-full text-left px-3 py-2 text-[10px] font-bold text-green-700 hover:bg-green-50 transition-colors border-b border-surface-100 flex items-center gap-1.5"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Confirmar Presença
                                      </button>
                                      
                                      <button 
                                        onClick={() => handleMarkFalta(sessao, dateStr, hora)}
                                        className="w-full text-left px-3 py-2 text-[10px] font-bold text-red-700 hover:bg-red-50 transition-colors border-b border-surface-100 flex items-center gap-1.5"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Marcar Falta (Crédito)
                                      </button>

                                      <button 
                                        onClick={() => handleCancelSessao(sessao, dateStr, hora)}
                                        className="w-full text-left px-3 py-2 text-[10px] font-semibold text-surface-600 hover:bg-surface-50 transition-colors border-b border-surface-100 flex items-center gap-1.5"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        Desmarcar (Crédito)
                                      </button>

                                      <button 
                                        onClick={() => handleOpenReschedule(sessao, dateStr)}
                                        className="w-full text-left px-3 py-2 text-[10px] font-semibold text-brand-dark hover:bg-surface-50 transition-colors border-b border-surface-100 flex items-center gap-1.5"
                                      >
                                        <CalendarDays className="w-3.5 h-3.5 text-brand-medium" />
                                        Remarcar (Hoje)
                                      </button>

                                      {sessao.overrideId && (
                                        <button 
                                          onClick={() => handleRevertStatus(sessao)}
                                          className="w-full text-left px-3 py-2 text-[10px] font-semibold text-surface-600 hover:bg-surface-100 transition-colors flex items-center gap-1.5"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5 text-surface-400" />
                                          Restaurar Status
                                        </button>
                                      )}

                                      {sessao.tipo === 'recorrente' && sessao.recId && (
                                        <>
                                          <button 
                                            onClick={() => handleOpenEditFixo(sessao.recId!)}
                                            className="w-full text-left px-3 py-2 text-[10px] font-bold text-indigo-700 hover:bg-indigo-50 border-t border-surface-100 transition-colors flex items-center gap-1.5"
                                          >
                                            <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                                            Editar Fixo (Todos)
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteFixo(sessao.recId!, sessao.aluno_nome)}
                                            className="w-full text-left px-3 py-2 text-[10px] font-bold text-red-700 hover:bg-red-50 transition-colors flex items-center gap-1.5"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                            Remover Fixo (Todos)
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}

                                </div>
                              ))
                            ) : (
                              <div 
                                onClick={() => handleQuickAdd(dateStr, hora)}
                                className="h-full border border-dashed border-surface-200 rounded-xl flex items-center justify-center text-[10px] text-surface-400 hover:border-brand-medium hover:text-brand-medium transition-colors cursor-pointer"
                              >
                                + Encaixar Aluno
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. VISÃO SEMANA (GRADE AGRUPADA POR PROFISSIONAL) */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'semana' && (
        <div className="glass-card p-6 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              {/* Header dos dias */}
              <div className="grid grid-cols-6 border-b border-surface-200 pb-4 mb-2 text-center font-display font-bold text-brand-dark text-sm">
                <div className="text-left pl-4 text-surface-400 self-center">Horário</div>
                {weekDays.map((dia, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <span>{diasSemana[idx]}</span>
                    <span className="text-xs text-surface-400 font-semibold mt-0.5">
                      {dia.getDate()} {dia.toLocaleString('pt-BR', { month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Linhas de horários */}
              <div className="divide-y divide-surface-100 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1">
                {slotsHorarios.map((hora) => (
                  <div key={hora} className="grid grid-cols-6 items-stretch min-h-[95px] hover:bg-surface-50/10">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-surface-500 py-3 pl-2">
                      <Clock className="w-3.5 h-3.5 text-brand-medium" />
                      {hora}
                    </div>

                    {diasAbrev.map((diaAbrev, dayIdx) => {
                      const activeDay = weekDays[dayIdx];
                      const dateStr = activeDay.toISOString().split('T')[0];
                      const slotSessoes = getSessoesSlot(diaAbrev, dateStr, hora);
                      
                      const activeCount = slotSessoes.filter(s => s.status !== 'cancelado').length;
                      const isOverCapacity = activeCount > maxCapacity;
                      const groupedByTrainer = groupSessoesByTrainer(slotSessoes);

                      return (
                        <div 
                          key={diaAbrev} 
                          className="border-l border-surface-100 p-2 flex flex-col gap-1.5 hover:bg-surface-50/20 transition-colors relative group/slot cursor-pointer"
                          onClick={(e) => {
                            if (e.target === e.currentTarget) {
                              handleQuickAdd(dateStr, hora);
                            }
                          }}
                        >
                          {/* Indicador de Lotação */}
                          {activeCount > 0 && (
                            <div className={`absolute top-1 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isOverCapacity 
                                ? 'bg-red-100 text-red-700' 
                                : activeCount === maxCapacity 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-surface-100 text-surface-500'
                            }`}>
                              {activeCount}/{maxCapacity}
                            </div>
                          )}

                          <div className="mt-3 space-y-2 flex-1 flex flex-col justify-start">
                            {Object.entries(groupedByTrainer).map(([trainerName, sessoesList]) => (
                              <div key={trainerName} className="space-y-1 bg-surface-50/80 p-1.5 rounded-xl border border-surface-200/80">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-brand-dark flex items-center justify-between px-1">
                                  <span>👤 {trainerName}</span>
                                  <span className="text-[8px] bg-brand-dark/10 px-1 rounded">{sessoesList.length}</span>
                                </div>

                                {sessoesList.map((sessao) => (
                                  <div 
                                    key={sessao.id}
                                    className={`p-1.5 rounded-lg border text-[11px] font-semibold flex flex-col justify-between transition-all hover:shadow-md relative group/card ${getStatusStyle(sessao.status)}`}
                                  >
                                    <div className="flex justify-between items-start gap-1">
                                      <div className="flex flex-col max-w-[85%]">
                                        <span className="font-bold truncate">{sessao.aluno_nome}</span>
                                        {sessao.plano_nome && (
                                          <span className="text-[9.5px] font-semibold text-brand-medium truncate">
                                            {sessao.plano_nome}
                                          </span>
                                        )}
                                        <div className="flex items-center gap-1 mt-0.5">
                                          {sessao.tipo === 'reposicao' ? (
                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white">⚡ Encaixe</span>
                                          ) : sessao.tipo === 'avulso' ? (
                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-500 text-white">📌 Avulso</span>
                                          ) : (
                                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-brand-dark/10 text-brand-dark">🟢 Fixo</span>
                                          )}
                                        </div>
                                      </div>

                                      <button 
                                        onClick={() => setActiveMenuId(activeMenuId === sessao.id ? null : sessao.id)}
                                        className="p-0.5 hover:bg-black/5 rounded text-surface-500 hover:text-brand-dark transition-all cursor-pointer"
                                      >
                                        <MoreVertical className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. VISÃO MÊS (SINTÉTICA) */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'mes' && (
        <div className="glass-card p-6">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center font-bold text-xs text-brand-dark uppercase">
            <div>Segunda</div>
            <div>Terça</div>
            <div>Quarta</div>
            <div>Quinta</div>
            <div>Sexta</div>
            <div>Sábado</div>
            <div>Domingo</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {getMonthDaysGrid(currentDate).map((dayObj, idx) => {
              const dStr = dayObj.date.toISOString().split('T')[0];
              const isToday = dStr === new Date().toISOString().split('T')[0];

              // Aulas do dia
              const daySessoes = agendaAulas.filter(a => a.data === dStr && a.status !== 'cancelado');
              const presencas = daySessoes.filter(a => a.status === 'presenca').length;
              const encaixes = daySessoes.filter(a => a.tipo === 'reposicao').length;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentDate(dayObj.date);
                    setViewMode('dia');
                  }}
                  className={`min-h-[100px] p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    !dayObj.isCurrentMonth
                      ? 'bg-surface-50/50 text-surface-300 border-surface-100'
                      : isToday
                      ? 'bg-brand-medium/10 border-brand-medium text-brand-dark shadow-md'
                      : 'bg-white border-surface-200 hover:border-brand-medium/50 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold text-sm">
                    <span>{dayObj.date.getDate()}</span>
                    {daySessoes.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-dark text-white">
                        {daySessoes.length} aulas
                      </span>
                    )}
                  </div>

                  {dayObj.isCurrentMonth && daySessoes.length > 0 ? (
                    <div className="space-y-1 text-[10px] font-semibold">
                      <div className="text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        {presencas} confirmados
                      </div>
                      {encaixes > 0 && (
                        <div className="text-amber-700 flex items-center gap-1">
                          ⚡ {encaixes} encaixe(s)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-surface-400 italic">Sem agendamentos</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

{/* Modal Novo Agendamento / Reposição */}
      {isNewSessaoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsNewSessaoModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-surface-200 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-dark">Agendar Aula ou Grade Horária</h3>
              <button onClick={() => setIsNewSessaoModalOpen(false)} className="p-2 hover:bg-surface-100 rounded-xl text-surface-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewSessao} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Tipo de Agendamento</label>
                <select 
                  value={newSessaoForm.tipo} 
                  onChange={e => setNewSessaoForm({ ...newSessaoForm, tipo: e.target.value as any })} 
                  className="input-field"
                >
                  <option value="avulso">Aula Avulsa (Avulso)</option>
                  <option value="reposicao">Aula de Reposição (Consome 1 Crédito)</option>
                  <option value="recorrente">Grade Semanal Recorrente (Fixo)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Selecione o Aluno</label>
                <select 
                  value={newSessaoForm.aluno_id} 
                  onChange={e => setNewSessaoForm({ ...newSessaoForm, aluno_id: e.target.value })} 
                  className="input-field"
                >
                  <option value="">-- Selecione o Aluno --</option>
                  {alunos.filter(a => a.ativo).map(a => {
                    const credits = a.creditos_reposicao ?? 0;
                    return (
                      <option key={a.id} value={a.id}>
                        {a.nome} {a.sobrenome || ''} {newSessaoForm.tipo === 'reposicao' ? `(${credits} em haver)` : ''}
                      </option>
                    );
                  })}
                </select>
                {newSessaoForm.tipo === 'reposicao' && newSessaoForm.aluno_id && (
                  <p className="text-xs text-amber-600 font-semibold mt-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    Esta operação irá descontar 1 aula em haver do saldo do aluno.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Personal Trainer</label>
                <select 
                  value={newSessaoForm.personal_id} 
                  onChange={e => setNewSessaoForm({ ...newSessaoForm, personal_id: e.target.value })} 
                  className="input-field"
                >
                  <option value="">-- Selecione o Personal --</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>

              {newSessaoForm.tipo === 'recorrente' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-brand-dark">Horário Fixo</label>
                      <select 
                        value={newSessaoForm.hora} 
                        onChange={e => setNewSessaoForm({ ...newSessaoForm, hora: e.target.value })} 
                        className="input-field"
                      >
                        {slotsHorarios.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-brand-dark">Modalidade</label>
                      <select 
                        value={newSessaoForm.modalidade} 
                        onChange={e => setNewSessaoForm({ ...newSessaoForm, modalidade: e.target.value as any })} 
                        className="input-field"
                      >
                        <option value="musculacao">Musculação</option>
                        <option value="funcional">Funcional</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-brand-dark block">Dias da Semana Recorrentes</label>
                    <div className="flex flex-wrap gap-2">
                      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map(dia => {
                        const isSelected = newSessaoForm.dias.includes(dia);
                        return (
                          <button
                            type="button"
                            key={dia}
                            onClick={() => {
                              setNewSessaoForm(prev => {
                                const dias = prev.dias.includes(dia)
                                  ? prev.dias.filter(d => d !== dia)
                                  : [...prev.dias, dia];
                                return { ...prev, dias };
                              });
                            }}
                            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-brand-medium text-white border-brand-medium shadow-sm shadow-brand-medium/20' 
                                : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                            }`}
                          >
                            {dia}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Data</label>
                    <input 
                      type="date" 
                      value={newSessaoForm.data} 
                      onChange={e => setNewSessaoForm({ ...newSessaoForm, data: e.target.value })} 
                      className="input-field" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-brand-dark">Horário</label>
                    <select 
                      value={newSessaoForm.hora} 
                      onChange={e => setNewSessaoForm({ ...newSessaoForm, hora: e.target.value })} 
                      className="input-field"
                    >
                      {slotsHorarios.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setIsNewSessaoModalOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  <Save className="w-5 h-5" />
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Remarcação (Exceção de Hoje) */}
      {isRescheduleModalOpen && sessaoToReschedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => setIsRescheduleModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-surface-200 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-dark">Remarcar Aula (Apenas Hoje)</h3>
              <button onClick={() => setIsRescheduleModalOpen(false)} className="p-2 hover:bg-surface-100 rounded-xl text-surface-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReschedule} className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-xs text-amber-700 leading-relaxed font-semibold">
                Esta ação cancelará a aula de {sessaoToReschedule.aluno_nome} do dia {sessaoToReschedule.originalDateStr} às {sessaoToReschedule.originalHora} (gerando crédito) e agendará uma reposição avulsa para a nova data selecionada.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark">Nova Data</label>
                  <input 
                    type="date" 
                    value={rescheduleForm.targetDate} 
                    onChange={e => setRescheduleForm({ ...rescheduleForm, targetDate: e.target.value })} 
                    className="input-field" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark">Novo Horário</label>
                  <select 
                    value={rescheduleForm.targetHora} 
                    onChange={e => setRescheduleForm({ ...rescheduleForm, targetHora: e.target.value })} 
                    className="input-field"
                  >
                    {slotsHorarios.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => setIsRescheduleModalOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  <Save className="w-5 h-5" />
                  Salvar Remarcação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Agendamento Fixo (Todos) */}
      {isEditFixoModalOpen && fixoToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => { setIsEditFixoModalOpen(false); setFixoToEdit(null); }}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-surface-200 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-dark">Editar Grade Horária Fixa</h3>
              <button onClick={() => { setIsEditFixoModalOpen(false); setFixoToEdit(null); }} className="p-2 hover:bg-surface-100 rounded-xl text-surface-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditFixo} className="space-y-4">
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-xs text-indigo-700 leading-relaxed font-semibold">
                Aluno: <strong>{fixoToEdit.aluno_nome}</strong><br/>
                Esta alteração mudará o horário fixo recorrente de todas as semanas para este aluno.
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-brand-dark">Personal Trainer</label>
                <select 
                  value={editFixoForm.personal_id} 
                  onChange={e => setEditFixoForm({ ...editFixoForm, personal_id: e.target.value })} 
                  className="input-field"
                >
                  <option value="">-- Selecione o Personal --</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark">Horário Fixo</label>
                  <select 
                    value={editFixoForm.hora} 
                    onChange={e => setEditFixoForm({ ...editFixoForm, hora: e.target.value })} 
                    className="input-field"
                  >
                    {slotsHorarios.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-brand-dark">Modalidade</label>
                  <select 
                    value={editFixoForm.modalidade} 
                    onChange={e => setEditFixoForm({ ...editFixoForm, modalidade: e.target.value as any })} 
                    className="input-field"
                  >
                    <option value="musculacao">Musculação</option>
                    <option value="funcional">Funcional</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-brand-dark block">Dias da Semana Recorrentes</label>
                <div className="flex flex-wrap gap-2">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map(dia => {
                    const isSelected = editFixoForm.dias.includes(dia);
                    return (
                      <button
                        type="button"
                        key={dia}
                        onClick={() => {
                          setEditFixoForm(prev => {
                            const dias = prev.dias.includes(dia)
                              ? prev.dias.filter(d => d !== dia)
                              : [...prev.dias, dia];
                            return { ...prev, dias };
                          });
                        }}
                        className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-brand-medium text-white border-brand-medium shadow-sm shadow-brand-medium/20' 
                            : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                        }`}
                      >
                        {dia}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                <button type="button" onClick={() => { setIsEditFixoModalOpen(false); setFixoToEdit(null); }} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  <Save className="w-5 h-5" />
                  Salvar Grade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendaCalendario;
