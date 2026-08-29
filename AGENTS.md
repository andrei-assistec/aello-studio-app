# AGENTS.md — Regras para Agentes de IA e Engenharia Colaborativa 🤖

Este documento define as diretrizes, padrões de código e regras de operação para agentes de Inteligência Artificial e desenvolvedores que operam neste repositório.

---

## 📌 1. Padrões de Projeto e Arquitetura

- **Framework:** React 19 com TypeScript. Tipagem estrita e sem `any` desnecessário.
- **Estilização:** Tailwind CSS utility-first classes, mantendo consistência com o design system do app (cores `brand-dark`, `brand-medium`, `surface-*`, `glass-card`).
- **Nomenclatura Padrão:** Sempre utilizar **"Dashboard"** em vez de "Painel" (`Dashboard Geral`, `Dashboard Financeiro`, `Dashboard Treinos`).
- **Formulários e Modais:** Formulários de lançamento financeiro e operacional devem utilizar contêineres horizontais amplos (`max-w-3xl`) e campos compactos para total compatibilidade com resoluções não-HD (ex: 1366x768 / 720p).
- **Rastreabilidade:** Todas as tabelas de listagem financeira devem manter a coluna **Cód. Conta** como o primeiro campo, exibindo o ID único do lançamento com funcionalidade de clique para copiar.

---

## 🛡️ 2. Regras de Integridade do Banco de Dados (Firestore)

1. **Nunca gerar cobranças retroativas indevidas:**
   - Ao executar qualquer função de geração de mensalidade (`syncMonthlyFinance`), utilize obrigatoriamente `getStudentStartYearMonth(aluno)`. Se a competência for anterior à data de cadastro ou reativação do aluno, ignore.
2. **Suporte a Múltiplos Planos Contratados:**
   - Alunos podem possuir mais de uma modalidade ativa em `planos_contratados`. Cada contrato possui seu próprio personal, valor e dia de vencimento.
3. **Desativação de Matrículas:**
   - Ao desativar um aluno com faturas pendentes, o sistema deve solicitar confirmação do usuário para mantê-las ou baixá-las.
4. **Preservação de Registros Órfãos:**
   - Antes de remover qualquer documento ou lote no Firestore, garanta que foi feito backup local ou que os dados financeiros históricos associados foram devidamente reatribuídos ao aluno oficial.

---

## 🔄 3. Controle de Versão (Git)

1. **Branch Principal:** A branch de trabalho e produção é `main`.
2. **Commits Semânticos:** Mensagens claras e objetivas em português ou inglês (ex: `feat: ...`, `fix: ...`, `docs: ...`).
3. **Validação Pré-Deploy:** Sempre execute `npm run build` para validar compilação e tipagem TypeScript com 0 erros antes de qualquer commit ou deploy no Firebase Hosting.
