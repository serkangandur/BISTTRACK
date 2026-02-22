'use client';

import { useMemo, useState } from 'react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { DividendRecord } from '@/lib/types';

export const TEMETTU_SYMBOLS = ['LOGO', 'TUPRS', 'CLEBI', 'ISMEN', 'PAGYO', 'ANHYT'];

// Varsayılan bilinen temettü verileri
export const DEFAULT_DIVIDENDS: Record<string, { net: number; year: number }> = {
  'TUPRS': { net: 12.92, year: 2025 },
};

export function useDividends() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);

  const dividendsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'globalData', 'dividends', 'stocks');
  }, [user, firestore]);

  const { data: dbDividends, isLoading } = useCollection(dividendsQuery);

  const dividendMap = useMemo(() => {
    const map: Record<string, DividendRecord> = {};
    
    // Önce default değerleri koy
    TEMETTU_SYMBOLS.forEach(sym => {
      const def = DEFAULT_DIVIDENDS[sym];
      if (def) {
        map[sym] = { id: sym, symbol: sym, netDividendPerShare: def.net, year: def.year };
      }
    });
    
    // Sonra Firebase verilerini üstüne yaz
    if (dbDividends) {
      dbDividends.forEach((d: any) => {
        map[d.symbol] = { id: d.id, symbol: d.symbol, netDividendPerShare: d.netDividendPerShare, year: d.year };
      });
    }
    
    return map;
  }, [dbDividends]);

  const saveDividend = async (symbol: string, net: number, year: number) => {
    if (!user || !firestore) return;
    setIsSaving(true);
    try {
      const ref = doc(firestore, 'globalData', 'dividends', 'stocks', symbol);
      await setDoc(ref, { symbol, netDividendPerShare: net, year, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error('Temettü kaydetme hatası:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return { dividendMap, isLoading, saveDividend, isSaving };
}
