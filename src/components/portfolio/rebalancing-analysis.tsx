"use client";

import { useMemo, useState, useEffect } from "react";
import { StockHolding, AssetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Scale, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface RebalancingAnalysisProps {
  holdings: StockHolding[];
}

const DEFAULT_WEIGHTS: Partial<Record<AssetCategory, number>> = {
  "Temettü": 70,
  "Büyüme": 30,
  "Emtia": 15,
  "Kripto": 5,
  "Nakit": 20,
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function RebalancingAnalysis({ holdings }: RebalancingAnalysisProps) {
  const [baseLimit, setBaseLimit] = useState<number>(0);
  const [targetWeights, setTargetWeights] = useState<Partial<Record<AssetCategory, number>>>({});

  useEffect(() => {
    setBaseLimit(loadFromStorage("bistrack_baseLimit", 2814000));
    setTargetWeights(loadFromStorage("bistrack_targetWeights", DEFAULT_WEIGHTS));
  }, []);

  const buyumeHoldings = useMemo(() => {
    return holdings.filter((h) => h.category === "Büyüme");
  }, [holdings]);

  const buyumeTargetLimit = useMemo(() => {
    const weight = targetWeights["Büyüme"] || 30;
    return (baseLimit * weight) / 100;
  }, [baseLimit, targetWeights]);

  const stockCount = buyumeHoldings.length;
  const perStockLimit = stockCount > 0 ? buyumeTargetLimit / stockCount : 0;

  const currentTotal = useMemo(() => {
    return buyumeHoldings.reduce((sum, h) => sum + h.quantity * (h.currentPrice || h.averageCost), 0);
  }, [buyumeHoldings]);

  const rebalanceLimit = stockCount > 0 ? currentTotal / stockCount : 0;

  const dailyChangePercent = useMemo(() => {
    if (currentTotal === 0) return 0;
    const totalPrevValue = buyumeHoldings.reduce((sum, h) => {
      const curPrice = h.currentPrice || h.averageCost;
      const changeDecimal = (h.dailyChange || 0) / 100;
      const prevPrice = curPrice / (1 + changeDecimal);
      return sum + h.quantity * prevPrice;
    }, 0);
    return totalPrevValue > 0 ? ((currentTotal - totalPrevValue) / totalPrevValue) * 100 : 0;
  }, [buyumeHoldings, currentTotal]);

  const diff = buyumeTargetLimit - currentTotal;

  const tableData = useMemo(() => {
    return buyumeHoldings.map((h) => {
      const price = h.currentPrice || h.averageCost;
      const currentVal = h.quantity * price;
      const surplus = currentVal - perStockLimit;
      const lot = price > 0 ? Math.round(surplus / price) : 0;
      const costBasis = h.quantity * h.averageCost;
      const plPercent = costBasis > 0 ? ((currentVal - costBasis) / costBasis) * 100 : 0;
      return { symbol: h.symbol, price, currentVal, limit: perStockLimit, surplus, plPercent, lot };
    }).sort((a, b) => b.currentVal - a.currentVal);
  }, [buyumeHoldings, perStockLimit]);

  const rebalanceData = useMemo(() => {
    return buyumeHoldings.map((h) => {
      const price = h.currentPrice || h.averageCost;
      const currentVal = h.quantity * price;
      const surplus = currentVal - rebalanceLimit;
      const lot = price > 0 ? Math.round(surplus / price) : 0;
      return { symbol: h.symbol, currentVal, limit: rebalanceLimit, surplus, lot, price };
    }).sort((a, b) => b.currentVal - a.currentVal);
  }, [buyumeHoldings, rebalanceLimit]);

  const fmt = (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
  const fmtPrice = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Target className="w-20 h-20 rotate-12" />
          </div>
          <CardContent className="p-5">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Toplam Hedef</p>
            <h3 className="text-2xl font-black text-white">₺{fmt(buyumeTargetLimit)}</h3>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Büyüme Sınır Hedefi</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/[0.06] shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Scale className="w-20 h-20 -rotate-12" />
          </div>
          <CardContent className="p-5">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Mevcut Toplam</p>
            <h3 className="text-2xl font-black text-white">₺{fmt(currentTotal)}</h3>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">{stockCount} Hisse</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "shadow-2xl relative overflow-hidden group border-none",
          diff >= 0 ? "bg-bist-down/10" : "bg-bist-up/10"
        )}>
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            {diff >= 0 ? <ArrowDownCircle className="w-20 h-20" /> : <ArrowUpCircle className="w-20 h-20" />}
          </div>
          <CardContent className="p-5">
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest mb-1",
              diff >= 0 ? "text-bist-down" : "text-bist-up"
            )}>Fark</p>
            <h3 className={cn(
              "text-2xl font-black",
              diff >= 0 ? "text-bist-down" : "text-bist-up"
            )}>
              {diff >= 0 ? "-" : "+"}₺{fmt(Math.abs(diff))}
            </h3>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Hedef - Mevcut</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "shadow-2xl relative overflow-hidden group border-none",
          dailyChangePercent >= 0 ? "bg-bist-up/10" : "bg-bist-down/10"
        )}>
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            {dailyChangePercent >= 0 ? <TrendingUp className="w-20 h-20" /> : <TrendingDown className="w-20 h-20" />}
          </div>
          <CardContent className="p-5">
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest mb-1",
              dailyChangePercent >= 0 ? "text-bist-up" : "text-bist-down"
            )}>Hisse Değişim</p>
            <h3 className={cn(
              "text-2xl font-black",
              dailyChangePercent >= 0 ? "text-bist-up" : "text-bist-down"
            )}>
              {dailyChangePercent >= 0 ? "+" : ""}{dailyChangePercent.toFixed(2)}%
            </h3>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Günlük Değişim</p>
          </CardContent>
        </Card>
      </div>

      {/* Hedef Sınır Tablosu */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <Target className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wider">Hedef Sınır Analizi</h3>
          <span className="text-[10px] text-muted-foreground font-bold ml-2">
            Hisse Başı Sınır: ₺{fmt(perStockLimit)}
          </span>
        </div>
        <div className="bg-card/20 border border-white/[0.05] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Hisse</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Fiyat (₺)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Mevcut Değer (₺)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Sınır (₺)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Fazla/Eksik (₺)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Kar/Zarar (%)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Lot Al/Sat</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={row.symbol} className={cn("border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors", i % 2 === 0 ? "bg-white/[0.01]" : "")}>
                    <td className="px-4 py-3 font-bold text-primary uppercase">{row.symbol}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtPrice(row.price)}</td>
                    <td className="px-4 py-3 text-right font-bold">{fmt(row.currentVal)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(row.limit)}</td>
                    <td className={cn("px-4 py-3 text-right font-bold", row.surplus >= 0 ? "text-bist-up" : "text-bist-down")}>
                      {row.surplus >= 0 ? "+" : ""}{fmt(row.surplus)}
                    </td>
                    <td className={cn("px-4 py-3 text-right font-bold", row.plPercent >= 0 ? "text-bist-up" : "text-bist-down")}>
                      {row.plPercent >= 0 ? "+" : ""}{row.plPercent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.lot !== 0 ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black",
                          row.lot > 0 ? "bg-bist-up/15 text-bist-up" : "bg-bist-down/15 text-bist-down"
                        )}>
                          {row.lot > 0 ? `${row.lot} SAT` : `${Math.abs(row.lot)} AL`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {tableData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Büyüme kategorisinde hisse bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Rebalancing Tablosu */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-accent/10 text-accent">
            <Scale className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wider">Rebalancing (Eşit Dağılım)</h3>
          <span className="text-[10px] text-muted-foreground font-bold ml-2">
            Hisse Başı Sınır: ₺{fmt(rebalanceLimit)}
          </span>
        </div>
        <div className="bg-card/20 border border-white/[0.05] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Hisse</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Mevcut Değer (₺)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Rebalancing Sınırı (₺)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Fazla/Eksik (₺)</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Lot Al/Sat</th>
                </tr>
              </thead>
              <tbody>
                {rebalanceData.map((row, i) => (
                  <tr key={row.symbol} className={cn("border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors", i % 2 === 0 ? "bg-white/[0.01]" : "")}>
                    <td className="px-4 py-3 font-bold text-primary uppercase">{row.symbol}</td>
                    <td className="px-4 py-3 text-right font-bold">{fmt(row.currentVal)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(row.limit)}</td>
                    <td className={cn("px-4 py-3 text-right font-bold", row.surplus >= 0 ? "text-bist-up" : "text-bist-down")}>
                      {row.surplus >= 0 ? "+" : ""}{fmt(row.surplus)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.lot !== 0 ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black",
                          row.lot > 0 ? "bg-bist-up/15 text-bist-up" : "bg-bist-down/15 text-bist-down"
                        )}>
                          {row.lot > 0 ? `${row.lot} SAT` : `${Math.abs(row.lot)} AL`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rebalanceData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Büyüme kategorisinde hisse bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
