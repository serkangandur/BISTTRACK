'use client';

import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockHolding } from '@/lib/types';

interface DividendProjectionProps {
  holdings: StockHolding[];
  dividendMap: Record<string, { netDividendPerShare: number; year: number }>;
}

const TEMETTU_SYMBOLS = ['ISMEN', 'LOGO', 'CLEBI', 'ANHYT', 'TUPRS', 'PAGYO'];
const YEARS = 10;
const START_YEAR = 2025;

interface ManualInput {
  price2025: string;
  lot2025: string;
  hbt2025: string;
  price2026: string;
  lot2026: string;
  hbt2026: string;
  usdRate: string;
}

export function DividendProjection({ holdings, dividendMap }: DividendProjectionProps) {
  const [manualInputs, setManualInputs] = useState<Record<string, ManualInput>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    const hasData = TEMETTU_SYMBOLS.some(sym => {
      const holding = holdings.find(h => h.symbol.toUpperCase() === sym);
      const divData = dividendMap[sym];
      return holding || divData;
    });
    if (!hasData) return;

    // Önce localStorage'dan yükle
    const saved = localStorage.getItem('bistrack_projection_inputs');
    if (saved) {
      try {
        setManualInputs(JSON.parse(saved));
        setInitialized(true);
        return;
      } catch {}
    }

    // localStorage yoksa Firebase'den doldur
    const init: Record<string, ManualInput> = {};
    TEMETTU_SYMBOLS.forEach(sym => {
      const holding = holdings.find(h => h.symbol.toUpperCase() === sym);
      const divData = dividendMap[sym];
      init[sym] = {
        price2025: holding?.averageCost?.toString() || '',
        lot2025: holding?.quantity?.toString() || '',
        hbt2025: divData?.netDividendPerShare?.toString() || '',
        price2026: '',
        lot2026: '',
        hbt2026: divData?.netDividendPerShare?.toString() || '',
        usdRate: '43.83',
      };
    });
    setManualInputs(init);
    setInitialized(true);
  }, [holdings, dividendMap, initialized]);

  // Değiştirilince localStorage'a kaydet
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem('bistrack_projection_inputs', JSON.stringify(manualInputs));
  }, [manualInputs, initialized]);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  const updateInput = (sym: string, field: keyof ManualInput, value: string) => {
    setManualInputs(prev => ({ ...prev, [sym]: { ...prev[sym], [field]: value } }));
  };

  const usdRate = parseFloat(manualInputs[TEMETTU_SYMBOLS[0]]?.usdRate || '43.83') || 43.83;
  const [growthRate, setGrowthRate] = useState('30');
  const GROWTH_RATE = parseFloat(growthRate) / 100 || 0.30;
  const [priceGrowth, setPriceGrowth] = useState('30');
  const PRICE_GROWTH = parseFloat(priceGrowth) / 100 || 0.30;
  const [monthlyUSD, setMonthlyUSD] = useState('2000');
  const [monthlyTargetUSD, setMonthlyTargetUSD] = useState('4000');
  const [dollarInflation, setDollarInflation] = useState('3');
  const [targetYear, setTargetYear] = useState('7');
  const [reinvestDividends, setReinvestDividends] = useState(true);
  const yearlyTargetUSD = parseFloat(monthlyTargetUSD || '4000') * 12;

  // Verim ağırlıkları: Senin hesabına göre (toplam %39.76)
  const SABIT_VERIMLER: Record<string, number> = {
    ISMEN: 11.50, LOGO: 2.83, CLEBI: 7.58,
    ANHYT: 6.83,  TUPRS: 5.58, PAGYO: 5.44,
  };
  const TOPLAM_VERIM = 39.76;

  const verimAgirliklar = useMemo(() => {
    const agirliklar: Record<string, number> = {};
    TEMETTU_SYMBOLS.forEach(sym => {
      agirliklar[sym] = (SABIT_VERIMLER[sym] || 0) / TOPLAM_VERIM;
    });
    return agirliklar;
  }, []);

  const projections = useMemo(() => {
    return TEMETTU_SYMBOLS.map(sym => {
      const div = dividendMap[sym];
      const holding = holdings.find(h => h.symbol.toUpperCase() === sym);
      const input = manualInputs[sym];

      const initialLot = parseFloat(input?.lot2025 || '0') || 0;
      const initialPrice = parseFloat(input?.price2025 || '0') || holding?.currentPrice || 0;
      const baseHBT = parseFloat(input?.hbt2026 || '') || div?.netDividendPerShare || 0;
      const lot2026 = parseFloat(input?.lot2026 || '') || initialLot;
      const price2026 = parseFloat(input?.price2026 || '') || (initialPrice * 1.30);

      let lot = initialLot;
      let prevTemNet = 0; // önceki yılın temettüsü (geri yatırım için)

      const years = Array.from({ length: YEARS }, (_, i) => {
        const year = START_YEAR + i;

        // HBT: 2025 sabit, 2026 manuel, 2027'den itibaren 2026 üzerinden %30 artar
        const hbt2025val = parseFloat(input?.hbt2025 || '') || div?.netDividendPerShare || 0;
        const hbt2026val = parseFloat(input?.hbt2026 || '') || hbt2025val;
        const hbt = i === 0 ? hbt2025val
          : i === 1 ? hbt2026val
          : hbt2026val * Math.pow(1 + GROWTH_RATE, i - 1);

        // Fiyat: 2025 ve 2026 manuel, sonrası %30 artar
        const fiyat = i === 0 ? initialPrice
          : i === 1 ? (price2026 || initialPrice * (1 + PRICE_GROWTH))
          : (price2026 || initialPrice * (1 + PRICE_GROWTH)) * Math.pow(1 + PRICE_GROWTH, i - 1);
        
        // Lot: 2025 ve 2026 manuel
        if (i === 0) { lot = initialLot; }
        else if (i === 1) { lot = lot2026; }

        // Aylık ekleme ile gelen LOT (verim ağırlığına göre dağıtım)
        const symAgirlik = verimAgirliklar[sym] || (1 / TEMETTU_SYMBOLS.length);
        const monthlyAddedLot = i > 0 && fiyat > 0
          ? Math.floor((parseFloat(monthlyUSD || '2000') * usdRate) * symAgirlik / fiyat)
          : 0;
        const lotEklem = i > 0 ? monthlyAddedLot * 12 : 0;

        // Temettü geri yatırımı ile gelen LOT (önceki yılın temettüsü / bu yılın fiyatı)
        const reinvestLot = (reinvestDividends && i > 0 && fiyat > 0 && prevTemNet > 0)
          ? Math.floor(prevTemNet / fiyat)
          : 0;

        // Toplam LOT
        if (i === 0 || i === 1) {
          // zaten yukarıda set edildi
        } else {
          lot = lot + lotEklem + reinvestLot;
        }

        const hbtYukselmesi = i > 0
          ? hbt - baseHBT * Math.pow(1 + GROWTH_RATE, Math.max(0, i - 2))
          : null;

        const temNet = lot * hbt;
        const temNetDL = temNet / usdRate;

        prevTemNet = temNet; // bir sonraki yıl için sakla

        return {
          year,
          fiyat,
          lot,
          lotEklem: i > 0 ? lotEklem : null,
          reinvestLot: i > 0 ? reinvestLot : null,
          hbt,
          hbtYukselmesi,
          temNet,
          temNetDL,
        };
      });

      return { sym, years };
    });
  }, [dividendMap, holdings, manualInputs, usdRate, priceGrowth, growthRate, monthlyUSD, reinvestDividends]);

  // Yıl bazlı toplam
  const yearTotals = useMemo(() => {
    return Array.from({ length: YEARS }, (_, i) => {
      const year = START_YEAR + i;
      const totalTL = projections.reduce((acc, p) => acc + (p.years[i]?.temNet || 0), 0);
      const inflationMultiplier = Math.pow(1 + (parseFloat(dollarInflation || '3') / 100), i);
      const totalUSD = (totalTL / usdRate) / inflationMultiplier;
      return { year, totalTL, totalUSD };
    });
  }, [projections, usdRate, dollarInflation]);

  const targetYearIndex = parseInt(targetYear || '7');
  const requiredYearlyUSD = parseFloat(monthlyTargetUSD || '4000') * 12;

  const requiredInvestment = useMemo(() => {
    return TEMETTU_SYMBOLS.map(sym => {
      const proj = projections.find(p => p.sym === sym);
      if (!proj) return { sym, neededLot: 0, additionalLot: 0, neededUSD: 0, perYearUSD: 0, targetHBT: 0, targetPrice: 0 };

      const targetYearData = proj.years[targetYearIndex];
      // Projeksiyon tablosundaki hedef yıldaki mevcut LOT'u kullan (geri yatırım dahil)
      const currentLotAtTarget = targetYearData?.lot || 0;
      const targetHBT = targetYearData?.hbt || 0;

      // Verim ağırlığına göre hedef dağıtım — verimi yüksek hisseden daha fazla temettü beklenir
      const symAgirlik = verimAgirliklar[sym] || (1 / TEMETTU_SYMBOLS.length);
      const perStockTargetUSD = requiredYearlyUSD * symAgirlik;
      const perStockTargetTL = perStockTargetUSD * usdRate;

      const neededLot = targetHBT > 0 ? Math.ceil(perStockTargetTL / targetHBT) : 0;
      const additionalLot = Math.max(0, neededLot - currentLotAtTarget);

      const targetPrice = targetYearData?.fiyat || 0;
      const neededUSD = (additionalLot * targetPrice) / usdRate;
      const perYearUSD = neededUSD / targetYearIndex;

      return { sym, neededLot, additionalLot, neededUSD, perYearUSD, targetHBT, targetPrice };
    });
  }, [projections, targetYearIndex, manualInputs, usdRate, requiredYearlyUSD]);

  const totalNeededUSD = requiredInvestment.reduce((acc, r) => acc + r.neededUSD, 0);
  const totalPerYearUSD = requiredInvestment.reduce((acc, r) => acc + r.perYearUSD, 0);

  // Senin Excel hesabın: yıllık hedef/2 * hedef yıl * kur → ağırlıklara göre dağıt
  const aylikHedefUSD = parseFloat(monthlyTargetUSD || '4000');
  const yillikHedefUSD = aylikHedefUSD * 12;
  const toplamEklenecekUSD = (yillikHedefUSD / 2) * parseInt(targetYear || '7');
  const toplamEklenecekTL = toplamEklenecekUSD * usdRate;
  const agirlikliDagilim = TEMETTU_SYMBOLS.map(sym => {
    const agirlik = verimAgirliklar[sym] || 0;
    return {
      sym,
      agirlik: agirlik * 100,
      gerekenTL: toplamEklenecekTL * agirlik,
      gerekenUSD: toplamEklenecekUSD * agirlik,
    };
  });

  // Kümülatif toplam
  const kumulatif = yearTotals.reduce((acc, yt) => acc + yt.totalUSD, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">10 Yıllık Temettü Projeksiyonu</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Yıllık büyüme oranı ile hesaplanmış projeksiyon
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
          <button
            onClick={() => setReinvestDividends(!reinvestDividends)}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              reinvestDividends ? "bg-green-500" : "bg-white/20"
            )}
          >
            <div className={cn(
              "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all",
              reinvestDividends ? "left-5" : "left-0.5"
            )} />
          </button>
          <span className="text-xs font-bold text-green-400">Temettü Geri Yatırımı</span>
        </div>
      </div>

      {/* Ayarlar */}
      <div className="p-4 bg-card/20 rounded-xl border border-white/5">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Başlangıç Değerleri & Ayarlar</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-foreground">USD/TL Kuru</label>
            <input
              type="number"
              value={manualInputs[TEMETTU_SYMBOLS[0]]?.usdRate || '43.83'}
              onChange={e => TEMETTU_SYMBOLS.forEach(sym => updateInput(sym, 'usdRate', e.target.value))}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Yıllık HBT Büyüme (%)</label>
            <input
              type="number"
              value={growthRate}
              onChange={e => setGrowthRate(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fiyat Performansı (%)</label>
            <input
              type="number"
              value={priceGrowth}
              onChange={e => setPriceGrowth(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Aylık Ekleme (USD)</label>
            <input
              type="number"
              value={monthlyUSD}
              onChange={e => setMonthlyUSD(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Aylık Temettü Hedefi (USD)</label>
            <input
              type="number"
              value={monthlyTargetUSD}
              onChange={e => setMonthlyTargetUSD(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Dolar Enflasyonu (%)</label>
            <input
              type="number"
              value={dollarInflation}
              onChange={e => setDollarInflation(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Yıl Hedefi</label>
            <input
              type="number"
              value={targetYear}
              onChange={e => setTargetYear(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {TEMETTU_SYMBOLS.map(sym => {
            const div = dividendMap[sym];
            return (
              <div key={sym} className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                    {sym[0]}
                  </div>
                  <p className="text-xs font-bold">{sym}</p>
                </div>
                <div className="border-b border-white/10 pb-2 mb-1">
                  <p className="text-[10px] font-bold text-primary mb-1">2025</p>
                  <div className="space-y-1">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Fiyat (₺)</label>
                      <input type="number" value={manualInputs[sym]?.price2025 || ''} onChange={e => updateInput(sym, 'price2025', e.target.value)} className="w-full mt-0.5 bg-background/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">HBT (₺)</label>
                      <input type="number" value={manualInputs[sym]?.hbt2025 || ''} onChange={e => updateInput(sym, 'hbt2025', e.target.value)} className="w-full mt-0.5 bg-background/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50" placeholder={div?.netDividendPerShare?.toFixed(4) || '0'} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Lot</label>
                      <input type="number" value={manualInputs[sym]?.lot2025 || ''} onChange={e => updateInput(sym, 'lot2025', e.target.value)} className="w-full mt-0.5 bg-background/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50" placeholder="0" />
                    </div>
                  </div>
                </div>
                <div className="pb-2">
                  <p className="text-[10px] font-bold text-yellow-400 mb-1">2026</p>
                  <div className="space-y-1">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Fiyat (₺)</label>
                      <input type="number" value={manualInputs[sym]?.price2026 || ''} onChange={e => updateInput(sym, 'price2026', e.target.value)} className="w-full mt-0.5 bg-background/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">HBT (₺)</label>
                      <input type="number" value={manualInputs[sym]?.hbt2026 || ''} onChange={e => updateInput(sym, 'hbt2026', e.target.value)} className="w-full mt-0.5 bg-background/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Lot</label>
                      <input type="number" value={manualInputs[sym]?.lot2026 || ''} onChange={e => updateInput(sym, 'lot2026', e.target.value)} className="w-full mt-0.5 bg-background/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50" placeholder="0" />
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Verim Ağırlığı: <span className="text-primary font-bold">%{((verimAgirliklar[sym] || 0) * 100).toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kümülatif özet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/20">
          <p className="text-xs text-muted-foreground">10 Yıl Kümülatif (USD)</p>
          <p className="text-2xl font-black text-green-400">${kumulatif.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="p-4 bg-card/20 rounded-xl border border-white/5">
          <p className="text-xs text-muted-foreground">2025 Son Yıl (USD)</p>
          <p className="text-2xl font-black">${(yearTotals[YEARS-1]?.totalUSD || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="p-4 bg-card/20 rounded-xl border border-white/5">
          <p className="text-xs text-muted-foreground">Aylık (Son Yıl)</p>
          <p className="text-2xl font-black">${((yearTotals[YEARS-1]?.totalUSD || 0) / 12).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
          <p className="text-xs text-muted-foreground">Geri Yatırım</p>
          <p className="text-2xl font-black text-primary">{reinvestDividends ? '✅ Aktif' : '❌ Pasif'}</p>
        </div>
      </div>




      {/* Yıl bazlı özet tablo */}
      <div>
        <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Yıllık Projeksiyon Özeti</p>
        <div className="space-y-2">
          {yearTotals.map((yt, i) => (
            <div key={yt.year} className="rounded-xl border border-white/5 overflow-hidden">
              <button
                onClick={() => setExpandedYear(expandedYear === yt.year ? null : yt.year)}
                className="w-full flex items-center justify-between p-4 bg-card/20 hover:bg-card/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "text-sm font-black px-3 py-1 rounded-lg",
                    i === 0 ? "bg-primary/20 text-primary" :
                    i === parseInt(targetYear || '7') ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50" :
                    "bg-white/5 text-white"
                  )}>
                    {yt.year}
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Toplam TEM. NET</p>
                      <p className="text-sm font-bold">₺{yt.totalTL.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Toplam (USD)</p>
                      <p className="text-sm font-bold text-green-400">${yt.totalUSD.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
                    </div>
                    {i > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Büyüme</p>
                        <p className="text-sm font-bold text-blue-400">
                          +{((yt.totalTL / yearTotals[i-1].totalTL - 1) * 100).toFixed(1)}%
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-muted-foreground">Hedefe Ulaşım</p>
                      <p className={cn("text-sm font-bold", yt.totalUSD >= yearlyTargetUSD ? "text-green-400" : "text-orange-400")}>
                        {yt.totalUSD >= yearlyTargetUSD
                          ? "✅ Hedef Aşıldı!"
                          : `$${(yearlyTargetUSD - yt.totalUSD).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} eksik`}
                      </p>
                    </div>
                    {i === parseInt(targetYear || '7') && (
                      <div className="text-xs font-black bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                        🎯 HEDEF YIL
                      </div>
                    )}
                  </div>
                </div>
                {expandedYear === yt.year
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>

              {expandedYear === yt.year && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-t border-white/5 bg-background/30">
                        <td className="px-4 py-2 text-muted-foreground font-bold"></td>
                        {TEMETTU_SYMBOLS.map(sym => (
                          <td key={sym} className="px-4 py-2 text-center font-black text-white">{sym}</td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'fiyat', label: 'FİYAT', format: (v: any) => `₺${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`, highlight: true },
                        { key: 'lot', label: 'LOT', format: (v: any) => Number(v).toLocaleString('tr-TR') },
                        ...(i > 0 ? [
                          { key: 'lotEklem', label: 'LOT EKLEM (Aylık)', format: (v: any) => v != null ? Number(v).toLocaleString('tr-TR') : '-' },
                          ...(reinvestDividends ? [
                            { key: 'reinvestLot', label: 'LOT EKLEM (Tem.)', format: (v: any) => v != null ? `+${Number(v).toLocaleString('tr-TR')}` : '-', green: true },
                          ] : []),
                        ] : []),
                        { key: 'hbt', label: `HBT ${yt.year}`, format: (v: any) => `₺${Number(v).toFixed(4)}` },
                        ...(i > 0 ? [
                          { key: 'hbtYukselmesi', label: 'HBT YÜKS.', format: (v: any) => v != null ? `₺${Number(v).toFixed(4)}` : '-' },
                        ] : []),
                        { key: 'temNet', label: 'TEM. NET', format: (v: any) => `₺${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, highlight: true },
                        { key: 'temNetDL', label: 'TEM. NET DL', format: (v: any) => `$${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, green: true },
                      ].map(row => (
                        <tr key={row.key} className={cn("border-t border-white/5", row.highlight ? "bg-white/5" : "")}>
                          <td className={cn("px-4 py-2 font-bold", row.green ? "text-green-400" : row.highlight ? "text-white" : "text-muted-foreground")}>
                            {row.label}
                          </td>
                          {projections.map(p => {
                            const yearData = p.years[i] as any;
                            const val = yearData?.[row.key];
                            return (
                              <td key={p.sym} className={cn("px-4 py-2 text-center", row.green ? "text-green-400 font-bold" : row.highlight ? "text-white font-bold" : "text-muted-foreground")}>
                                {row.format(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Yıllık ekleme satırı */}
                      {i > 0 && i <= parseInt(targetYear || '7') && (() => {
                        const yillikUSD = toplamEklenecekUSD / parseInt(targetYear || '7');
                        return (
                          <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                            <td className="px-4 py-2 font-bold text-blue-400">EKLENECEK (USD)</td>
                            {TEMETTU_SYMBOLS.map(sym => {
                              const agirlik = verimAgirliklar[sym] || 0;
                              return (
                                <td key={sym} className="px-4 py-2 text-center text-blue-400 font-bold">
                                  ${(yillikUSD * agirlik).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
