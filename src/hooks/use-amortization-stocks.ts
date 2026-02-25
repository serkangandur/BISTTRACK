'use client';

import { useMemo, useState, useCallback } from 'react';
import { collection, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';

export interface AmortizationStock {
  id: string;
  symbol: string;
  anapara: number;
  createdAt?: any;
}

export function useAmortizationStocks() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);

  const stocksQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'amortizationStocks');
  }, [user, firestore]);

  const { data: dbStocks, isLoading } = useCollection(stocksQuery);

  const stocks = useMemo((): AmortizationStock[] => {
    if (!dbStocks) return [];
    return dbStocks.map((d: any) => ({
      id: d.id,
      symbol: d.symbol || '',
      anapara: d.anapara || 0,
      createdAt: d.createdAt,
    }));
  }, [dbStocks]);

  const addStock = useCallback(async (stock: { symbol: string; anapara: number }) => {
    if (!user || !firestore) return;
    setIsSaving(true);
    try {
      const ref = doc(collection(firestore, 'users', user.uid, 'amortizationStocks'));
      await setDoc(ref, {
        ...stock,
        symbol: stock.symbol.toUpperCase(),
        id: ref.id,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Amortisman hisse kaydetme hatası:', err);
    } finally {
      setIsSaving(false);
    }
  }, [user, firestore]);

  const updateStockAnapara = useCallback(async (stockId: string, anapara: number) => {
    if (!user || !firestore) return;
    setIsSaving(true);
    try {
      const ref = doc(firestore, 'users', user.uid, 'amortizationStocks', stockId);
      await updateDoc(ref, { anapara });
    } catch (err) {
      console.error('Amortisman anapara güncelleme hatası:', err);
    } finally {
      setIsSaving(false);
    }
  }, [user, firestore]);

  const removeStock = useCallback(async (stockId: string) => {
    if (!user || !firestore) return;
    try {
      const ref = doc(firestore, 'users', user.uid, 'amortizationStocks', stockId);
      await deleteDoc(ref);
    } catch (err) {
      console.error('Amortisman hisse silme hatası:', err);
    }
  }, [user, firestore]);

  return { stocks, isLoading, isSaving, addStock, updateStockAnapara, removeStock };
}
