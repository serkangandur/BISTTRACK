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
    const [dovizRes, bistRes, altinRes] = await Promise.all([
      fetch(`https://finans.cnnturk.com/doviz?t=${Date.now()}`, { headers, cache: 'no-store' }),
      fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?t=${Date.now()}`, { headers, cache: 'no-store' }),
      fetch(`https://finans.cnnturk.com/altin?t=${Date.now()}`, { headers, cache: 'no-store' })
    ]);

    // 1. ALTIN (GA) & GÜMÜŞ (GG) - Hedef: 7165,09 ve 118,46
    if (altinRes.ok) {
      const $ = cheerio.load(await altinRes.text());
      const emtiaMap: any = { 'GRAM ALTIN': 'GA', 'GÜMÜŞ GRAM (TL)': 'GG' };
      $('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 2) {
          const rowName = $(tds[0]).text().trim().toUpperCase();
          const matchedKey = Object.keys(emtiaMap).find(k => rowName.includes(k));
          if (matchedKey) {
            const sym = emtiaMap[matchedKey];
            if (requestedSymbols.includes(sym)) {
              // Görseldeki 2. sütun (Alış): 7165,09 ve 118,46
              const val = parseFloat($(tds[1]).text().trim().replace(/\./g, '').replace(',', '.'));
              if (!isNaN(val)) {
                updates.push({ symbol: sym, price: val, change: 0 });
              }
            }
          }
        }
      });
    }

    // 2. DÖVİZ (USD & EUR) - Hedef: 51,68
    if (dovizRes.ok) {
      const $d = cheerio.load(await dovizRes.text());
      const dovizMap: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
      $d('tr').each((_, el) => {
        const tds = $d(el).find('td');
        if (tds.length >= 2) {
          const rowName = $d(tds[0]).text().trim().toUpperCase();
          const matchedKey = Object.keys(dovizMap).find(k => rowName.includes(k));
          if (matchedKey) {
            const sym = dovizMap[matchedKey];
            if (requestedSymbols.includes(sym)) {
              // 51,68'i yakalamak için tüm hücrelere bak
              let bestPrice = 0;
              tds.each((i, td) => {
                const n = parseFloat($d(td).text().trim().replace(/\./g, '').replace(',', '.'));
                if (n > 30 && n < 100) {
                  bestPrice = n;
                }
              });
              if (bestPrice > 0) {
                updates.push({ symbol: sym, price: bestPrice, change: 0 });
              }
            }
          }
        }
      });
    }

    // 3. BIST (PAGYO vb.)
    if (bistRes.ok) {
      const $b = cheerio.load(await bistRes.text());
      $b('tr').each((_, el) => {
        const tds = $b(el).find('td');
        if (tds.length >= 2) {
          const rawSym = $b(tds[0]).text().trim().split(/\s+/)[0].toUpperCase();
          if (requestedSymbols.includes(rawSym) && !['USD','EUR','GA','GG'].includes(rawSym)) {
            const price = parseFloat($b(tds[1]).text().trim().replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price)) {
              updates.push({ symbol: rawSym, price, change: 0 });
            }
          }
        }
      });
    }
  } catch (error) {
    console.error(error);
  }
  return NextResponse.json(updates);
}
