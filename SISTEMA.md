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
| **Colaboradores** | `/financeiro/funcionarios` | Gestão de personal trainers, professores, perfis de acesso (Admin/Instrutor) e comissões. |
| **Planos & Valores** | `/mensalidades/planos` | Tabela oficial de planos, modalidades, durações e preços base. |
| **Plano de Contas** | `/financeiro/planodecontas` | Estrutura contábil padronizada (Receitas: 1.1 Mensalidades, 1.2 Avulsas, 1.3 Vendas de Produtos; Despesas: 2.1 Pessoal, 2.2 Operacionais, 2.6 Compra de Mercadoria, etc.). |
| **Contas a Receber** | `/financeiro/receitas` | Faturas mensais geradas, faturas avulsas e vendas de balcão (`origem: 'VENDA'`), identificador `Cód. Conta` e liquidação. |
| **Contas a Pagar** | `/financeiro/despesas` | Controle de despesas avulsas, compras de fornecedores (`2.6 Compra de Mercadoria`) e contas fixas recorrentes. |
| **Fluxo de Caixa** | `/financeiro/caixa` | Extrato consolidado de entradas e saídas, filtros por período e status, ordenação estilo Excel. |
| **Contas Fixas** | `/financeiro/contas-fixas` | Configuração de despesas recorrentes lançadas mensalmente. |
| **Pró-Labore & Comissões** | `/financeiro/prolabore`, `/financeiro/folha` | Cálculo de retiradas dos sócios e comissões devidas aos instrutores por aula ministrada. |
| **Vendas (PDV Balcão)** | `/vendas` | Ponto de venda de vestuário e produtos, leitor de código de barras USB, comprador (aluno/cliente), parcelamento e trocas. |
| **Estoque de Produtos** | `/estoque` | Catálogo de produtos, EAN-13 interno, Kardex append-only, custo médio ponderado móvel, semáforo de saldo e etiquetas A4. |
| **Compras & NF-e** | `/compras` | Importação de XML de NF-e com rateio de frete/desconto e autoaprendizado De-Para ou compras manuais. |
| **Comissões sobre Vendas** | `/comissoes` | Relatório consolidado por período e por vendedor com valores de comissão congelados na venda. |
| **Curva ABC & Giro** | `/relatorios/estoque-vendas` | Relatórios estratégicos de curva ABC de faturamento (Pareto A/B/C) e análise de giro/cobertura de estoque em dias. |
| **Prescrição de Treinos** | `/prescricao/motor` | Elaboração de treinos clínicos A/B/C assistida pelo motor de IA (Gemini). |
| **Página Mobile do Aluno**| `/meutreino/:id` | Interface mobile leve para o aluno visualizar a ficha de exercícios em execução no studio. |

---

## 🗄️ 3. Estrutura das Coleções do Firestore

### `alunos`
- `nome`, `sobrenome`, `cpf`, `telefone`, `data_nascimento`, `altura_cm`, `data_inicio`: Dados cadastrais básicos.
- `ativo`: Booleano de matrícula ativa.
- `personal_ids`: Array de UIDs de personais vinculados (`planos_contratados` e legado) para controle de escopo ACL.
- `planos_contratados`: Array de objetos do contrato (`plano_id`, `modalidade`, `valor_mensalidade`, `personal_id`, `horarios_fixos`).

### `produtos`
- `codigo`: Número sequencial via `contadores/produtos`.
- `descricao`, `nome_curto`, `marca`, `categoria`: Dados básicos do item.
- `tamanho`, `cor`, `agrupador`: Atributos de vestuário/grade.
- `ean_fabricante`, `ean_interno`: Código EAN-13 único GS1 restrito (prefixo 2).
- `custo_medio`, `preco_venda`, `saldo`, `qtd_minima`, `unidade`, `foto_url`, `ativo`: Indicadores de estoque.
- `ncm`, `cfop_padrao`, `cst_csosn`, `origem_mercadoria`, `unidade_tributavel`: Campos fiscais.

### `estoque_movimentos`
- `produto_id`, `tipo`: `ENTRADA_COMPRA` | `SAIDA_VENDA` | `ENTRADA_AJUSTE` | `SAIDA_AJUSTE` | `ENTRADA_DEVOLUCAO` | `AJUSTE_CUSTO`.
- `qtd`, `custo_unit`, `saldo_apos`, `origem_tipo`, `origem_id`, `usuario_id`, `regime`, `data`: Histórico append-only do Kardex.

### `vendas`
- `numero`: Sequencial via `contadores/vendas`.
- `comprador`: `{ tipo: 'ALUNO' | 'CLIENTE', id, nome }`.
- `itens`: Lista de itens vendidos com `custo_unit_snapshot` no momento da venda.
- `subtotal`, `desconto_geral`, `total`, `forma_pagamento`, `condicao`, `parcelas`: Dados financeiros.
- `vendedor_id`, `vendedor_nome`, `comissao_pct`, `comissao_valor`: Comissão congelada.
- `credito_usado`: Valor de crédito abatido.
- `status`: `CONCLUIDA` | `CANCELAMENTO_SOLICITADO` | `CANCELADA` | `DEVOLVIDA_TOTAL`.
- `receitas_ids`: IDs das faturas geradas no financeiro via evento `RECEBER_CRIAR`.

### `compras`
- `numero_nota`, `serie`, `chave_nfe`, `cfop`, `data_emissao`, `fornecedor_id`, `fornecedor_nome`: Dados do documento de compra.
- `itens`, `valor_produtos`, `valor_frete`, `valor_desconto`, `valor_total`, `parcelas`: Rateio e pagamentos.
- `despesas_ids`: IDs das faturas a pagar geradas em `despesas` via evento `PAGAR_CRIAR`.

### `compras_depara`
- `fornecedor_id`, `cod_fornecedor`, `ean`, `descricao_origem`, `produto_id`: Mapeamento autoaprendido de códigos externos.

### `clientes`
- `nome`, `telefone`, `cpf`, `virou_aluno`: Cadastro rápido de compradores não-alunos.

### `creditos`
- `comprador`, `valor_original`, `valor_usado`, `valor_disponivel`, `origem_venda_id`, `ativo`: Saldo de devolução em loja.

### `receitas`
- `id`: Document ID (exibido como **Cód. Conta**).
- `aluno_id`, `aluno_nome`, `descricao`, `plano`, `categoria_id`, `valor`, `vencimento`, `status`, `forma_pagamento`, `data_pagamento`, `personal_id`, `vendedor_id`, `origem` (`MENSALIDADE` | `AVULSA` | `VENDA`), `venda_id`.

### `despesas`
- `id`: Document ID (exibido como **Cód. Conta**).
- `descricao`, `categoria`, `categoria_id`, `valor`, `vencimento`, `status`, `forma_pagamento`, `data_pagamento`.

---

## ⚖️ 4. Regras de Negócio Críticas (Core Rules)

### Regra 1: Controle de Acesso (ACL) e Visibilidade de Dados
1. Perfis padrão: `admin` (acesso irrestrito) e `instrutor` (acesso restrito aos seus próprios alunos, treinos e vendas).
2. Instrutores enxergam apenas alunos com seu UID presente no array `personal_ids[]`.
3. Telas administrativas (Contas a Pagar, Despesas, Compras, Produtos/Custos) são bloqueadas para instrutores via componentes `<Se>` e `<GuardaPagina>`.

### Regra 2: Desacoplamento Financeiro Event-Driven
1. O módulo de vendas NUNCA grava diretamente na coleção `receitas`. Ele escreve em `vendas` e dispara a função handler `criarReceitaVenda(...)` em `src/services/financeiroHandler.ts`.
2. O módulo de compras NUNCA grava diretamente na coleção `despesas`. Ele escreve em `compras` e dispara a função handler `criarDespesaCompra(...)` em `src/services/financeiroHandler.ts`.

### Regra 3: Custo Médio Ponderado Móvel e Kardex
1. Toda entrada de mercadoria recalcula o custo médio: `custo_medio = (saldo × custo_medio_atual + entrada_qtd × custo_entrada) / (saldo + entrada_qtd)`.
2. Vendas e saídas mantêm o custo médio vigente e gravam `custo_unit_snapshot`.
3. Saldo negativo é permitido sem bloquear vendas; a movimentação fica marcada como `regime: 'PROVISORIO'`.

### Regra 4: Trocas, Devoluções e Créditos na Loja (Prazo 30 Dias)
1. Devoluções até 30 dias geram automaticamente crédito em `creditos` para o comprador utilizar no PDV.
2. Devoluções em dinheiro (estorno em espécie) são de autorização exclusiva da administração (`financeiro.estorno`).
3. Vendas canceladas estornam o estoque via `ENTRADA_DEVOLUCAO` e cancelam receitas pendentes. Vendas nunca são apagadas fisicamente.
