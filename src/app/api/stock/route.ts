import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: any[] = [];
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' };

  try {
    // 3 FARKLI KAYNAĞI AYNI ANDA ÇEKİYORUZ
    const [dovizRes, bistRes, altinRes] = await Promise.all([
      fetch(`https://finans.cnnturk.com/doviz?t=${Date.now()}`, { headers, cache: 'no-store' }),
      fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?t=${Date.now()}`, { headers, cache: 'no-store' }),
      fetch(`https://finans.cnnturk.com/altin?t=${Date.now()}`, { headers, cache: 'no-store' })
    ]);

    // --- 1. DÖVİZ İŞLEME (USD, EUR) ---
    if (dovizRes.ok) {
      const $ = cheerio.load(await dovizRes.text());
      const mapping: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
      $('tr').each((_, el) => {
        const text = $(el).text().toUpperCase();
        const matchedKey = Object.keys(mapping).find(k => text.includes(k));
        if (matchedKey) {
          const sym = mapping[matchedKey];
          if (requestedSymbols.includes(sym)) {
            $(el).find('td').each((__, td) => {
              const val = parseFloat($(td).text().trim().replace(/\./g, '').replace(',', '.'));
              if (val > 30 && val < 100) { updates.push({ symbol: sym, price: val, change: 0 }); return false; }
            });
          }
        }
      });
    }

    // --- 2. ALTIN VE GÜMÜŞ İŞLEME (GA, GG) ---
    if (altinRes.ok) {
      const $ = cheerio.load(await altinRes.text());
      const emtiaMapping: any = { 'GRAM ALTIN': 'GA', 'GÜMÜŞ': 'GG' };
      
      $('tr').each((_, el) => {
        const text = $(el).text().toUpperCase();
        const matchedKey = Object.keys(emtiaMapping).find(k => text.includes(k));
        
        if (matchedKey) {
          const sym = emtiaMapping[matchedKey];
          if (requestedSymbols.includes(sym) || requestedSymbols.includes(matchedKey.split(' ')[0])) {
            $(el).find('td').each((i, td) => {
              const val = parseFloat($(td).text().trim().replace(/\./g, '').replace(',', '.'));
              if (val > 25) { 
                updates.push({ symbol: sym, price: val, change: 0 }); 
                return false; 
              }
            });
          }
        }
      });
    }

    // --- 3. BIST HİSSE İŞLEME (PAGYO vb.) ---
    if (bistRes.ok) {
      const $ = cheerio.load(await bistRes.text());
      $('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 2) {
          const rawSymbol = $(tds[0]).text().trim().toUpperCase();
          const foundSymbol = requestedSymbols.find(s => rawSymbol.includes(s));
          if (foundSymbol && !['USD','EUR','GA','GG'].includes(foundSymbol)) {
            const price = parseFloat($(tds[1]).text().trim().replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price)) updates.push({ symbol: foundSymbol, price, change: 0 });
          }
        }
      });
    }

  } catch (e) {
    console.error("Hata:", e);
  }

  return NextResponse.json(updates);
}