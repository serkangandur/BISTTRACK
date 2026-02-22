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

// ✅ Firebase'de ne yazarsa yazsın, iç kodda standart sembol kullanılır
const SYMBOL_ALIASES: Record<string, string> = {
  'ALTIN': 'GA',
  'GRAM ALTIN': 'GA',
  'GRAMALTIN': 'GA',
  'GA': 'GA',
  'GUMUS': 'GG',
  'GÜMÜŞ': 'GG',
  'GRAM GUMUS': 'GG',
  'GRAM GÜMÜŞ': 'GG',
  'GG': 'GG',
};

function normalizeSymbol(s: string): string {
  const upper = s.trim().toUpperCase();
  return SYMBOL_ALIASES[upper] || upper;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  // Ham semboller (Firebase'den gelenler: "ALTIN", "GUMUS" vb.)
  const rawSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  
  // Normalize edilmiş semboller (iç işlemler için: "GA", "GG" vb.)
  const requestedSymbols = rawSymbols.map(normalizeSymbol);
  
  // Normalize → Orijinal mapping (cevap dönerken Firebase'deki sembolü kullan)
  const symbolMap: Record<string, string> = {};
  rawSymbols.forEach(raw => {
    const normalized = normalizeSymbol(raw);
    symbolMap[normalized] = raw;
  });

  const updates: StockPriceUpdate[] = [];

  const needsAltinGumus = requestedSymbols.includes('GA') || requestedSymbols.includes('GG');
  const needsDoviz = requestedSymbols.some(s => ['USD', 'EUR'].includes(s));
  const needsBist = requestedSymbols.some(s => !['USD', 'EUR', 'GA', 'GG'].includes(s));

  // Sonucu orijinal sembolle push et
  const pushUpdate = (normalizedSymbol: string, price: number, change: number) => {
    const originalSymbol = symbolMap[normalizedSymbol] || normalizedSymbol;
    updates.push({ symbol: originalSymbol, price, change });
  };

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

      // GRAM ALTIN — href tabanlı (en güvenilir)
      if (requestedSymbols.includes('GA')) {
        $a('a[href*="gram-altin-fiyati"]')
          .not('a[href*="ceyrek"]')
          .not('a[href*="yarim"]')
          .not('a[href*="0.25"]')
          .not('a[href*="0.50"]')
          .each((_, el) => {
            const parent = $a(el).closest('tr');
            const tds = parent.find('td');
            if (tds.length >= 2) {
              const alis = parseNum($a(tds[1]).text().trim());
              if (!isNaN(alis) && alis > 1000) {
                const degisimText = tds.length >= 4 ? $a(tds[3]).text().trim() : '0';
                const degisim = parseFloat(degisimText.replace('%', '').replace(',', '.')) || 0;
                pushUpdate('GA', alis, degisim);
                return false;
              }
            }
          });
      }

      // GRAM GÜMÜŞ — href tabanlı
      if (requestedSymbols.includes('GG')) {
        $a('a[href*="gumus-gram-TL-fiyati"]').each((_, el) => {
          const parent = $a(el).closest('tr');
          const tds = parent.find('td');
          if (tds.length >= 2) {
            const alis = parseNum($a(tds[1]).text().trim());
            if (!isNaN(alis) && alis > 50 && alis < 2000) {
              const degisimText = tds.length >= 4 ? $a(tds[3]).text().trim() : '0';
              const degisim = parseFloat(degisimText.replace('%', '').replace(',', '.')) || 0;
              pushUpdate('GG', alis, degisim);
              return false;
            }
          }
        });
      }

      // Fallback: tablo text araması
      if (!updates.find(u => normalizeSymbol(u.symbol) === 'GA') && requestedSymbols.includes('GA')) {
        $a('table tr').each((_, el) => {
          const tds = $a(el).find('td');
          if (tds.length < 2) return;
          const label = $a(tds[0]).text().trim().toUpperCase()
            .replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G')
            .replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C');
          const alis = parseNum($a(tds[1]).text().trim());
          if (label === 'GRAM ALTIN' && !isNaN(alis) && alis > 1000) {
            pushUpdate('GA', alis, 0);
            return false;
          }
        });
      }

      if (!updates.find(u => normalizeSymbol(u.symbol) === 'GG') && requestedSymbols.includes('GG')) {
        $a('table tr').each((_, el) => {
          const tds = $a(el).find('td');
          if (tds.length < 2) return;
          const label = $a(tds[0]).text().trim().toUpperCase()
            .replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G')
            .replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C');
          const alis = parseNum($a(tds[1]).text().trim());
          if (label.includes('GUMUS') && label.includes('GRAM') && !isNaN(alis) && alis > 50 && alis < 2000) {
            pushUpdate('GG', alis, 0);
            return false;
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
              pushUpdate(dMap[key], val, 0);
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
          const normalized = normalizeSymbol(s);
          if (requestedSymbols.includes(normalized) && !['USD', 'EUR', 'GA', 'GG'].includes(normalized)) {
            const val = parseNum($b(tds[1]).text().trim());
            if (!isNaN(val) && val > 0) {
              pushUpdate(normalized, val, 0);
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