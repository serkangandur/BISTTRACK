
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
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  deleteDocumentNonBlocking
} from "@/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

type ViewType = "Özet" | AssetCategory;

const SIDEBAR_ITEMS: { label: ViewType; icon: any }[] = [
  { label: "Özet", icon: LayoutDashboard },
  { label: "Temettü", icon: Receipt },
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
  const [activeView, setActiveView] = useState<ViewType>("Özet");
  
  const lastFetchedCount = useRef(0);

  // 1. Anonim Oturum Yönetimi
  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      console.log("[AUTH] Anonim oturum başlatılıyor...");
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // 2. Portföy Verilerini Dinle
  const portfoliosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'portfolios');
  }, [user, firestore]);
  
  const { data: portfolios, isLoading: isPortfoliosLoading } = useCollection(portfoliosQuery);

  // 3. Sabit Portföy Belirleme
  const portfolioId = useMemo(() => {
    if (portfolios && portfolios.length > 0) return portfolios[0].id;
    return 'default-portfolio';
  }, [portfolios]);

  // 4. Varsayılan Portföy Oluşturma (Eğer hiç yoksa)
  useEffect(() => {
    if (!isPortfoliosLoading && portfolios && portfolios.length === 0 && user && firestore) {
      console.log("[FIRESTORE] Varsayılan portföy oluşturuluyor...");
      const portfolioRef = doc(firestore, 'users', user.uid, 'portfolios', 'default-portfolio');
      setDoc(portfolioRef, {
        id: 'default-portfolio',
        userId: user.uid,
        name: 'Ana Portföy',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }, [portfolios, isPortfoliosLoading, user, firestore]);

  // 5. Varlıkları (StockHoldings) Dinle
  const stocksQuery = useMemoFirebase(() => {
    if (!user || !firestore || !portfolioId) return null;
    return collection(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings');
  }, [user, firestore, portfolioId]);

  const { data: dbStocks, isLoading: isStocksLoading } = useCollection(stocksQuery);

  // DEBUG: Veritabanından ne geliyor?
  useEffect(() => {
    if (dbStocks) {
      console.log("[FIRESTORE] Ham Veri (StockHoldings):", dbStocks);
    }
  }, [dbStocks]);

  // 6. Fiyat Çekme Fonksiyonu
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

  // 7. Otomatik Fiyat Güncelleme
  useEffect(() => {
    if (!isStocksLoading && dbStocks && dbStocks.length > 0) {
      if (dbStocks.length !== lastFetchedCount.current) {
        const fetchable = dbStocks
          .filter(s => ["Büyüme", "Emtia", "Kripto", "Temettü"].includes(s.category))
          .map(s => s.symbol);
        
        if (fetchable.length > 0) {
          fetchStockPrices(fetchable);
          lastFetchedCount.current = dbStocks.length;
        }
      }
    }
  }, [dbStocks, isStocksLoading, fetchStockPrices]);

  // 8. Verileri Birleştir ve Normalizasyon ile Filtrele
  const holdings = useMemo((): StockHolding[] => {
    if (!dbStocks) return [];
    return dbStocks.map(s => {
      const symbolUpper = s.symbol.toUpperCase();
      const market = marketData[symbolUpper];
      return {
        ...s,
        currentPrice: market?.price || s.currentPrice || s.averageCost,
        dailyChange: market?.change || 0,
        isLoaded: !!market
      } as StockHolding;
    });
  }, [dbStocks, marketData]);

  const filteredHoldings = useMemo(() => {
    if (activeView === "Özet") return holdings;
    
    // Normalizasyon: Küçük harf ve trim yaparak eşleştir
    const searchCategory = activeView.toLowerCase().trim();
    return holdings.filter(h => 
      h.category?.toString().toLowerCase().trim() === searchCategory
    );
  }, [holdings, activeView]);

  const totalAssets = useMemo(() => holdings.reduce((acc, h) => acc + h.quantity * h.currentPrice, 0), [holdings]);

  // 9. İşlem Fonksiyonları
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
        <p className="text-sm text-muted-foreground animate-pulse">Varlıklar Yükleniyor...</p>
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
              const isActive = activeView === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => setActiveView(item.label)}
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
          <div className="text-lg font-black truncate">₺{totalAssets.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-bist-up" />
            Portföy Anlık Değeri
          </div>
        </div>
      </aside>

      {/* Ana İçerik */}
      <div className="flex-1 flex flex-col min-w-0">
        <nav className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">{activeView === "Özet" ? "Genel Panel" : `${activeView} Detayları`}</h2>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-white/10"
                onClick={() => fetchStockPrices(holdings.map(h => h.symbol))} 
                disabled={isRefreshing}
              >
                <RefreshCcw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                Yenile
              </Button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
          {activeView === "Özet" ? (
            <>
              <TargetProgress currentTotal={totalAssets} />
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">Varlık Analizi</h2>
                <AddStockDialog onAdd={handleAddStock} />
              </div>
              <SummaryCards holdings={holdings} />
              <PortfolioCharts holdings={holdings} />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Tüm Varlıklar</h3>
                  <Badge variant="outline">{holdings.length} Kalem</Badge>
                </div>
                <StockTable holdings={holdings} onDelete={handleDeleteStock} onUpdate={handleUpdateStock} />
              </div>
            </>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold">{activeView} Portföyü</h2>
                  <p className="text-sm text-muted-foreground">{activeView} kategorisindeki varlıklarınız.</p>
                </div>
                <AddStockDialog onAdd={handleAddStock} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card/50 border border-white/5 p-6 rounded-xl">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Kategori Değeri</p>
                  <div className="text-3xl font-black">₺{filteredHoldings.reduce((acc, h) => acc + h.quantity * h.currentPrice, 0).toLocaleString("tr-TR")}</div>
                </div>
                <div className="bg-card/50 border border-white/5 p-6 rounded-xl">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Varlık Adedi</p>
                  <div className="text-3xl font-black">{filteredHoldings.length}</div>
                </div>
                <div className="bg-card/50 border border-white/5 p-6 rounded-xl">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Pay</p>
                  <div className="text-3xl font-black">%{totalAssets > 0 ? ((filteredHoldings.reduce((acc, h) => acc + h.quantity * h.currentPrice, 0) / totalAssets) * 100).toFixed(1) : 0}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Varlık Listesi</h3>
                  <Badge variant="outline">{filteredHoldings.length} Kalem</Badge>
                </div>
                <StockTable holdings={filteredHoldings} onDelete={handleDeleteStock} onUpdate={handleUpdateStock} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
