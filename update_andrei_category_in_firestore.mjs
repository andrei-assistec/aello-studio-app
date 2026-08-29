import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

async function updateAndreiRecords() {
  console.log('--- Atualizando lançamentos do Andrei no Firestore ---');

  // 1. Atualizar contas_fixas
  const cfSnap = await getDocs(collection(db, 'contas_fixas'));
  let cfCount = 0;
  cfSnap.forEach(async (d) => {
    const data = d.data();
    if ((data.descricao && data.descricao.toUpperCase().includes('ANDREI')) || data.categoria === 'Repasse Personal Trainers') {
      if (data.descricao && data.descricao.toUpperCase().includes('ANDREI')) {
        await updateDoc(doc(db, 'contas_fixas', d.id), {
          descricao: 'Pagamento de Empréstimo - Andrei',
          categoria: 'Empréstimos & Financiamentos'
        });
        cfCount++;
      }
    }
  });

  // 2. Atualizar despesas
  const despesasSnap = await getDocs(collection(db, 'despesas'));
  let despesasCount = 0;
  for (const d of despesasSnap.docs) {
    const data = d.data();
    const descUpper = (data.descricao || '').toUpperCase();
    if (descUpper.includes('ANDREI') && data.categoria === 'Repasse Personal Trainers') {
      await updateDoc(doc(db, 'despesas', d.id), {
        categoria: 'Empréstimos & Financiamentos'
      });
      despesasCount++;
    }
  }

  console.log(`🎉 Atualização concluída! Contas fixas atualizadas: ${cfCount}, Despesas reclassificadas: ${despesasCount}.`);
}

updateAndreiRecords().catch(console.error);
