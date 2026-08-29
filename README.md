# Aello Studio — ERP & Prescrição Inteligente de Treinos 🏋️‍♂️📊

Sistema integrado de gestão operacional, financeira e prescrição de treinos com Inteligência Artificial para estúdios de treinamento personalizado, musculação e funcional.

**Produção:** [https://aello-prescritor.web.app](https://aello-prescritor.web.app)

---

## 🚀 Tecnologias Utilizadas

- **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Backend & Nuvem:** [Firebase](https://firebase.google.com/) (Cloud Firestore, Firebase Authentication, Firebase Hosting)
- **Inteligência Artificial:** [Google Gemini API](https://ai.google.dev/) (Motor de Prescrição e Análise de Treinos)
- **Rotinas Administrativas:** Python 3 (Scripts de sincronização, auditoria e migração via `firebase-admin`)

---

## 🧭 Estrutura de Módulos

```
1º Dashboard Geral (/)
2º Agenda (/agenda)
3º Cadastros
   ├── Alunos (/prescricao/alunos)
   ├── Colaboradores & Profissionais (/funcionarios)
   ├── Planos & Valores (/mensalidades/planos)
   ├── Plano de Contas (/financeiro/plano-contas)
   ├── Banco de Exercícios (/prescricao/exercicios)
   └── Equipamentos (/equipamentos)
4º Financeiro
   ├── Dashboard Financeiro (/financeiro)
   ├── Contas a Receber (/financeiro/receitas)
   ├── Contas a Pagar (/financeiro/despesas)
   ├── Fluxo de Caixa (/financeiro/caixa)
   ├── Contas Fixas (/financeiro/contas-fixas)
   ├── Pro Labore (/financeiro/prolabore)
   ├── Comissões (/financeiro/folha)
   └── Conciliação Bancária (/financeiro/conciliacao)
5º Prescrição de Treinos
   ├── Dashboard Treinos (/prescricao)
   ├── Avaliação Física (/prescricao/avaliacao)
   ├── Prescrições com IA (/prescricao/motor)
   └── Importador de PDFs (/prescricao/importador)
6º Relatórios & Análises (/relatorios)
```

---

## 💡 Principais Recursos & Funcionalidades

### 1. Dashboard Geral Unificado (`/`)
- Visão executiva em tempo real: Saldo Líquido do Mês, Alunos Ativos, Ocupação da Agenda semanal, Inadimplência Geral e Faturamento Mensal Projetado recorrente.
- **Distribuição de Alunos por Plano:** Gráfico de barras com porcentagem e total de alunos em cada modalidade contratada.
- **Renovações de Mensalidades (Próximos 30 dias):** Rastreio de planos a vencer ou vencidos com botão de ação rápida para renovação direta e lançamento quitado no caixa.
- **Resumo da Agenda Diária:** Acompanhamento de presenças, faltas e aulas pendentes de hoje.
- **Alertas Clínicos:** Identificação de alunos ativos sem mesociclo/treino cadastrado.

### 2. Gestão Financeira Completa
- **Contas a Receber:**
  - Coluna **Cód. Conta** (ID único de cada lançamento com clique para copiar, evitando faturas duplicadas).
  - Filtro por mês de competência e status (*A Receber*, *Pagas*, *Atrasadas* e *Todas*).
  - Ordenação estilo Excel (clique nos cabeçalhos para alternar entre ordenação crescente/decrescente em todos os campos).
  - Suporte a **Receita Avulsa** (sem necessidade de vincular aluno, para eventos, vendas e acertos).
  - Concessão de **Desconto / Ajuste de Mensalidade** com registro do valor de tabela original, valor final cobrado e justificativa auditável.
  - Registro de quitação com data real de recebimento e espécie/forma de pagamento (*Pix, Dinheiro, Cartão, Transferência, Boleto*).
- **Contas a Pagar:**
  - Coluna **Cód. Conta**, categorização pelo Plano de Contas estruturado, quitação rápida e repetição de despesas fixas recorrentes.
- **Fluxo de Caixa Consolidado:**
  - Extrato unificado de entradas e saídas, identificador único de lançamento, separação clara entre data de vencimento e data de liquidação, filtros por período e status de quitação.

### 3. Cadastros Especializados
- **Alunos com Múltiplos Planos:**
  - Suporte a alunos matriculados em mais de uma modalidade simultaneamente (ex: *Musculação 1x* com um personal + *Funcional 1x* com outro personal), com dias de vencimento independentes e agendas distintas.
- **Regras de Negócio e Proteção Anti-Faturamento Retroativo:**
  - **Novos Alunos:** Cobranças são geradas estritamente a partir do mês de cadastro (`data_inicio` / `created_at`). Meses anteriores são protegidos contra geração indevida de faturas.
  - **Reativação:** Ao reativar uma matrícula, o sistema salva `data_reativacao` e gera a fatura apenas a partir do mês de retorno, impedindo cobranças indevidas de meses em que o aluno esteve ausente.
  - **Desativação:** Questiona o operador se eventuais pendências vencidas do aluno devem ser mantidas para cobrança posterior ou baixadas.

### 4. Layout Otimizado para Todas as Telas
- **Modais Horizontais Responsivos:** Formulários de Contas a Receber e Contas a Pagar desenvolvidos em layout horizontal amplo (`max-w-3xl`), garantindo visualização completa e botões de ação sempre acessíveis sem necessidade de rolagem em monitores com resolução inferior a Full HD (como notebooks 1366x768 / 720p).
- **Menu Lateral Compacto:** Otimizado com tipografia e espaçamentos ajustados para máxima legibilidade e área útil de trabalho.

---

## 🛠️ Instalação e Execução Local

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [npm](https://www.npmjs.com/)

### 1. Clonar e Instalar Dependências
```bash
git clone <url-do-repositorio>
cd aello-studio-app
npm install
```

### 2. Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto (não commitado no Git):
```env
VITE_GEMINI_API_KEY=sua_chave_api_do_google_gemini
```

### 3. Executar em Modo de Desenvolvimento
```bash
npm run dev
```
Acesse localmente em `http://localhost:5173`.

### 4. Build de Produção
```bash
npm run build
```
Os arquivos otimizados serão gerados na pasta `dist/`.

---

## 🚀 Deploy em Produção

O projeto é hospedado no **Firebase Hosting**:
```bash
# Compilar o frontend
npm run build

# Publicar no Firebase Hosting
npx firebase-tools deploy --only hosting
```

Para publicar alterações nas regras de segurança do Firestore:
```bash
npx firebase-tools deploy --only firestore:rules
```

---

## 📄 Documentação Complementar

- [SISTEMA.md](file:///e:/Google%20Antigravity/aello-studio-app/SISTEMA.md): Diagrama arquitetural, fluxo de dados e mapeamento das coleções do Firestore.
- [DEPLOY.md](file:///e:/Google%20Antigravity/aello-studio-app/DEPLOY.md): Guia de empacotamento, publicação e boas práticas de versionamento.
- [AGENTS.md](file:///e:/Google%20Antigravity/aello-studio-app/AGENTS.md): Diretrizes para agentes de inteligência artificial e sincronização colaborativa.
