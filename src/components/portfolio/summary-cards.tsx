
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ShieldCheck, Coins, Landmark, BarChart3, Receipt, Banknote, History } from "lucide-react";
import { StockHolding, AssetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface SummaryCardsProps {
  holdings: StockHolding[];
}

const CATEGORY_ICONS: Record<AssetCategory, any> = {
  "Temettü": Receipt,
  "Temettü Sabit": History,
  "Büyüme": BarChart3,
  "Nakit": Banknote,
  "Emtia": Landmark,
  "Kripto": Coins,
  "Döviz": Wallet,
  "Sigorta": ShieldCheck
};

const CATEGORY_COLORS: Record<AssetCategory, string> = {
  "Temettü": "text-category-temettu",
  "Temettü Sabit": "text-category-temettu-sabit",
  "Büyüme": "text-category-buyume",
  "Nakit": "text-category-nakit",
  "Emtia": "text-category-emtia",
  "Kripto": "text-category-kripto",
  "Döviz": "text-category-doviz",
  "Sigorta": "text-category-sigorta",
};

export function SummaryCards({ holdings }: SummaryCardsProps) {
  // STRATEJİK İZOLASYON: Temettü Sabit hariç toplam
  const totalAssets = holdings
    .filter(h => h.category !== "Temettü Sabit")
    .reduce((acc, stock) => acc + stock.quantity * stock.currentPrice, 0);
  
  const categoryTotals = holdings.reduce((acc, stock) => {
    const val = stock.quantity * stock.currentPrice;
    acc[stock.category] = (acc[stock.category] || 0) + val;
    return acc;
  }, {} as Record<AssetCategory, number>);

  const insuranceHolding = holdings.find(h => h.category === "Sigorta");
  const insuranceTarget = insuranceHolding?.monthlySalary ? insuranceHolding.monthlySalary * 60 : 0;
  const insuranceCurrent = categoryTotals["Sigorta"] || 0;
  const insuranceProgress = insuranceTarget > 0 ? (insuranceCurrent / insuranceTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/15 to-accent/5 border-primary/20 backdrop-blur-sm shadow-xl glow-primary col-span-1 md:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm font-bold text-primary uppercase tracking-widest">TOPLAM PORTFÖY</p>
              <Landmark className="h-5 w-5 text-primary" />
            </div>
            <div className="text-4xl font-black text-white">₺{totalAssets.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-2">Tüm varlıkların (Temettü Sabit hariç) toplamı</p>
          </CardContent>
        </Card>

        {Object.entries(CATEGORY_ICONS).map(([cat, Icon], idx) => {
          // STRATEJİK İZOLASYON: Temettü Sabit kartını özet alanında göstermiyoruz
          if (cat === "Temettü Sabit") return null;

          const value = categoryTotals[cat as AssetCategory] || 0;
          if (cat === "Sigorta") return (
             <Card key={cat} className="bg-category-sigorta/5 border-category-sigorta/20 shadow-lg">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-category-sigorta uppercase">{cat}</p>
                  <Icon className="h-4 w-4 text-category-sigorta" />
                </div>
                <div>
                  <div className="text-xl font-bold">₺{value.toLocaleString("tr-TR")}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[9px] font-bold uppercase">
                      <span className="text-muted-foreground">60 Ay Hedefi</span>
                      <span className="text-category-sigorta">%{insuranceProgress.toFixed(1)}</span>
                    </div>
                    <Progress value={insuranceProgress} className="h-1.5 bg-category-sigorta/10" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          return (
            <Card key={cat} className="bg-card/50 border-white/[0.06] shadow-lg hover:border-white/10 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between pb-1">
                  <p className={cn("text-[10px] font-bold uppercase", CATEGORY_COLORS[cat as AssetCategory] || "text-muted-foreground")}>{cat}</p>
                  <Icon className={cn("h-3.5 w-3.5", CATEGORY_COLORS[cat as AssetCategory] || "text-muted-foreground")} />
                </div>
                <div className="text-xl font-bold">₺{value.toLocaleString("tr-TR")}</div>
                <p className="text-[9px] text-muted-foreground mt-1">Pay: %{totalAssets > 0 ? ((value/totalAssets)*100).toFixed(1) : 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
