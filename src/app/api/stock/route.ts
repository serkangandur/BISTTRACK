import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

const parseNum = (t: string) => parseFloat(t.replace(/\./g, '').replace(',', '.'));

const headers = { 
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache'
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: StockPriceUpdate[] = [];

  const needsAltinGumus = requestedSymbols.includes('GA') || requestedSymbols.includes('GG');
  const needsDoviz = requestedSymbols.some(s => ['USD', 'EUR'].includes(s));
  const needsBist = requestedSymbols.some(s => !['USD', 'EUR', 'GA', 'GG'].includes(s));

  try {
    // Paralel fetch — sadece gerekli kaynakları çek
    const [dovizHTML, bistHTML, altinGumusData] = await Promise.all([
      needsDoviz
        ? fetch(`https://finans.cnnturk.com/doviz?v=${Date.now()}`, { headers, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      needsBist
        ? fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?v=${Date.now()}`, { headers, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      // ✅ CNN Türk yerine GenelPara API — JSON, hızlı, güvenilir
      needsAltinGumus
        ? fetch('https://api.genelpara.com/json/?list=altin&sembol=GA,GAG', { cache: 'no-store' }).then(r => r.json())
        : Promise.resolve(null)
    ]);

    // --- 1. ALTIN & GÜMÜŞ (GenelPara API) ---
    if (altinGumusData) {
      // GA = Gram Altın
      if (requestedSymbols.includes('GA') && altinGumusData.GA) {
        const price = parseFloat(altinGumusData.GA.alis || altinGumusData.GA.satis || '0');
        if (price > 0) {
          updates.push({ 
            symbol: 'GA', 
            price, 
            change: parseFloat(altinGumusData.GA.degisim || altinGumusData.GA.kapanis || '0') 
          });
        }
      }
      // GG = Gram Gümüş (GenelPara'da GAG olarak geçer)
      if (requestedSymbols.includes('GG') && altinGumusData.GAG) {
        const price = parseFloat(altinGumusData.GAG.alis || altinGumusData.GAG.satis || '0');
        if (price > 0) {
          updates.push({ 
            symbol: 'GG', 
            price, 
            change: parseFloat(altinGumusData.GAG.degisim || altinGumusData.GAG.kapanis || '0') 
          });
        }
      }
    }

    // --- 2. DÖVİZ (CNN Türk - Cheerio) ---
    if (dovizHTML) {
      const $d = cheerio.load(dovizHTML);
      const dMap: Record<string, string> = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
      $d('tr').each((_, el) => {
        const rowText = $d(el).text().toUpperCase();
        const key = Object.keys(dMap).find(k => rowText.includes(k));
        if (key && requestedSymbols.includes(dMap[key])) {
          $d(el).find('td').each((_, td) => {
            const val = parseNum($d(td).text().trim());
            // Akıllı Filtre: 30-100 bandı gerçek kurdur
            if (val > 30 && val < 100) {
              updates.push({ symbol: dMap[key], price: val, change: 0 });
              return false;
            }
          });
        }
      });
    }

    // --- 3. BİST HİSSELERİ (CNN Türk - Cheerio) ---
    if (bistHTML) {
      const $b = cheerio.load(bistHTML);
      $b('tr').each((_, el) => {
        const tds = $b(el).find('td');
        if (tds.length >= 2) {
          const s = $b(tds[0]).text().trim().split(/\s+/)[0].toUpperCase();
          if (requestedSymbols.includes(s) && !['USD', 'EUR', 'GA', 'GG'].includes(s)) {
            const val = parseNum($b(tds[1]).text().trim());
            if (!isNaN(val) && val > 0) {
              updates.push({ symbol: s, price: val, change: 0 });
            }
          }
        }
      });
    }

  } catch (err) {
    console.error("Veri çekme hatası:", err);
  }

  return NextResponse.json(updates);
}
