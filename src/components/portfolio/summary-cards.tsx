"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, Percent } from "lucide-react";
import { StockHolding } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  holdings: StockHolding[];
}

export function SummaryCards({ holdings }: SummaryCardsProps) {
  const totalAssets = holdings.reduce((acc, stock) => acc + stock.quantity * stock.currentPrice, 0);
  const totalCost = holdings.reduce((acc, stock) => acc + stock.quantity * stock.averageCost, 0);
  
  // Simulated daily change for demo
  const dailyProfitLoss = holdings.reduce((acc, stock) => {
    const prevPrice = stock.currentPrice / (1 + stock.dailyChange / 100);
    return acc + (stock.currentPrice - prevPrice) * stock.quantity;
  }, 0);
  
  const dailyChangePercentage = (dailyProfitLoss / (totalAssets - dailyProfitLoss)) * 100;
  
  const topGainer = [...holdings].sort((a, b) => b.dailyChange - a.dailyChange)[0];

  const cards = [
    {
      title: "Toplam Varlık",
      value: `₺${totalAssets.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`,
      description: "Toplam Portföy Değeri",
      icon: Wallet,
      color: "text-primary",
    },
    {
      title: "Günlük Kâr/Zarar",
      value: `₺${dailyProfitLoss.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`,
      description: `${dailyChangePercentage >= 0 ? "+" : ""}${dailyChangePercentage.toFixed(2)}% Bugün`,
      icon: dailyProfitLoss >= 0 ? TrendingUp : TrendingDown,
      color: dailyProfitLoss >= 0 ? "text-bist-up" : "text-bist-down",
    },
    {
      title: "Toplam Getiri",
      value: `₺${(totalAssets - totalCost).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`,
      description: `${(((totalAssets - totalCost) / totalCost) * 100).toFixed(2)}% Toplam`,
      icon: Percent,
      color: (totalAssets - totalCost) >= 0 ? "text-bist-up" : "text-bist-down",
    },
    {
      title: "En Çok Yükselen",
      value: topGainer?.symbol || "-",
      description: `${topGainer?.dailyChange >= 0 ? "+" : ""}${topGainer?.dailyChange}% Günlük`,
      icon: ArrowUpRight,
      color: "text-accent",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => (
        <Card key={idx} className="bg-card/50 border-white/5 backdrop-blur-sm shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <div>
              <div className="text-2xl font-bold font-headline">{card.value}</div>
              <p className={cn("text-xs mt-1 font-medium", card.description.includes("-") ? "text-bist-down" : "text-muted-foreground")}>
                {card.description}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}