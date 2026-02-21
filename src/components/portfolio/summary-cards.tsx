
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ShieldCheck, Coins, Landmark, BarChart3, Receipt, Banknote } from "lucide-react";
import { StockHolding, AssetCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface SummaryCardsProps {
  holdings: StockHolding[];
}

const CATEGORY_ICONS: Record<AssetCategory, any> = {
  "Temettü": Receipt,
  "Büyüme": BarChart3,
  "Nakit": Banknote,
  "Emtia": Landmark,
  "Kripto": Coins,
  "Döviz": Wallet,
  "Sigorta": ShieldCheck
};

export function SummaryCards({ holdings }: SummaryCardsProps) {
  const totalAssets = holdings.reduce((acc, stock) => acc + stock.quantity * stock.currentPrice, 0);
  
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
        <Card className="bg-primary/10 border-primary/20 backdrop-blur-sm shadow-xl col-span-1 md:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm font-bold text-primary uppercase tracking-widest">TOPLAM PORTFÖY</p>
              <Landmark className="h-5 w-5 text-primary" />
            </div>
            <div className="text-4xl font-black text-white">₺{totalAssets.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-2">Tüm varlıkların güncel piyasa değeri toplamı</p>
          </CardContent>
        </Card>

        {Object.entries(CATEGORY_ICONS).map(([cat, Icon], idx) => {
          const value = categoryTotals[cat as AssetCategory] || 0;
          if (cat === "Sigorta") return (
             <Card key={cat} className="bg-accent/5 border-accent/20 shadow-lg">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-accent uppercase">{cat}</p>
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <div className="text-xl font-bold">₺{value.toLocaleString("tr-TR")}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[9px] font-bold uppercase">
                      <span className="text-muted-foreground">60 Ay Hedefi</span>
                      <span className="text-accent">%{insuranceProgress.toFixed(1)}</span>
                    </div>
                    <Progress value={insuranceProgress} className="h-1.5 bg-accent/10" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          return (
            <Card key={cat} className="bg-card/50 border-white/5 shadow-lg hover:border-white/10 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between pb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">{cat}</p>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
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
