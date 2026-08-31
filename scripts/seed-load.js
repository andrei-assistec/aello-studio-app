import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('ERRO DE SEGURANÇA: FIRESTORE_EMULATOR_HOST não está definido.');
  console.error('Este script recusa-se a rodar sem o emulador ativo para proteger a produção.');
  process.exit(1);
}

console.log(`Conectando ao Emulador Firestore em: ${process.env.FIRESTORE_EMULATOR_HOST}`);

admin.initializeApp({
  projectId: 'aello-prescritor'
});

const db = admin.firestore();
const seedDir = path.resolve('seed');

if (!fs.existsSync(seedDir)) {
  console.error('Erro: Pasta ./seed/ não encontrada. Execute node scripts/seed-from-prod.js primeiro.');
  process.exit(1);
}

async function loadSeedToEmulator() {
  const files = fs.readdirSync(seedDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const colName = file.replace('.json', '');
    const content = JSON.parse(fs.readFileSync(path.join(seedDir, file), 'utf8'));
    console.log(`Carregando ${content.length} documentos na coleção '${colName}' do emulador...`);

    const batch = db.batch();
    let count = 0;

    for (const item of content) {
      const docId = item._id;
      const data = { ...item };
      delete data._id;

      const ref = db.collection(colName).doc(docId);
      batch.set(ref, data);
      count++;

      if (count % 400 === 0) {
        await batch.commit();
      }
    }

    if (count % 400 !== 0) {
      await batch.commit();
    }
  }

  console.log('✅ Carga no emulador concluída com sucesso!');
}

loadSeedToEmulator().catch(err => {
  console.error('Erro ao carregar seed no emulador:', err);
  process.exit(1);
});
