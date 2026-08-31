# Aello Studio — ERP & Prescrição Inteligente de Treinos 🏋️‍♂️📊

Sistema integrado de gestão operacional, financeira, vendas/estoque e prescrição de treinos com Inteligência Artificial para estúdios de treinamento personalizado, musculação e funcional.

**Produção:** [https://aello-prescritor.web.app](https://aello-prescritor.web.app)

---

## 🚀 Tecnologias Utilizadas

- **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Backend & Nuvem:** [Firebase](https://firebase.google.com/) (Cloud Firestore, Firebase Authentication, Firebase Hosting)
- **Inteligência Artificial:** [Google Gemini API](https://ai.google.dev/) (Motor de Prescrição e Análise de Treinos)
- **Testes & Automação:** Vitest (Testes de contrato e regras de ACL), Firebase Emulators (Auth e Firestore)
- **Rotinas Administrativas:** Python 3 (Scripts de sincronização, auditoria, backfill e criação de usuários via `firebase-admin`)

---

## 🧭 Estrutura de Módulos & Navegação

```
1º Dashboard Geral (/)
2º Agenda (/agenda)
3º Cadastros
   ├── Alunos (/prescricao/alunos)
   ├── Colaboradores & Profissionais (/financeiro/funcionarios)
   ├── Planos & Valores (/mensalidades/planos)
   ├── Plano de Contas (/financeiro/planodecontas)
   ├── Banco de Exercícios (/prescricao/exercicios)
   └── Equipamentos (/prescricao/equipamentos)
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
6º Loja & Estoque (Grupo Expansível Clicável)
   ├── Vendas (PDV Balcão) (/vendas)
   ├── Estoque de Produtos (/estoque)
   ├── Compras & NF-e (/compras)
   └── Comissões sobre Vendas (/comissoes)
7º Relatórios & Análises (Grupo Expansível Clicável)
   ├── Curva ABC & Giro (/relatorios/estoque-vendas)
   └── Relatórios Gerais (/relatorios)
```

---

## 💡 Principais Recursos & Funcionalidades

### 1. Controle de Acesso & Segurança (ACL)
- Perfis diferenciados: `admin` (acesso irrestrito a todos os dados e módulos) e `instrutor` (acesso restrito aos seus próprios alunos, treinos e vendas).
- Visibilidade de dados escopada por `personal_ids[]` nos documentos de alunos e receitas.
- Proteção visual com componentes `<Se>` e `<GuardaPagina>` e regras estritas em `firestore.rules`.

### 2. Módulo de Estoque & Produtos
- Catálogo unificado com código sequencial, EAN-13 de circulação interna (prefixo 2), foto, categoria e atributos opcionais de vestuário (`tamanho`, `cor`, `agrupador`).
- Histórico do Kardex append-only em `estoque_movimentos` com recálculo automático de custo médio ponderado móvel.
- Gerador e impressor de etiquetas A4 (5×13 = 65 etiquetas por folha) com escolha de linha/coluna inicial para reaproveitamento.
- Campos fiscais parametrizados: NCM, CFOP padrão, CST/CSOSN, origem da mercadoria e unidade tributável.

### 3. Módulo de Compras & Importação NF-e
- Leitura de arquivos XML de NF-e com rateio proporcional de frete e desconto por item.
- Autoaprendizado de-para (`compras_depara`) que reconhece automaticamente produtos de notas anteriores.
- Lançamento de compras manuais e geração de parcelas a pagar em `despesas` sob a categoria `2.6 Compra de Mercadoria`.

### 4. Módulo de Vendas (PDV Balcão)
- Interface de caixa com suporte a leitor de código de barras USB (tecla Enter adiciona item).
- Busca unificada de comprador entre `alunos` e `clientes` (não-alunos), com cadastro rápido em tela.
- Abatimento automático de saldos de créditos de loja (`creditos`).
- Pagamentos à vista e parcelados em até 12x com ajuste de resíduo na última parcela.
- Gestão de trocas/devoluções de 30 dias com concessão de crédito na loja ou estorno em espécie (exclusivo Admin).

### 5. Comissões de Vendas & Relatórios Estratégicos
- Comissão incidente exclusivamente sobre vendas de produtos com congelamento de porcentagem e valor na venda.
- Relatórios de Curva ABC de vendas (Pareto A 80%, B 15%, C 5%), análise de giro e dias de cobertura de estoque com alertas de ruptura.

---

## 🛠️ Instalação e Execução Local

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [npm](https://www.npmjs.com/)

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/andrei-assistec/aello-studio-app.git
cd aello-studio-app
npm install
```

### 2. Executar Testes e Build
```bash
npm run test
npm run build
```

### 3. Deploy para Produção
```bash
npx firebase-tools deploy --only hosting,firestore:rules
```
