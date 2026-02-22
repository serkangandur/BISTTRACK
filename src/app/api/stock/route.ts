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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
    'Cache-Control': 'no-store'
  };

  const parse = (val: string) => parseFloat(val.replace(/\./g, '').replace(',', '.'));

  try {
    const [dovizRes, bistRes, altinRes] = await Promise.all([
      fetch(`https://finans.cnnturk.com/doviz?t=${Date.now()}`, { headers }),
      fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?t=${Date.now()}`, { headers }),
      fetch(`https://finans.cnnturk.com/altin?t=${Date.now()}`, { headers })
    ]);

    // 1. DÖVİZ (USD, EUR) - Hedef: 51,68 bandı
    if (dovizRes.ok) {
      const $ = cheerio.load(await dovizRes.text());
      const map: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
      $('tr').each((_, el) => {
        const row = $(el).text().toUpperCase();
        const key = Object.keys(map).find(k => row.includes(k));
        if (key && requestedSymbols.includes(map[key])) {
          $(el).find('td').each((__, td) => {
            const v = parse($(td).text().trim());
            // Mantıklı kur aralığı: 30-100 arası
            if (v > 30 && v < 100) { 
              updates.push({ symbol: map[key], price: v, change: 0 }); 
              return false; 
            }
          });
        }
      });
    }

    // 2. ALTIN & GÜMÜŞ (GA, GG) - Hedef: 7165 ve 118 bandı
    if (altinRes.ok) {
      const $ = cheerio.load(await altinRes.text());
      const emtiaMap: any = { 'GRAM ALTIN': 'GA', 'GÜMÜŞ': 'GG' };
      $('tr').each((_, el) => {
        const row = $(el).text().toUpperCase();
        const key = Object.keys(emtiaMap).find(k => row.includes(k));
        if (key && requestedSymbols.includes(emtiaMap[key])) {
          const sym = emtiaMap[key];
          $(el).find('td').each((__, td) => {
            const v = parse($(td).text().trim());
            // Altın için 5000+, Gümüş için 100+ bir rakam arıyoruz
            if (sym === "GA" && v > 5000) { 
              updates.push({ symbol: "GA", price: v, change: 0 }); 
              return false; 
            }
            if (sym === "GG" && v > 100 && v < 500) { 
              updates.push({ symbol: "GG", price: v, change: 0 }); 
              return false; 
            }
          });
        }
      });
    }

    // 3. BIST (HİSSELER: PAGYO, TUPRS vb.)
    if (bistRes.ok) {
      const $ = cheerio.load(await bistRes.text());
      $('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 2) {
          const s = $(tds[0]).text().trim().split(/\s+/)[0].toUpperCase();
          if (requestedSymbols.includes(s) && !['USD','EUR','GA','GG'].includes(s)) {
            const v = parse($(tds[1]).text().trim());
            if (!isNaN(v)) updates.push({ symbol: s, price: v, change: 0 });
          }
        }
      });
    }
  } catch (e) { console.error("Fetch Hatası:", e); }

  return NextResponse.json(updates);
}
