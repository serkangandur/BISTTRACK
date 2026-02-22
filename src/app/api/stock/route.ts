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

    // --- AKILLI TARAYICI FONKSİYONU ---
    const findBestPrice = (el: any, $: any, min: number, max: number) => {
      let found = 0;
      $(el).find('td').each((_: any, td: any) => {
        const val = parseFloat($(td).text().trim().replace(/\./g, '').replace(',', '.'));
        if (!isNaN(val) && val >= min && val <= max) {
          found = val;
        }
      });
      return found;
    };

    // 1. DÖVİZ (USD & EUR)
    if (dovizRes.ok) {
      const $ = cheerio.load(await dovizRes.text());
      const map: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
      $('tr').each((_, el) => {
        const rowText = $(el).text().toUpperCase();
        const key = Object.keys(map).find(k => rowText.includes(k));
        if (key && requestedSymbols.includes(map[key])) {
          const price = findBestPrice(el, $, 30, 70); // Dolar/Euro 30-70 arasıdır
          if (price > 0) updates.push({ symbol: map[key], price, change: 0 });
        }
      });
    }

    // 2. ALTIN (GA) & GÜMÜŞ (GG)
    if (altinRes.ok) {
      const $ = cheerio.load(await altinRes.text());
      const map: any = { 'GRAM ALTIN': 'GA', 'GÜMÜŞ': 'GG' };
      $('tr').each((_, el) => {
        const rowText = $(el).text().toUpperCase();
        const key = Object.keys(map).find(k => rowText.includes(k));
        if (key && requestedSymbols.includes(map[key])) {
          // Altın için 5000-9000 arası, Gümüş için 50-250 arası rakam ara
          const price = map[key] === 'GA' ? findBestPrice(el, $, 5000, 9000) : findBestPrice(el, $, 50, 250);
          if (price > 0) updates.push({ symbol: map[key], price, change: 0 });
        }
      });
    }

    // 3. BIST (PAGYO vb.)
    if (bistRes.ok) {
      const $ = cheerio.load(await bistRes.text());
      $('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 2) {
          const sym = $(tds[0]).text().trim().split(/\s+/)[0].toUpperCase();
          if (requestedSymbols.includes(sym) && !['USD','EUR','GA','GG'].includes(sym)) {
            const price = parseFloat($(tds[1]).text().trim().replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price)) updates.push({ symbol: sym, price, change: 0 });
          }
        }
      });
    }
  } catch (error) {
    console.error("Hata:", error);
  }

  return NextResponse.json(updates);
}
