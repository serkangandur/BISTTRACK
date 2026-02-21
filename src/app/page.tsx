
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { StockHolding } from "@/lib/types";
import { SummaryCards } from "@/components/portfolio/summary-cards";
import { StockTable } from "@/components/portfolio/stock-table";
import { PortfolioCharts } from "@/components/portfolio/portfolio-charts";
import { AddStockDialog } from "@/components/portfolio/add-stock-dialog";
import { TargetProgress } from "@/components/portfolio/target-progress";
import { LayoutDashboard, TrendingUp, RefreshCcw, Loader2, ShieldCheck } from "lucide-react";
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
  updateDocumentNonBlocking,
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

  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const portfoliosQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'portfolios');
  }, [user, firestore]);
  
  const { data: portfolios, isLoading: isPortfoliosLoading } = useCollection(portfoliosQuery);
  const portfolioId = portfolios?.[0]?.id || 'default-portfolio';

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

  const stocksQuery = useMemoFirebase(() => {
    if (!user || !firestore || !portfolioId) return null;
    return collection(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings');
  }, [user, firestore, portfolioId]);

  const { data: dbStocks, isLoading: isStocksLoading } = useCollection(stocksQuery);

  const fetchStockPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0 || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/stock?symbols=${symbols.join(',')}`);
      if (!response.ok) throw new Error(`API Hatası`);
      const updates: StockPriceUpdate[] = await response.json();
      if (updates && Array.isArray(updates)) {
        const newData: Record<string, StockPriceUpdate> = {};
        updates.forEach(u => { newData[u.symbol.toUpperCase()] = u; });
        setMarketData(prev => ({ ...prev, ...newData }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsRefreshing(false);
      setInitialFetchDone(true);
    }
  }, [isRefreshing]);

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

  const totalAssets = useMemo(() => holdings.reduce((acc, h) => acc + h.quantity * h.currentPrice, 0), [holdings]);

  useEffect(() => {
    if (!isStocksLoading && dbStocks && dbStocks.length > 0 && !initialFetchDone) {
      const fetchable = dbStocks.filter(s => s.category === "Büyüme" || s.category === "Emtia" || s.category === "Kripto").map(s => s.symbol);
      if (fetchable.length > 0) fetchStockPrices(fetchable);
      else setInitialFetchDone(true);
    }
  }, [dbStocks, isStocksLoading, initialFetchDone, fetchStockPrices]);

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
    toast({ title: "Varlık Eklendi", description: "Portföyünüz güncellendi." });
  };

  const handleUpdateStock = (id: string, updatedData: Partial<StockHolding>) => {
    if (!user || !firestore || !portfolioId) return;
    const docRef = doc(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings', id);
    updateDocumentNonBlocking(docRef, { ...updatedData, updatedAt: serverTimestamp() });
  };

  const handleDeleteStock = (id: string) => {
    if (!user || !firestore || !portfolioId) return;
    const docRef = doc(firestore, 'users', user.uid, 'portfolios', portfolioId, 'stockHoldings', id);
    deleteDocumentNonBlocking(docRef);
  };

  if (isUserLoading || isPortfoliosLoading || isStocksLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101418]">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101418] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <TrendingUp className="text-primary-foreground h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tighter">VARLIK YÖNETİMİ</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchStockPrices(holdings.map(h => h.symbol))} disabled={isRefreshing}>
            <RefreshCcw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Fiyatları Güncelle
          </Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <TargetProgress currentTotal={totalAssets} />

        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-primary" />
            Portföy Analizi
          </h2>
          <AddStockDialog onAdd={handleAddStock} />
        </div>

        <SummaryCards holdings={holdings} />
        <PortfolioCharts holdings={holdings} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Varlık Detayları</h3>
            <Badge variant="outline" className="border-white/10">{holdings.length} Kalem Varlık</Badge>
          </div>
          <StockTable holdings={holdings} onDelete={handleDeleteStock} onUpdate={handleUpdateStock} />
        </div>
      </main>
    </div>
  );
}
