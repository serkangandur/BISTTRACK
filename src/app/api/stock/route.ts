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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Cache-Control': 'no-cache'
  };

  const parseNum = (t: string) => parseFloat(t.replace(/\./g, '').replace(',', '.'));

  try {
    // 3 ANA KAYNAĞI PARALEL OLARAK ÇEKİYORUZ
    const [dovizHTML, bistHTML, altinHTML] = await Promise.all([
      fetch(`https://finans.cnnturk.com/doviz?v=${Date.now()}`, { headers, cache: 'no-store' }).then(r => r.text()),
      fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?v=${Date.now()}`, { headers, cache: 'no-store' }).then(r => r.text()),
      fetch(`https://finans.cnnturk.com/altin?v=${Date.now()}`, { headers, cache: 'no-store' }).then(r => r.text())
    ]);

    // --- 1. DÖVİZ İŞLEME (USD, EUR) ---
    const $d = cheerio.load(dovizHTML);
    const dMap: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
    $d('tr').each((_, el) => {
      const rowText = $d(el).text().toUpperCase();
      const key = Object.keys(dMap).find(k => rowText.includes(k));
      if (key && requestedSymbols.includes(dMap[key])) {
        $d(el).find('td').each((i, td) => {
          const val = parseNum($d(td).text().trim());
          // 2026 Gerçekliği: 30-100 bandındaki rakam gerçek fiyattır
          if (val > 30 && val < 100) {
            updates.push({ symbol: dMap[key], price: val, change: 0 });
            return false;
          }
        });
      }
    });

    // --- 2. ALTIN & GÜMÜŞ İŞLEME (GA, GG) ---
    const $a = cheerio.load(altinHTML);
    const aMap: any = { 'GRAM ALTIN': 'GA', 'GÜMÜŞ': 'GG' };
    $a('tr').each((_, el) => {
      const rowText = $a(el).text().toUpperCase();
      const key = Object.keys(aMap).find(k => rowText.includes(k));
      if (key && requestedSymbols.includes(aMap[key])) {
        const sym = aMap[key];
        $a(el).find('td').each((i, td) => {
          const val = parseNum($a(td).text().trim());
          // Altın 5000+, Gümüş 100+ ise gerçek fiyattır
          if (sym === 'GA' && val > 5000) {
            updates.push({ symbol: sym, price: val, change: 0 });
            return false;
          }
          if (sym === 'GG' && val > 100 && val < 500) {
            updates.push({ symbol: sym, price: val, change: 0 });
            return false;
          }
        });
      }
    });

    // --- 3. BIST HİSSE İŞLEME (PAGYO, TUPRS vb.) ---
    const $b = cheerio.load(bistHTML);
    $b('tr').each((_, el) => {
      const tds = $b(el).find('td');
      if (tds.length >= 2) {
        const s = $b(tds[0]).text().trim().split(/\s+/)[0].toUpperCase();
        if (requestedSymbols.includes(s) && !['USD','EUR','GA','GG'].includes(s)) {
          const val = parseNum($b(tds[1]).text().trim());
          if (!isNaN(val)) {
            updates.push({ symbol: s, price: val, change: 0 });
          }
        }
      }
    });

  } catch (err) {
    console.error("Veri çekme hatası:", err);
  }

  return NextResponse.json(updates);
}
