import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

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

const sharedDir = 'e:/Google Antigravity/aello-studio-app/shared';

function parseOFXFile(filePath) {
  const content = fs.readFileSync(filePath, 'latin1');
  const trns = content.split('<STMTTRN>');
  const results = [];

  if (trns.length <= 1) return results;

  for (let i = 1; i < trns.length; i++) {
    const trn = trns[i];
    const matchAmt = trn.match(/<TRNAMT>(.*?)(?:\n|\r|<)/);
    const matchDt = trn.match(/<DTPOSTED>(.*?)(?:\n|\r|<)/);
    const matchFit = trn.match(/<FITID>(.*?)(?:\n|\r|<)/);
    const matchMemo = trn.match(/<MEMO>(.*?)(?:\n|\r|<)/);
    const matchName = trn.match(/<NAME>(.*?)(?:\n|\r|<)/);

    const amt = matchAmt ? parseFloat(matchAmt[1].trim()) : 0;
    const rawDt = matchDt ? matchDt[1].trim().substring(0, 8) : '';
    const fitid = matchFit ? matchFit[1].trim() : '';
    let memo = matchMemo ? matchMemo[1].trim() : (matchName ? matchName[1].trim() : 'Lançamento Bancário');

    if (!rawDt || amt === 0) continue;

    const y = rawDt.substring(0, 4);
    const m = rawDt.substring(4, 6);
    const d = rawDt.substring(6, 8);
    const dateFormatted = `${y}-${m}-${d}`;

    results.push({
      fitid,
      data: dateFormatted,
      valor: Math.abs(amt),
      tipo: amt > 0 ? 'CREDITO' : 'DEBITO',
      descricao: memo,
      banco: 'Sicredi',
      origem: 'OFX Importado',
      fitidKey: fitid || `${dateFormatted}_${amt}_${memo.substring(0, 15)}`
    });
  }

  return results;
}

async function runOFXImport() {
  console.log('--- Buscando lançamentos existentes no Firestore para evitar duplicatas ---');
  const despesasSnap = await getDocs(collection(db, 'despesas'));
  const receitasSnap = await getDocs(collection(db, 'receitas'));

  const existingKeys = new Set();

  despesasSnap.forEach(d => {
    const data = d.data();
    if (data.fitid) existingKeys.add(data.fitid);
    if (data.ofx_key) existingKeys.add(data.ofx_key);
  });

  receitasSnap.forEach(d => {
    const data = d.data();
    if (data.fitid) existingKeys.add(data.fitid);
    if (data.ofx_key) existingKeys.add(data.ofx_key);
  });

  console.log(`Chaves únicas existentes no Firestore: ${existingKeys.size}`);

  const ofxFiles = fs.readdirSync(sharedDir).filter(f => f.toLowerCase().endsWith('.ofx'));
  console.log(`Lendo ${ofxFiles.length} arquivos OFX em ${sharedDir}...`);

  let allTrns = [];
  for (const f of ofxFiles) {
    const pth = path.join(sharedDir, f);
    allTrns.push(...parseOFXFile(pth));
  }

  // Deduplicar localmente por fitidKey
  const uniqueTrnsMap = new Map();
  for (const t of allTrns) {
    if (!uniqueTrnsMap.has(t.fitidKey)) {
      uniqueTrnsMap.set(t.fitidKey, t);
    }
  }

  const trnsToInsert = Array.from(uniqueTrnsMap.values()).filter(t => !existingKeys.has(t.fitidKey));
  console.log(`Total de lançamentos OFX únicos: ${uniqueTrnsMap.size}. Novos a importar: ${trnsToInsert.length}`);

  let insertedDespesas = 0;
  let insertedReceitas = 0;

  for (let i = 0; i < trnsToInsert.length; i++) {
    const t = trnsToInsert[i];

    // Categorização Inteligente
    let categoria = 'Outros';
    const memoUpper = t.descricao.toUpperCase();

    if (t.tipo === 'CREDITO') {
      if (memoUpper.includes('PIX') || memoUpper.includes('RECEB') || memoUpper.includes('DEPOSITO')) {
        categoria = 'Mensalidades Studio';
      } else if (memoUpper.includes('CARTAO') || memoUpper.includes('MAQUININHA') || memoUpper.includes('GETNET') || memoUpper.includes('REDE')) {
        categoria = 'Vendas Cartão';
      } else {
        categoria = 'Receitas Operacionais';
      }

      await addDoc(collection(db, 'receitas'), {
        descricao: t.descricao,
        categoria: categoria,
        valor: t.valor,
        data_vencimento: t.data,
        data_pagamento: t.data,
        status: 'PAGO',
        forma_pagamento: 'PIX/Transferência',
        banco: 'Sicredi',
        fitid: t.fitidKey,
        ofx_key: t.fitidKey,
        created_at: Date.now()
      });
      insertedReceitas++;

    } else {
      // Débito (Despesa)
      if (memoUpper.includes('ALUGUEL') || memoUpper.includes('IMOBILIARIA') || memoUpper.includes('LOCACAO')) {
        categoria = 'Aluguel & Condomínio';
      } else if (memoUpper.includes('ENERGIA') || memoUpper.includes('RGE') || memoUpper.includes('CEEE') || memoUpper.includes('LUZ')) {
        categoria = 'Energia Elétrica';
      } else if (memoUpper.includes('AGUA') || memoUpper.includes('CORSAN')) {
        categoria = 'Água & Saneamento';
      } else if (memoUpper.includes('INTERNET') || memoUpper.includes('CLARO') || memoUpper.includes('TELEFONICA') || memoUpper.includes('VIVO')) {
        categoria = 'Internet & Telefonia';
      } else if (memoUpper.includes('CONTAB') || memoUpper.includes('CONTADOR')) {
        categoria = 'Serviços Contábeis';
      } else if (memoUpper.includes('SALARIO') || memoUpper.includes('FOLHA') || memoUpper.includes('PROLABORE') || memoUpper.includes('CIEE')) {
        categoria = 'Salários & Pró-Labore';
      } else if (memoUpper.includes('MARISTELA') || memoUpper.includes('ANDREI') || memoUpper.includes('ANA CLAUDIA')) {
        categoria = 'Repasse Personal Trainers';
      } else if (memoUpper.includes('DAS') || memoUpper.includes('SIMPLES') || memoUpper.includes('DARF') || memoUpper.includes('E-SOCIAL') || memoUpper.includes('IMPOSTO')) {
        categoria = 'Impostos & Taxas';
      } else if (memoUpper.includes('JUROS') || memoUpper.includes('CESTA') || memoUpper.includes('IOF') || memoUpper.includes('TARIFA')) {
        categoria = 'Tarifas Bancárias';
      } else {
        categoria = 'Despesas Operacionais';
      }

      await addDoc(collection(db, 'despesas'), {
        descricao: t.descricao,
        categoria: categoria,
        valor: t.valor,
        data_vencimento: t.data,
        data_pagamento: t.data,
        status: 'PAGO',
        forma_pagamento: 'Débito em Conta/PIX',
        banco: 'Sicredi',
        fitid: t.fitidKey,
        ofx_key: t.fitidKey,
        created_at: Date.now()
      });
      insertedDespesas++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`Processados ${i + 1}/${trnsToInsert.length} lançamentos (Receitas: ${insertedReceitas}, Despesas: ${insertedDespesas})...`);
    }
  }

  console.log(`🎉 Importação OFX finalizada! Receitas importadas: ${insertedReceitas}, Despesas importadas: ${insertedDespesas}.`);
}

runOFXImport().catch(console.error);
