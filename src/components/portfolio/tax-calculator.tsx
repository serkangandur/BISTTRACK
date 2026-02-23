"use client";

import { useState, useMemo } from "react";
import { Calculator, FileText, ArrowDownCircle, ArrowUpCircle, AlertCircle, Info, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TAX_BRACKETS_2025 = [
  { limit: 158000, rate: 0.15 },
  { limit: 380000, rate: 0.20 },
  { limit: 900000, rate: 0.27 },
  { limit: 4300000, rate: 0.35 },
  { limit: Infinity, rate: 0.40 },
];

const EXEMPTION_RATE = 0.50;
const WITHHOLDING_RATE = 0.15;
const DECLARATION_THRESHOLD = 230000;

interface DividendEntry {
  id: string;
  stock: string;
  netAmount: number;
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
      bracket: prevLimit === 0
        ? `0 - ${bracket.limit === Infinity ? '∞' : bracket.limit.toLocaleString('tr-TR')} TL`
        : `${prevLimit.toLocaleString('tr-TR')} - ${bracket.limit === Infinity ? '∞' : bracket.limit.toLocaleString('tr-TR')} TL`,
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
  const raw = val.replace(/[^0-9]/g, '');
  if (raw === '') return '';
  return parseInt(raw).toLocaleString('tr-TR');
}

function parseNum(val: string): number {
  return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
}

export function TaxCalculator() {
  const [entries, setEntries] = useState<DividendEntry[]>([]);
  const [newStock, setNewStock] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const addEntry = () => {
    const amount = parseNum(newAmount);
    if (!newStock.trim() || amount <= 0) return;
    setEntries(prev => [...prev, {
      id: Date.now().toString(),
      stock: newStock.trim().toUpperCase(),
      netAmount: amount,
    }]);
    setNewStock("");
    setNewAmount("");
  };

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const totalNetDividend = useMemo(() => entries.reduce((sum, e) => sum + e.netAmount, 0), [entries]);
  const totalGrossDividend = useMemo(() => totalNetDividend / (1 - WITHHOLDING_RATE), [totalNetDividend]);

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

  const formatCurrency = (val: number) =>
    val.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Temettü Vergi Beyannamesi</h2>
          <p className="text-sm text-muted-foreground">2025-2026 Vergi Dilimleri</p>
        </div>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300/80 space-y-1">
          <p><strong>İstisna Oranı:</strong> %50 — Brüt temettünün yarısı vergiden muaftır.</p>
          <p><strong>Stopaj Oranı:</strong> %15 — Şirket ödeme anında keser.</p>
          <p><strong>Beyan Sınırı:</strong> 230.000 TL — Matrah bu tutarı aşarsa beyanname zorunludur.</p>
          <p><strong>Not:</strong> Aşağıya hisse bazında net ele geçen temettü tutarlarını girin. Brüt çevirme otomatik yapılır.</p>
        </div>
      </div>

      <div className="bg-card/30 border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Temettü Gelirleri
          </h3>
          {entries.length > 0 && (
            <span className="text-xs text-muted-foreground">{entries.length} hisse</span>
          )}
        </div>

        <div className="p-4 border-b border-white/5 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">Hisse Adı</label>
            <input
              type="text"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder="THYAO"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary"
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">Net Temettü (₺)</label>
            <input
              type="text"
              value={newAmount}
              onChange={(e) => setNewAmount(formatNum(e.target.value))}
              placeholder="50.000"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary"
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            />
          </div>
          <button
            onClick={addEntry}
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:opacity-90 transition flex items-center gap-1 text-sm font-medium shrink-0"
          >
            <Plus className="w-4 h-4" /> Ekle
          </button>
        </div>

        {entries.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-white/5">
                <th className="text-left p-3">Hisse</th>
                <th className="text-right p-3">Net Temettü</th>
                <th className="text-right p-3">Brüt Temettü</th>
                <th className="text-right p-3">Stopaj</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const gross = entry.netAmount / (1 - WITHHOLDING_RATE);
                const stopaj = gross * WITHHOLDING_RATE;
                return (
                  <tr key={entry.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="p-3 text-sm font-medium">{entry.stock}</td>
                    <td className="p-3 text-sm text-right text-green-400">₺{formatCurrency(entry.netAmount)}</td>
                    <td className="p-3 text-sm text-right">₺{formatCurrency(gross)}</td>
                    <td className="p-3 text-sm text-right text-orange-400">₺{formatCurrency(stopaj)}</td>
                    <td className="p-3">
                      <button onClick={() => removeEntry(entry.id)} className="text-red-400/60 hover:text-red-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-white/5 font-bold">
                <td className="p-3 text-sm">TOPLAM</td>
                <td className="p-3 text-sm text-right text-green-400">₺{formatCurrency(totalNetDividend)}</td>
                <td className="p-3 text-sm text-right">₺{formatCurrency(totalGrossDividend)}</td>
                <td className="p-3 text-sm text-right text-orange-400">₺{formatCurrency(totalGrossDividend * WITHHOLDING_RATE)}</td>
                <td className="p-3"></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Henüz temettü geliri eklenmedi. Yukarıdan hisse ve net temettü tutarını girin.
          </div>
        )}
      </div>

      {results && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card/30 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Toplam Brüt Temettü</p>
              <p className="text-xl font-bold">₺{formatCurrency(results.gross)}</p>
            </div>
            <div className="bg-card/30 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Kesilen Stopaj (%15)</p>
              <p className="text-xl font-bold text-orange-400">₺{formatCurrency(results.withholding)}</p>
            </div>
            <div className="bg-card/30 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Vergiye Tabi Matrah (%50)</p>
              <p className="text-xl font-bold">₺{formatCurrency(results.matrah)}</p>
            </div>
            <div className="bg-card/30 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">Efektif Vergi Oranı</p>
              <p className="text-xl font-bold text-primary">%{results.effectiveRate.toFixed(2)}</p>
            </div>
          </div>

          <div className={cn(
            "rounded-xl p-5 border flex items-start gap-3",
            results.needsDeclaration
              ? "bg-yellow-500/5 border-yellow-500/20"
              : "bg-green-500/5 border-green-500/20"
          )}>
            <AlertCircle className={cn(
              "w-5 h-5 shrink-0 mt-0.5",
              results.needsDeclaration ? "text-yellow-400" : "text-green-400"
            )} />
            <div>
              <p className={cn(
                "font-bold",
                results.needsDeclaration ? "text-yellow-400" : "text-green-400"
              )}>
                {results.needsDeclaration
                  ? "BEYANNAME VERİLMESİ ZORUNLU"
                  : "BEYANNAME VERİLMESİNE GEREK YOK"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {results.needsDeclaration
                  ? `Matrah (₺${formatCurrency(results.matrah)}) beyan sınırını (₺230.000) aşıyor.`
                  : `Matrah (₺${formatCurrency(results.matrah)}) beyan sınırının (₺230.000) altında. Stopaj nihai vergidir.`}
              </p>
            </div>
          </div>

          {results.needsDeclaration && results.breakdown.length > 0 && (
            <div className="bg-card/30 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-bold flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  Vergi Dilimi Detayları
                </h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-white/5">
                    <th className="text-left p-3">Dilim</th>
                    <th className="text-right p-3">Tutar</th>
                    <th className="text-right p-3">Oran</th>
                    <th className="text-right p-3">Vergi</th>
                  </tr>
                </thead>
                <tbody>
                  {results.breakdown.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      <td className="p-3 text-sm">{row.bracket}</td>
                      <td className="p-3 text-sm text-right">₺{formatCurrency(row.amount)}</td>
                      <td className="p-3 text-sm text-right text-primary">%{(row.rate * 100).toFixed(0)}</td>
                      <td className="p-3 text-sm text-right font-medium">₺{formatCurrency(row.tax)}</td>
                    </tr>
                  ))}
                  <tr className="bg-white/5 font-bold">
                    <td className="p-3 text-sm" colSpan={3}>Toplam Hesaplanan Vergi</td>
                    <td className="p-3 text-sm text-right">₺{formatCurrency(results.totalTax)}</td>
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
                <span>₺{formatCurrency(results.totalTax)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">(-) Kesilen Stopaj</span>
                <span className="text-orange-400">- ₺{formatCurrency(results.withholding)}</span>
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between">
                <span className="font-bold">
                  {results.refund > 0 ? "Vergi İadesi" : "Ödenecek Vergi"}
                </span>
                <span className={cn(
                  "text-xl font-bold flex items-center gap-2",
                  results.refund > 0 ? "text-green-400" : "text-red-400"
                )}>
                  {results.refund > 0 ? (
                    <><ArrowDownCircle className="w-5 h-5" /> ₺{formatCurrency(results.refund)}</>
                  ) : (
                    <><ArrowUpCircle className="w-5 h-5" /> ₺{formatCurrency(results.taxPayable)}</>
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Vergi Sonrası Net Temettü</p>
            <p className="text-3xl font-black text-primary">₺{formatCurrency(results.netDividend)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Toplam brüt ₺{formatCurrency(results.gross)} üzerinden
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
