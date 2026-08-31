import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

const serviceAccountPath = path.resolve('aello-prescritor-firebase-adminsdk-fbsvc-8800a606bf.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Erro: Arquivo Service Account não encontrado:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const seedDir = path.resolve('seed');
if (!fs.existsSync(seedDir)) {
  fs.mkdirSync(seedDir, { recursive: true });
}

const collections = [
  'alunos',
  'receitas',
  'despesas',
  'plano_contas',
  'agenda_aulas',
  'agendamentos_fixos',
  'funcionarios',
  'planos',
  'exercicios',
  'equipamentos',
  'usuarios'
];

function anonymizeDoc(collectionName, docData) {
  const item = { ...docData };
  if (collectionName === 'alunos') {
    if (item.cpf) item.cpf = '000.000.000-00';
    if (item.telefone) item.telefone = '(54) 99999-0000';
    if (item.data_nascimento) item.data_nascimento = '1990-01-01';
  }
  if (collectionName === 'funcionarios') {
    if (item.cpf) item.cpf = '000.000.000-00';
    if (item.telefone) item.telefone = '(54) 99999-0000';
  }
  return item;
}

async function runSeedFromProd() {
  console.log('--- Baixando dados de Produção e Anonimizando ---');
  for (const colName of collections) {
    const snapshot = await db.collection(colName).get();
    const data = [];
    snapshot.forEach(doc => {
      const d = doc.to_dict ? doc.to_dict() : doc.data();
      const anonymized = anonymizeDoc(colName, d);
      data.push({ _id: doc.id, ...anonymized });
    });

    const filePath = path.join(seedDir, `${colName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[SEED] Salvo ${colName}.json com ${data.length} documentos (Anonimizados).`);
  }
  console.log('Seed de produção gerado com sucesso em ./seed/');
}

runSeedFromProd().catch(err => {
  console.error('Erro ao gerar seed:', err);
  process.exit(1);
});
