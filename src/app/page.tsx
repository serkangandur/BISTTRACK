
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { StockHolding, AssetCategory } from "@/lib/types";
import { SummaryCards } from "@/components/portfolio/summary-cards";
import { StockTable } from "@/components/portfolio/stock-table";
import { PortfolioCharts } from "@/components/portfolio/portfolio-charts";
import { AddStockDialog } from "@/components/portfolio/add-stock-dialog";
import { TargetProgress } from "@/components/portfolio/target-progress";
import { 
  LayoutDashboard, 
  TrendingUp, 
  RefreshCcw, 
  Loader2, 
  Receipt, 
  BarChart3, 
  Wallet, 
  Coins, 
  Landmark, 
  Banknote, 
  ShieldCheck,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  initiateAnonymousSignIn,
  useAuth,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  setDocumentNonBlocking
} from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";

interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

type ViewType = "Özet" | AssetCategory;

const SIDEBAR_ITEMS: { label: ViewType; icon: any }[] = [
  { label: "Özet", icon: LayoutDashboard },
  { label: "Temettü", icon: Receipt },
  { label: "Temettü Sabit", icon: History },
  { label: "Büyüme", icon: BarChart3 },
  { label: "Döviz", icon: Wallet },
  { label: "Kripto", icon: Coins },
  { label: "Emtia", icon: Landmark },
  { label: "Nakit", icon: Banknote },
  { label: "Sigorta", icon: ShieldCheck },
];

export default function PortfolioDashboard() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [marketData, setMarketData] = useState<Record<string, StockPriceUpdate>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ViewType>("Özet");
  
  const lastFetchedCount = useRef(0);

  // 1. Anonim Oturum Yönetimi
  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // 2. Portföy Verilerini Dinle
  const portfoliosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'portfolios');
  }, [user, firestore]);
  
  const { data: portfolios, isLoading: isPortfoliosLoading } = useCollection(portfoliosQuery);

  const portfolioId = useMemo(() => {
    if (portfolios && portfolios.length > 0) return portfolios[0].id;
    return 'default-portfolio';
  }, [portfolios]);

  // Varsayılan Portföy Oluşturma
  useEffect(() => {
    if (!isPortfoliosLoading && portfolios && portfolios.length === 0 && user && firestore) {
      const portfolioRef = doc(firestore, 'users', user.uid, 'portfolios', 'default-portfolio');
      setDocumentNonBlocking(portfolioRef, {
        id: 'default-portfolio',
        userId: user.uid,
        name: 'Ana Portföy',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }, [portfolios, isPortfoliosLoading, user, firestore]);

  // 3. Varlıkları (StockHoldings) Dinle
  const stocksQuery = useMemoFirebase(() => {
    if (!user || !firestore || !portfolioId) return null;
    return collection(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings');
  }, [user, firestore, portfolioId]);

  const { data: dbStocks, isLoading: isStocksLoading } = useCollection(stocksQuery);

  // 4. Fiyat Çekme Fonksiyonu
  const fetchStockPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0 || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/stock?symbols=${symbols.join(',')}`);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const updates: StockPriceUpdate[] = await response.json();
      
      if (updates && Array.isArray(updates)) {
        const newData: Record<string, StockPriceUpdate> = {};
        updates.forEach(u => { 
          if (u.symbol) newData[u.symbol.toUpperCase()] = u; 
        });
        setMarketData(prev => ({ ...prev, ...newData }));
      }
    } catch (error: any) {
      console.error("[API] Fiyat çekme hatası:", error.message);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // 5. Otomatik Fiyat Güncelleme
  useEffect(() => {
    if (!isStocksLoading && dbStocks && dbStocks.length > 0) {
      const fetchable = dbStocks
        .filter(s => ["Büyüme", "Emtia", "Kripto", "Temettü", "Temettü Sabit"].includes(s.category))
        .map(s => s.symbol);
      
      if (fetchable.length > 0 && dbStocks.length !== lastFetchedCount.current) {
        fetchStockPrices(fetchable);
        lastFetchedCount.current = dbStocks.length;
      }
    }
  }, [dbStocks, isStocksLoading, fetchStockPrices]);

  // 6. Verileri Birleştir ve Hesapla
  const assets = useMemo((): StockHolding[] => {
    if (!dbStocks) return [];
    
    return dbStocks.map(s => {
      const symbolUpper = s.symbol.toUpperCase();
      const market = marketData[symbolUpper];
      return {
        ...s,
        currentPrice: market?.price || s.currentPrice || s.averageCost || 0,
        dailyChange: market?.change || 0,
        isLoaded: !!market
      } as StockHolding;
    });
  }, [dbStocks, marketData]);

  // STRATEJİK İZOLASYON: Toplam Portföy Değeri (Temettü Sabit Hariç)
  const totalValue = useMemo(() => {
    return assets
      .filter(a => a.category !== "Temettü Sabit")
      .reduce((acc, a) => acc + (a.quantity * a.currentPrice), 0);
  }, [assets]);

  // STRATEJİK İZOLASYON: Filtrelenmiş Liste
  const filteredAssets = useMemo(() => {
    if (activeCategory === "Özet") {
      // Özet görünümünde Temettü Sabit'leri göstermiyoruz (İzolasyon Kuralı)
      return assets.filter(a => a.category !== "Temettü Sabit");
    }
    return assets.filter(a => a.category.toLowerCase().trim() === activeCategory.toLowerCase().trim());
  }, [assets, activeCategory]);

  // 7. İşlem Fonksiyonları
  const handleAddStock = (newStock: Omit<StockHolding, "id">) => {
    if (!user || !firestore || !portfolioId) return;
    const stocksRef = collection(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings');
    addDocumentNonBlocking(stocksRef, {
      ...newStock,
      userId: user.uid,
      portfolioId: portfolioId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    toast({ title: "Varlık Eklendi" });
  };

  const handleUpdateStock = (id: string, updatedData: Partial<StockHolding>) => {
    if (!user || !firestore || !portfolioId) return;
    const docRef = doc(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings', id);
    updateDocumentNonBlocking(docRef, { ...updatedData, updatedAt: serverTimestamp() });
    toast({ title: "Güncellendi" });
  };

  const handleDeleteStock = (id: string) => {
    if (!user || !firestore || !portfolioId) return;
    const docRef = doc(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Varlık Silindi" });
  };

  if (isUserLoading || isPortfoliosLoading || (isStocksLoading && !dbStocks)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#101418] gap-4">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Varlıklar Hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101418] text-white flex">
      {/* Sol Sidebar */}
      <aside className="w-64 sticky top-0 h-screen border-r border-white/5 bg-background/50 backdrop-blur-xl flex flex-col p-4 gap-2 hidden lg:flex shrink-0">
        <div className="flex items-center gap-3 px-2 py-4 mb-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <TrendingUp className="text-primary-foreground h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tighter">BISTrack</h1>
        </div>

        <div className="py-2 px-2">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Navigasyon</p>
          <div className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeCategory === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => setActiveCategory(item.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-bold" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto p-4 bg-primary/5 rounded-xl border border-primary/10">
          <p className="text-[10px] font-bold text-primary uppercase mb-2">Toplam Değer</p>
          <div className="text-lg font-black truncate">₺{totalValue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-bist-up" />
            Canlı Portföy Değeri
          </div>
        </div>
      </aside>

      {/* Ana İçerik */}
      <div className="flex-1 flex flex-col min-w-0">
        <nav className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">{activeCategory === "Özet" ? "Genel Bakış" : activeCategory}</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-white/10"
                onClick={() => fetchStockPrices(assets.map(h => h.symbol))} 
                disabled={isRefreshing}
              >
                <RefreshCcw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                Fiyatları Güncelle
              </Button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl w-full mx-auto px-6 py-8 space-y-8 animate-in fade-in duration-700">
          {activeCategory === "Özet" ? (
            <>
              <TargetProgress currentTotal={totalValue} />
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">Varlık Analizi</h2>
                <AddStockDialog onAdd={handleAddStock} />
              </div>
              <SummaryCards holdings={assets} />
              <PortfolioCharts holdings={assets} />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Son İşlemler</h3>
                  <Badge variant="outline">{filteredAssets.length} Kalem</Badge>
                </div>
                <StockTable holdings={filteredAssets} onDelete={handleDeleteStock} onUpdate={handleUpdateStock} />
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{activeCategory} Portföyü</h2>
                <AddStockDialog onAdd={handleAddStock} />
              </div>
              
              {activeCategory === "Temettü Sabit" && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                   <Card className="bg-primary/5 border-primary/20 p-4">
                     <p className="text-[10px] font-bold text-muted-foreground uppercase">Kategori Toplamı</p>
                     <div className="text-2xl font-black">
                       ₺{filteredAssets.reduce((acc, a) => acc + (a.quantity * a.currentPrice), 0).toLocaleString("tr-TR")}
                     </div>
                   </Card>
                </div>
              )}

              <StockTable holdings={filteredAssets} onDelete={handleDeleteStock} onUpdate={handleUpdateStock} />
              
              {filteredAssets.length === 0 && (
                <div className="p-12 text-center bg-card/20 rounded-xl border border-dashed border-white/10">
                  <p className="text-muted-foreground">Bu kategoride henüz bir varlık eklenmemiş.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
