"use client";

import { useState, useMemo, Fragment } from "react";
import {
  TrendingUp,
  ArrowDownCircle,
  Info,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  PiggyBank,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAmortizationPayments, AmortizationPayment } from "@/hooks/use-amortization-payments";
import { useAmortizationStocks } from "@/hooks/use-amortization-stocks";

interface GroupedStock {
  stock: string;
  stockId?: string;
  payments: AmortizationPayment[];
  totalNet: number;
  anapara: number;
  amortizationPct: number;
}

function formatNum(val: string): string {
  const raw = val.replace(/[^0-9]/g, "");
  if (raw === "") return "";
  return parseInt(raw).toLocaleString("tr-TR");
}

function parseNum(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0;
}

export function AmortizationAnalysis() {
  const { payments, isLoading: paymentsLoading, isSaving: paymentsSaving, addPayment, removePayment } = useAmortizationPayments();
  const { stocks: manualStocks, isLoading: stocksLoading, isSaving: stocksSaving, addStock, updateStockAnapara, removeStock } = useAmortizationStocks();

  const isLoading = paymentsLoading || stocksLoading;
  const isSaving = paymentsSaving || stocksSaving;

  // Temettü ekleme formu
  const [newStock, setNewStock] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newNote, setNewNote] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Hisse/Anapara ekleme formu
  const [showAddStockForm, setShowAddStockForm] = useState(false);
  const [newStockSymbol, setNewStockSymbol] = useState("");
  const [newStockAnapara, setNewStockAnapara] = useState("");

  // Anapara düzenleme
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editAnaparaValue, setEditAnaparaValue] = useState("");

  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());

  // Manuel hisselerden anapara haritası
  const anaparaMap = useMemo(() => {
    const map: Record<string, { anapara: number; id: string }> = {};
    manualStocks.forEach((s) => {
      map[s.symbol] = { anapara: s.anapara, id: s.id };
    });
    return map;
  }, [manualStocks]);

  const manualSymbols = useMemo(() => manualStocks.map((s) => s.symbol), [manualStocks]);

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

  const handleAddStock = async () => {
    const anapara = parseNum(newStockAnapara);
    const symbol = newStockSymbol.trim().toUpperCase();
    if (!symbol || anapara <= 0) return;

    // Eğer zaten varsa, güncelle
    if (anaparaMap[symbol]) {
      await updateStockAnapara(anaparaMap[symbol].id, anapara);
    } else {
      await addStock({ symbol, anapara });
    }

    setNewStockSymbol("");
    setNewStockAnapara("");
    setShowAddStockForm(false);
  };

  const handleUpdateAnapara = async (stockId: string) => {
    const anapara = parseNum(editAnaparaValue);
    if (anapara <= 0) return;
    await updateStockAnapara(stockId, anapara);
    setEditingStockId(null);
    setEditAnaparaValue("");
  };

  const handleRemovePayment = async (id: string) => {
    await removePayment(id);
  };

  const handleRemoveStock = async (stockId: string, symbol: string) => {
    await removeStock(stockId);
  };

  const toggleExpand = (stock: string) => {
    setExpandedStocks((prev) => {
      const next = new Set(prev);
      if (next.has(stock)) next.delete(stock);
      else next.add(stock);
      return next;
    });
  };

  const grouped = useMemo((): GroupedStock[] => {
    const map = new Map<string, AmortizationPayment[]>();

    // Manuel hisseleri ekle
    manualSymbols.forEach((sym) => {
      if (!map.has(sym)) map.set(sym, []);
    });

    // Ödemeleri ekle (hisse listesinde olmayan ödemeler de dahil)
    payments.forEach((p) => {
      if (!map.has(p.stock)) map.set(p.stock, []);
      map.get(p.stock)!.push(p);
    });

    return Array.from(map.entries())
      .map(([stock, pmts]) => {
        const totalNet = pmts.reduce((s, p) => s + p.netAmount, 0);
        const anapara = anaparaMap[stock]?.anapara || 0;
        const amortizationPct = anapara > 0 ? (totalNet / anapara) * 100 : 0;
        return {
          stock,
          stockId: anaparaMap[stock]?.id,
          payments: pmts.sort((a, b) => a.date.localeCompare(b.date)),
          totalNet,
          anapara,
          amortizationPct,
        };
      })
      .sort((a, b) => b.amortizationPct - a.amortizationPct);
  }, [payments, manualSymbols, anaparaMap]);

  const totalAnapara = useMemo(
    () => grouped.reduce((sum, g) => sum + g.anapara, 0),
    [grouped]
  );
  const totalDividend = useMemo(
    () => payments.reduce((sum, p) => sum + p.netAmount, 0),
    [payments]
  );
  const totalAmortPct = useMemo(
    () => (totalAnapara > 0 ? (totalDividend / totalAnapara) * 100 : 0),
    [totalAnapara, totalDividend]
  );

  const f = (val: number) =>
    "₺" + val.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fInt = (val: number) =>
    "₺" + val.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Amortisman yüzdesine göre renk
  const getAmortColor = (pct: number) => {
    if (pct >= 100) return "text-emerald-400";
    if (pct >= 50) return "text-green-400";
    if (pct >= 25) return "text-blue-400";
    if (pct >= 10) return "text-yellow-400";
    if (pct > 0) return "text-orange-400";
    return "text-muted-foreground/40";
  };

  const getBarColor = (pct: number) => {
    if (pct >= 100) return "bg-emerald-400";
    if (pct >= 50) return "bg-green-400";
    if (pct >= 25) return "bg-blue-400";
    if (pct >= 10) return "bg-yellow-400";
    if (pct > 0) return "bg-orange-400";
    return "bg-muted-foreground/20";
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">Amortisman verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <PiggyBank className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Temettü Amortisman Analizi</h2>
          <p className="text-sm text-muted-foreground">Yatırımını ne kadar geri aldın?</p>
        </div>
      </div>

      {/* Bilgi Kutusu */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300/80 space-y-1">
          <p>
            Takip etmek istediğiniz hisseleri ve anapara tutarlarını manuel olarak ekleyin.
            Ardından hisse bazında aldığınız <strong>net temettü</strong> tutarlarını girin.
          </p>
          <p>
            Sistem, toplam temettünüzün anaparanızın yüzde kaçını karşıladığını (%100 = yatırım tamamen amorte) hesaplar.
          </p>
        </div>
      </div>

      {/* Özet Kartları */}
      {totalAnapara > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card/30 border border-white/[0.08] rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Toplam Anapara</p>
            <p className="text-xl font-bold">{fInt(totalAnapara)}</p>
          </div>
          <div className="bg-card/30 border border-white/[0.08] rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Toplam Temettü</p>
            <p className="text-xl font-bold text-green-400">{f(totalDividend)}</p>
          </div>
          <div className="bg-card/30 border border-white/[0.08] rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Kalan Anapara</p>
            <p className="text-xl font-bold text-orange-400">{fInt(Math.max(0, totalAnapara - totalDividend))}</p>
          </div>
          <div className="bg-card/30 border border-white/[0.08] rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Genel Amortisman</p>
            <div className="flex items-center gap-2">
              <p className={cn("text-xl font-bold", getAmortColor(totalAmortPct))}>
                %{totalAmortPct.toFixed(1)}
              </p>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 mt-2">
              <div
                className={cn("h-2 rounded-full transition-all duration-500", getBarColor(totalAmortPct))}
                style={{ width: `${Math.min(100, totalAmortPct)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Hisse Tablosu */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Hisse Bazında Amortisman</h2>
            {grouped.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {payments.length} ödeme · {grouped.length} hisse
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => { setShowAddStockForm(!showAddStockForm); setShowAddForm(false); }}
              variant="outline"
              size="sm"
              disabled={isSaving}
              className="border-white/[0.12]"
            >
              {stocksSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Hisse Ekle
            </Button>
            <Button
              onClick={() => { setShowAddForm(!showAddForm); setShowAddStockForm(false); }}
              className="bg-primary text-primary-foreground"
              size="sm"
              disabled={isSaving}
            >
              {paymentsSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Temettü Ekle
            </Button>
          </div>
        </div>

        {/* Hisse/Anapara Ekleme Formu */}
        {showAddStockForm && (
          <div className="bg-card/40 border border-white/[0.08] rounded-xl p-4 mb-4 space-y-3 animate-in fade-in duration-300">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Hisse Adı</label>
                <input
                  type="text" value={newStockSymbol} onChange={(e) => setNewStockSymbol(e.target.value)}
                  placeholder="THYAO" autoFocus
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                  onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Anapara (₺)</label>
                <input
                  type="text" value={newStockAnapara} onChange={(e) => setNewStockAnapara(formatNum(e.target.value))}
                  placeholder="100.000"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                  onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
                />
              </div>
              <Button onClick={handleAddStock} size="sm" className="shrink-0" disabled={isSaving}>
                {isSaving ? "Kaydediliyor..." : "Ekle"}
              </Button>
              <Button onClick={() => setShowAddStockForm(false)} variant="ghost" size="sm" className="shrink-0 text-muted-foreground">İptal</Button>
            </div>
          </div>
        )}

        {/* Temettü Ekleme Formu */}
        {showAddForm && (
          <div className="bg-card/40 border border-white/[0.08] rounded-xl p-4 mb-4 space-y-3 animate-in fade-in duration-300">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Hisse Adı</label>
                <div className="relative">
                  <input
                    type="text" value={newStock} onChange={(e) => setNewStock(e.target.value)}
                    placeholder="THYAO" autoFocus list="amort-stock-suggestions"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                    onKeyDown={(e) => e.key === "Enter" && handleAddPayment()}
                  />
                  <datalist id="amort-stock-suggestions">
                    {manualSymbols.map((sym) => (<option key={sym} value={sym} />))}
                  </datalist>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Net Temettü (₺)</label>
                <input
                  type="text" value={newAmount} onChange={(e) => setNewAmount(formatNum(e.target.value))}
                  placeholder="50.000"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                  onKeyDown={(e) => e.key === "Enter" && handleAddPayment()}
                />
              </div>
              <div className="w-40">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Tarih</label>
                <input
                  type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition"
                />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Not (opsiyonel)</label>
                <input
                  type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
                  placeholder="1. ara temettü"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                  onKeyDown={(e) => e.key === "Enter" && handleAddPayment()}
                />
              </div>
              <Button onClick={handleAddPayment} size="sm" className="shrink-0" disabled={isSaving}>
                {isSaving ? "Kaydediliyor..." : "Ekle"}
              </Button>
              <Button onClick={() => setShowAddForm(false)} variant="ghost" size="sm" className="shrink-0 text-muted-foreground">İptal</Button>
            </div>
          </div>
        )}

        <div className="bg-card/20 border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground">Varlık</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">Anapara (₺)</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">Toplam Temettü (₺)</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">Kalan (₺)</th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground w-48">Amortisman</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.length > 0 ? (
                <>
                  {grouped.map((group) => {
                    const isExpanded = expandedStocks.has(group.stock);
                    const isEditing = editingStockId === group.stockId;
                    const kalan = Math.max(0, group.anapara - group.totalNet);
                    return (
                      <Fragment key={group.stock}>
                        <tr
                          className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => toggleExpand(group.stock)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                              <div>
                                <div className="font-bold text-sm">{group.stock}</div>
                                {group.payments.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">{group.payments.length} ödeme</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            {isEditing && group.stockId ? (
                              <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text" value={editAnaparaValue}
                                  onChange={(e) => setEditAnaparaValue(formatNum(e.target.value))}
                                  className="w-28 bg-white/[0.04] border border-primary/50 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-primary transition"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleUpdateAnapara(group.stockId!);
                                    if (e.key === "Escape") { setEditingStockId(null); setEditAnaparaValue(""); }
                                  }}
                                />
                                <button
                                  onClick={() => handleUpdateAnapara(group.stockId!)}
                                  className="text-green-400 hover:text-green-300 p-1 rounded hover:bg-white/5 transition"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => { setEditingStockId(null); setEditAnaparaValue(""); }}
                                  className="text-muted-foreground/50 hover:text-white p-1 rounded hover:bg-white/5 transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="font-medium text-sm">{group.anapara > 0 ? fInt(group.anapara) : "—"}</span>
                                {group.stockId && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingStockId(group.stockId!);
                                      setEditAnaparaValue(group.anapara > 0 ? group.anapara.toLocaleString("tr-TR") : "");
                                    }}
                                    className="text-muted-foreground/30 hover:text-primary p-1 rounded hover:bg-white/5 transition"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className={cn("font-bold text-sm", group.totalNet > 0 ? "text-green-400" : "text-muted-foreground/40")}>
                              {group.totalNet > 0 ? f(group.totalNet) : "—"}
                            </div>
                          </td>
                          <td className="p-4 text-right text-sm">
                            {group.anapara > 0 ? (
                              <span className={group.amortizationPct >= 100 ? "text-emerald-400" : "text-orange-400"}>
                                {group.amortizationPct >= 100 ? "Tamamlandı!" : fInt(kalan)}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center gap-3 justify-end">
                              <div className="w-24 bg-white/5 rounded-full h-2">
                                <div
                                  className={cn("h-2 rounded-full transition-all duration-500", getBarColor(group.amortizationPct))}
                                  style={{ width: `${Math.min(100, group.amortizationPct)}%` }}
                                />
                              </div>
                              <span className={cn("text-sm font-bold min-w-[52px] text-right", getAmortColor(group.amortizationPct))}>
                                %{group.amortizationPct.toFixed(1)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            {group.stockId && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveStock(group.stockId!, group.stock); }}
                                className="text-muted-foreground/20 hover:text-red-400 transition p-1 rounded-lg hover:bg-white/5"
                                title="Hisseyi sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>

                        {isExpanded && group.payments.length > 0 && group.payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-white/[0.06] last:border-0 bg-white/[0.01]">
                            <td className="p-3 pl-12">
                              <div className="text-xs text-muted-foreground">{formatDate(payment.date)}</div>
                              {payment.note && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{payment.note}</div>}
                            </td>
                            <td className="p-3"></td>
                            <td className="p-3 text-right text-xs text-green-400/80">{f(payment.netAmount)}</td>
                            <td className="p-3"></td>
                            <td className="p-3"></td>
                            <td className="p-3 text-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemovePayment(payment.id); }}
                                className="text-muted-foreground/30 hover:text-red-400 transition p-1 rounded-lg hover:bg-white/5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {isExpanded && group.payments.length === 0 && (
                          <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                            <td colSpan={6} className="p-4 pl-12 text-xs text-muted-foreground/50">
                              Henüz temettü ödemesi eklenmedi. &quot;Temettü Ekle&quot; butonunu kullanarak bu hisseye ödeme ekleyin.
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {totalDividend > 0 && (
                    <tr className="bg-white/[0.03] font-bold border-t border-white/[0.08]">
                      <td className="p-4 text-sm">TOPLAM</td>
                      <td className="p-4 text-right text-sm">{fInt(totalAnapara)}</td>
                      <td className="p-4 text-right text-sm text-green-400">{f(totalDividend)}</td>
                      <td className="p-4 text-right text-sm text-orange-400">{fInt(Math.max(0, totalAnapara - totalDividend))}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center gap-3 justify-end">
                          <div className="w-24 bg-white/5 rounded-full h-2">
                            <div
                              className={cn("h-2 rounded-full transition-all duration-500", getBarColor(totalAmortPct))}
                              style={{ width: `${Math.min(100, totalAmortPct)}%` }}
                            />
                          </div>
                          <span className={cn("text-sm font-bold min-w-[52px] text-right", getAmortColor(totalAmortPct))}>
                            %{totalAmortPct.toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4"></td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <p className="text-muted-foreground text-sm">Henüz hisse eklenmedi.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">&quot;Hisse Ekle&quot; butonunu kullanarak takip etmek istediğiniz hisseleri ekleyin.</p>
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
