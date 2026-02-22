import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

const parseNum = (t: string) => {
  if (!t) return NaN;
  return parseFloat(t.replace(/\./g, '').replace(',', '.').trim());
};

const fetchHeaders = { 
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
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
    const ts = Date.now();

    const [altinHTML, dovizHTML, bistHTML] = await Promise.all([
      needsAltinGumus
        ? fetch(`https://finans.cnnturk.com/altin?v=${ts}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      needsDoviz
        ? fetch(`https://finans.cnnturk.com/doviz?v=${ts}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      needsBist
        ? fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?v=${ts}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
    ]);

    // --- 1. GRAM ALTIN & GRAM GÜMÜŞ ---
    if (altinHTML) {
      const $a = cheerio.load(altinHTML);

      $a('table tr').each((_, el) => {
        const tds = $a(el).find('td');
        if (tds.length < 2) return;

        // Türkçe karakter sorunları için normalize et
        const labelRaw = $a(tds[0]).text().trim();
        const labelText = labelRaw.toUpperCase()
          .replace(/İ/g, 'I')
          .replace(/Ş/g, 'S')
          .replace(/Ğ/g, 'G')
          .replace(/Ü/g, 'U')
          .replace(/Ö/g, 'O')
          .replace(/Ç/g, 'C');

        const alis = parseNum($a(tds[1]).text().trim());

        // ✅ GRAM ALTIN
        if (
          requestedSymbols.includes('GA') &&
          labelText.includes('GRAM ALTIN') &&
          !labelText.includes('0.25') &&
          !labelText.includes('0.50') &&
          !isNaN(alis) && alis > 1000
        ) {
          const degisimText = tds.length >= 4 ? $a(tds[3]).text().trim() : '0';
          const degisim = parseFloat(degisimText.replace('%', '').replace(',', '.')) || 0;
          updates.push({ symbol: 'GA', price: alis, change: degisim });
        }

        // ✅ GRAM GÜMÜŞ
        if (
          requestedSymbols.includes('GG') &&
          labelText.includes('GUMUS') &&
          labelText.includes('GRAM') &&
          labelText.includes('TL') &&
          !isNaN(alis) && alis > 50 && alis < 1000
        ) {
          const degisimText = tds.length >= 4 ? $a(tds[3]).text().trim() : '0';
          const degisim = parseFloat(degisimText.replace('%', '').replace(',', '.')) || 0;
          updates.push({ symbol: 'GG', price: alis, change: degisim });
        }
      });

      // ✅ Altın için — href üzerinden direkt bul (0.25 ve 0.50 hariç)
      if (!updates.find(u => u.symbol === 'GA') && requestedSymbols.includes('GA')) {
        $a('a[href*="gram-altin-fiyati"]').not('a[href*="0.25"]').not('a[href*="0.50"]').each((_, el) => {
          const parent = $a(el).closest('tr');
          const tds = parent.find('td');
          if (tds.length >= 2) {
            const alis = parseNum($a(tds[1]).text().trim());
            if (!isNaN(alis) && alis > 1000) {
              updates.push({ symbol: 'GA', price: alis, change: 0 });
              return false;
            }
          }
        });
      }

      // ✅ Gümüş için — normalize yerine href ile direkt bul (daha güvenilir)
      if (!updates.find(u => u.symbol === 'GG') && requestedSymbols.includes('GG')) {
        $a('a[href*="gumus-gram-TL-fiyati"]').each((_, el) => {
          const parent = $a(el).closest('tr');
          const tds = parent.find('td');
          if (tds.length >= 2) {
            const alis = parseNum($a(tds[1]).text().trim());
            if (!isNaN(alis) && alis > 50 && alis < 1000) {
              updates.push({ symbol: 'GG', price: alis, change: 0 });
              return false;
            }
          }
        });
      }
    }

    // --- 2. DÖVİZ ---
    if (dovizHTML) {
      const $d = cheerio.load(dovizHTML);
      const dMap: Record<string, string> = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
      $d('tr').each((_, el) => {
        const rowText = $d(el).text().toUpperCase();
        const key = Object.keys(dMap).find(k => rowText.includes(k));
        if (key && requestedSymbols.includes(dMap[key])) {
          $d(el).find('td').each((_, td) => {
            const val = parseNum($d(td).text().trim());
            if (val > 30 && val < 100) {
              updates.push({ symbol: dMap[key], price: val, change: 0 });
              return false;
            }
          });
        }
      });
    }

    // --- 3. BİST HİSSELERİ ---
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