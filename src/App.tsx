import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardGeral } from './features/dashboard/DashboardGeral';
import { PrescricaoLayout } from './layouts/PrescricaoLayout';
import { PrescricaoDashboard } from './features/prescricao/PrescricaoDashboard';
import { AlunosList } from './features/alunos/AlunosList';
import { ExerciciosList } from './features/exercicios/ExerciciosList';
import { PrescricaoEngine } from './features/prescricao/PrescricaoEngine';
import { ImportadorPDFPage } from './features/prescricao/ImportadorPDFPage';
import { AvaliacaoFisicaPage } from './features/prescricao/AvaliacaoFisicaPage';
import { EquipamentosList } from './features/equipamentos/EquipamentosList';
import { SettingsPage } from './features/settings/SettingsPage';
import { TreinoMobile } from './pages/TreinoMobile';
import { AppLayout } from './layouts/AppLayout';
import { RelatoriosPage } from './features/relatorios/RelatoriosPage';

import { FinanceiroLayout } from './layouts/FinanceiroLayout';
import { FinanceiroDashboard } from './features/financeiro/FinanceiroDashboard';
import { ContasReceber } from './features/financeiro/ContasReceber';
import { ContasPagar } from './features/financeiro/ContasPagar';
import { FluxoCaixa } from './features/financeiro/FluxoCaixa';
import { ConciliacaoBancaria } from './features/financeiro/ConciliacaoBancaria';
import { PlanoDeContasPage } from './features/financeiro/PlanoDeContasPage';
import { ContasFixasPage } from './features/financeiro/ContasFixasPage';
import { ProLaborePage } from './features/financeiro/ProLaborePage';

import { AgendaLayout } from './layouts/AgendaLayout';
import { AgendaCalendario } from './features/agenda/AgendaCalendario';
import { ConfigurarHorarios } from './features/agenda/ConfigurarHorarios';
import { AgendamentosList } from './features/agenda/AgendamentosList';
import { SaldoAulasPage } from './features/agenda/SaldoAulasPage';

import { MensalidadesLayout } from './layouts/MensalidadesLayout';
import { CadastroPlanos } from './features/mensalidades/CadastroPlanos';
import { HistoricoRenovacoes } from './features/mensalidades/HistoricoRenovacoes';

import { FuncionariosList } from './features/funcionarios/FuncionariosList';
import { FolhaComissoes } from './features/financeiro/FolhaComissoes';

import { EstoqueList } from './features/estoque/EstoqueList';
import { ComprasList } from './features/compras/ComprasList';
import { VendasList } from './features/vendas/VendasList';
import { RelatorioComissao } from './features/comissao/RelatorioComissao';
import { RelatoriosEstoqueVendas } from './features/relatorios/RelatoriosEstoqueVendas';

import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-brand-medium" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Rota pública para visualização mobile do treino (sem sidebar) */}
      <Route path="/meutreino/:id" element={<TreinoMobile />} />

      {!user ? (
        // Rotas quando deslogado
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        // Rotas quando logado
        <>
          <Route 
            path="/" 
            element={
              <AppLayout>
                <DashboardGeral />
              </AppLayout>
            } 
          />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/painel" element={<Navigate to="/" replace />} />

          {/* Módulo Prescrição */}
          <Route 
            path="/prescricao/*" 
            element={
              <ProtectedRoute module="prescricao">
                <PrescricaoLayout>
                  <Routes>
                    <Route path="/" element={<PrescricaoDashboard />} />
                    <Route path="/alunos" element={<AlunosList />} />
                    <Route path="/exercicios" element={<ExerciciosList />} />
                    <Route path="/motor" element={<PrescricaoEngine />} />
                    <Route path="/avaliacao" element={<AvaliacaoFisicaPage />} />
                    <Route path="/importador" element={<ImportadorPDFPage />} />
                    <Route path="/equipamentos" element={<EquipamentosList />} />
                    <Route path="/historico" element={<div className="glass-card p-8 text-brand-dark font-semibold">Histórico & Relatórios (Em breve)</div>} />
                    <Route path="*" element={<Navigate to="/prescricao" replace />} />
                  </Routes>
                </PrescricaoLayout>
              </ProtectedRoute>
            } 
          />

          {/* Módulo Financeiro */}
          <Route 
            path="/financeiro/*" 
            element={
              <ProtectedRoute module="financeiro">
                <FinanceiroLayout>
                  <Routes>
                     <Route path="/" element={<FinanceiroDashboard />} />
                     <Route path="/prolabore" element={<ProLaborePage />} />
                     <Route path="/receitas" element={<ContasReceber />} />
                     <Route path="/despesas" element={<ContasPagar />} />
                     <Route path="/contas-fixas" element={<ContasFixasPage />} />
                     <Route path="/caixa" element={<FluxoCaixa />} />
                     <Route path="/funcionarios" element={<FuncionariosList />} />
                     <Route path="/folha" element={<FolhaComissoes />} />
                     <Route path="/conciliacao" element={<ConciliacaoBancaria />} />
                     <Route path="/planodecontas" element={<PlanoDeContasPage />} />
                     <Route path="*" element={<Navigate to="/financeiro" replace />} />
                  </Routes>
                </FinanceiroLayout>
              </ProtectedRoute>
            } 
          />

          {/* Módulo Agenda */}
          <Route 
            path="/agenda/*" 
            element={
              <ProtectedRoute module="agenda">
                <AgendaLayout>
                  <Routes>
                    <Route path="/" element={<AgendaCalendario />} />
                    <Route path="/configuracao" element={<ConfigurarHorarios />} />
                    <Route path="/agendamentos" element={<AgendamentosList />} />
                    <Route path="/saldo-aulas" element={<SaldoAulasPage />} />
                    <Route path="/profissionais" element={<FuncionariosList />} />
                    <Route path="*" element={<Navigate to="/agenda" replace />} />
                  </Routes>
                </AgendaLayout>
              </ProtectedRoute>
            } 
          />

          {/* Módulo Controle de Mensalidades */}
          <Route 
            path="/mensalidades/*" 
            element={
              <ProtectedRoute module="mensalidades">
                <MensalidadesLayout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/mensalidades/planos" replace />} />
                    <Route path="/planos" element={<CadastroPlanos />} />
                    <Route path="/renovacoes" element={<HistoricoRenovacoes />} />
                    <Route path="*" element={<Navigate to="/mensalidades/planos" replace />} />
                  </Routes>
                </MensalidadesLayout>
              </ProtectedRoute>
            } 
          />

          {/* Módulo Vendas (PDV Balcão) */}
          <Route 
            path="/vendas" 
            element={
              <ProtectedRoute module="vendas">
                <AppLayout>
                  <VendasList />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          {/* Módulo Estoque */}
          <Route 
            path="/estoque" 
            element={
              <ProtectedRoute module="estoque">
                <AppLayout>
                  <EstoqueList />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          {/* Módulo Compras */}
          <Route 
            path="/compras" 
            element={
              <ProtectedRoute module="compras">
                <AppLayout>
                  <ComprasList />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          {/* Relatório de Comissões */}
          <Route 
            path="/comissoes" 
            element={
              <ProtectedRoute module="comissao">
                <AppLayout>
                  <RelatorioComissao />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          {/* Relatórios Estratégicos (Curva ABC / Giro) */}
          <Route 
            path="/relatorios/estoque-vendas" 
            element={
              <ProtectedRoute module="relatorios">
                <AppLayout>
                  <RelatoriosEstoqueVendas />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          {/* Relatórios & Análises */}
          <Route 
            path="/relatorios" 
            element={
              <ProtectedRoute module="relatorios">
                <AppLayout>
                  <RelatoriosPage />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          {/* Configurações Global */}
          <Route 
            path="/configuracoes" 
            element={
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            } 
          />

          {/* Fallback para logados */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}

function App() {
  return (
    <UserProvider>
      <Router>
        <AppRoutes />
      </Router>
    </UserProvider>
  );
}

export default App;
