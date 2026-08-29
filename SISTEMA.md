# SISTEMA.md — Mapa do Sistema, Arquitetura e Regras de Negócio 📐

Este documento detalha a arquitetura técnica, modelo de dados do Firestore, módulos funcionais e regras de negócio do **Aello Studio App**.

---

## 🏗️ 1. Arquitetura e Fluxo de Dados

```text
               +----------------------------------------+
               |           Aello Studio App             |
               |         (React 19 + Vite + TS)         |
               +-------------------+--------------------+
                                   |
            +----------------------+----------------------+
            |                      |                      |
            v                      v                      v
  +------------------+   +------------------+   +--------------------+
  |  Firebase Auth   |   |Cloud Firestore   |   |   Gemini API       |
  |  (Autenticação)  |   | (Banco de Dados) |   | (Sugestões Treino) |
  +------------------+   +--------+---------+   +--------------------+
                                  ^
                                  | (Firebase Admin SDK)
                         +--------+---------+
                         | Scripts Python   |
                         | (Auditoria/Fix)  |
                         +------------------+
```

---

## 📦 2. Tabela de Módulos e Rotas

| Módulo / Recurso | Rota Principal | Descrição / Responsabilidade |
| :--- | :--- | :--- |
| **Dashboard Geral** | `/` | Centro de comando: KPIs financeiros, faturamento recorrente, agenda diária, renovações em 30 dias e distribuição por plano. |
| **Agenda & Aulas** | `/agenda` | Gestão de horários por personal, grade semanal, controle de presenças/faltas e reposições. |
| **Cadastro de Alunos** | `/prescricao/alunos` | Cadastro completo, restrições médicas, múltiplos planos/modalidades contratados, dados de contato e frequência semanal. |
| **Colaboradores** | `/funcionarios` | Gestão de personal trainers, professores e comissões. |
| **Planos & Valores** | `/mensalidades/planos` | Tabela oficial de planos, modalidades, durações e preços base. |
| **Plano de Contas** | `/financeiro/plano-contas` | Estrutura contábil padronizada (Receitas: 1.1 Mensalidades, 1.2 Avulsas; Despesas: 2.1 Pessoal, 2.2 Operacionais, etc.). |
| **Contas a Receber** | `/financeiro/receitas` | Faturas mensais geradas, faturas avulsas, identificador `Cód. Conta`, descontos com justificativa e baixa/quitação. |
| **Contas a Pagar** | `/financeiro/despesas` | Controle de despesas avulsas e contas fixas recorrentes, com `Cód. Conta` e categorização contábil. |
| **Fluxo de Caixa** | `/financeiro/caixa` | Extrato consolidado de entradas e saídas, filtros por período e status, ordenação estilo Excel. |
| **Contas Fixas** | `/financeiro/contas-fixas` | Configuração de despesas recorrentes que o sistema lança mensalmente de forma automática. |
| **Pró-Labore & Comissões** | `/financeiro/prolabore`, `/financeiro/folha` | Cálculo de retiradas e comissões devidas aos instrutores por aula ministrada. |
| **Prescrição de Treinos** | `/prescricao/motor` | Elaboração de treinos clínicos A/B/C assistida pelo motor de IA (Gemini). |
| **Página Mobile do Aluno**| `/meutreino/:id` | Interface mobile leve para o aluno visualizar a ficha de exercícios em execução no studio. |

---

## 🗄️ 3. Estrutura das Coleções do Firestore

### `alunos`
- `nome`, `sobrenome`, `cpf`, `telefone`, `data_nascimento`, `altura_cm`, `data_inicio`: Dados cadastrais básicos.
- `ativo`: Booleano indicando se a matrícula está ativa ou trancada/desativada.
- `data_reativacao`: String no formato `YYYY-MM`, indicando o mês em que o aluno foi reativado (previne cobranças retroativas).
- `tem_multiplos_planos`: Booleano indicando se possui mais de uma modalidade simultânea.
- `planos_contratados`: Array de objetos do tipo `PlanoContratadoItem`:
  - `id`: Identificador único do contrato dentro do aluno.
  - `plano_id`, `plano_nome`: Referência ao plano da tabela de planos.
  - `modalidade`: `musculacao` | `funcional` | etc.
  - `frequencia_semanal`: Número de vezes por semana (ex: 1, 2, 3, 5).
  - `dia_vencimento`: Dia do mês para o vencimento da mensalidade (ex: 3, 5, 10, 26).
  - `valor_mensalidade`: Valor específico contratado pelo aluno para esta modalidade.
  - `personal_id`, `personal_nome`: Instrutor responsável por este contrato.
  - `horarios_fixos`: Lista de slots reservados na agenda (`dia_semana`, `horario`, `personal_id`).

### `receitas`
- `id`: Document ID único do Firestore (exibido como **Cód. Conta** no ERP).
- `aluno_id`: ID do documento do aluno (vazio em receitas avulsas).
- `aluno_nome`: Nome do aluno ou título da receita avulsa.
- `descricao`: Descrição detalhada da receita (obrigatória para avulsas).
- `plano`: Nome da modalidade/plano associado (ou `Receita Avulsa`).
- `plano_contratado_id`: ID do contrato específico dentro de `planos_contratados` do aluno.
- `categoria_id`: ID da conta no `plano_contas`.
- `valor`: Valor líquido a receber ou recebido.
- `valor_original`: Valor de tabela antes da concessão de desconto.
- `tem_desconto`: Booleano indicando se houve ajuste ou desconto concedido.
- `justificativa_desconto`: Texto explicativo obrigatório quando há desconto (ex: *"Aluno treinou 2x/sem neste mês"*).
- `vencimento` / `data_vencimento`: Data no formato `YYYY-MM-DD`.
- `status`: `pendente` | `pago` | `atrasado`.
- `forma_pagamento`: `Pix` | `Dinheiro` | `Cartão Crédito` | `Cartão Débito` | `Transferência Bancária` | `Boleto`.
- `data_pagamento`: Timestamp em milissegundos da liquidação real.

### `despesas`
- `id`: Document ID único do Firestore (exibido como **Cód. Conta** no ERP).
- `descricao`: Título/fornecedor da despesa.
- `categoria`, `categoria_id`: Nome e ID no `plano_contas`.
- `valor`: Valor a pagar ou pago.
- `vencimento` / `data_vencimento`: Data no formato `YYYY-MM-DD`.
- `status`: `pendente` | `pago`.
- `forma_pagamento`, `data_pagamento`: Dados de liquidação.
- `recorrente`, `recorrencia_id`: Indicadores se faz parte de uma sequência de despesa fixa repetida.

### `plano_contas`
- `codigo`: Ex: `1.1` (Mensalidades), `1.2` (Receitas Avulsas), `2.1` (Despesas Operacionais).
- `nome`: Nome da categoria contábil.
- `tipo`: `receita` | `despesa`.
- `ativo`: Booleano de disponibilidade.

### `agenda_aulas` e `agendamentos_fixos`
- `aluno_id`, `aluno_nome`, `personal_id`, `personal_nome`, `data`, `hora`, `status`: Controle de presenças diárias e bloqueios semanais de horário.

---

## ⚖️ 4. Regras de Negócio Críticas (Core Rules)

### Regra 1: Prevenção de Faturamento Retroativo Indevido (`monthlyFinanceGenerator.ts`)
1. Antes de gerar faturas de um mês (`targetYearMonth`), o gerador valida a data de início do aluno através da função `getStudentStartYearMonth(aluno)`.
2. Se o mês da fatura for **anterior** ao mês de cadastro (`data_inicio` / `created_at`), a geração é **ignorada**.
3. Se o aluno foi desativado e depois reativado (`data_reativacao`), faturas de meses anteriores à reativação não são geradas.

### Regra 2: Alunos com Múltiplos Planos Contratados
1. Cada modalidade do aluno possui seu próprio dia de vencimento, personal e valor em `planos_contratados`.
2. A sincronização mensal (`syncMonthlyFinance`) percorre cada plano do aluno de forma independente e gera uma fatura distinta para cada contrato.
3. A identificação de faturas existentes para evitar duplicidade compara `(aluno_id === a.id || aluno_nome matches)` e `(plano_contratado_id === p.id || plano === p.plano_nome)`.

### Regra 3: Transparência e Rastreabilidade Financeira (`Cód. Conta`)
1. As telas de **Contas a Receber**, **Contas a Pagar** e **Fluxo de Caixa** exibem obrigatoriamente o identificador único da conta na **primeira coluna** da tabela.
2. Cada código pode ser copiado com um clique para a área de transferência.
3. Permite a operadores e administradores diferenciar imediatamente faturas legítimas de eventuais contas duplicadas.

### Regra 4: Responsividade e Layout Compacto para Telas não-HD
1. Os formulários de criação/edição financeira (`ReceitaFormModal` e `DespesaFormModal`) utilizam contêineres horizontais amplos (`max-w-3xl`) com os campos agrupados lado a lado.
2. Isso garante que, mesmo em dispositivos com resolução vertical restrita (como telas de 720p ou 1366x768), os botões de ação (**Cancelar** e **Salvar**) permaneçam sempre visíveis e acessíveis sem necessidade de rolagem.
