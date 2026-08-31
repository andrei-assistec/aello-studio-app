import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface UserProfile {
  id: string;
  email: string;
  nome: string;
  role: 'admin' | 'trainer' | 'finance' | 'user';
  modulos: string[];
  created_at: number;
}

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const useUser = () => useContext(UserContext);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // refreshProfile remains as fallback, but changes are automatically captured in real-time
  const refreshProfile = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'usuarios', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        setProfile({ id: user.uid, ...userDoc.data() } as UserProfile);
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil manual:', error);
    }
  };

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Clean up previous user listener
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (currentUser) {
        setLoading(true);
        try {
          const userRef = doc(db, 'usuarios', currentUser.uid);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            // Provisionamento automático (zero setup)
            const emailLower = currentUser.email?.toLowerCase() || '';
            const isAdmin = emailLower.includes('andreiplet') || emailLower.includes('adriana') || emailLower.includes('aello') || emailLower.includes('admin');
            const newProfile: Omit<UserProfile, 'id'> = {
              email: currentUser.email || '',
              nome: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuário',
              role: isAdmin ? 'admin' : 'trainer',
              modulos: isAdmin 
                ? ['prescricao', 'financeiro', 'agenda', 'mensalidades', 'vendas', 'estoque', 'compras', 'comissao', 'relatorios'] 
                : ['prescricao'],
              created_at: Date.now(),
            };

            await setDoc(userRef, newProfile);
          }

          // Escuta em tempo real para o perfil do usuário
          unsubscribeSnapshot = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              const emailLower = currentUser.email?.toLowerCase() || '';
              const isAdmin = data.role === 'admin' || data.perfil === 'admin' || emailLower.includes('andreiplet') || emailLower.includes('adriana') || emailLower.includes('aello') || emailLower.includes('admin');
              
              setProfile({
                id: currentUser.uid,
                ...data,
                role: isAdmin ? 'admin' : (data.role || 'trainer'),
                modulos: isAdmin
                  ? ['prescricao', 'financeiro', 'agenda', 'mensalidades', 'vendas', 'estoque', 'compras', 'comissao', 'relatorios']
                  : (data.modulos || ['prescricao'])
              } as UserProfile);
            }
            setLoading(false);
          }, (error) => {
            console.error('Erro no listener do perfil:', error);
            setLoading(false);
          });

        } catch (error) {
          console.error('Erro ao inicializar perfil:', error);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
};

