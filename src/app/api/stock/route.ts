import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: any[] = [];
  
  const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' 
  };

  try {
    // --- 1. DÖVİZ TARAMA (EURO 51,68 HEDEFİ) ---
    const dovizRes = await fetch(`https://finans.cnnturk.com/doviz?t=${Date.now()}`, { headers, cache: 'no-store' });
    if (dovizRes.ok) {
      const html = await dovizRes.text();
      const $ = cheerio.load(html);
      const mapping: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };

      $('tr').each((_, el) => {
        const rowText = $(el).text().toUpperCase();
        const matchedKey = Object.keys(mapping).find(key => rowText.includes(key));
        
        if (matchedKey) {
          const sym = mapping[matchedKey];
          if (requestedSymbols.includes(sym)) {
            // Satırdaki tüm hücreleri tara, hangisi 30 ile 100 arasındaysa o fiyattır
            $(el).find('td').each((__, td) => {
              const val = $(td).text().trim().replace(/\./g, '').replace(',', '.');
              const num = parseFloat(val);
              // Akıllı Filtre: 30'dan büyükse bu gerçek kurdur (24,94 gibi değişimleri eler)
              if (!isNaN(num) && num > 30 && num < 100) {
                updates.push({ symbol: sym, price: num, change: 0 });
                console.log(`[DÖVİZ AKILLI] ${sym} Yakalandı: ${num} ₺`);
                return false; 
              }
            });
          }
        }
      });
    }

    // --- 2. BIST TARAMA (HİSSELER: PAGYO, TUPRS vb.) ---
    const bistRes = await fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?t=${Date.now()}`, { headers, cache: 'no-store' });
    if (bistRes.ok) {
      const html = await bistRes.text();
      const $ = cheerio.load(html);
      $('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 2) {
          const rawSymbolText = $(tds[0]).text().trim().toUpperCase();
          const firstWord = rawSymbolText.split(/\s+/)[0];
          
          if (requestedSymbols.includes(firstWord) && firstWord !== 'USD' && firstWord !== 'EUR') {
            const price = parseFloat($(tds[1]).text().trim().replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price)) {
              updates.push({ symbol: firstWord, price: price, change: 0 });
            }
          }
        }
      });
    }
  } catch (e: any) {
    console.error("Hata:", e.message);
  }

  return NextResponse.json(updates);
}
