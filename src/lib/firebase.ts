import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from "firebase/analytics";

// Configurações do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBeL2su-hJbry7RVBlSRbRg8wgcmEohlkk",
  authDomain: "aello-prescritor.firebaseapp.com",
  projectId: "aello-prescritor",
  storageBucket: "aello-prescritor.firebasestorage.app",
  messagingSenderId: "1080307135360",
  appId: "1:1080307135360:web:2d978973dabe13b874c765",
  measurementId: "G-DZQXHEW34R"
};

// Inicialização
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
