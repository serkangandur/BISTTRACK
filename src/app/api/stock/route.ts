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
  'BTC': 'BTC',
  'BITCOIN': 'BTC',
  'ETH': 'ETH',
  'ETHEREUM': 'ETH',
  'BNB': 'BNB',
  'SOL': 'SOL',
  'SOLANA': 'SOL',
  'ADA': 'ADA',
  'XRP': 'XRP',
  'DOGE': 'DOGE',
  'AVAX': 'AVAX',
};

// CoinGecko ID mapping
const CRYPTO_COINGECKO_IDS: Record<string, string> = {
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
  const needsKripto = requestedSymbols.some(s => Object.keys(CRYPTO_COINGECKO_IDS).includes(s));

  // ✅ YENİ AYRIŞTIRMA MANTIĞI
  const NON_BIST = ['USD', 'EUR', 'GA', 'GG', ...Object.keys(CRYPTO_COINGECKO_IDS)];
  
  // TEFAS fon kodları mutlaka rakam içerir (TP2, GO6, TTE1 vb.) veya 2 karakter (YA, TA)
  const TEFAS_REGEX = /^[A-Z]{1,3}[0-9]+$|^[A-Z0-9]{2}$/;
  const tefasSemboller = requestedSymbols.filter(s => TEFAS_REGEX.test(s) && !NON_BIST.includes(s));
  const needsTefas = tefasSemboller.length > 0;

  // BİST: rakam içermeyen 3-5 harf semboller (THYAO, SASA, TUPRS vb.)
  const needsBist = requestedSymbols.some(s => 
    !NON_BIST.includes(s) && 
    !tefasSemboller.includes(s) && 
    /^[A-Z]{3,5}$/.test(s)
  );

  // Sonucu orijinal sembolle push et
  const pushUpdate = (normalizedSymbol: string, price: number, change: number) => {
    const originalSymbol = symbolMap[normalizedSymbol] || normalizedSymbol;
    updates.push({ symbol: originalSymbol, price, change });
  };

  try {
    const ts = Date.now();

    const [altinHTML, dovizHTML, bistHTML, kripto, tefasResults] = await Promise.all([
      needsAltinGumus
        ? fetch(`https://finans.cnnturk.com/altin?v=${ts}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      needsDoviz
        ? fetch(`https://finans.cnnturk.com/doviz?v=${ts}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      needsBist
        ? fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?v=${ts}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text())
        : Promise.resolve(''),
      needsKripto
        ? (() => {
            const kriptoSemboller = requestedSymbols.filter(s => CRYPTO_COINGECKO_IDS[s]);
            const ids = kriptoSemboller.map(s => CRYPTO_COINGECKO_IDS[s]).join(',');
            return fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=try&include_24hr_change=true`, { cache: 'no-store' }).then(r => r.json());
          })()
        : Promise.resolve(null),
      // TEFAS: her fon kodu için ayrı istek (paralel)
      needsTefas
        ? Promise.all(tefasSemboller.map(async (fonKodu) => {
            try {
              const html = await fetch(`https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${fonKodu}`, { headers: fetchHeaders, cache: 'no-store' }).then(r => r.text());
              const $t = cheerio.load(html);
              let fiyat = 0;
              let degisim = 0;
              $t('li').each((_, el) => {
                const text = $t(el).text();
                if (text.includes('Son Fiyat')) {
                  const val = parseFloat($t(el).find('span, strong, b').last().text().trim().replace(',', '.')) || 0;
                  if (val > 0) fiyat = val;
                }
                if (text.includes('Günlük Getiri')) {
                  const match = text.match(/%([\d,.-]+)/);
                  if (match) degisim = parseFloat(match[1].replace(',', '.')) || 0;
                }
              });
              if (fiyat === 0) {
                const fullText = $t('body').text();
                const match = fullText.match(/Son Fiyat[^0-9]*([0-9]+,[0-9]+)/);
                if (match) fiyat = parseFloat(match[1].replace(',', '.')) || 0;
              }
              return { symbol: fonKodu, price: fiyat, change: degisim };
            } catch {
              return null;
            }
          }))
        : Promise.resolve([]),
    ]);

    // --- 1. GRAM ALTIN & GRAM GÜMÜŞ ---
    if (altinHTML) {
      const $a = cheerio.load(altinHTML);
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

    // --- 4. KRİPTO ---
    if (kripto) {
      Object.entries(CRYPTO_COINGECKO_IDS).forEach(([symbol, geckoId]) => {
        if (requestedSymbols.includes(symbol) && kripto[geckoId]) {
          const price = kripto[geckoId].try || 0;
          const change = kripto[geckoId].try_24h_change || 0;
          if (price > 0) {
            pushUpdate(symbol, price, parseFloat(change.toFixed(2)));
          }
        }
      });
    }

    // --- 5. TEFAS FONLARI ---
    if (tefasResults && Array.isArray(tefasResults)) {
      tefasResults.forEach((result: any) => {
        if (result && result.price > 0) {
          pushUpdate(result.symbol, result.price, result.change);
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
          if (requestedSymbols.includes(normalized) && !NON_BIST.includes(normalized) && !tefasSemboller.includes(normalized)) {
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