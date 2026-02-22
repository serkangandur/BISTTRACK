'client';

import { useState, useMemo } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
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
  usdRate: string;
}

export function DividendProjection({ holdings, dividendMap }: DividendProjectionProps) {
  const [manualInputs, setManualInputs] = useState<Record<string, ManualInput>>(() => {
    const init: Record<string, ManualInput> = {};
    TEMETTU_SYMBOLS.forEach(sym => {
      const holding = holdings.find(h => h.symbol.toUpperCase() === sym);
      init[sym] = {
        price2025: holding?.averageCost?.toString() || '',
        lot2025: holding?.quantity?.toString() || '',
        usdRate: '32',
      };
    });
    return init;
  });
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  const updateInput = (sym: string, field: keyof ManualInput, value: string) => {
    setManualInputs(prev => ({ ...prev, [sym]: { ...prev[sym], [field]: value } }));
  };

  const usdRate = parseFloat(manualInputs[TEMETTU_SYMBOLS[0]]?.usdRate || '32') || 32;
  const [growthRate, setGrowthRate] = useState('30');
  const GROWTH_RATE = parseFloat(growthRate) / 100 || 0.30;
  const [priceGrowth, setPriceGrowth] = useState('30');
  const PRICE_GROWTH = parseFloat(priceGrowth) / 100 || 0.30;
  const [monthlyUSD, setMonthlyUSD] = useState('2000');
  const [monthlyTargetUSD, setMonthlyTargetUSD] = useState('4000');
  const [dollarInflation, setDollarInflation] = useState('3');
  const yearlyTargetUSD = parseFloat(monthlyTargetUSD || '4000') * 12;

  // Her hisse için 10 yıllık projeksiyon hesapla
  const projections = useMemo(() => {
    return TEMETTU_SYMBOLS.map(sym => {
      const div = dividendMap[sym];
      const holding = holdings.find(h => h.symbol.toUpperCase() === sym);
      const input = manualInputs[sym];

      const baseHBT = div?.netDividendPerShare || 0;
      const lot2025 = parseFloat(input?.lot2025 || '0') || 0;
      const liveLot = holding?.quantity || 0;
      const livePrice = holding?.currentPrice || 0;

      const years = Array.from({ length: YEARS }, (_, i) => {
        const year = START_YEAR + i;
        const hbt = baseHBT * Math.pow(1 + GROWTH_RATE, i);
        
        const projectedPrice = year === 2026 
          ? livePrice 
          : livePrice * Math.pow(1 + PRICE_GROWTH, i - 1);

        const fiyat = year === START_YEAR 
          ? parseFloat(input?.price2025 || '0') 
          : projectedPrice;

        const monthlyAddedLot = year > START_YEAR && projectedPrice > 0
          ? Math.floor((parseFloat(monthlyUSD || '2000') * usdRate) / TEMETTU_SYMBOLS.length / projectedPrice)
          : 0;
        const totalAddedLot = monthlyAddedLot * 12 * i;
        const lot = year === START_YEAR ? lot2025 : liveLot + totalAddedLot;
        const lotEklem = year > START_YEAR ? monthlyAddedLot * 12 : null;
        
        const hbtYukselmesi = year > START_YEAR ? hbt - baseHBT * Math.pow(1 + GROWTH_RATE, i - 1) : null;
        const temNet = lot * hbt;
        const temNetDL = temNet / usdRate;

        return {
          year,
          fiyat,
          lot,
          lotEklem,
          hbt,
          hbtYukselmesi,
          temNet,
          temNetDL,
        };
      });

      return { sym, years };
    });
  }, [dividendMap, holdings, manualInputs, usdRate, priceGrowth, growthRate, monthlyUSD]);

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">10 Yıllık Temettü Projeksiyonu</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Yıllık büyüme oranı ile hesaplanmış projeksiyon
          </p>
        </div>
      </div>

      {/* Ayarlar */}
      <div className="p-4 bg-card/20 rounded-xl border border-white/5">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">2025 Başlangıç Değerleri & Ayarlar</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-foreground">USD/TL Kuru</label>
            <input
              type="number"
              value={manualInputs[TEMETTU_SYMBOLS[0]]?.usdRate || '32'}
              onChange={e => TEMETTU_SYMBOLS.forEach(sym => updateInput(sym, 'usdRate', e.target.value))}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              placeholder="32"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Yıllık Büyüme Oranı (%)</label>
            <input
              type="number"
              value={growthRate}
              onChange={e => setGrowthRate(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              placeholder="30"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fiyat Performansı (%)</label>
            <input
              type="number"
              value={priceGrowth}
              onChange={e => setPriceGrowth(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              placeholder="30"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Aylık Ekleme (USD)</label>
            <input
              type="number"
              value={monthlyUSD}
              onChange={e => setMonthlyUSD(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              placeholder="2000"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Aylık Temettü Hedefi (USD)</label>
            <input
              type="number"
              value={monthlyTargetUSD}
              onChange={e => setMonthlyTargetUSD(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              placeholder="4000"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Dolar Enflasyonu (%)</label>
            <input
              type="number"
              value={dollarInflation}
              onChange={e => setDollarInflation(e.target.value)}
              className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              placeholder="3"
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
                <div>
                  <label className="text-[10px] text-muted-foreground">2025 Fiyat (₺)</label>
                  <input
                    type="number"
                    value={manualInputs[sym]?.price2025 || ''}
                    onChange={e => updateInput(sym, 'price2025', e.target.value)}
                    className="w-full mt-0.5 bg-background/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">2025 Lot</label>
                  <input
                    type="number"
                    value={manualInputs[sym]?.lot2025 || ''}
                    onChange={e => updateInput(sym, 'lot2025', e.target.value)}
                    className="w-full mt-0.5 bg-background/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                    placeholder="0"
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  HBT: <span className="text-white">₺{div?.netDividendPerShare?.toFixed(4) || '---'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Yıl bazlı özet tablo */}
      <div>
        <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Yıllık Projeksiyon Özeti</p>
        <div className="space-y-2">
          {yearTotals.map((yt, i) => (
            <div key={yt.year} className="rounded-xl border border-white/5 overflow-hidden">
              {/* Yıl başlık satırı */}
              <button
                onClick={() => setExpandedYear(expandedYear === yt.year ? null : yt.year)}
                className="w-full flex items-center justify-between p-4 bg-card/20 hover:bg-card/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "text-sm font-black px-3 py-1 rounded-lg",
                    i === 0 ? "bg-primary/20 text-primary" : "bg-white/5 text-white"
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
                  </div>
                </div>
                {expandedYear === yt.year 
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>

              {/* Detay tablo */}
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
                        { key: 'fiyat', label: 'FİYAT', format: (v: number) => `₺${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`, highlight: true },
                        { key: 'lot', label: 'LOT', format: (v: number) => v.toLocaleString('tr-TR') },
                        ...(i > 0 ? [
                          { key: 'lotEklem', label: 'LOT EKLEM', format: (v: number | null) => v !== null ? v.toLocaleString('tr-TR') : '-' },
                        ] : []),
                        { key: 'hbt', label: `HBT ${yt.year}`, format: (v: number) => `₺${v.toFixed(4)}` },
                        ...(i > 0 ? [
                          { key: 'hbtYukselmesi', label: 'HBT YÜKS.', format: (v: number | null) => v !== null ? `₺${v.toFixed(4)}` : '-' },
                        ] : []),
                        { key: 'temNet', label: 'TEM. NET', format: (v: number) => `₺${v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, highlight: true },
                        { key: 'temNetDL', label: 'TEM. NET DL', format: (v: number) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, green: true },
                      ].map(row => (
                        <tr key={row.key} className={cn(
                          "border-t border-white/5",
                          row.highlight ? "bg-white/5" : "",
                        )}>
                          <td className={cn(
                            "px-4 py-2 font-bold",
                            row.green ? "text-green-400" : row.highlight ? "text-white" : "text-muted-foreground"
                          )}>
                            {row.label}
                          </td>
                          {projections.map(p => {
                            const yearData = p.years[i] as any;
                            const val = yearData?.[row.key];
                            return (
                              <td key={p.sym} className={cn(
                                "px-4 py-2 text-center",
                                row.green ? "text-green-400 font-bold" : row.highlight ? "text-white font-bold" : "text-muted-foreground"
                              )}>
                                {row.format(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
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
