"use client";

import { useMemo, useState, useEffect } from "react";
import { StockHolding, AssetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Target, 
  BarChart3, 
  Receipt, 
  Landmark, 
  Coins, 
  Banknote, 
  ShieldCheck,
  ChevronRight,
  Calculator
} from "lucide-react";

interface WeightAnalysisProps {
  holdings: StockHolding[];
}

const MAIN_INVESTMENT_CATEGORIES: AssetCategory[] = ["Temettü", "Büyüme", "Emtia", "Kripto", "Nakit"];

const CATEGORY_CONFIG: Record<AssetCategory, { icon: any; color: string }> = {
  "Temettü": { icon: Receipt, color: "text-blue-400" },
  "Büyüme": { icon: BarChart3, color: "text-purple-400" },
  "Emtia": { icon: Landmark, color: "text-amber-400" },
  "Kripto": { icon: Coins, color: "text-orange-400" },
  "Nakit": { icon: Banknote, color: "text-emerald-400" },
  "Sigorta": { icon: ShieldCheck, color: "text-cyan-400" },
  "Temettü Sabit": { icon: Calculator, color: "text-slate-400" }
};

const DEFAULT_WEIGHTS = {
  "Temettü": 70,
  "Büyüme": 30,
  "Emtia": 15,
  "Kripto": 5,
  "Nakit": 20,
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function WeightAnalysis({ holdings }: WeightAnalysisProps) {
  const [baseLimit, setBaseLimit] = useState<number>(() => loadFromStorage('bistrack_baseLimit', 2814000));
  const [insuranceMultiplier, setInsuranceMultiplier] = useState<number>(() => loadFromStorage('bistrack_insuranceMultiplier', 60));
  const [targetWeights, setTargetWeights] = useState<Partial<Record<AssetCategory, number>>>(() => loadFromStorage('bistrack_targetWeights', DEFAULT_WEIGHTS));

  // localStorage'a kaydet
  useEffect(() => { localStorage.setItem('bistrack_baseLimit', JSON.stringify(baseLimit)); }, [baseLimit]);
  useEffect(() => { localStorage.setItem('bistrack_insuranceMultiplier', JSON.stringify(insuranceMultiplier)); }, [insuranceMultiplier]);
  useEffect(() => { localStorage.setItem('bistrack_targetWeights', JSON.stringify(targetWeights)); }, [targetWeights]);

  // income-analysis ile birebir aynı hesap
  const monthlyIncome = useMemo(() => {
    const INCOME_CATS: AssetCategory[] = ["Temettü", "Büyüme", "Emtia", "Kripto", "Nakit"];
    return INCOME_CATS.reduce((acc, cat) => {
      const totalVal = holdings
        .filter(h => h.category === cat)
        .reduce((sum, h) => sum + (Number(h.quantity) * Number(h.currentPrice || h.averageCost)), 0);
      return acc + (totalVal / 100 * 3.5) / 12;
    }, 0);
  }, [holdings]);

  const categoryData = useMemo(() => {
    const data: Partial<Record<AssetCategory, { total: number; holdings: { symbol: string; currentVal: number }[]; limit: number; targetPercent: number }>> = {};
    
    const insuranceLimit = monthlyIncome * insuranceMultiplier;

    const allCategories: AssetCategory[] = ["Temettü", "Büyüme", "Emtia", "Kripto", "Nakit", "Sigorta"];
    
    allCategories.forEach((cat) => {
      const targetPercent = targetWeights[cat] || 0;
      data[cat] = {
        total: 0,
        holdings: [],
        limit: cat === "Sigorta" ? insuranceLimit : (baseLimit * targetPercent) / 100,
        targetPercent
      };
    });

    holdings.forEach(h => {
      if (h.category === "Temettü Sabit") return;
      const catData = data[h.category];
      if (catData) {
        const val = h.category === "Temettü" 
          ? h.quantity * h.averageCost 
          : h.quantity * (h.currentPrice || h.averageCost);
        catData.total += val;
        const existing = catData.holdings.find(item => item.symbol === h.symbol);
        if (existing) {
          existing.currentVal += val;
        } else {
          catData.holdings.push({ symbol: h.symbol, currentVal: val });
        }
      }
    });

    Object.values(data).forEach(d => {
      d?.holdings.sort((a, b) => b.currentVal - a.currentVal);
    });

    return data;
  }, [holdings, baseLimit, targetWeights, insuranceMultiplier]);

  const totalStrategicValue = useMemo(() => 
    holdings
      .filter(h => MAIN_INVESTMENT_CATEGORIES.includes(h.category))
      .reduce((acc, h) => {
        const val = h.category === "Temettü" 
          ? h.quantity * h.averageCost 
          : h.quantity * (h.currentPrice || h.averageCost);
        return acc + val;
      }, 0)
  , [holdings]);

  const totalLimit = useMemo(() => {
    return Object.entries(categoryData)
      .filter(([cat]) => MAIN_INVESTMENT_CATEGORIES.includes(cat as AssetCategory))
      .reduce((acc, [_, d]) => acc + (d?.limit || 0), 0);
  }, [categoryData]);

  const deficitSurplus = totalStrategicValue - totalLimit;

  const handleWeightChange = (category: AssetCategory, value: string) => {
    const numValue = Number(value.replace(/[^0-9]/g, ''));
    setTargetWeights(prev => ({ ...prev, [category]: numValue }));
  };

  const CategoryCard = ({ category, label }: { category: AssetCategory, label: string }) => {
    const data = categoryData[category];
    if (!data) return null;

    const config = CATEGORY_CONFIG[category];
    const Icon = config.icon;
    const diff = data.total - data.limit;
    const actualPercent = data.limit > 0 ? (data.total / data.limit) * 100 : 0;
    const isOver = diff >= 0;

    return (
      <Card className="bg-card/40 border-white/5 shadow-xl flex flex-col hover:border-white/10 transition-all duration-300">
        <CardHeader className="p-4 pb-2 border-b border-white/5 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md bg-white/5", config.color)}>
              <Icon className="w-4 h-4" />
            </div>
            <CardTitle className="text-xs font-bold uppercase tracking-wider">{label}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {category === "Sigorta" ? (
              <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Ay:</span>
                <input 
                  type="text"
                  inputMode="numeric"
                  value={insuranceMultiplier}
                  onChange={(e) => setInsuranceMultiplier(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                  className="bg-transparent border-none text-center w-8 focus:outline-none font-bold text-xs p-0"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                <input 
                  type="text"
                  inputMode="numeric"
                  value={data.targetPercent}
                  onChange={(e) => handleWeightChange(category, e.target.value)}
                  className="bg-transparent border-none text-right w-8 focus:outline-none font-bold text-xs p-0"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-4 flex-1 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Sınır Hedefi</p>
              <p className="text-sm font-black">₺{data.limit.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Mevcut Durum</p>
              <p className="text-sm font-black">₺{data.total.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <Badge variant="outline" className={cn(
                "text-[10px] py-0 h-5 border-none font-bold",
                isOver ? "bg-bist-up/10 text-bist-up" : "bg-bist-down/10 text-bist-down"
              )}>
                {isOver ? "+" : "-"}₺{Math.abs(diff).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
              </Badge>
              <span className="text-[11px] font-black text-muted-foreground">%{actualPercent.toFixed(1)}</span>
            </div>
            <Progress value={actualPercent} className="h-1.5 bg-white/5" />
          </div>

          <div className="mt-2 border-t border-white/5 pt-3 space-y-1.5 flex-1">
            <p className="text-[9px] text-muted-foreground font-black uppercase mb-2">Varlık Detayları</p>
            {data.holdings.length > 0 ? (
              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                {data.holdings.map((h, i) => (
                  <div key={i} className="flex justify-between items-center text-[11px] group">
                    <span className="text-primary font-bold flex items-center gap-1 uppercase">
                      <ChevronRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {h.symbol}
                    </span>
                    <span className="font-medium text-muted-foreground">₺{h.currentVal.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic py-4 text-center border border-dashed border-white/5 rounded">Henüz varlık yok</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Calculator className="w-24 h-24 rotate-12" />
          </div>
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Global Yatırım (Stratejik)</p>
            <h3 className="text-3xl font-black text-white">₺{totalStrategicValue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</h3>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <p className="text-[10px] text-muted-foreground font-bold">Temettü (Maliyet) + Diğerleri (Piyasa)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Target className="w-24 h-24 -rotate-12" />
          </div>
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Global Sınır (Kişisel Hedef)</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-white">₺</span>
              <input 
                type="text"
                inputMode="numeric"
                value={baseLimit.toLocaleString("tr-TR")}
                onChange={(e) => setBaseLimit(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                className="bg-transparent border-none text-left w-full focus:outline-none font-black text-3xl p-0"
              />
            </div>
            <p className="text-[10px] text-muted-foreground font-bold mt-2 italic">Hesaplamaları tetikleyen ana limit</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "shadow-2xl relative overflow-hidden group border-none",
          deficitSurplus >= 0 ? "bg-bist-up/10" : "bg-bist-down/10"
        )}>
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp className="w-24 h-24" />
          </div>
          <CardContent className="p-6">
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest mb-1",
              deficitSurplus >= 0 ? "text-bist-up" : "text-bist-down"
            )}>Eksik / Fazla Durumu</p>
            <h3 className={cn(
              "text-3xl font-black",
              deficitSurplus >= 0 ? "text-bist-up" : "text-bist-down"
            )}>
              {deficitSurplus >= 0 ? "+" : "-"}₺{Math.abs(deficitSurplus).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-[10px] text-muted-foreground font-bold mt-2">Hedeflenen stratejiye göre konumunuz</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CategoryCard category="Temettü" label="Temettü" />
        <CategoryCard category="Büyüme" label="Büyüme" />
        <CategoryCard category="Emtia" label="Emtia" />
        <CategoryCard category="Kripto" label="Kripto" />
        <CategoryCard category="Nakit" label="Nakit" />
        <CategoryCard category="Sigorta" label="Sigorta" />
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
