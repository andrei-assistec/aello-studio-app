import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useCollection<T>(collectionName: string, sortField?: string, sortDirection: 'asc' | 'desc' = 'asc') {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let q;
    if (sortField) {
      q = query(collection(db, collectionName), orderBy(sortField, sortDirection));
    } else {
      q = query(collection(db, collectionName));
    }

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, sortField, sortDirection]);

  const add = async (item: Omit<T, 'id'>) => {
    return addDoc(collection(db, collectionName), item as any);
  };

  const update = async (id: string, item: Partial<T>) => {
    return updateDoc(doc(db, collectionName, id), item as any);
  };

  const remove = async (id: string) => {
    return deleteDoc(doc(db, collectionName, id));
  };

  return { data, loading, error, add, update, remove };
}
