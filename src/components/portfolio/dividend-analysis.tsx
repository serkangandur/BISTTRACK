
'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Search, 
  RefreshCcw, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  Calendar,
  Percent,
  Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { StockHolding } from '@/lib/types';

interface DividendData {
  symbol: string;
  netDividendPerShare: number;
  dividendYield: number;
  paymentDate: string;
  year: number;
}

interface DividendAnalysisProps {
  holdings: StockHolding[];
}

// Analiz edilecek varsayılan temettü hisseleri
const DEFAULT_WATCHLIST = ['LOGO', 'TUPRS', 'CLEBI', 'ISMEN', 'PAGYO', 'ANHYT'];

export function DividendAnalysis({ holdings }: DividendAnalysisProps) {
  const [dividendData, setDividendData] = useState<DividendData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchResult, setSearchResult] = useState<DividendData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Portföydeki temettü hisselerini (kategoriye göre) filtrele
  const temettuHoldings = useMemo(() => {
    return holdings.filter(h => h.category === 'Temettü');
  }, [holdings]);

  // Portföy bazlı ağırlıklı ortalama temettü verimi hesabı
  const portfolioYield = useMemo(() => {
    if (temettuHoldings.length === 0) return 0;
    
    const totalValue = temettuHoldings.reduce((acc, h) => acc + (h.quantity * h.currentPrice), 0);
    if (totalValue === 0) return 0;
    
    // Verileri çekilen hisselerin verimlerini ağırlıklandır
    const weightedYield = temettuHoldings.reduce((acc, h) => {
      const weight = (h.quantity * h.currentPrice) / totalValue;
      const div = dividendData.find(d => d.symbol === h.symbol.toUpperCase());
      // Eğer veri yoksa muhafazakar bir yaklaşım için 0 alıyoruz
      return acc + (weight * (div?.dividendYield || 0));
    }, 0);
    
    return weightedYield;
  }, [temettuHoldings, dividendData]);

  const fetchDividends = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Hem izleme listesini hem portföydeki sembolleri çek
      const uniqueSymbols = Array.from(new Set([
        ...DEFAULT_WATCHLIST,
        ...temettuHoldings.map(h => h.symbol.toUpperCase())
      ]));
      
      const res = await fetch(`/api/dividend?symbols=${uniqueSymbols.join(',')}`);
      if (!res.ok) throw new Error('Temettü verileri çekilemedi');
      const data: DividendData[] = await res.json();
      setDividendData(data);
    } catch (err: any) {
      setError('Veriler güncellenirken bir ağ hatası oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDividends();
  }, [temettuHoldings.length]);

  const handleSearch = async () => {
    if (!searchSymbol.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/dividend?symbols=${searchSymbol.toUpperCase()}`);
      if (!res.ok) throw new Error('Hisse bulunamadı');
      const data: DividendData[] = await res.json();
      if (data.length > 0) setSearchResult(data[0]);
    } catch {
      setError("Hisse kodu geçerli değil veya veri bulunamadı.");
    } finally {
      setIsSearching(false);
    }
  };

  const getRecommendation = (yieldValue: number) => {
    if (portfolioYield === 0) return { type: 'neutral', label: 'Veri Yok', color: 'text-muted-foreground', icon: Minus };
    const diff = yieldValue - portfolioYield;
    if (diff > 0.5) return { type: 'buy', label: 'Verim Artırıcı', color: 'text-bist-up', icon: TrendingUp };
    if (diff < -0.5) return { type: 'skip', label: 'Verim Düşürücü', color: 'text-bist-down', icon: TrendingDown };
    return { type: 'neutral', label: 'Benzer Verim', color: 'text-yellow-400', icon: Minus };
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Üst Özet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Percent className="w-24 h-24 rotate-12" />
          </div>
          <CardContent className="p-6">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Portföy Temettü Verimi</p>
            {isLoading ? (
              <div className="flex items-center gap-2 mt-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                <span className="text-lg font-bold text-muted-foreground">Analiz ediliyor...</span>
              </div>
            ) : (
              <h3 className="text-4xl font-black text-white">%{portfolioYield.toFixed(2)}</h3>
            )}
            <div className="flex items-center gap-1.5 mt-2">
               <div className="w-1.5 h-1.5 rounded-full bg-primary" />
               <p className="text-[10px] text-muted-foreground font-bold">Ağırlıklı Ortalama (Piyasa Değeri Bazlı)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-card/40 border-white/5 shadow-2xl flex items-center p-6 gap-4">
          <div className="p-3 rounded-full bg-white/5 border border-white/10 shrink-0">
            <Info className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Stratejik Karar Destek Sistemi</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mevcut portföy veriminiz kıyas noktasıdır. Yeni bir hisse eklemeden önce bu verimin üzerinde olup olmadığını kontrol ederek pasif gelir hedeflerinizi optimize edebilirsiniz.
            </p>
          </div>
        </Card>
      </div>

      {/* İzleme Listesi ve Mevcut Hisseler */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest">Temettü İzleme Paneli</h3>
          <Button variant="ghost" size="sm" className="h-8 text-xs hover:bg-white/5" onClick={fetchDividends} disabled={isLoading}>
            <RefreshCcw className={cn("h-3 w-3 mr-2", isLoading && "animate-spin")} />
            Verileri Tazele
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-xs font-bold">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEFAULT_WATCHLIST.map(symbol => {
            const div = dividendData.find(d => d.symbol === symbol);
            const holding = temettuHoldings.find(h => h.symbol.toUpperCase() === symbol);
            const rec = div ? getRecommendation(div.dividendYield) : null;
            const isBetter = div && div.dividendYield >= portfolioYield;

            return (
              <Card key={symbol} className="bg-card/40 border-white/5 hover:border-white/10 transition-all group shadow-lg">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                      {symbol[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black">{symbol}</p>
                      {holding && <p className="text-[10px] text-muted-foreground">{holding.quantity.toLocaleString()} Adet Mevcut</p>}
                    </div>
                  </div>
                  {div && <Badge variant="secondary" className="text-[9px] font-bold py-0 h-4">{div.year} Verisi</Badge>}
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Net Temettü</span>
                      <span className="font-bold">₺{div?.netDividendPerShare.toFixed(3) || "---"}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Temettü Verimi</span>
                      <span className={cn("font-black", isBetter ? "text-bist-up" : "text-bist-down")}>
                        %{div?.dividendYield.toFixed(2) || "---"}
                      </span>
                    </div>
                    {div?.paymentDate && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Ödeme Tarihi
                        </span>
                        <span className="text-muted-foreground">{div.paymentDate}</span>
                      </div>
                    )}
                  </div>

                  {div && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase text-muted-foreground">
                        <span>Verim Kıyaslama</span>
                        <span className={cn(rec?.color)}>{rec?.label}</span>
                      </div>
                      <Progress 
                        value={Math.min((div.dividendYield / Math.max(portfolioYield * 1.5, 10)) * 100, 100)} 
                        className="h-1 bg-white/5" 
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Karşılaştırma Arama Kutusu */}
      <Card className="bg-card/30 border-white/5 border-dashed shadow-2xl overflow-hidden">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Search className="w-4 h-4" /> Yeni Hisse Karşılaştır
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchSymbol}
              onChange={e => setSearchSymbol(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Hisse kodu girin... (Örn: AKBNK, FROTO)"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
            />
            <Button onClick={handleSearch} disabled={isSearching || !searchSymbol} className="font-bold gap-2">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analiz Et
            </Button>
          </div>

          {searchResult && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-6 space-y-6 animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Receipt className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black">{searchResult.symbol}</h4>
                    <p className="text-xs text-muted-foreground">{searchResult.year} Mali Yılı Tahmini</p>
                  </div>
                </div>
                {(() => {
                  const rec = getRecommendation(searchResult.dividendYield);
                  return (
                    <div className={cn("px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2", 
                      rec.type === 'buy' ? "bg-bist-up/10 text-bist-up" : "bg-bist-down/10 text-bist-down"
                    )}>
                      <rec.icon className="w-3.5 h-3.5" />
                      {rec.label}
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-black uppercase">Net Temettü</p>
                  <p className="text-2xl font-black">₺{searchResult.netDividendPerShare.toFixed(3)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-black uppercase">Temettü Verimi</p>
                  <p className="text-2xl font-black text-bist-up">%{searchResult.dividendYield.toFixed(2)}</p>
                </div>
                <div className="space-y-1 col-span-2 md:col-span-1">
                   <p className="text-[10px] text-muted-foreground font-black uppercase">Verim Farkı</p>
                   <p className={cn("text-2xl font-black", (searchResult.dividendYield - portfolioYield) >= 0 ? "text-bist-up" : "text-bist-down")}>
                     {(searchResult.dividendYield - portfolioYield) >= 0 ? "+" : ""}{(searchResult.dividendYield - portfolioYield).toFixed(2)}%
                   </p>
                </div>
              </div>

              {/* Grafiksel Kıyaslama */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                    <span>Mevcut Portföy Verimin</span>
                    <span>%{portfolioYield.toFixed(2)}</span>
                  </div>
                  <Progress value={(portfolioYield / Math.max(searchResult.dividendYield, portfolioYield)) * 100} className="h-2 bg-white/5" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-primary">
                    <span>{searchResult.symbol} Potansiyel Verimi</span>
                    <span>%{searchResult.dividendYield.toFixed(2)}</span>
                  </div>
                  <Progress 
                    value={(searchResult.dividendYield / Math.max(searchResult.dividendYield, portfolioYield)) * 100} 
                    className="h-2 bg-primary/20 [&>div]:bg-primary" 
                  />
                </div>
              </div>

              {/* Analiz Metni */}
              <div className={cn(
                "p-4 rounded-lg flex gap-3 items-start",
                searchResult.dividendYield >= portfolioYield ? "bg-bist-up/5 border border-bist-up/10" : "bg-bist-down/5 border border-bist-down/10"
              )}>
                {searchResult.dividendYield >= portfolioYield ? <CheckCircle2 className="w-5 h-5 text-bist-up shrink-0" /> : <AlertCircle className="w-5 h-5 text-bist-down shrink-0" />}
                <p className="text-sm leading-relaxed">
                  {searchResult.dividendYield >= portfolioYield 
                    ? `${searchResult.symbol} eklemek, portföyünüzün toplam temettü verimini yukarı çekecektir. Pasif gelir stratejiniz için verimli bir hamle olabilir.`
                    : `${searchResult.symbol} verimi portföy ortalamanızın altında. Bu hisseyi eklemek toplam temettü verimliliğinizi azaltacaktır.`}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
