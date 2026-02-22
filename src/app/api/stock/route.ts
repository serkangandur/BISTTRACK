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

  // Sayı temizleme fonksiyonu: "7.165,09" -> 7165.09
  const parseVal = (txt: string) => parseFloat(txt.replace(/\./g, '').replace(',', '.'));

  try {
    const [dovizRes, bistRes, altinRes] = await Promise.all([
      fetch(`https://finans.cnnturk.com/doviz?v=${Date.now()}`, { headers }),
      fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?v=${Date.now()}`, { headers }),
      fetch(`https://finans.cnnturk.com/altin?v=${Date.now()}`, { headers })
    ]);

    // 1. ALTIN (GA) & GÜMÜŞ (GG) TARAMA
    if (altinRes.ok) {
      const $ = cheerio.load(await altinRes.text());
      $('tr').each((_, el) => {
        const rowText = $(el).text().toUpperCase();
        let sym = "";
        if (rowText.includes("GRAM ALTIN")) sym = "GA";
        else if (rowText.includes("GÜMÜŞ")) sym = "GG";

        if (sym && requestedSymbols.includes(sym)) {
          $(el).find('td').each((__, td) => {
            const v = parseVal($(td).text().trim());
            // Akıllı Filtre: Altın 5000+, Gümüş 100+ ise fiyattır
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

    // 2. DÖVİZ (USD & EUR) TARAMA
    if (dovizRes.ok) {
      const $ = cheerio.load(await dovizRes.text());
      const dMap: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
      $('tr').each((_, el) => {
        const rowText = $(el).text().toUpperCase();
        const key = Object.keys(dMap).find(k => rowText.includes(k));
        if (key && requestedSymbols.includes(dMap[key])) {
          $(el).find('td').each((__, td) => {
            const v = parseVal($(td).text().trim());
            // Döviz 30-100 arasıdır (51.68'i yakalar)
            if (v > 30 && v < 100) { 
              updates.push({ symbol: dMap[key], price: v, change: 0 }); 
              return false; 
            }
          });
        }
      });
    }

    // 3. BIST (HİSSELER) TARAMA
    if (bistRes.ok) {
      const $ = cheerio.load(await bistRes.text());
      $('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 2) {
          const s = $(tds[0]).text().trim().split(/\s+/)[0].toUpperCase();
          if (requestedSymbols.includes(s) && !['USD','EUR','GA','GG'].includes(s)) {
            const v = parseVal($(tds[1]).text().trim());
            if (!isNaN(v)) updates.push({ symbol: s, price: v, change: 0 });
          }
        }
      });
    }
  } catch (err) { console.error(err); }

  return NextResponse.json(updates);
}
