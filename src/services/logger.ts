import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import type { LogEntry } from '../types/database';

type LogParams = Omit<LogEntry, 'id' | 'user_email' | 'created_at'>;

export const logActivity = async (params: LogParams) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'logs'), {
      ...params,
      user_email: user.email,
      created_at: Date.now() // Usando timestamp local para consistência com o restante do app
    });
  } catch (error) {
    console.error('Falha ao registrar log:', error);
  }
};
