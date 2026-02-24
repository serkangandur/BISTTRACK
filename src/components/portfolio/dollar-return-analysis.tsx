"use client";

import { useState, useMemo, useEffect, Fragment, useCallback } from "react";
import {
  DollarSign,
  Info,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StockHolding } from "@/lib/types";
import { useDollarDividends, DollarDividendPayment } from "@/hooks/use-dollar-dividends";

interface DollarReturnAnalysisProps {
  holdings?: StockHolding[];
}

interface StockDollarData {
  stock: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  anaparaTL: number;
  currentValueTL: number;
  totalDividendTL: number;
  anaparaUSD: number;
  currentValueUSD: number;
  totalDividendUSD: number;
  totalReturnUSD: number;
  returnPct: number;
  payments: DollarDividendPayment[];
}

function formatNum(val: string): string {
  const raw = val.replace(/[^0-9]/g, "");
  if (raw === "") return "";
  return parseInt(raw).toLocaleString("tr-TR");
}

function parseNum(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0;
}

export function DollarReturnAnalysis({ holdings = [] }: DollarReturnAnalysisProps) {
  const { payments, isLoading: isPaymentsLoading, isSaving, addPayment, removePayment } = useDollarDividends();

  const [buyDate, setBuyDate] = useState("2026-01-01");
  const [buyDateRate, setBuyDateRate] = useState<number | null>(null);
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(true);
  const [newStock, setNewStock] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newNote, setNewNote] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());

  // Dolar kurlarını çek
  const fetchRates = useCallback(async () => {
    setIsLoadingRates(true);
    try {
      // Güncel kur
      const currentRes = await fetch('/api/exchange');
      if (currentRes.ok) {
        const data = await currentRes.json();
        setCurrentRate(data.rate);
      }

      // Alış tarihi kuru
      const histRes = await fetch(`/api/exchange?date=${buyDate}`);
      if (histRes.ok) {
        const data = await histRes.json();
        setBuyDateRate(data.rate);
      }
    } catch (err) {
      console.error('Kur çekme hatası:', err);
    } finally {
      setIsLoadingRates(false);
    }
  }, [buyDate]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Temettü Sabit portföyündeki hisseler
  const portfolioStocks = useMemo(() => {
    return holdings
      .filter((h) => h.category === "Temettü Sabit")
      .map((h) => ({
        symbol: h.symbol.toUpperCase(),
        quantity: h.quantity,
        averageCost: h.averageCost,
        currentPrice: h.currentPrice,
      }));
  }, [holdings]);

  const portfolioSymbols = useMemo(() => portfolioStocks.map((s) => s.symbol), [portfolioStocks]);

  const handleAddPayment = async () => {
    const amount = parseNum(newAmount);
    if (!newStock.trim() || amount <= 0) return;
    const symbol = newStock.trim().toUpperCase();
    await addPayment({
      stock: symbol,
      netAmount: amount,
      date: newDate || new Date().toISOString().split("T")[0],
      note: newNote.trim(),
    });
    setNewStock("");
    setNewAmount("");
    setNewDate("");
    setNewNote("");
    setShowAddForm(false);
    setExpandedStocks((prev) => new Set(prev).add(symbol));
  };

  const handleRemovePayment = async (id: string) => {
    await removePayment(id);
  };

  const toggleExpand = (stock: string) => {
    setExpandedStocks((prev) => {
      const next = new Set(prev);
      if (next.has(stock)) next.delete(stock);
      else next.add(stock);
      return next;
    });
  };

  // Hisse bazında dolar getiri hesapla
  const stockData = useMemo((): StockDollarData[] => {
    if (!buyDateRate || !currentRate) return [];

    const paymentMap = new Map<string, DollarDividendPayment[]>();
    portfolioSymbols.forEach((sym) => paymentMap.set(sym, []));
    payments.forEach((p) => {
      if (!paymentMap.has(p.stock)) paymentMap.set(p.stock, []);
      paymentMap.get(p.stock)!.push(p);
    });

    return portfolioStocks.map((stock) => {
      const pmts = paymentMap.get(stock.symbol) || [];
      const anaparaTL = stock.quantity * stock.averageCost;
      const currentValueTL = stock.quantity * stock.currentPrice;
      const totalDividendTL = pmts.reduce((s, p) => s + p.netAmount, 0);

      const anaparaUSD = anaparaTL / buyDateRate;
      const currentValueUSD = currentValueTL / currentRate;
      const totalDividendUSD = totalDividendTL / currentRate;
      const totalReturnUSD = (currentValueUSD + totalDividendUSD) - anaparaUSD;
      const returnPct = anaparaUSD > 0 ? (totalReturnUSD / anaparaUSD) * 100 : 0;

      return {
        stock: stock.symbol,
        quantity: stock.quantity,
        averageCost: stock.averageCost,
        currentPrice: stock.currentPrice,
        anaparaTL,
        currentValueTL,
        totalDividendTL,
        anaparaUSD,
        currentValueUSD,
        totalDividendUSD,
        totalReturnUSD,
        returnPct,
        payments: pmts.sort((a, b) => a.date.localeCompare(b.date)),
      };
    }).sort((a, b) => b.returnPct - a.returnPct);
  }, [portfolioStocks, portfolioSymbols, payments, buyDateRate, currentRate]);

  // Toplamlar
  const totals = useMemo(() => {
    const totalAnaparaUSD = stockData.reduce((s, d) => s + d.anaparaUSD, 0);
    const totalCurrentUSD = stockData.reduce((s, d) => s + d.currentValueUSD, 0);
    const totalDivUSD = stockData.reduce((s, d) => s + d.totalDividendUSD, 0);
    const totalReturnUSD = stockData.reduce((s, d) => s + d.totalReturnUSD, 0);
    const totalReturnPct = totalAnaparaUSD > 0 ? (totalReturnUSD / totalAnaparaUSD) * 100 : 0;
    return { totalAnaparaUSD, totalCurrentUSD, totalDivUSD, totalReturnUSD, totalReturnPct };
  }, [stockData]);

  const fUSD = (val: number) => "$" + val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fTL = (val: number) => "₺" + val.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fRate = (val: number) => val.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getReturnColor = (pct: number) => {
    if (pct >= 20) return "text-emerald-400";
    if (pct >= 0) return "text-green-400";
    return "text-red-400";
  };

  // Grafik — Bar chart SVG
  const chartHeight = 300;
  const chartWidth = 700;
  const barWidth = stockData.length > 0 ? Math.min(60, (chartWidth - 80) / stockData.length - 10) : 40;
  const maxPct = Math.max(30, ...stockData.map(d => Math.abs(d.returnPct)), 25);
  const minPct = Math.min(-5, ...stockData.map(d => d.returnPct));
  const range = maxPct - minPct;
  const zeroY = ((maxPct) / range) * (chartHeight - 60) + 30;
  const refLineY = ((maxPct - 20) / range) * (chartHeight - 60) + 30;

  if (isPaymentsLoading || isLoadingRates) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">
          {isLoadingRates ? "Dolar kurları çekiliyor..." : "Veriler yükleniyor..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Temettü Dolar Getiri</h2>
          <p className="text-sm text-muted-foreground">Temettü Sabit portföyü — dolar bazında performans</p>
        </div>
      </div>

      {/* Bilgi + Kur Ayarları */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300/80 space-y-2 flex-1">
          <p>Temettü Sabit portföyündeki hisseler, alış tarihindeki dolar kuru ile bugünkü kur karşılaştırılarak dolar bazında getiri hesaplanır. Temettüler de eklenir.</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-400/60">Alış Tarihi:</span>
              <input
                type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
              />
            </div>
            {buyDateRate && (
              <span className="text-xs">
                <span className="text-blue-400/60">Alış Kuru:</span>{" "}
                <span className="text-white font-bold">₺{fRate(buyDateRate)}</span>
              </span>
            )}
            {currentRate && (
              <span className="text-xs">
                <span className="text-blue-400/60">Güncel Kur:</span>{" "}
                <span className="text-white font-bold">₺{fRate(currentRate)}</span>
              </span>
            )}
            <Button onClick={fetchRates} variant="ghost" size="sm" className="text-xs h-7" disabled={isLoadingRates}>
              Kurları Güncelle
            </Button>
          </div>
        </div>
      </div>

      {/* Özet Kartları */}
      {stockData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-card/30 border border-white/10 rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Toplam Yatırım ($)</p>
            <p className="text-xl font-bold">{fUSD(totals.totalAnaparaUSD)}</p>
          </div>
          <div className="bg-card/30 border border-white/10 rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Güncel Değer ($)</p>
            <p className="text-xl font-bold">{fUSD(totals.totalCurrentUSD)}</p>
          </div>
          <div className="bg-card/30 border border-white/10 rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Toplam Temettü ($)</p>
            <p className="text-xl font-bold text-green-400">{fUSD(totals.totalDivUSD)}</p>
          </div>
          <div className="bg-card/30 border border-white/10 rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Net Getiri ($)</p>
            <p className={cn("text-xl font-bold flex items-center gap-1", getReturnColor(totals.totalReturnPct))}>
              {totals.totalReturnUSD >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {fUSD(Math.abs(totals.totalReturnUSD))}
            </p>
          </div>
          <div className="bg-card/30 border border-white/10 rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Toplam Getiri (%)</p>
            <p className={cn("text-xl font-bold", getReturnColor(totals.totalReturnPct))}>
              %{totals.totalReturnPct.toFixed(1)}
            </p>
          </div>
        </div>
      )}

      {/* Grafik */}
      {stockData.length > 0 && (
        <div className="bg-card/20 border border-white/5 rounded-xl p-6">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Hisse Bazında Dolar Getiri (%)
          </h3>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-3xl mx-auto" style={{ minWidth: '500px' }}>
              {/* Grid çizgileri */}
              {[-20, -10, 0, 10, 20, 30, 40, 50].filter(v => v >= minPct && v <= maxPct).map((val) => {
                const y = ((maxPct - val) / range) * (chartHeight - 60) + 30;
                return (
                  <g key={val}>
                    <line x1="60" y1={y} x2={chartWidth - 20} y2={y} stroke="white" strokeOpacity="0.06" strokeWidth="1" />
                    <text x="55" y={y + 4} textAnchor="end" fill="white" fillOpacity="0.3" fontSize="11">%{val}</text>
                  </g>
                );
              })}

              {/* %20 Referans Çizgisi */}
              <line x1="60" y1={refLineY} x2={chartWidth - 20} y2={refLineY}
                stroke="#f59e0b" strokeWidth="2" strokeDasharray="8 4" strokeOpacity="0.7" />
              <text x={chartWidth - 18} y={refLineY - 6} textAnchor="end" fill="#f59e0b" fontSize="11" fontWeight="bold">
                %20 Hedef
              </text>

              {/* Sıfır çizgisi */}
              <line x1="60" y1={zeroY} x2={chartWidth - 20} y2={zeroY} stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />

              {/* Barlar */}
              {stockData.map((d, i) => {
                const x = 80 + i * ((chartWidth - 100) / stockData.length);
                const barH = Math.abs(d.returnPct / range) * (chartHeight - 60);
                const barY = d.returnPct >= 0 ? zeroY - barH : zeroY;
                const color = d.returnPct >= 20 ? "#34d399" : d.returnPct >= 0 ? "#4ade80" : "#ef4444";

                return (
                  <g key={d.stock}>
                    <rect x={x} y={barY} width={barWidth} height={Math.max(2, barH)} rx="4" fill={color} fillOpacity="0.8" />
                    <text x={x + barWidth / 2} y={chartHeight - 5} textAnchor="middle" fill="white" fillOpacity="0.5" fontSize="10">
                      {d.stock}
                    </text>
                    <text x={x + barWidth / 2} y={d.returnPct >= 0 ? barY - 6 : barY + barH + 14}
                      textAnchor="middle" fill={color} fontSize="11" fontWeight="bold">
                      %{d.returnPct.toFixed(1)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Temettü Ekleme + Tablo */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Hisse Detayları</h2>
            {stockData.length > 0 && (
              <Badge variant="outline" className="text-xs">{payments.length} ödeme · {stockData.length} hisse</Badge>
            )}
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-primary text-primary-foreground" size="sm" disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Temettü Ekle
          </Button>
        </div>

        {showAddForm && (
          <div className="bg-card/40 border border-white/10 rounded-xl p-4 mb-4 space-y-3 animate-in fade-in duration-300">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Hisse Adı</label>
                <input type="text" value={newStock} onChange={(e) => setNewStock(e.target.value)} placeholder="PAGYO" autoFocus list="dollar-stock-suggestions"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                  onKeyDown={(e) => e.key === "Enter" && handleAddPayment()} />
                <datalist id="dollar-stock-suggestions">
                  {portfolioSymbols.map((sym) => (<option key={sym} value={sym} />))}
                </datalist>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Net Temettü (₺)</label>
                <input type="text" value={newAmount} onChange={(e) => setNewAmount(formatNum(e.target.value))} placeholder="10.000"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                  onKeyDown={(e) => e.key === "Enter" && handleAddPayment()} />
              </div>
              <div className="w-40">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Tarih</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition" />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Not (opsiyonel)</label>
                <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="1. ara temettü"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                  onKeyDown={(e) => e.key === "Enter" && handleAddPayment()} />
              </div>
              <Button onClick={handleAddPayment} size="sm" className="shrink-0" disabled={isSaving}>
                {isSaving ? "Kaydediliyor..." : "Ekle"}
              </Button>
              <Button onClick={() => setShowAddForm(false)} variant="ghost" size="sm" className="shrink-0 text-muted-foreground">İptal</Button>
            </div>
          </div>
        )}

        <div className="bg-card/20 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground">Hisse</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">Anapara ($)</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">Güncel Değer ($)</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">Temettü ($)</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">Net Getiri ($)</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">Getiri (%)</th>
              </tr>
            </thead>
            <tbody>
              {stockData.length > 0 ? (
                <>
                  {stockData.map((d) => {
                    const isExpanded = expandedStocks.has(d.stock);
                    return (
                      <Fragment key={d.stock}>
                        <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => toggleExpand(d.stock)}>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                              <div>
                                <div className="font-bold text-sm">{d.stock}</div>
                                <span className="text-[10px] text-muted-foreground">{d.quantity} adet · Ort. {fTL(d.averageCost)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right text-sm">{fUSD(d.anaparaUSD)}</td>
                          <td className="p-4 text-right text-sm">{fUSD(d.currentValueUSD)}</td>
                          <td className="p-4 text-right text-sm text-green-400">{d.totalDividendUSD > 0 ? fUSD(d.totalDividendUSD) : "—"}</td>
                          <td className="p-4 text-right">
                            <span className={cn("text-sm font-bold flex items-center gap-1 justify-end", getReturnColor(d.returnPct))}>
                              {d.totalReturnUSD >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              {fUSD(Math.abs(d.totalReturnUSD))}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <span className={cn("text-sm font-bold", getReturnColor(d.returnPct))}>
                              %{d.returnPct.toFixed(1)}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && d.payments.length > 0 && d.payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-white/5 last:border-0 bg-white/[0.01]">
                            <td className="p-3 pl-12">
                              <div className="text-xs text-muted-foreground">{formatDate(payment.date)}</div>
                              {payment.note && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{payment.note}</div>}
                            </td>
                            <td className="p-3"></td>
                            <td className="p-3"></td>
                            <td className="p-3 text-right text-xs text-green-400/80">₺{payment.netAmount.toLocaleString("tr-TR")}</td>
                            <td className="p-3"></td>
                            <td className="p-3 text-right">
                              <button onClick={(e) => { e.stopPropagation(); handleRemovePayment(payment.id); }}
                                className="text-muted-foreground/30 hover:text-red-400 transition p-1 rounded-lg hover:bg-white/5">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {isExpanded && d.payments.length === 0 && (
                          <tr className="border-b border-white/5 bg-white/[0.01]">
                            <td colSpan={6} className="p-4 pl-12 text-xs text-muted-foreground/50">
                              Henüz temettü eklenmedi. &quot;Temettü Ekle&quot; butonunu kullanın.
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  <tr className="bg-white/[0.03] font-bold border-t border-white/10">
                    <td className="p-4 text-sm">TOPLAM</td>
                    <td className="p-4 text-right text-sm">{fUSD(totals.totalAnaparaUSD)}</td>
                    <td className="p-4 text-right text-sm">{fUSD(totals.totalCurrentUSD)}</td>
                    <td className="p-4 text-right text-sm text-green-400">{fUSD(totals.totalDivUSD)}</td>
                    <td className="p-4 text-right">
                      <span className={cn("text-sm font-bold", getReturnColor(totals.totalReturnPct))}>
                        {fUSD(Math.abs(totals.totalReturnUSD))}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={cn("text-sm font-bold", getReturnColor(totals.totalReturnPct))}>
                        %{totals.totalReturnPct.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <p className="text-muted-foreground text-sm">Temettü Sabit portföyünde hisse bulunmuyor.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Portföyünüze &quot;Temettü Sabit&quot; kategorisinde hisse ekleyin.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
