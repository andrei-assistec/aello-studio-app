# DEPLOY.md — Guia de Deploy e Versionamento 🚀

Este documento descreve os processos de empacotamento, publicação (deploy), versionamento no Git e gerenciamento de segredos para o ambiente do **Aello Studio App**.

---

## 🏆 Regra de Ouro (Versionamento Seguro)

1. **Repositório Git:** A branch principal de produção é `main`.
2. **Sempre sincronize:** Rode `git pull origin main` antes de iniciar qualquer trabalho se houver repositório remoto conectado.
3. **Crie tags de backup:** Crie uma tag do estado atual local (`git tag backup-<contexto>-<AAAA-MM-DD>`) antes de publicar alterações de grande porte.
4. **Não publique de cópias desatualizadas:** Garanta que seu código local está atualizado em relação ao remoto antes de rodar os comandos de deploy.

---

## 🚫 O que NUNCA deve ser enviado ao repositório Git

Os seguintes itens contêm dependências locais ou segredos críticos e são estritamente ignorados no controle de versão (verifique o `.gitignore`):

* Dependências: `node_modules/`
* Arquivos de build: `dist/`, `dist-ssr/`
* Segredos e Credenciais: `.env`, `.env.local`, `*-adminsdk-*.json` (chave de serviço administrativo do Firebase)
* Dados temporários, relatórios de auditoria e planilhas com dados reais de alunos: `xlspdf/`, `*.xlsx`, `*.xls`, `parsed_evaluations_*.json`, `*_report.txt`, `*_analysis.txt`

---

## 💾 Backup e Ambiente do Emulador Firestore

### 1. Backup em Nuvem (Google Cloud Storage)
Para exportar todo o banco de dados do Firestore em produção:
```bash
gcloud firestore export gs://aello-prescritor-backups/$(date +%Y%m%d) --project=aello-prescritor
```
*Bucket recomendado:* `gs://aello-prescritor-backups/` com regra de Lifecycle de expiração automatizada em **30 dias** e agendamento via Cloud Scheduler/Cron diário às 03:00.

### 2. Emulador Local e Seed de Dados Anonimizados
Para rodar os testes e desenvolvimento em ambiente isolado sem afetar a produção:
```bash
# 1. Iniciar o emulador do Firebase (Firestore + Auth)
npx firebase emulators:start

# 2. Em outro terminal, extrair cópia anonimizada dos dados da produção para ./seed/
npm run seed:dump

# 3. Carregar o seed anonimizado no emulador local (exige FIRESTORE_EMULATOR_HOST)
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
npm run seed:load
```

---

## 🚀 Passo a Passo de Deploy

A hospedagem do painel é feita no **Firebase Hosting**. Siga as etapas abaixo para publicar atualizações:

### Passo 1: Construção do Frontend (Build)
Gere os arquivos estáticos de produção na pasta `dist/`:
```bash
npm run build
```

### Passo 2: Testar Localmente (Opcional)
Se desejar validar o build de produção localmente antes de publicar:
```bash
npm run preview
```

### Passo 3: Deploy para Produção (Firebase Hosting)
Publique a pasta `dist` compilada diretamente nos servidores do Firebase Hosting:
```bash
npx firebase-tools deploy --only hosting
```
*(Se você possui o Firebase CLI instalado globalmente, pode rodar apenas `firebase deploy --only hosting`)*

### Passo 4: Atualizar Regras de Segurança do Firestore (Se alteradas)
Caso faça alterações nas regras de segurança em `firestore.rules`, publique-as usando:
```bash
npx firebase-tools deploy --only firestore:rules
```

---

## 🔑 Gerenciamento de Segredos e Configurações

O sistema utiliza os seguintes segredos para conexão de APIs e bancos de dados:

1. **`VITE_GEMINI_API_KEY`** (Integração com a IA do Gemini):
   * Fica em um arquivo local `.env` na raiz do projeto.
   * Não deve ser versionado no Git. Em produção, essa chave é embutida durante o processo de build do Vite.
2. **Firebase Admin SDK (Chave de Serviço JSON)**:
   * Arquivo `aello-prescritor-firebase-adminsdk-fbsvc-8800a606bf.json` na raiz do projeto.
   * Usado exclusivamente pelos scripts Python para acesso administrativo ao Firestore.
   * **Risco crítico:** Nunca versione este arquivo JSON, pois ele dá acesso total e irrestrito ao seu banco de dados na nuvem.

### O que fazer em caso de vazamento de segredos?
* **Gemini API Key:** Acesse o Google AI Studio, revogue a chave antiga e crie uma nova. Atualize a linha no `.env` local.
* **Chave de Serviço Firebase (JSON):** Acesse o console do Google Cloud Platform (GCP) -> IAM & Admin -> Service Accounts. Selecione a conta de serviço, exclua a chave vazada e gere um novo arquivo de chave JSON de substituição.
