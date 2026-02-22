import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: any[] = [];

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
          const rawText = $(cols[0]).text().trim().toUpperCase();
          const symbolInTable = rawText.split(/\s+/)[0]; 
          if (requestedSymbols.includes(symbolInTable)) {
            let priceRaw = $(cols[1]).text().trim();
            const priceValue = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(priceValue)) {
              updates.push({ symbol: symbolInTable, price: priceValue, change: 0 });
            }
          }
        }
      });
    }
  } catch (e) { console.error("BIST hatası:", e); }

  // --- 2. DÖVİZ (USD/EUR - CNN TÜRK) ---
  try {
    const dovizRes = await fetch('https://finans.cnnturk.com/doviz', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (dovizRes.ok) {
      const html = await dovizRes.text();
      const $ = cheerio.load(html);
      
      const mapping: Record<string, string> = {
        'ABD DOLARI': 'USD',
        'EURO': 'EUR'
      };

      $('tr').each((_, element) => {
        const cols = $(element).find('td');
        if (cols.length >= 3) {
          const label = $(cols[0]).text().trim().toUpperCase();
          // Excel görüntüne göre ismi eşleştir (ABD DOLARI -> USD)
          const matchedSymbolKey = Object.keys(mapping).find(key => label.includes(key));
          
          if (matchedSymbolKey) {
            const finalSymbol = mapping[matchedSymbolKey];
            if (requestedSymbols.includes(finalSymbol)) {
              // Sütun 2: Satış Fiyatı (Excel görüntünle aynı)
              let priceRaw = $(cols[2]).text().trim();
              const priceValue = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'));
              if (!isNaN(priceValue)) {
                updates.push({ symbol: finalSymbol, price: priceValue, change: 0 });
                console.log(`[DÖVİZ] ${finalSymbol} Bulundu: ${priceValue} ₺`);
              }
            }
          }
        }
      });
    }
  } catch (e) { console.error("Döviz hatası:", e); }

  return NextResponse.json(updates);
}