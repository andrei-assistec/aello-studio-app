import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyBeL2su-hJbry7RVBlSRbRg8wgcmEohlkk",
  authDomain: "aello-prescritor.firebaseapp.com",
  projectId: "aello-prescritor",
  storageBucket: "aello-prescritor.firebasestorage.app",
  messagingSenderId: "1080307135360",
  appId: "1:1080307135360:web:2d978973dabe13b874c765",
  measurementId: "G-DZQXHEW34R"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runImport() {
  const alunosSnap = await getDocs(collection(db, 'alunos'));
  const alunosMap = new Map();
  alunosSnap.forEach(d => {
    const data = d.data();
    const fullName = `${data.nome || ''} ${data.sobrenome || ''}`.trim().toLowerCase();
    const firstName = (data.nome || '').trim().toLowerCase();
    alunosMap.set(fullName, d.id);
    alunosMap.set(firstName, d.id);
  });

  console.log(`Carregados ${alunosMap.size} identificadores de alunos no Firestore.`);

  // Ler o JSON de avaliações extraídas
  const samplePath = 'parsed_evaluations_all.json';
  if (!fs.existsSync(samplePath)) {
    console.error('Arquivo parsed_evaluations_all.json não encontrado.');
    return;
  }

  const items = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
  console.log(`Gravando ${items.length} avaliações no Firestore 'avaliacoes_fisicas'...`);

  let count = 0;
  for (const item of items) {
    const cleanName = (item.aluno_nome || '').trim().toLowerCase();
    let matchId = alunosMap.get(cleanName) || '';
    if (!matchId) {
      for (const [k, v] of alunosMap.entries()) {
        if (cleanName.includes(k) || k.includes(cleanName)) {
          matchId = v;
          break;
        }
      }
    }

    await addDoc(collection(db, 'avaliacoes_fisicas'), {
      ...item,
      aluno_id: matchId,
      created_at: Date.now()
    });
    count++;
    if (count % 20 === 0) {
      console.log(`Gravadas ${count}/${items.length} avaliações...`);
    }
  }

  console.log(`🎉 Importação concluída! ${count} avaliações gravadas no Firestore.`);
}

runImport().catch(console.error);
