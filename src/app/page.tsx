
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { StockHolding } from "@/lib/types";
import { SummaryCards } from "@/components/portfolio/summary-cards";
import { StockTable } from "@/components/portfolio/stock-table";
import { PortfolioCharts } from "@/components/portfolio/portfolio-charts";
import { AddStockDialog } from "@/components/portfolio/add-stock-dialog";
import { LayoutDashboard, TrendingUp, RefreshCcw, Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  initiateAnonymousSignIn,
  useAuth,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking
} from "@/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

export default function PortfolioDashboard() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [marketData, setMarketData] = useState<Record<string, StockPriceUpdate>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Anonim giriş yap
  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Kullanıcının portföylerini getir
  const portfoliosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'portfolios');
  }, [user, firestore]);
  
  const { data: portfolios, isLoading: isPortfoliosLoading } = useCollection(portfoliosQuery);
  
  const portfolioId = portfolios?.[0]?.id || 'default-portfolio';

  // Eğer portföy yoksa oluştur
  useEffect(() => {
    if (!isPortfoliosLoading && portfolios && portfolios.length === 0 && user && firestore) {
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

  // Hisseleri Firestore'dan getir
  const stocksQuery = useMemoFirebase(() => {
    if (!user || !firestore || !portfolioId) return null;
    return collection(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings');
  }, [user, firestore, portfolioId]);

  const { data: dbStocks, isLoading: isStocksLoading } = useCollection(stocksQuery);

  // Fiyatları çekme fonksiyonu
  const fetchStockPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0 || isRefreshing) return;
    
    setIsRefreshing(true);
    const symbolsQuery = symbols.join(',');
    
    try {
      const response = await fetch(`/api/stock?symbols=${symbolsQuery}`);
      
      if (!response.ok) {
        throw new Error(`API Yanıt Vermedi: ${response.status}`);
      }

      const updates: StockPriceUpdate[] = await response.json();

      if (updates && Array.isArray(updates) && updates.length > 0) {
        const newData: Record<string, StockPriceUpdate> = {};
        updates.forEach(u => {
          newData[u.symbol.toUpperCase()] = u;
        });
        setMarketData(prev => ({ ...prev, ...newData }));
      }
    } catch (error: any) {
      console.error("[CLIENT] Veri çekme hatası:", error);
    } finally {
      setIsRefreshing(false);
      setInitialFetchDone(true);
    }
  }, [isRefreshing]);

  // Firestore verileri ile market verilerini birleştir
  const holdings = useMemo((): StockHolding[] => {
    if (!dbStocks) return [];
    return dbStocks.map(s => {
      const symbolUpper = s.symbol.toUpperCase();
      const market = marketData[symbolUpper];
      
      return {
        id: s.id,
        symbol: s.symbol,
        name: s.name || s.symbol,
        quantity: s.quantity,
        averageCost: s.averageCost,
        currentPrice: market?.price || s.averageCost,
        dailyChange: market?.change || 0,
        isLoaded: !!market
      };
    });
  }, [dbStocks, marketData]);

  // Veriler yüklendiğinde fiyatları çek
  useEffect(() => {
    if (!isStocksLoading && dbStocks && dbStocks.length > 0 && !initialFetchDone) {
      fetchStockPrices(dbStocks.map(s => s.symbol));
    }
  }, [dbStocks, isStocksLoading, initialFetchDone, fetchStockPrices]);

  const handleRefreshClick = () => {
    if (holdings.length > 0) {
      fetchStockPrices(holdings.map(h => h.symbol));
      toast({
        title: "Güncelleniyor",
        description: "Piyasa verileri tazeleniyor...",
      });
    }
  };

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
    // Yeni hisse eklenince fiyatları hemen çekmeye çalış
    setTimeout(() => {
      const allSymbols = [newStock.symbol, ...holdings.map(h => h.symbol)];
      fetchStockPrices(allSymbols);
    }, 1000);
  };

  const handleDeleteStock = (id: string) => {
    if (!user || !firestore || !portfolioId) return;
    const docRef = doc(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings', id);
    deleteDocumentNonBlocking(docRef);
  };

  if (isUserLoading || isPortfoliosLoading || isStocksLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101418]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin h-12 w-12 text-primary" />
          <p className="text-muted-foreground animate-pulse text-sm">Verileriniz hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101418] selection:bg-primary/30">
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
              <Button 
                variant="outline" 
                className="border-white/10 hover:bg-white/5 text-xs font-semibold"
                onClick={handleRefreshClick}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5 mr-2" />
                )}
                {isRefreshing ? "Güncelleniyor..." : "Verileri Yenile"}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-primary" />
              Portföy Özeti
            </h2>
          </div>
          <AddStockDialog onAdd={handleAddStock} />
        </div>

        <SummaryCards holdings={holdings} />
        <PortfolioCharts holdings={holdings} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Varlıklarım</h3>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-widest flex items-center gap-2">
              {holdings.length} Aktif Pozisyon
            </div>
          </div>
          <StockTable holdings={holdings} onDelete={handleDeleteStock} />
        </div>
      </main>

      <footer className="mt-20 border-t border-white/5 py-10 bg-card/20 text-center">
        <p className="text-xs text-muted-foreground">© 2024 BISTrack. Verileriniz bulutta kalıcı olarak saklanır.</p>
      </footer>
    </div>
  );
}
