import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: any[] = [];

  console.log("--- [API TARAMA BAŞLADI] ---");

  // --- 1. BIST HİSSELERE (CNN TÜRK) ---
  try {
    const bistRes = await fetch('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (bistRes.ok) {
      const html = await bistRes.text();
      const $ = cheerio.load(html);
      $('tr').each((_, element) => {
        const cols = $(element).find('td');
        if (cols.length >= 2) {
          // Sütun 0: Sembol (PAGYO, TUPRS vb.)
          const rawText = $(cols[0]).text().trim().toUpperCase();
          const symbolInTable = rawText.split(/\s+/)[0]; 
          
          if (requestedSymbols.includes(symbolInTable)) {
            // Sütun 1: Son Fiyat
            let priceRaw = $(cols[1]).text().trim();
            const priceValue = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(priceValue)) {
              updates.push({ symbol: symbolInTable, price: priceValue, change: 0 });
              console.log(`[BIST] ${symbolInTable} Bulundu: ${priceValue}`);
            }
          }
        }
      });
    }
  } catch (e) { console.error("BIST Hatası:", e); }

  // --- 2. DÖVİZ (USD/EUR - CNN TÜRK) ---
  try {
    const dovizRes = await fetch('https://finans.cnnturk.com/doviz', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (dovizRes.ok) {
      const html = await dovizRes.text();
      const $ = cheerio.load(html);
      const mapping: Record<string, string> = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };

      $('tr').each((_, element) => {
        const cols = $(element).find('td');
        if (cols.length >= 3) {
          const label = $(cols[0]).text().trim().toUpperCase();
          const matchedKey = Object.keys(mapping).find(key => label === key);
          
          if (matchedKey) {
            const finalSymbol = mapping[matchedKey];
            if (requestedSymbols.includes(finalSymbol)) {
              // Sütun 2: Satış Fiyatı (Hatalı 0.874 değerini önlemek için cols[2] sabitlendi)
              let priceRaw = $(cols[2]).text().trim();
              const priceValue = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'));
              if (!isNaN(priceValue)) {
                updates.push({ symbol: finalSymbol, price: priceValue, change: 0 });
                console.log(`[DÖVİZ] ${finalSymbol} Bulundu: ${priceValue}`);
              }
            }
          }
        }
      });
    }
  } catch (e) { console.error("Döviz Hatası:", e); }

  console.log(`--- [TARAMA BİTTİ] Toplam ${updates.length} veri bulundu. ---`);
  return NextResponse.json(updates);
}
