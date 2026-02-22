
"use client";

import { useMemo, useState } from "react";
import { StockHolding, AssetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WeightAnalysisProps {
  holdings: StockHolding[];
}

const TARGET_WEIGHTS: Partial<Record<AssetCategory, number>> = {
  "Temettü": 70,
  "Büyüme": 30,
  "Emtia": 15,
  "Kripto": 5,
  "Nakit": 20,
};

export function WeightAnalysis({ holdings }: WeightAnalysisProps) {
  // Global Sınır State - Kullanıcı tarafından düzenlenebilir
  const [baseLimit, setBaseLimit] = useState(2814000);

  // Kategorilere göre verileri grupla - ANA PARA (Maliyet) BAZLI HESAPLAMA
  const categoryData = useMemo(() => {
    const data: Partial<Record<AssetCategory, { total: number; holdings: StockHolding[]; limit: number; targetPercent: number }>> = {};
    
    // Sigorta için özel maaş bazlı hesaplama
    const insuranceHolding = holdings.find(h => h.category === "Sigorta");
    const insuranceLimit = insuranceHolding?.monthlySalary ? insuranceHolding.monthlySalary * 60 : 474003.58;

    Object.keys(TARGET_WEIGHTS).forEach((cat) => {
      const category = cat as AssetCategory;
      const targetPercent = TARGET_WEIGHTS[category] || 0;
      data[category] = {
        total: 0,
        holdings: [],
        limit: (baseLimit * targetPercent) / 100,
        targetPercent
      };
    });

    // Sigorta kategorisini ekle
    data["Sigorta"] = {
      total: 0,
      holdings: [],
      limit: insuranceLimit,
      targetPercent: 0
    };

    holdings.forEach(h => {
      if (data[h.category]) {
        // ✅ ANA PARA HESABI: Miktar * Ortalama Maliyet
        data[h.category]!.total += h.quantity * h.averageCost;
        data[h.category]!.holdings.push(h);
      }
    });

    return data;
  }, [holdings, baseLimit]);

  // Toplam Ana Para Değeri
  const totalCostBasis = useMemo(() => 
    holdings.filter(h => h.category !== "Temettü Sabit").reduce((acc, h) => acc + (h.quantity * h.averageCost), 0)
  , [holdings]);

  // Kategorilerin toplam limiti
  const totalLimit = useMemo(() => {
     return Object.values(categoryData).reduce((acc, d) => acc + (d?.limit || 0), 0);
  }, [categoryData]);

  const deficitSurplus = totalCostBasis - totalLimit;

  const CategoryBoard = ({ category, label, color }: { category: AssetCategory, label: string, color: string }) => {
    const data = categoryData[category];
    if (!data) return null;

    const diff = data.total - data.limit;
    const actualPercent = data.limit > 0 ? (data.total / data.limit) * 100 : 0;
    const isOver = diff >= 0;

    // 10 satıra tamamla
    const displayHoldings = [...data.holdings];
    while (displayHoldings.length < 10) {
      displayHoldings.push({ id: `empty-${displayHoldings.length}`, symbol: "", name: "", quantity: 0, averageCost: 0, currentPrice: 0, dailyChange: 0, category: category });
    }

    return (
      <div className="flex flex-col border border-orange-500/60 bg-black min-w-[180px] flex-1 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
        {/* Header */}
        <div className={cn("text-center font-black py-1.5 text-black text-[13px] uppercase tracking-tighter", color)}>
          {label}
        </div>
        
        {/* Sınır Paneli */}
        <div className="border-t border-orange-500/60 px-1 py-1">
          <div className="text-[10px] text-orange-400/80 text-center font-bold tracking-widest">SINIR</div>
          <div className="bg-yellow-400 text-black text-center font-black text-[14px] py-1">
            ₺{data.limit.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Hedef Yüzde Paneli */}
        <div className="border-t border-orange-500/60 py-1.5 bg-yellow-400/90 text-black text-center font-black text-xl leading-none">
          {category === "Sigorta" ? (
            <div className="flex justify-around items-center h-full">
              <div className="text-center leading-tight">
                <span className="text-[9px] block">AY</span>
                <span className="text-[14px]">60</span>
              </div>
              <div className="text-center leading-tight">
                <span className="text-[9px] block">MAAS</span>
                <span className="text-[14px]">₺{(data.limit/60).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          ) : (
            data.targetPercent
          )}
        </div>

        {/* Fazla/Az Paneli */}
        <div className="border-t border-orange-500/60 px-1 py-1">
          <div className="text-[10px] text-orange-400/80 text-center font-bold uppercase tracking-widest">Fazla/Az</div>
          <div className={cn(
            "text-center font-black text-[14px] py-1 border border-orange-500/20",
            isOver ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          )}>
            {isOver ? "+" : "-"}₺{Math.abs(diff).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Gerçekleşen Yüzde Paneli */}
        <div className="border-t border-orange-500/60 py-1.5 text-center bg-zinc-950">
          <div className={cn(
            "text-[14px] font-black",
            actualPercent >= 100 ? "text-green-400" : "text-red-400"
          )}>
            %{actualPercent.toFixed(2).replace('.', ',')}
          </div>
        </div>

        {/* Varlık Listesi Izgarası */}
        <div className="border-t border-orange-500/60 flex-1 overflow-hidden">
          {displayHoldings.map((h, i) => (
            <div key={h.id} className="grid grid-cols-5 border-b border-orange-500/30 last:border-0 h-6 items-center px-1.5 group hover:bg-white/5 transition-colors">
              <div className="col-span-2 text-[10px] font-bold text-sky-400 truncate uppercase tracking-tighter">
                {h.symbol}
              </div>
              <div className="col-span-3 text-[10px] text-orange-200 text-right font-mono font-medium">
                {h.symbol ? `₺${(h.quantity * h.averageCost).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}` : ""}
              </div>
            </div>
          ))}
        </div>

        {/* Kategori Toplam Paneli */}
        <div className="border-t border-orange-500/60 bg-zinc-900 p-2 text-center">
          <div className="text-[13px] font-black text-white/90">
            ₺{data.total.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in zoom-in duration-700 overflow-x-auto pb-8 px-2">
      {/* Üst Global İstatistik Panelleri */}
      <div className="flex flex-wrap justify-center gap-8 md:gap-16 pt-6">
        {/* Eksik/Fazla */}
        <div className="min-w-[200px] border-2 border-orange-500 p-1 bg-black shadow-[0_0_20px_rgba(249,115,22,0.15)]">
          <div className="bg-orange-600 text-black text-[11px] font-black text-center py-1 uppercase tracking-widest">Eksik/Fazla Miktar</div>
          <div className={cn(
            "text-center py-4 font-black text-lg border-t-2 border-orange-500 mt-0.5",
            deficitSurplus >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          )}>
            {deficitSurplus >= 0 ? "+" : "-"}₺{Math.abs(deficitSurplus).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Global Sınır - DÜZENLENEBİLİR KUTU */}
        <div className="min-w-[240px] border-2 border-orange-500 p-1 bg-black shadow-[0_0_20px_rgba(249,115,22,0.15)]">
          <div className="text-orange-400 text-[11px] font-black text-center py-1 uppercase tracking-widest">Global Sınır (Miktar Giriniz)</div>
          <div className="bg-yellow-400 text-black flex items-center justify-center py-4 border-t-2 border-orange-500 mt-0.5 relative group">
            <span className="font-black text-lg ml-4">₺</span>
            <input 
              type="text"
              inputMode="numeric"
              value={baseLimit.toLocaleString("tr-TR")}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/[^0-9]/g, '');
                setBaseLimit(Number(rawValue) || 0);
              }}
              className="bg-transparent border-none text-left w-full focus:outline-none focus:ring-0 font-black text-lg px-2 placeholder-black/50"
            />
          </div>
        </div>

        {/* Global Yatırım (Ana Para Bazlı) */}
        <div className="min-w-[240px] border-2 border-orange-500 p-1 bg-black shadow-[0_0_20px_rgba(249,115,22,0.15)]">
          <div className="text-orange-400 text-[11px] font-black text-center py-1 uppercase tracking-widest">Global Yatırım</div>
          <div className="bg-yellow-400 text-black text-center py-4 font-black text-lg border-t-2 border-orange-500 mt-0.5">
            ₺{totalCostBasis.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Dikey Kategori Panelleri Izgarası */}
      <div className="flex gap-4 min-w-[1100px] justify-between h-[650px]">
        <CategoryBoard category="Temettü" label="Temettü" color="bg-green-500" />
        <CategoryBoard category="Büyüme" label="Büyüme" color="bg-green-500" />
        <CategoryBoard category="Emtia" label="Emtia" color="bg-green-500" />
        <CategoryBoard category="Kripto" label="Kripto" color="bg-green-500" />
        <CategoryBoard category="Nakit" label="Nakit" color="bg-green-500" />
        <CategoryBoard category="Sigorta" label="Sigorta" color="bg-green-500" />
      </div>
    </div>
  );
}
