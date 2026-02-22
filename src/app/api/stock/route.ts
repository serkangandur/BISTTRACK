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

// ✅ Sembol Dönüşümleri (Aliasing)
const SYMBOL_ALIASES: Record<string, string> = {
  'ALTIN': 'GA',
  'GRAM ALTIN': 'GA',
  'GUMUS': 'GG',
  'GÜMÜŞ': 'GG',
  'BITCOIN': 'BTC',
  'ETHEREUM': 'ETH',
  'SOLANA': 'SOL',
};

// ✅ Kripto ID Eşleştirmesi (CoinGecko için)
const CRYPTO_ID_MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'ADA': 'cardano',
  'XRP': 'ripple',
  'DOGE': 'dogecoin',
  'AVAX': 'avalanche-2',
};

function normalizeSymbol(s: string): string {
  const upper = s.trim().toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C');
  return SYMBOL_ALIASES[upper] || upper;
}

const fetchHeaders = { 
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Cache-Control': 'no-cache',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const rawSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const requestedSymbols = rawSymbols.map(normalizeSymbol);
  
  // Normalize -> Orijinal eşleşmesi (Cevap dönerken kullanmak için)
  const symbolMap: Record<string, string> = {};
  rawSymbols.forEach(raw => {
    const normalized = normalizeSymbol(raw);
    symbolMap[normalized] = raw;
  });

  const updates: StockPriceUpdate[] = [];

  const cryptoToFetch = requestedSymbols.filter(s => CRYPTO_ID_MAP[s]);
  const needsAltinGumus = requestedSymbols.includes('GA') || requestedSymbols.includes('GG');
  const needsDoviz = requestedSymbols.includes('USD') || requestedSymbols.includes('EUR');
  const needsBist = requestedSymbols.some(s => !CRYPTO_ID_MAP[s] && !['USD', 'EUR', 'GA', 'GG'].includes(s));

  try {
    const ts = Date.now();
    
    // ✅ Paralel Veri Çekme
    const [altinHTML, dovizHTML, bistHTML, cryptoData] = await Promise.all([
      needsAltinGumus
        ? fetch(`https://finans.cnnturk.com/altin?v=${ts}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      needsDoviz
        ? fetch(`https://finans.cnnturk.com/doviz?v=${ts}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      needsBist
        ? fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?v=${ts}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      cryptoToFetch.length > 0
        ? fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoToFetch.map(s => CRYPTO_ID_MAP[s]).join(',')}&vs_currencies=try&include_24hr_change=true`, { cache: 'no-store' }).then(r => r.json())
        : Promise.resolve(null)
    ]);

    const pushUpdate = (normalizedSymbol: string, price: number, change: number) => {
      const originalSymbol = symbolMap[normalizedSymbol] || normalizedSymbol;
      updates.push({ symbol: originalSymbol, price, change });
    };

    // --- 1. GRAM ALTIN & GRAM GÜMÜŞ ---
    if (altinHTML) {
      const $a = cheerio.load(altinHTML);
      // GA
      if (requestedSymbols.includes('GA')) {
        $a('a[href*="gram-altin-fiyati"]').not('a[href*="0."]').each((_, el) => {
          const row = $a(el).closest('tr');
          const tds = row.find('td');
          if (tds.length >= 2) {
            const price = parseNum($a(tds[1]).text().trim());
            if (price > 1000) {
              const change = parseNum($a(tds[3]).text().replace('%', '')) || 0;
              pushUpdate('GA', price, change);
              return false;
            }
          }
        });
      }
      // GG
      if (requestedSymbols.includes('GG')) {
        $a('a[href*="gumus-gram-TL-fiyati"]').each((_, el) => {
          const row = $a(el).closest('tr');
          const tds = row.find('td');
          if (tds.length >= 2) {
            const price = parseNum($a(tds[1]).text().trim());
            if (price > 10 && price < 1000) {
              const change = parseNum($a(tds[3]).text().replace('%', '')) || 0;
              pushUpdate('GG', price, change);
              return false;
            }
          }
        });
      }
    }

    // --- 2. DÖVİZ (USD, EUR) ---
    if (dovizHTML) {
      const $d = cheerio.load(dovizHTML);
      const dMap: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };
      $d('tr').each((_, el) => {
        const rowText = $d(el).text().toUpperCase()
          .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
          .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C');
        const key = Object.keys(dMap).find(k => rowText.includes(k));
        if (key && requestedSymbols.includes(dMap[key])) {
          $d(el).find('td').each((_, td) => {
            const val = parseNum($d(td).text().trim());
            if (val > 30 && val < 100) {
              pushUpdate(dMap[key], val, 0);
              return false;
            }
          });
        }
      });
    }

    // --- 3. KRİPTO (CoinGecko) ---
    if (cryptoData) {
      cryptoToFetch.forEach(sym => {
        const id = CRYPTO_ID_MAP[sym];
        const data = cryptoData[id];
        if (data && data.try) {
          pushUpdate(sym, data.try, data.try_24h_change || 0);
        }
      });
    }

    // --- 4. BİST HİSSELERİ ---
    if (bistHTML) {
      const $b = cheerio.load(bistHTML);
      $b('tr').each((_, el) => {
        const tds = $b(el).find('td');
        if (tds.length >= 2) {
          const s = $b(tds[0]).text().trim().split(/\s+/)[0].toUpperCase();
          const normalized = normalizeSymbol(s);
          if (requestedSymbols.includes(normalized) && !['USD', 'EUR', 'GA', 'GG'].includes(normalized) && !CRYPTO_ID_MAP[normalized]) {
            const val = parseNum($b(tds[1]).text().trim());
            if (!isNaN(val) && val > 0) {
              pushUpdate(normalized, val, 0);
            }
          }
        }
      });
    }

  } catch (err) {
    console.error("Fiyat çekme hatası:", err);
  }

  return NextResponse.json(updates);
}