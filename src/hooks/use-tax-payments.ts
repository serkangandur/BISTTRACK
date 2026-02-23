'use client';

import { useMemo, useState, useCallback } from 'react';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';

export interface TaxDividendPayment {
  id: string;
  stock: string;
  netAmount: number;
  date: string;
  note: string;
  createdAt?: any;
}

export function useTaxPayments() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);

  const paymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'taxDividendPayments');
  }, [user, firestore]);

  const { data: dbPayments, isLoading } = useCollection(paymentsQuery);

  const payments = useMemo((): TaxDividendPayment[] => {
    if (!dbPayments) return [];
    return dbPayments.map((d: any) => ({
      id: d.id,
      stock: d.stock || '',
      netAmount: d.netAmount || 0,
      date: d.date || '',
      note: d.note || '',
      createdAt: d.createdAt,
    }));
  }, [dbPayments]);

  const addPayment = useCallback(async (payment: Omit<TaxDividendPayment, 'id' | 'createdAt'>) => {
    if (!user || !firestore) return;
    setIsSaving(true);
    try {
      const ref = doc(collection(firestore, 'users', user.uid, 'taxDividendPayments'));
      await setDoc(ref, {
        ...payment,
        id: ref.id,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Temettü ödeme kaydetme hatası:', err);
    } finally {
      setIsSaving(false);
    }
  }, [user, firestore]);

  const removePayment = useCallback(async (paymentId: string) => {
    if (!user || !firestore) return;
    try {
      const ref = doc(firestore, 'users', user.uid, 'taxDividendPayments', paymentId);
      await deleteDoc(ref);
    } catch (err) {
      console.error('Temettü ödeme silme hatası:', err);
    }
  }, [user, firestore]);

  return { payments, isLoading, isSaving, addPayment, removePayment };
}
