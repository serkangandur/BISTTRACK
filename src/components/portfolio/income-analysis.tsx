"use client";

import { useMemo, useState } from "react";
import { StockHolding, AssetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Banknote, 
  Target, 
  TrendingUp, 
  Receipt, 
  BarChart3, 
  Landmark, 
  Coins, 
  Wallet,
  Calculator,
  DollarSign
} from "lucide-react";

interface IncomeAnalysisProps {
  holdings: StockHolding[];
}

const INCOME_CATEGORIES: AssetCategory[] = ["Temettü", "Büyüme", "Emtia", "Kripto", "Nakit"];

const CATEGORY_CONFIG: Record<AssetCategory, { icon: any; color: string }> = {
  "Temettü": { icon: Receipt, color: "text-category-temettu" },
  "Büyüme": { icon: BarChart3, color: "text-category-buyume" },
  "Emtia": { icon: Landmark, color: "text-category-emtia" },
  "Kripto": { icon: Coins, color: "text-category-kripto" },
  "Nakit": { icon: Banknote, color: "text-category-nakit" },
  "Sigorta": { icon: Wallet, color: "text-category-sigorta" },
  "Temettü Sabit": { icon: Calculator, color: "text-category-temettu-sabit" }
};

export function IncomeAnalysis({ holdings }: IncomeAnalysisProps) {
  // Sabit Kur (Hesaplamalar için)
  const USD_RATE = 43.82;

  // Hedef Aylık Gelir (USD) - Değişken Kutusu
  const [targetMonthlyIncomeUsd, setTargetMonthlyIncomeUsd] = useState(4000);

  const categoryIncomes = useMemo(() => {
    const data: Partial<Record<AssetCategory, { totalVal: number; yearly: number; monthly: number; monthlyUsd: number }>> = {};

    INCOME_CATEGORIES.forEach(cat => {
      const filtered = holdings.filter(h => h.category === cat);
      
      const totalVal = filtered.reduce((acc, h) => {
        return acc + (Number(h.quantity) * Number(h.currentPrice || h.averageCost));
      }, 0);

      // YILLIK: Toplam Portföy / 100 * 3.5
      const yearly = (totalVal / 100) * 3.5;
      // AYLIK: Yıllık / 12
      const monthly = yearly / 12;
      // USD: Aylık TL / Kur
      const monthlyUsd = monthly / USD_RATE;

      data[cat] = { totalVal, yearly, monthly, monthlyUsd };
    });

    return data;
  }, [holdings, USD_RATE]);

  // Toplam Gelirler (Sigorta hariç)
  const totalMonthlyIncomeTl = INCOME_CATEGORIES.reduce((acc, cat) => acc + (categoryIncomes[cat]?.monthly || 0), 0);
  const totalMonthlyIncomeUsd = totalMonthlyIncomeTl / USD_RATE;
  
  const progressPercent = Math.min((totalMonthlyIncomeUsd / targetMonthlyIncomeUsd) * 100, 100);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ÜST ÖZET KARTLARI - 4'lü Izgara */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* TL GELİR KARTI */}
        <Card className="bg-primary/5 border-primary/20 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp className="w-24 h-24 rotate-12" />
          </div>
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Mevcut Aylık Getiri (TL)</p>
            <h3 className="text-3xl font-black text-white">₺{totalMonthlyIncomeTl.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <div className="flex items-center gap-1.5 mt-2">
               <div className="w-1.5 h-1.5 rounded-full bg-primary" />
               <p className="text-[10px] text-muted-foreground font-bold">Portföy Geneli %3.5 Verim Hesabı</p>
            </div>
          </CardContent>
        </Card>

        {/* USD GELİR KARTI */}
        <Card className="bg-accent/5 border-accent/20 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <DollarSign className="w-24 h-24" />
          </div>
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">Mevcut Aylık Getiri (USD)</p>
            <h3 className="text-3xl font-black text-accent">${totalMonthlyIncomeUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <div className="flex items-center gap-1.5 mt-2">
               <div className="w-1.5 h-1.5 rounded-full bg-accent" />
               <p className="text-[10px] text-muted-foreground font-bold">Döviz Bazlı Aylık Akış</p>
            </div>
          </CardContent>
        </Card>

        {/* USD HEDEF KARTI */}
        <Card className="bg-card/40 border-white/[0.06] shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Target className="w-24 h-24 -rotate-12" />
          </div>
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Hedef Aylık Getiri (USD)</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-white">$</span>
              <input 
                type="text"
                inputMode="numeric"
                value={targetMonthlyIncomeUsd.toLocaleString("en-US")}
                onChange={(e) => setTargetMonthlyIncomeUsd(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                className="bg-transparent border-none text-left w-full focus:outline-none font-black text-3xl p-0"
              />
            </div>
            <p className="text-[10px] text-muted-foreground font-bold mt-2 italic">Hesaplamayı tetikleyen ana hedef</p>
          </CardContent>
        </Card>

        {/* İLERLEME KARTI */}
        <Card className={cn(
          "shadow-2xl relative overflow-hidden group border-none",
          progressPercent >= 100 ? "bg-bist-up/10" : "bg-orange-500/10"
        )}>
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Banknote className="w-24 h-24" />
          </div>
          <CardContent className="p-6">
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest mb-1",
              progressPercent >= 100 ? "text-bist-up" : "text-orange-400"
            )}>Hedef Gerçekleşme Oranı</p>
            <h3 className={cn(
              "text-3xl font-black",
              progressPercent >= 100 ? "text-bist-up" : "text-orange-400"
            )}>
              %{progressPercent.toFixed(2)}
            </h3>
            <div className="mt-3">
               <Progress value={progressPercent} className="h-1.5 bg-white/5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KATEGORİ BAZLI GELİR GRİDİ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {INCOME_CATEGORIES.map((cat) => {
          const data = categoryIncomes[cat];
          if (!data) return null;

          const config = CATEGORY_CONFIG[cat];
          const Icon = config.icon;
          
          // Bu kategorinin hedefe olan katkı yüzdesi
          const contribution = (data.monthlyUsd / targetMonthlyIncomeUsd) * 100;

          return (
            <Card key={cat} className="bg-card/40 border-white/[0.06] shadow-xl flex flex-col hover:border-white/10 transition-all duration-300">
              <CardHeader className="p-4 pb-2 border-b border-white/[0.06] flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                   <div className={cn("p-1.5 rounded-md bg-white/5", config.color)}>
                     <Icon className="w-4 h-4" />
                   </div>
                   <CardTitle className="text-xs font-bold uppercase tracking-wider">{cat} Getirisi</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold border-white/10">
                  %{contribution.toFixed(1)} Katkı
                </Badge>
              </CardHeader>
              
              <CardContent className="p-4 flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Yıllık Getiri (TL)</p>
                    <p className="text-sm font-black text-white">₺{data.yearly.toLocaleString("tr-TR", { minimumFractionDigits: 3 })}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Aylık Getiri (TL)</p>
                    <p className="text-sm font-black text-emerald-400">₺{data.monthly.toLocaleString("tr-TR", { minimumFractionDigits: 3 })}</p>
                  </div>
                </div>

                <div className="bg-white/[0.04] rounded-lg p-3 border border-white/[0.06] flex justify-between items-center group hover:border-accent/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-accent/10">
                      <DollarSign className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-[10px] font-bold text-accent uppercase">Aylık USD</span>
                  </div>
                  <span className="text-lg font-black text-gold">${data.monthlyUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="space-y-1.5 mt-1">
                  <div className="flex justify-between items-center text-[9px] font-black text-muted-foreground uppercase">
                    <span>Stratejik Verim İlerlemesi</span>
                    <span>%{contribution.toFixed(2)}</span>
                  </div>
                  <Progress value={contribution} className="h-1 bg-white/5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-full text-[10px] text-muted-foreground font-medium uppercase">
          <Calculator className="w-3 h-3" />
          Hesaplamalar kategori piyasa değeri üzerinden yıllık %3.5 getiri baz alınarak yapılmaktadır.
        </div>
      </div>
    </div>
  );
}
