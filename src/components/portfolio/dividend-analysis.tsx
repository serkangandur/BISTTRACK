'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Minus, Search, RefreshCcw, 
  Loader2, AlertCircle, CheckCircle2, Info, Pencil, Save, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StockHolding } from '@/lib/types';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface DividendRecord {
  id: string;
  symbol: string;
  netDividendPerShare: number;
  year: number;
  updatedAt?: any;
}

interface DividendAnalysisProps {
  holdings: StockHolding[];
}

const TEMETTU_SYMBOLS = ['LOGO', 'TUPRS', 'CLEBI', 'ISMEN', 'PAGYO', 'ANHYT'];

// Varsayılan bilinen temettü verileri (başlangıç için)
const DEFAULT_DIVIDENDS: Record<string, { net: number; year: number }> = {
  'TUPRS': { net: 12.92, year: 2025 },
};

export function DividendAnalysis({ holdings }: DividendAnalysisProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ net: string; year: string }>({ net: '', year: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchNet, setSearchNet] = useState('');
  const [searchYear, setSearchYear] = useState(new Date().getFullYear().toString());

  // Firebase'den temettü verilerini çek
  const dividendsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'globalData', 'dividends', 'stocks');
  }, [user, firestore]);

  const { data: dbDividends, isLoading } = useCollection(dividendsQuery);

  // Temettü verilerini map'e çevir
  const dividendMap = useMemo(() => {
    const map: Record<string, DividendRecord> = {};
    
    // Önce default değerleri koy
    TEMETTU_SYMBOLS.forEach(sym => {
      const def = DEFAULT_DIVIDENDS[sym];
      if (def) {
        map[sym] = { id: sym, symbol: sym, netDividendPerShare: def.net, year: def.year };
      }
    });
    
    // Sonra Firebase verilerini üstüne yaz
    if (dbDividends) {
      dbDividends.forEach((d: any) => {
        map[d.symbol] = { id: d.id, symbol: d.symbol, netDividendPerShare: d.netDividendPerShare, year: d.year };
      });
    }
    
    return map;
  }, [dbDividends]);

  // Temettü verimini hesapla
  const calculateYield = (symbol: string): { market: number; cost: number } => {
    const div = dividendMap[symbol];
    if (!div || div.netDividendPerShare === 0) return { market: 0, cost: 0 };
    const holding = holdings.find(h => h.symbol.toUpperCase() === symbol);
    if (!holding) return { market: 0, cost: 0 };
    const market = holding.currentPrice > 0 ? (div.netDividendPerShare / holding.currentPrice) * 100 : 0;
    const cost = holding.averageCost > 0 ? (div.netDividendPerShare / holding.averageCost) * 100 : 0;
    return { market, cost };
  };

  // Portföy ağırlıklı ortalama verimi
  const portfolioYield = useMemo(() => {
    const temettuHoldings = holdings.filter(h => TEMETTU_SYMBOLS.includes(h.symbol.toUpperCase()));
    if (temettuHoldings.length === 0) return 0;
    const totalValue = temettuHoldings.reduce((acc, h) => acc + (h.quantity * h.currentPrice), 0);
    if (totalValue === 0) return 0;
    return temettuHoldings.reduce((acc, h) => {
      const weight = (h.quantity * h.currentPrice) / totalValue;
      return acc + (weight * calculateYield(h.symbol.toUpperCase()).market);
    }, 0);
  }, [holdings, dividendMap]);

  // Firebase'e kaydet
  const saveDividend = async (symbol: string, net: number, year: number) => {
    if (!user || !firestore) return;
    setIsSaving(true);
    try {
      const ref = doc(firestore, 'globalData', 'dividends', 'stocks', symbol);
      await setDoc(ref, { symbol, netDividendPerShare: net, year, updatedAt: serverTimestamp() }, { merge: true });
      setEditingSymbol(null);
    } catch (err) {
      console.error('Kaydetme hatası:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (symbol: string) => {
    const div = dividendMap[symbol];
    setEditValues({ 
      net: div?.netDividendPerShare?.toString() || '', 
      year: div?.year?.toString() || new Date().getFullYear().toString() 
    });
    setEditingSymbol(symbol);
  };

  const getRecommendation = (yieldValue: number) => {
    if (portfolioYield === 0 || yieldValue === 0) return null;
    const diff = yieldValue - portfolioYield;
    if (diff > 0.5) return { type: 'buy', label: 'Ekleme Değerlendir', color: 'text-green-400', icon: TrendingUp };
    if (diff < -0.5) return { type: 'skip', label: 'Ekleme Önerilmez', color: 'text-red-400', icon: TrendingDown };
    return { type: 'neutral', label: 'Benzer Verim', color: 'text-yellow-400', icon: Minus };
  };

  // Arama sonucu için anlık hesaplama
  const searchYield = useMemo(() => {
    const net = parseFloat(searchNet.replace(',', '.'));
    if (!net || !searchSymbol) return 0;
    // Arama yapılan hisse portföyde varsa canlı fiyatı kullan
    const holding = holdings.find(h => h.symbol.toUpperCase() === searchSymbol.toUpperCase());
    if (holding && holding.currentPrice > 0) return (net / holding.currentPrice) * 100;
    return 0;
  }, [searchNet, searchSymbol, holdings]);

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Temettü Analizi</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Mevcut portföy verimin ile yeni hisseleri kıyasla
          </p>
        </div>
      </div>

      {/* Portföy Verimi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-primary/10 rounded-xl border border-primary/20">
          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Portföy Temettü Verimi</p>
          <p className="text-3xl font-black text-primary">%{portfolioYield.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">Ağırlıklı Ortalama (Piyasa Değeri Bazlı)</p>
        </div>
        <div className="md:col-span-2 p-5 bg-card/20 rounded-xl border border-white/5 flex items-center gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Temettü verimi = Hisse Başı Net Temettü ÷ Canlı Fiyat × 100. 
            Her hisse için son temettü bilgisini <span className="text-white font-medium">kalem ikonuna</span> tıklayarak güncelleyebilirsin.
          </p>
        </div>
      </div>

      {/* Hisse Kartları */}
      <div>
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Temettü İzleme Paneli</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMETTU_SYMBOLS.map(symbol => {
            const div = dividendMap[symbol];
            const holding = holdings.find(h => h.symbol.toUpperCase() === symbol);
            const yields = calculateYield(symbol);
            const yieldValue = yields.market;
            const costYield = yields.cost;
            const isEditing = editingSymbol === symbol;

            return (
              <div key={symbol} className={cn(
                "p-4 rounded-xl border space-y-3 transition-all",
                yieldValue > portfolioYield && portfolioYield > 0
                  ? "bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/10"
                  : yieldValue > 0 && yieldValue < portfolioYield && portfolioYield > 0
                  ? "bg-card/20 border-orange-500/20"
                  : "bg-card/20 border-white/5"
              )}>
                {/* Kart Başlık */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black",
                      yieldValue > portfolioYield && portfolioYield > 0
                        ? "bg-green-500/20 text-green-400"
                        : "bg-primary/10 text-primary"
                    )}>
                      {symbol[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm">{symbol}</p>
                        {yieldValue > portfolioYield && portfolioYield > 0 && (
                          <span className="text-[10px] font-black bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
                            ▲ YUKARI
                          </span>
                        )}
                      </div>
                      {holding && <p className="text-xs text-muted-foreground">{holding.quantity.toLocaleString('tr-TR')} Adet Mevcut</p>}
                    </div>
                  </div>
                  <button onClick={() => isEditing ? setEditingSymbol(null) : startEdit(symbol)}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-white">
                    {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* Düzenleme Modu */}
                {isEditing ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Hisse Başı Net Temettü (₺)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editValues.net}
                        onChange={e => setEditValues(v => ({ ...v, net: e.target.value }))}
                        className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50"
                        placeholder="örn: 4.4737"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Yıl</label>
                      <input
                        type="number"
                        value={editValues.year}
                        onChange={e => setEditValues(v => ({ ...v, year: e.target.value }))}
                        className="w-full mt-1 bg-background/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50"
                        placeholder="2025"
                      />
                    </div>
                    <Button size="sm" className="w-full" disabled={isSaving || !editValues.net}
                      onClick={() => saveDividend(symbol, parseFloat(editValues.net.replace(',', '.')), parseInt(editValues.year))}>
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Kaydet
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Net Temettü</span>
                        <span className="text-sm font-bold">
                          {div ? `₺${div.netDividendPerShare.toFixed(4)}` : '₺---'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Verim (Canlı Fiyat)</span>
                        <span className={cn("text-sm font-bold", yieldValue > 0 ? "text-green-400" : "text-muted-foreground")}>
                          {yieldValue > 0 ? `%${yieldValue.toFixed(2)}` : '%---'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Verim (Maliyetim)</span>
                        <span className={cn("text-sm font-bold", costYield > 0 ? "text-blue-400" : "text-muted-foreground")}>
                          {costYield > 0 ? `%${costYield.toFixed(2)}` : '%---'}
                        </span>
                      </div>
                      {holding && holding.currentPrice > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Canlı Fiyat</span>
                          <span className="text-xs">₺{holding.currentPrice.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {div && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Veri Yılı</span>
                          <Badge variant="outline" className="text-xs h-4">{div.year}</Badge>
                        </div>
                      )}
                    </div>

                    {/* Verim Bar */}
                    {yieldValue > 0 && portfolioYield > 0 && (
                      <div className="space-y-1">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all",
                              yieldValue >= portfolioYield ? "bg-green-400" : "bg-orange-400"
                            )}
                            style={{ width: `${Math.min((yieldValue / (portfolioYield * 2)) * 100, 100)}%` }}
                          />
                        </div>
                        <p className={cn("text-xs", yieldValue >= portfolioYield ? "text-green-400" : "text-orange-400")}>
                          {yieldValue >= portfolioYield ? '▲ Ortalamanın üstünde' : '▼ Ortalamanın altında'}
                        </p>
                      </div>
                    )}

                    {!div && (
                      <button onClick={() => startEdit(symbol)}
                        className="w-full text-xs text-primary/70 hover:text-primary border border-dashed border-primary/20 hover:border-primary/40 rounded-lg py-2 transition-colors">
                        + Temettü verisi ekle
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Yeni Hisse Karşılaştır */}
      <div className="p-5 bg-card/20 rounded-xl border border-white/5 space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Yeni Hisse Karşılaştır</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={searchSymbol}
            onChange={e => setSearchSymbol(e.target.value.toUpperCase())}
            placeholder="Hisse kodu (Örn: AKBNK, FROTO)"
            className="bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
          />
          <input
            type="number"
            step="0.0001"
            value={searchNet}
            onChange={e => setSearchNet(e.target.value)}
            placeholder="Hisse başı net temettü (₺)"
            className="bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
          />
          <input
            type="number"
            value={searchYear}
            onChange={e => setSearchYear(e.target.value)}
            placeholder="Yıl"
            className="bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Karşılaştırma Sonucu */}
        {searchSymbol && searchNet && parseFloat(searchNet) > 0 && (
          <div className="p-4 bg-background/30 rounded-xl border border-white/10 space-y-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="font-bold text-lg">{searchSymbol}</p>
                <p className="text-xs text-muted-foreground">{searchYear} verisi</p>
              </div>
              {(() => {
                const rec = getRecommendation(searchYield);
                if (!rec || searchYield === 0) return null;
                return (
                  <div className={cn("flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg border", 
                    rec.type === 'buy' ? "bg-green-500/10 border-green-500/20 text-green-400" :
                    rec.type === 'skip' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                    "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                  )}>
                    <rec.icon className="h-4 w-4" />
                    {rec.label}
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Hisse Başı Net</p>
                <p className="text-xl font-black">₺{parseFloat(searchNet).toFixed(4)}</p>
              </div>
              {searchYield > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tahmini Verim</p>
                  <p className="text-xl font-black text-green-400">%{searchYield.toFixed(2)}</p>
                </div>
              )}
              {portfolioYield > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Portföyüm</p>
                  <p className="text-xl font-black text-primary">%{portfolioYield.toFixed(2)}</p>
                </div>
              )}
            </div>

            {searchYield === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                Bu hisse portföyünde olmadığı için canlı fiyat yok — tahmini verim hesaplanamıyor. Hisseyi ekledikten sonra verim otomatik hesaplanır.
              </p>
            )}

            {/* Karar */}
            {portfolioYield > 0 && searchYield > 0 && (() => {
              const rec = getRecommendation(searchYield);
              const diff = searchYield - portfolioYield;
              return (
                <div className={cn(
                  "p-3 rounded-lg border flex items-start gap-2 text-sm",
                  rec?.type === 'buy' ? "bg-green-500/10 border-green-500/20" :
                  rec?.type === 'skip' ? "bg-red-500/10 border-red-500/20" :
                  "bg-yellow-500/10 border-yellow-500/20"
                )}>
                  {rec?.type === 'buy' ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> :
                   rec?.type === 'skip' ? <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" /> :
                   <Minus className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />}
                  <p>
                    {rec?.type === 'buy' && `${searchSymbol} verimi portföy ortalamanızdan %${Math.abs(diff).toFixed(2)} daha yüksek. Ekleme portföy veriminizi artırır.`}
                    {rec?.type === 'skip' && `${searchSymbol} verimi portföy ortalamanızdan %${Math.abs(diff).toFixed(2)} daha düşük. Ekleme portföy veriminizi düşürür.`}
                    {rec?.type === 'neutral' && `${searchSymbol} verimi portföy ortalamanıza çok yakın. Verim açısından nötr bir ekleme olur.`}
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}