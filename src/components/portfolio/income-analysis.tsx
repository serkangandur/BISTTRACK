
"use client";

import { useMemo, useState } from "react";
import { StockHolding, AssetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

interface IncomeAnalysisProps {
  holdings: StockHolding[];
}

export function IncomeAnalysis({ holdings }: IncomeAnalysisProps) {
  // Mock döviz ve endeks verileri
  const currencies = {
    eur: 51.62,
    usd: 43.82
  };

  const indices = {
    bist100: "+0,94%",
    bist30: "+1,39%"
  };

  // Hedef Gelir (Görseldeki gibi sabit veya ayarlanabilir)
  const [targetMonthlyIncome, setTargetMonthlyIncome] = useState(4000);

  const categoryIncomes = useMemo(() => {
    const data: Record<string, { yearly: number; monthly: number; monthlyUsd: number }> = {};
    const categories: AssetCategory[] = ["Temettü", "Büyüme", "Emtia", "Kripto", "Nakit", "Sigorta", "Döviz"];

    categories.forEach(cat => {
      const filtered = holdings.filter(h => h.category === cat);
      const totalVal = filtered.reduce((acc, h) => {
        // Stratejiye sadık kalınarak: Temettü için maliyet (Ana Para), diğerleri için piyasa değeri
        const val = cat === "Temettü" ? h.quantity * h.averageCost : h.quantity * h.currentPrice;
        return acc + val;
      }, 0);

      // Talep edilen yeni hesaplama: Toplam / 100 * 3.5
      const yearly = (totalVal / 100) * 3.5;
      const monthly = yearly / 12;
      const monthlyUsd = monthly / currencies.usd;

      data[cat] = { yearly, monthly, monthlyUsd };
    });

    return data;
  }, [holdings, currencies.usd]);

  const totalMonthlyIncome = Object.values(categoryIncomes).reduce((acc, val) => acc + val.monthly, 0);
  
  // Yatırımdan gelen gelir: Temettü ve Büyüme toplamı
  const investmentIncome = categoryIncomes["Temettü"].monthly + categoryIncomes["Büyüme"].monthly;

  // Chart Genişlikleri
  const totalWidth = Math.min((totalMonthlyIncome / (targetMonthlyIncome * currencies.usd / 12)) * 100, 100); // Örnek hedef bazlı
  const investmentWidth = Math.min((investmentIncome / (targetMonthlyIncome * currencies.usd / 12)) * 100, 100);

  return (
    <div className="bg-black text-white p-8 space-y-12 font-mono uppercase tracking-tight select-none min-h-screen">
      
      {/* ÜST BAR */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="text-[9px] text-muted-foreground border border-white/10 px-4 py-0.5 bg-white/5">EUR/TRY</div>
            <div className="text-orange-400 font-black border border-orange-400/50 px-4 py-1 mt-1">₺{currencies.eur.toLocaleString("tr-TR")}</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[9px] text-muted-foreground border border-white/10 px-4 py-0.5 bg-white/5">DOLLAR/TRY</div>
            <div className="text-orange-400 font-black border border-orange-400/50 px-4 py-1 mt-1">₺{currencies.usd.toLocaleString("tr-TR")}</div>
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          <div className="border border-orange-400/50 px-12 py-2 text-xl font-black tracking-[0.3em] text-white">
            NAKİT GELİRLER
          </div>
        </div>

        <div className="flex gap-4">
           <div className="flex flex-col items-center">
            <div className="text-[9px] text-muted-foreground border border-white/10 px-4 py-0.5 bg-white/5">BIST 100</div>
            <div className="text-emerald-400 font-black border border-emerald-400/30 bg-emerald-400/5 px-4 py-1 mt-1">{indices.bist100}</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[9px] text-muted-foreground border border-white/10 px-4 py-0.5 bg-white/5">BIST 30</div>
            <div className="text-emerald-400 font-black border border-emerald-400/30 bg-emerald-400/5 px-4 py-1 mt-1">{indices.bist30}</div>
          </div>
        </div>
      </div>

      {/* MERKEZİ CHART ALANI */}
      <div className="relative py-12 flex flex-col items-start gap-4 max-w-6xl mx-auto">
        {/* LEJANT */}
        <div className="absolute right-0 top-0 text-[8px] flex flex-col gap-1 items-start font-bold">
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-emerald-600" />
             <span>TOPLAM GELİR</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-orange-600" />
             <span>YATIRIMDAN GELİR</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-red-600" />
             <span>HEDEF GELİR</span>
           </div>
        </div>

        {/* TOPLAM GELİR ÇUBUĞU */}
        <div className="w-full flex items-center h-4 relative">
          <div className="absolute left-0 h-full bg-emerald-900/50 w-full border-l-2 border-muted-foreground" />
          <div 
            className="h-full bg-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.3)] transition-all duration-1000 relative"
            style={{ width: `${Math.min(100, (totalMonthlyIncome / (targetMonthlyIncome * currencies.usd)) * 100)}%` }}
          >
            <div className="absolute -right-20 top-1/2 -translate-y-1/2 bg-black border border-white/20 px-2 text-[11px] font-black">
              ${(totalMonthlyIncome / currencies.usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* YATIRIMDAN GELİR ÇUBUĞU */}
        <div className="w-full flex items-center h-4 relative">
          <div className="absolute left-0 h-full bg-orange-900/20 w-full border-l-2 border-muted-foreground" />
          <div 
            className="h-full bg-orange-600 shadow-[0_0_15px_rgba(234,88,12,0.3)] transition-all duration-1000 relative"
            style={{ width: `${Math.min(100, (investmentIncome / (targetMonthlyIncome * currencies.usd)) * 100)}%` }}
          >
            <div className="absolute -right-20 top-1/2 -translate-y-1/2 bg-black border border-white/20 px-2 text-[11px] font-black">
              ${(investmentIncome / currencies.usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* HEDEF GELİR ÇUBUĞU */}
        <div className="w-full flex items-center h-4 relative">
          <div className="absolute left-0 h-full bg-red-900/20 w-full border-l-2 border-muted-foreground" />
          <div className="h-full bg-red-600 w-full relative">
            <div className="absolute -right-24 top-1/2 -translate-y-1/2 bg-black border border-white/20 px-2 text-[11px] font-black">
              ${targetMonthlyIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* KATEGORİ KARTLARI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {Object.entries(categoryIncomes).map(([cat, data]) => (
          <div key={cat} className="flex flex-col">
            <div className="text-[8px] font-black text-muted-foreground text-center mb-1 border border-white/10 py-1 bg-white/5">
              {cat} TOPLAM
            </div>
            <div className="border border-orange-500/50 bg-black p-4 space-y-4 text-center group hover:border-orange-500 transition-colors">
              <div className="space-y-0.5">
                <p className="text-[8px] text-muted-foreground">YILLIK TL</p>
                <p className="text-xs font-black">₺{data.yearly.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] text-muted-foreground">AYLIK TL</p>
                <p className="text-xs font-black text-emerald-400">₺{data.monthly.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] text-muted-foreground">AYLIK DL</p>
                <p className="text-xs font-black text-orange-400">${data.monthlyUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
