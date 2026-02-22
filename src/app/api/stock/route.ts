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

  const parseNum = (t: string) => parseFloat(t.replace(/\./g, '').replace(',', '.'));

  try {
    const [dRes, bRes, aRes] = await Promise.all([
      fetch(`https://finans.cnnturk.com/doviz?v=${Date.now()}`, { headers }).then(r => r.text()),
      fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?v=${Date.now()}`, { headers }).then(r => r.text()),
      fetch(`https://finans.cnnturk.com/altin?v=${Date.now()}`, { headers }).then(r => r.text())
    ]);

    // 1. DÖVİZ (USD, EUR) - Tüm satırı tara, mantıklı olanı al
    const $d = cheerio.load(dRes);
    const dMap: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
    $d('tr').each((_, el) => {
      const rowText = $d(el).text().toUpperCase();
      const key = Object.keys(dMap).find(k => rowText.includes(k));
      if (key && requestedSymbols.includes(dMap[key])) {
        $d(el).find('td').each((i, td) => {
          const val = parseNum($d(td).text().trim());
          if (val > 30 && val < 100) { // 51.68 buraya düşer
            updates.push({ symbol: dMap[key], price: val, change: 0 });
            return false;
          }
        });
      }
    });

    // 2. ALTIN & GÜMÜŞ (GA, GG) - 7165 ve 118 hedefi
    const $a = cheerio.load(aRes);
    const aMap: any = { 'GRAM ALTIN': 'GA', 'GÜMÜŞ': 'GG' };
    $a('tr').each((_, el) => {
      const rowText = $a(el).text().toUpperCase();
      const key = Object.keys(aMap).find(k => rowText.includes(k));
      if (key && requestedSymbols.includes(aMap[key])) {
        const sym = aMap[key];
        $a(el).find('td').each((i, td) => {
          const val = parseNum($a(td).text().trim());
          if (sym === 'GA' && val > 5000) { // 7165 buraya düşer
            updates.push({ symbol: sym, price: val, change: 0 });
            return false;
          }
          if (sym === 'GG' && val > 100 && val < 500) { // 118 buraya düşer
            updates.push({ symbol: sym, price: val, change: 0 });
            return false;
          }
        });
      }
    });

    // 3. BIST HİSSELERİ (PAGYO vb.)
    const $b = cheerio.load(bRes);
    $b('tr').each((_, el) => {
      const tds = $b(el).find('td');
      if (tds.length >= 2) {
        const s = $b(tds[0]).text().trim().split(/\s+/)[0].toUpperCase();
        if (requestedSymbols.includes(s) && !['USD','EUR','GA','GG'].includes(s)) {
          const val = parseNum($b(tds[1]).text().trim());
          if (!isNaN(val)) updates.push({ symbol: s, price: val, change: 0 });
        }
      }
    });

  } catch (e) { console.log("Hata:", e); }

  return NextResponse.json(updates);
}