"use client";

import { useState, useMemo } from "react";
import { HandCoins, Info, Loader2, Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StockHolding, DividendRecord } from "@/lib/types";

interface ReceivedDividendAnalysisProps {
  holdings: StockHolding[];
  dividendMap: Record<string, DividendRecord>;
  onSaveDividend: (symbol: string, net: number, year: number) => Promise<void>;
  isSaving?: boolean;
}

export function ReceivedDividendAnalysis({
  holdings,
  dividendMap,
  onSaveDividend,
  isSaving = false,
}: ReceivedDividendAnalysisProps) {
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Temettü kategorisindeki hisseler
  const dividendStocks = useMemo(() => {
    return holdings
      .filter((h) => h.category === "Temettü")
      .map((h) => {
        const symbol = h.symbol.toUpperCase();
        const hbt = dividendMap[symbol]?.netDividendPerShare || 0;
        const lot = h.quantity;
        const yillik = hbt * lot;
        const aylik = yillik / 12;
        return { symbol, hbt, lot, yillik, aylik, holding: h };
      })
      .sort((a, b) => b.yillik - a.yillik);
  }, [holdings, dividendMap]);

  const totals = useMemo(() => {
    return dividendStocks.reduce(
      (acc, s) => ({
        lot: acc.lot + s.lot,
        yillik: acc.yillik + s.yillik,
        aylik: acc.aylik + s.aylik,
      }),
      { lot: 0, yillik: 0, aylik: 0 }
    );
  }, [dividendStocks]);

  const handleStartEdit = (symbol: string, currentHbt: number) => {
    setEditingSymbol(symbol);
    setEditValue(currentHbt > 0 ? currentHbt.toString().replace(".", ",") : "");
  };

  const handleSaveHbt = async (symbol: string) => {
    const value = parseFloat(editValue.replace(",", "."));
    if (isNaN(value) || value < 0) return;
    const year = new Date().getFullYear();
    await onSaveDividend(symbol, value, year);
    setEditingSymbol(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, symbol: string) => {
    if (e.key === "Enter") handleSaveHbt(symbol);
    if (e.key === "Escape") {
      setEditingSymbol(null);
      setEditValue("");
    }
  };

  const f = (val: number) =>
    "₺" +
    val.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="space-y-8">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <HandCoins className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Alınan Temettü</h2>
          <p className="text-sm text-muted-foreground">
            Hisse başına temettü ve toplam gelir hesaplaması
          </p>
        </div>
      </div>

      {/* Bilgi Kutusu */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300/80 space-y-1">
          <p>
            <strong>HBT (Hisse Başına Temettü)</strong> sütunundaki kalem ikonuna
            tıklayarak her hisse için net temettü tutarını girin.
          </p>
          <p>
            LOT sayıları Temettü Portföyünüzden otomatik alınır. Yıllık ve aylık
            temettü geliriniz otomatik hesaplanır.
          </p>
        </div>
      </div>

      {/* Özet Kartları */}
      {totals.yillik > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card/30 border border-white/[0.08] rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">Toplam LOT</p>
            <p className="text-xl font-bold">
              {totals.lot.toLocaleString("tr-TR")}
            </p>
          </div>
          <div className="bg-card/30 border border-white/[0.08] rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">
              Yıllık Temettü Geliri
            </p>
            <p className="text-xl font-bold text-green-400">{f(totals.yillik)}</p>
          </div>
          <div className="bg-card/30 border border-white/[0.08] rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">
              Aylık Temettü Geliri
            </p>
            <p className="text-xl font-bold text-emerald-400">
              {f(totals.aylik)}
            </p>
          </div>
        </div>
      )}

      {/* Tablo */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold">Hisse Detayları</h2>
          {dividendStocks.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {dividendStocks.length} hisse
            </Badge>
          )}
        </div>

        <div className="bg-card/20 border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground">
                  Hisse
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                  HBT (₺)
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                  LOT
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                  Yıllık Temettü (₺)
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                  Aylık Temettü (₺)
                </th>
              </tr>
            </thead>
            <tbody>
              {dividendStocks.length > 0 ? (
                <>
                  {dividendStocks.map((stock) => {
                    const isEditing = editingSymbol === stock.symbol;
                    return (
                      <tr
                        key={stock.symbol}
                        className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-bold text-sm">{stock.symbol}</div>
                        </td>
                        <td className="p-4 text-right">
                          {isEditing ? (
                            <div
                              className="flex items-center gap-1 justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-24 bg-white/[0.04] border border-primary/50 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-primary transition"
                                autoFocus
                                placeholder="0,00"
                                onKeyDown={(e) => handleKeyDown(e, stock.symbol)}
                              />
                              <button
                                onClick={() => handleSaveHbt(stock.symbol)}
                                disabled={isSaving}
                                className="text-green-400 hover:text-green-300 p-1 rounded hover:bg-white/5 transition"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 justify-end">
                              <span
                                className={cn(
                                  "font-medium text-sm",
                                  stock.hbt > 0
                                    ? "text-white"
                                    : "text-muted-foreground/40"
                                )}
                              >
                                {stock.hbt > 0
                                  ? `₺${stock.hbt.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`
                                  : "—"}
                              </span>
                              <button
                                onClick={() =>
                                  handleStartEdit(stock.symbol, stock.hbt)
                                }
                                className="text-muted-foreground/30 hover:text-primary p-1 rounded hover:bg-white/5 transition"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right font-medium text-sm text-muted-foreground">
                          {stock.lot.toLocaleString("tr-TR")}
                        </td>
                        <td className="p-4 text-right">
                          <span
                            className={cn(
                              "font-bold text-sm",
                              stock.yillik > 0
                                ? "text-green-400"
                                : "text-muted-foreground/40"
                            )}
                          >
                            {stock.yillik > 0 ? f(stock.yillik) : "—"}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span
                            className={cn(
                              "font-bold text-sm",
                              stock.aylik > 0
                                ? "text-emerald-400"
                                : "text-muted-foreground/40"
                            )}
                          >
                            {stock.aylik > 0 ? f(stock.aylik) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Toplam Satırı */}
                  {totals.yillik > 0 && (
                    <tr className="bg-white/[0.03] font-bold border-t border-white/[0.08]">
                      <td className="p-4 text-sm">TOPLAM</td>
                      <td className="p-4"></td>
                      <td className="p-4 text-right text-sm text-muted-foreground">
                        {totals.lot.toLocaleString("tr-TR")}
                      </td>
                      <td className="p-4 text-right text-sm text-green-400">
                        {f(totals.yillik)}
                      </td>
                      <td className="p-4 text-right text-sm text-emerald-400">
                        {f(totals.aylik)}
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <p className="text-muted-foreground text-sm">
                      Temettü portföyünüzde hisse bulunmuyor.
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Temettü kategorisine hisse ekleyin.
                    </p>
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
