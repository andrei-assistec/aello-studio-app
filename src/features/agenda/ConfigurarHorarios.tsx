import React, { useState, useEffect } from 'react';
import { Save, Clock, HelpCircle, Check, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { logActivity } from '../../services/logger';

export const ConfigurarHorarios = () => {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const [config, setConfig] = useState({
    inicio_manha: '06:00',
    fim_manha: '12:00',
    inicio_tarde: '14:00',
    fim_noite: '22:00',
    max_alunos_slot: 3,
    tempo_cancelamento_h: 2,
  });

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const docRef = doc(db, 'config', 'agenda');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setConfig({
            inicio_manha: data.inicio_manha || '06:00',
            fim_manha: data.fim_manha || '12:00',
            inicio_tarde: data.inicio_tarde || '14:00',
            fim_noite: data.fim_noite || '22:00',
            max_alunos_slot: Number(data.max_alunos_slot ?? 3),
            tempo_cancelamento_h: Number(data.tempo_cancelamento_h ?? 2),
          });
        }
      } catch (err) {
        console.error('Erro ao carregar configurações de horário:', err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setSucesso(false);
    try {
      const docRef = doc(db, 'config', 'agenda');
      await setDoc(docRef, config);
      await logActivity({
        action: 'UPDATE',
        resource_type: 'agenda',
        details: 'Atualizou as configurações gerais de horários e limites do studio'
      });
      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar as configurações.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4 text-surface-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-medium" />
        <p>Carregando configurações de horário...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-display text-brand-dark">Configuração de Horários ⚙️</h2>
          <p className="text-surface-500">Defina os limites de turmas e janelas de funcionamento do studio.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Janelas de Funcionamento */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-brand-dark">
            <Clock className="w-5 h-5 text-amber-500" />
            Horários de Atendimento
          </h3>
          <p className="text-sm text-surface-400 mb-6">Configure o horário de início e término em que o studio está aberto para treinos.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">Início do Turno da Manhã</label>
              <input 
                type="time" 
                value={config.inicio_manha} 
                onChange={(e) => setConfig({ ...config, inicio_manha: e.target.value })}
                className="input-field" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">Fim do Turno da Manhã</label>
              <input 
                type="time" 
                value={config.fim_manha} 
                onChange={(e) => setConfig({ ...config, fim_manha: e.target.value })}
                className="input-field" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">Início do Turno da Tarde/Noite</label>
              <input 
                type="time" 
                value={config.inicio_tarde} 
                onChange={(e) => setConfig({ ...config, inicio_tarde: e.target.value })}
                className="input-field" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">Fim do Turno da Noite</label>
              <input 
                type="time" 
                value={config.fim_noite} 
                onChange={(e) => setConfig({ ...config, fim_noite: e.target.value })}
                className="input-field" 
              />
            </div>
          </div>
        </div>

        {/* Parâmetros de Lotação */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-brand-dark">
            <HelpCircle className="w-5 h-5 text-brand-medium" />
            Capacidade e Regras
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">Máximo de Alunos por Horário</label>
              <input 
                type="number" 
                value={config.max_alunos_slot} 
                onChange={(e) => setConfig({ ...config, max_alunos_slot: parseInt(e.target.value) || 1 })}
                className="input-field" 
                min="1"
              />
              <p className="text-xs text-surface-400 mt-1">Garante que o personal trainer não atenda mais alunos do que o configurado simultaneamente.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">Tempo Mínimo para Cancelamento (Horas)</label>
              <input 
                type="number" 
                value={config.tempo_cancelamento_h} 
                onChange={(e) => setConfig({ ...config, tempo_cancelamento_h: parseInt(e.target.value) || 0 })}
                className="input-field" 
                min="0"
              />
              <p className="text-xs text-surface-400 mt-1">Tempo limite para o aluno desmarcar a aula sem perder a sessão.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            type="submit" 
            disabled={salvando}
            className="btn-primary"
          >
            {salvando ? 'Salvando...' : (
              <>
                <Save className="w-5 h-5" />
                Salvar Configurações
              </>
            )}
          </button>

          {sucesso && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-semibold animate-fade-in">
              <Check className="w-5 h-5" />
              Configurações salvas com sucesso!
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ConfigurarHorarios;
