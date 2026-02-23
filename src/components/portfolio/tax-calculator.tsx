"use client";

import { useState, useMemo, Fragment } from "react";
import {
  Calculator,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertCircle,
  Info,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StockHolding } from "@/lib/types";

// ═══════════════════════════════════════════════════════════════
// 2025 YILI VERGİ PARAMETRELERİ
// Kaynak: GVK Madde 103 — Gelir Vergisi Genel Tebliği (Seri No: 329)
// Resmi Gazete: 30.12.2024, Sayı: 32738 (2. Mükerrer)
// Ücret dışı gelirler (temettü = menkul sermaye iradı) tarifesi
// ═══════════════════════════════════════════════════════════════
const TAX_BRACKETS_2025 = [
  { limit: 158000, rate: 0.15 },
  { limit: 330000, rate: 0.20 },
  { limit: 800000, rate: 0.27 },
  { limit: 4300000, rate: 0.35 },
  { limit: Infinity, rate: 0.40 },
];

const EXEMPTION_RATE = 0.5;        // GVK Madde 22/2 — Brüt temettünün %50'si istisna
const WITHHOLDING_RATE = 0.15;     // GVK Geçici 67 — %15 stopaj
const DECLARATION_THRESHOLD = 330000; // 2025 yılı beyan sınırı (GVK Madde 86/1-c)

// Mevzuat bilgisi — UI'da gösterilecek
const TAX_LAW_INFO = {
  year: 2025,
  lawName: "Gelir Vergisi Genel Tebliği (Seri No: 329)",
  gazetteDate: "30.12.2024",
  gazetteNumber: "32738 (2. Mükerrer)",
  sourceUrl: "https://www.gib.gov.tr/node/157433",
  lastVerified: "2025-03-01",
};

interface DividendPayment {
  id: string;
  stock: string;
  netAmount: number;
  date: string;
  note: string;
}

interface GroupedStock {
  stock: string;
  payments: DividendPayment[];
  totalNet: number;
  totalGross: number;
  totalStopaj: number;
}

interface TaxCalculatorProps {
  holdings?: StockHolding[];
}

function calculateTax(matrah: number) {
  let remaining = matrah;
  let totalTax = 0;
  let prevLimit = 0;
  const breakdown: { bracket: string; amount: number; rate: number; tax: number }[] = [];

  for (const bracket of TAX_BRACKETS_2025) {
    if (remaining <= 0) break;
    const bracketSize = bracket.limit === Infinity ? remaining : bracket.limit - prevLimit;
    const taxableInBracket = Math.min(remaining, bracketSize);
    const taxForBracket = taxableInBracket * bracket.rate;

    breakdown.push({
      bracket:
        prevLimit === 0
          ? `0 - ${bracket.limit === Infinity ? "∞" : bracket.limit.toLocaleString("tr-TR")} TL`
          : `${prevLimit.toLocaleString("tr-TR")} - ${bracket.limit === Infinity ? "∞" : bracket.limit.toLocaleString("tr-TR")} TL`,
      amount: taxableInBracket,
      rate: bracket.rate,
      tax: taxForBracket,
    });

    totalTax += taxForBracket;
    remaining -= taxableInBracket;
    prevLimit = bracket.limit;
  }

  return { totalTax, breakdown };
}

function formatNum(val: string): string {
  const raw = val.replace(/[^0-9]/g, "");
  if (raw === "") return "";
  return parseInt(raw).toLocaleString("tr-TR");
}

function parseNum(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0;
}

export function TaxCalculator({ holdings = [] }: TaxCalculatorProps) {
  const [payments, setPayments] = useState<DividendPayment[]>([]);
  const [newStock, setNewStock] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newNote, setNewNote] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());

  // Portföydeki temettü hisselerinin sembolleri
  const portfolioSymbols = useMemo(() => {
    const dividendCategories = ["Temettü", "Temettü Sabit"];
    return holdings
      .filter((h) => dividendCategories.includes(h.category))
      .map((h) => h.symbol.toUpperCase());
  }, [holdings]);

  const addPayment = () => {
    const amount = parseNum(newAmount);
    if (!newStock.trim() || amount <= 0) return;
    const symbol = newStock.trim().toUpperCase();
    setPayments((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        stock: symbol,
        netAmount: amount,
        date: newDate || new Date().toISOString().split("T")[0],
        note: newNote.trim(),
      },
    ]);
    setNewStock("");
    setNewAmount("");
    setNewDate("");
    setNewNote("");
    setShowAddForm(false);
    setExpandedStocks((prev) => new Set(prev).add(symbol));
  };

  const removePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleExpand = (stock: string) => {
    setExpandedStocks((prev) => {
      const next = new Set(prev);
      if (next.has(stock)) next.delete(stock);
      else next.add(stock);
      return next;
    });
  };

  // Hisseleri grupla — portföydekiler temettü olmasa bile listelenir (0 ile)
  const grouped = useMemo((): GroupedStock[] => {
    const map = new Map<string, DividendPayment[]>();

    // Portföydeki tüm temettü hisselerini başlat (boş bile olsa)
    portfolioSymbols.forEach((sym) => {
      if (!map.has(sym)) map.set(sym, []);
    });

    // Ödemeleri ekle
    payments.forEach((p) => {
      if (!map.has(p.stock)) map.set(p.stock, []);
      map.get(p.stock)!.push(p);
    });

    return Array.from(map.entries())
      .map(([stock, pmts]) => {
        const totalNet = pmts.reduce((s, p) => s + p.netAmount, 0);
        const totalGross = totalNet > 0 ? totalNet / (1 - WITHHOLDING_RATE) : 0;
        return {
          stock,
          payments: pmts.sort((a, b) => a.date.localeCompare(b.date)),
          totalNet,
          totalGross,
          totalStopaj: totalGross * WITHHOLDING_RATE,
        };
      })
      .sort((a, b) => b.totalNet - a.totalNet);
  }, [payments, portfolioSymbols]);

  const totalNetDividend = useMemo(
    () => payments.reduce((sum, p) => sum + p.netAmount, 0),
    [payments]
  );
  const totalGrossDividend = useMemo(
    () => (totalNetDividend > 0 ? totalNetDividend / (1 - WITHHOLDING_RATE) : 0),
    [totalNetDividend]
  );

  const results = useMemo(() => {
    if (totalGrossDividend <= 0) return null;

    const gross = totalGrossDividend;
    const withholding = gross * WITHHOLDING_RATE;
    const matrah = gross * EXEMPTION_RATE;
    const needsDeclaration = matrah > DECLARATION_THRESHOLD;

    if (!needsDeclaration) {
      return {
        gross,
        withholding,
        matrah,
        needsDeclaration: false,
        totalTax: withholding,
        taxPayable: 0,
        refund: 0,
        breakdown: [],
        netDividend: gross - withholding,
        effectiveRate: (withholding / gross) * 100,
      };
    }

    const { totalTax, breakdown } = calculateTax(matrah);
    const taxPayable = totalTax - withholding;

    return {
      gross,
      withholding,
      matrah,
      needsDeclaration: true,
      totalTax,
      taxPayable: Math.max(0, taxPayable),
      refund: taxPayable < 0 ? Math.abs(taxPayable) : 0,
      breakdown,
      netDividend: gross - withholding - Math.max(0, taxPayable),
      effectiveRate: ((withholding + Math.max(0, taxPayable)) / gross) * 100,
    };
  }, [totalGrossDividend]);

  const f = (val: number) =>
    "₺" +
    val.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Temettü Vergi Beyannamesi</h2>
          <p className="text-sm text-muted-foreground">
            {TAX_LAW_INFO.year} Takvim Yılı Gelirleri
          </p>
        </div>
      </div>

      {/* Mevzuat Bilgi Kutusu */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-300/80 space-y-1.5">
          <p className="font-bold text-emerald-400 text-xs uppercase tracking-wider">
            Mevzuat Bilgisi — {TAX_LAW_INFO.year} Yılı
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <p>
              <span className="text-emerald-400/60">Dayanak:</span>{" "}
              {TAX_LAW_INFO.lawName}
            </p>
            <p>
              <span className="text-emerald-400/60">Resmi Gazete:</span>{" "}
              {TAX_LAW_INFO.gazetteDate} — Sayı: {TAX_LAW_INFO.gazetteNumber}
            </p>
            <p>
              <span className="text-emerald-400/60">Vergi Tarifesi:</span> GVK Madde 103
              (ücret dışı gelirler)
            </p>
            <p>
              <span className="text-emerald-400/60">Son Kontrol:</span>{" "}
              {new Date(TAX_LAW_INFO.lastVerified).toLocaleDateString("tr-TR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <p className="text-[10px] text-emerald-400/40 mt-1">
            Vergi dilimleri her yıl Resmi Gazete&apos;de yayımlanan Gelir Vergisi Genel
            Tebliği ile güncellenir. Yeni yıl tebliği yayımlandığında bu hesaplayıcının
            güncellenmesi gerekir.
          </p>
        </div>
      </div>

      {/* Vergi Parametreleri Özeti */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300/80 space-y-1">
          <p>
            <strong>İstisna Oranı:</strong> %50 (GVK Md. 22/2) ·{" "}
            <strong>Stopaj:</strong> %15 (GVK Geç. Md. 67) ·{" "}
            <strong>Beyan Sınırı:</strong> {DECLARATION_THRESHOLD.toLocaleString("tr-TR")} TL
            (GVK Md. 86/1-c)
          </p>
          <p>
            Portföyünüzdeki temettü hisseleri otomatik listelenir. Hisse bazında{" "}
            <strong>net ele geçen temettü</strong> tutarlarını girin. Aynı hisseye birden fazla
            ödeme ekleyebilirsiniz.
          </p>
        </div>
      </div>

      {/* Vergi Dilimleri Tablosu */}
      <div className="bg-card/20 border border-white/5 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            {TAX_LAW_INFO.year} Gelir Vergisi Tarifesi (Ücret Dışı Gelirler)
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-white/5">
              <th className="text-left p-3">Gelir Dilimi</th>
              <th className="text-right p-3">Vergi Oranı</th>
            </tr>
          </thead>
          <tbody>
            {TAX_BRACKETS_2025.map((bracket, i) => {
              const prev = i === 0 ? 0 : TAX_BRACKETS_2025[i - 1].limit;
              return (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="p-3 text-xs">
                    {bracket.limit === Infinity
                      ? `${prev.toLocaleString("tr-TR")} TL'den fazlası`
                      : `${prev === 0 ? "0" : prev.toLocaleString("tr-TR")} — ${bracket.limit.toLocaleString("tr-TR")} TL`}
                  </td>
                  <td className="p-3 text-xs text-right text-primary font-bold">
                    %{(bracket.rate * 100).toFixed(0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Portföy Tablosu */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Temettü Gelirleri</h2>
            {grouped.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {payments.length} ödeme · {grouped.length} hisse
              </Badge>
            )}
          </div>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-primary text-primary-foreground"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Temettü Ekle
          </Button>
        </div>

        {showAddForm && (
          <div className="bg-card/40 border border-white/10 rounded-xl p-4 mb-4 space-y-3 animate-in fade-in duration-300">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                  Hisse Adı
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    placeholder="THYAO"
                    autoFocus
                    list="stock-suggestions"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                    onKeyDown={(e) => e.key === "Enter" && addPayment()}
                  />
                  <datalist id="stock-suggestions">
                    {portfolioSymbols.map((sym) => (
                      <option key={sym} value={sym} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                  Net Temettü (₺)
                </label>
                <input
                  type="text"
                  value={newAmount}
                  onChange={(e) => setNewAmount(formatNum(e.target.value))}
                  placeholder="50.000"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                  onKeyDown={(e) => e.key === "Enter" && addPayment()}
                />
              </div>
              <div className="w-40">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                  Tarih
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition"
                />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                  Not (opsiyonel)
                </label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="1. ara temettü"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary transition"
                  onKeyDown={(e) => e.key === "Enter" && addPayment()}
                />
              </div>
              <Button onClick={addPayment} size="sm" className="shrink-0">
                Ekle
              </Button>
              <Button
                onClick={() => setShowAddForm(false)}
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
              >
                İptal
              </Button>
            </div>
          </div>
        )}

        <div className="bg-card/20 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-xs font-medium text-muted-foreground">
                  Varlık &amp; Kategori
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                  Ödeme Sayısı
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                  Net Temettü (₺)
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                  Brüt Temettü (₺)
                </th>
                <th className="text-right p-4 text-xs font-medium text-muted-foreground">
                  Stopaj (₺)
                </th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.length > 0 ? (
                <>
                  {grouped.map((group) => {
                    const isExpanded = expandedStocks.has(group.stock);
                    const pct =
                      totalNetDividend > 0
                        ? (group.totalNet / totalNetDividend) * 100
                        : 0;
                    const isFromPortfolio = portfolioSymbols.includes(group.stock);
                    return (
                      <Fragment key={group.stock}>
                        <tr
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => toggleExpand(group.stock)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                              <div>
                                <div className="font-bold text-sm">{group.stock}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] px-1.5 py-0",
                                      isFromPortfolio
                                        ? "border-primary/30 text-primary"
                                        : "border-white/20 text-muted-foreground"
                                    )}
                                  >
                                    {isFromPortfolio ? "Portföy" : "Manuel"}
                                  </Badge>
                                  {group.totalNet > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      %{pct.toFixed(1)} pay
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <Badge variant="outline" className="text-xs">
                              {group.payments.length}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <div
                              className={cn(
                                "font-bold text-sm",
                                group.totalNet > 0
                                  ? "text-green-400"
                                  : "text-muted-foreground/40"
                              )}
                            >
                              {group.totalNet > 0 ? f(group.totalNet) : "—"}
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium text-sm">
                            {group.totalGross > 0 ? f(group.totalGross) : "—"}
                          </td>
                          <td className="p-4 text-right text-sm text-orange-400">
                            {group.totalStopaj > 0 ? f(group.totalStopaj) : "—"}
                          </td>
                          <td className="p-4"></td>
                        </tr>

                        {isExpanded && group.payments.length > 0 &&
                          group.payments.map((payment) => {
                            const pgross = payment.netAmount / (1 - WITHHOLDING_RATE);
                            const pstopaj = pgross * WITHHOLDING_RATE;
                            return (
                              <tr
                                key={payment.id}
                                className="border-b border-white/5 last:border-0 bg-white/[0.01]"
                              >
                                <td className="p-3 pl-12">
                                  <div className="text-xs text-muted-foreground">
                                    {formatDate(payment.date)}
                                  </div>
                                  {payment.note && (
                                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                      {payment.note}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3"></td>
                                <td className="p-3 text-right text-xs text-green-400/80">
                                  {f(payment.netAmount)}
                                </td>
                                <td className="p-3 text-right text-xs text-muted-foreground">
                                  {f(pgross)}
                                </td>
                                <td className="p-3 text-right text-xs text-orange-400/60">
                                  {f(pstopaj)}
                                </td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removePayment(payment.id);
                                    }}
                                    className="text-muted-foreground/30 hover:text-red-400 transition p-1 rounded-lg hover:bg-white/5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}

                        {isExpanded && group.payments.length === 0 && (
                          <tr className="border-b border-white/5 bg-white/[0.01]">
                            <td
                              colSpan={6}
                              className="p-4 pl-12 text-xs text-muted-foreground/50"
                            >
                              Henüz temettü ödemesi eklenmedi. &quot;Temettü Ekle&quot; butonunu
                              kullanarak bu hisseye ödeme ekleyin.
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}

                  {totalNetDividend > 0 && (
                    <tr className="bg-white/[0.03] font-bold border-t border-white/10">
                      <td className="p-4 text-sm" colSpan={2}>
                        TOPLAM
                      </td>
                      <td className="p-4 text-right text-sm text-green-400">
                        {f(totalNetDividend)}
                      </td>
                      <td className="p-4 text-right text-sm">{f(totalGrossDividend)}</td>
                      <td className="p-4 text-right text-sm text-orange-400">
                        {f(totalGrossDividend * WITHHOLDING_RATE)}
                      </td>
                      <td className="p-4"></td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <p className="text-muted-foreground text-sm">
                      Henüz temettü geliri eklenmedi.
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Portföyünüze temettü hissesi ekleyin veya &quot;Temettü Ekle&quot; butonunu
                      kullanın.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vergi Hesaplama Sonuçları */}
      {results && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card/30 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Toplam Brüt Temettü</p>
              <p className="text-xl font-bold">{f(results.gross)}</p>
            </div>
            <div className="bg-card/30 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Kesilen Stopaj (%15)</p>
              <p className="text-xl font-bold text-orange-400">{f(results.withholding)}</p>
            </div>
            <div className="bg-card/30 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Vergiye Tabi Matrah (%50)</p>
              <p className="text-xl font-bold">{f(results.matrah)}</p>
            </div>
            <div className="bg-card/30 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Efektif Vergi Oranı</p>
              <p className="text-xl font-bold text-primary">
                %{results.effectiveRate.toFixed(2)}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "rounded-xl p-5 border flex items-start gap-3",
              results.needsDeclaration
                ? "bg-yellow-500/5 border-yellow-500/20"
                : "bg-green-500/5 border-green-500/20"
            )}
          >
            <AlertCircle
              className={cn(
                "w-5 h-5 shrink-0 mt-0.5",
                results.needsDeclaration ? "text-yellow-400" : "text-green-400"
              )}
            />
            <div>
              <p
                className={cn(
                  "font-bold",
                  results.needsDeclaration ? "text-yellow-400" : "text-green-400"
                )}
              >
                {results.needsDeclaration
                  ? "BEYANNAME VERİLMESİ ZORUNLU"
                  : "BEYANNAME VERİLMESİNE GEREK YOK"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {results.needsDeclaration
                  ? `Matrah (${f(results.matrah)}) beyan sınırını (₺${DECLARATION_THRESHOLD.toLocaleString("tr-TR")}) aşıyor.`
                  : `Matrah (${f(results.matrah)}) beyan sınırının (₺${DECLARATION_THRESHOLD.toLocaleString("tr-TR")}) altında. Stopaj nihai vergidir.`}
              </p>
            </div>
          </div>

          {results.needsDeclaration && results.breakdown.length > 0 && (
            <div className="bg-card/20 border border-white/5 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h3 className="font-bold flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" /> Vergi Dilimi Detayları
                </h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-white/5">
                    <th className="text-left p-4">Dilim</th>
                    <th className="text-right p-4">Tutar</th>
                    <th className="text-right p-4">Oran</th>
                    <th className="text-right p-4">Vergi</th>
                  </tr>
                </thead>
                <tbody>
                  {results.breakdown.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      <td className="p-4 text-sm">{row.bracket}</td>
                      <td className="p-4 text-sm text-right">{f(row.amount)}</td>
                      <td className="p-4 text-sm text-right text-primary">
                        %{(row.rate * 100).toFixed(0)}
                      </td>
                      <td className="p-4 text-sm text-right font-medium">{f(row.tax)}</td>
                    </tr>
                  ))}
                  <tr className="bg-white/5 font-bold">
                    <td className="p-4 text-sm" colSpan={3}>
                      Toplam Hesaplanan Vergi
                    </td>
                    <td className="p-4 text-sm text-right">{f(results.totalTax)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {results.needsDeclaration && (
            <div className="bg-card/30 border border-white/10 rounded-xl p-5 space-y-3">
              <h3 className="font-bold">Mahsup Hesabı</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hesaplanan Gelir Vergisi</span>
                <span>{f(results.totalTax)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">(-) Kesilen Stopaj</span>
                <span className="text-orange-400">- {f(results.withholding)}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between">
                <span className="font-bold">
                  {results.refund > 0 ? "Vergi İadesi" : "Ödenecek Vergi"}
                </span>
                <span
                  className={cn(
                    "text-xl font-bold flex items-center gap-2",
                    results.refund > 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {results.refund > 0 ? (
                    <>
                      <ArrowDownCircle className="w-5 h-5" /> {f(results.refund)}
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-5 h-5" /> {f(results.taxPayable)}
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Vergi Sonrası Net Temettü</p>
            <p className="text-3xl font-black text-primary">{f(results.netDividend)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Toplam brüt {f(results.gross)} üzerinden
            </p>
          </div>
        </div>
      )}

      {/* Alt Bilgi */}
      <div className="text-[10px] text-muted-foreground/40 text-center pt-4 border-t border-white/5 space-y-1">
        <p>
          Bu hesaplayıcı yalnızca bilgilendirme amaçlıdır, mali müşavirlik veya vergi danışmanlığı
          hizmeti yerine geçmez.
        </p>
        <p>
          Dayanak: {TAX_LAW_INFO.lawName} · R.G. {TAX_LAW_INFO.gazetteDate} (Sayı:{" "}
          {TAX_LAW_INFO.gazetteNumber})
        </p>
      </div>
    </div>
  );
}
