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
    // 3 ANA KAYNAĞI ÇEKİYORUZ
    const [dovizRes, bistRes, altinRes] = await Promise.all([
      fetch(`https://finans.cnnturk.com/doviz?t=${Date.now()}`, { headers, cache: 'no-store' }),
      fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?t=${Date.now()}`, { headers, cache: 'no-store' }),
      fetch(`https://finans.cnnturk.com/altin?t=${Date.now()}`, { headers, cache: 'no-store' })
    ]);

    // --- 1. ALTIN VE GÜMÜŞ (7165,09 ve 118,46 HEDEFİ) ---
    if (altinRes.ok) {
      const $ = cheerio.load(await altinRes.text());
      const emtiaMap: any = { 'GRAM ALTIN': 'GA', 'GÜMÜŞ': 'GG' };

      $('tr').each((_, el) => {
        const rowText = $(el).text().toUpperCase();
        const matchedKey = Object.keys(emtiaMap).find(k => rowText.includes(k));
        
        if (matchedKey) {
          const sym = emtiaMap[matchedKey];
          if (requestedSymbols.includes(sym)) {
            let candidates: number[] = [];
            $(el).find('td').each((__, td) => {
              const val = parseFloat($(td).text().trim().replace(/\./g, '').replace(',', '.'));
              if (!isNaN(val) && val > 10) candidates.push(val);
            });
            // Satırdaki EN YÜKSEK rakamı al (Genelde Satış fiyatı budur: 7165 veya 118)
            if (candidates.length > 0) {
              const bestPrice = Math.max(...candidates);
              updates.push({ symbol: sym, price: bestPrice, change: 0 });
            }
          }
        }
      });
    }

    // --- 2. DÖVİZ (USD/EUR - 51,68 HEDEFİ) ---
    if (dovizRes.ok) {
      const $d = cheerio.load(await dovizRes.text());
      const dovizMap: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
      $d('tr').each((_, el) => {
        const text = $d(el).text().toUpperCase();
        const matchedKey = Object.keys(dovizMap).find(k => text.includes(k));
        if (matchedKey) {
          const sym = dovizMap[matchedKey];
          if (requestedSymbols.includes(sym)) {
            let candidates: number[] = [];
            $d(el).find('td').each((__, td) => {
              const val = parseFloat($d(td).text().trim().replace(/\./g, '').replace(',', '.'));
              if (!isNaN(val) && val > 30 && val < 100) candidates.push(val);
            });
            if (candidates.length > 0) {
              updates.push({ symbol: sym, price: Math.max(...candidates), change: 0 });
            }
          }
        }
      });
    }

    // --- 3. BIST (HİSSELER) ---
    if (bistRes.ok) {
      const $b = cheerio.load(await bistRes.text());
      $b('tr').each((_, el) => {
        const tds = $b(el).find('td');
        if (tds.length >= 2) {
          const rawSymbol = $b(tds[0]).text().trim().toUpperCase();
          const foundSymbol = requestedSymbols.find(s => rawSymbol.includes(s));
          // Döviz ve Altın sembollerini burada tekrar eklemeyelim
          if (foundSymbol && !['USD','EUR','GA','GG'].includes(foundSymbol)) {
            const price = parseFloat($b(tds[1]).text().trim().replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price)) updates.push({ symbol: foundSymbol, price, change: 0 });
          }
        }
      });
    }

  } catch (e) { console.error("Hata:", e); }

  return NextResponse.json(updates);
}