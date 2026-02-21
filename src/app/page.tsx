"use client";

import { useState, useEffect } from "react";
import { INITIAL_HOLDINGS } from "@/lib/mock-data";
import { StockHolding } from "@/lib/types";
import { SummaryCards } from "@/components/portfolio/summary-cards";
import { StockTable } from "@/components/portfolio/stock-table";
import { PortfolioCharts } from "@/components/portfolio/portfolio-charts";
import { AddStockDialog } from "@/components/portfolio/add-stock-dialog";
import { LayoutDashboard, TrendingUp, RefreshCcw, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortfolioDashboard() {
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial load
    setHoldings(INITIAL_HOLDINGS);
    setIsLoading(false);
  }, []);

  const handleAddStock = (newStock: Omit<StockHolding, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setHoldings([...holdings, { ...newStock, id }]);
  };

  const handleDeleteStock = (id: string) => {
    setHoldings(holdings.filter(h => h.id !== id));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101418] selection:bg-primary/30">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <TrendingUp className="text-primary-foreground h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">BISTrack</h1>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Borsa İstanbul Takip Paneli</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="hover:bg-white/5">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </Button>
              <Button variant="outline" className="hidden sm:flex border-white/10 hover:bg-white/5 text-xs font-semibold">
                <RefreshCcw className="h-3.5 w-3.5 mr-2" />
                Verileri Yenile
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary" />
              Portföy Özeti
            </h2>
            <p className="text-muted-foreground mt-1">Hoş geldiniz, işte bugünkü finansal durumunuz.</p>
          </div>
          <AddStockDialog onAdd={handleAddStock} />
        </div>

        {/* Summary Cards */}
        <SummaryCards holdings={holdings} />

        {/* Charts & Analytics */}
        <PortfolioCharts holdings={holdings} />

        {/* Holdings Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Varlıklarım</h3>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
              {holdings.length} Aktif Pozisyon
            </div>
          </div>
          <StockTable holdings={holdings} onDelete={handleDeleteStock} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/5 py-10 bg-card/20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            © 2024 BISTrack. Veriler gecikmeli olarak sağlanabilir. Finansal kararlar almadan önce profesyonel yardım alınız.
          </p>
        </div>
      </footer>
    </div>
  );
}