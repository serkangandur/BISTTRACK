
'use server';

import yahooFinance from 'yahoo-finance2';

// Global yapılandırma
try {
  yahooFinance.setGlobalConfig({
    queue: { concurrency: 2 },
  });
} catch (e) {
  console.error("Yahoo Finance Config Error:", e);
}

export interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

/**
 * Yahoo Finance API kullanarak hisse senedi fiyatlarını çeker ve detaylı log tutar.
 */
export async function getLiveStockPrices(symbols: string[]): Promise<StockPriceUpdate[]> {
  console.log('--- [DEBUG] BIST VERI CEKIMI BASLADI ---');
  console.log('Talep Edilen Semboller:', symbols);

  if (!symbols || symbols.length === 0) {
    console.log('[DEBUG] Sembol listesi bos.');
    return [];
  }

  try {
    const uniqueSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase())));
    const formattedSymbols = uniqueSymbols.map(s => s.endsWith('.IS') ? s : `${s}.IS`);
    
    console.log('[DEBUG] Formatlanmis Semboller:', formattedSymbols);
    
    const results: StockPriceUpdate[] = [];

    // BIST hisseleri için tek tek sorgu yapmak daha güvenli (toplu sorgu bazen engellenebiliyor)
    for (const sym of formattedSymbols) {
      try {
        console.log(`[DEBUG] Sorgulaniyor: ${sym}...`);
        const quote = await yahooFinance.quote(sym);
        
        if (quote) {
          const cleanSymbol = quote.symbol.split('.')[0].toUpperCase();
          const price = quote.regularMarketPrice || 
                        quote.regularMarketPreviousClose || 
                        quote.bid || 
                        quote.ask || 
                        0;
          
          const change = quote.regularMarketChangePercent || 0;

          console.log(`[DEBUG] BASARILI (${sym}): Fiyat=${price}, Degisim=%${change.toFixed(2)}`);
          
          results.push({
            symbol: cleanSymbol,
            price: price,
            change: change,
          });
        } else {
          console.warn(`[DEBUG] VERI BULUNAMADI: ${sym}`);
        }
      } catch (err: any) {
        console.error(`[DEBUG] HATA (${sym}):`, err.message);
        if (err.response) {
          console.error(`[DEBUG] Yanit Durumu: ${err.response.status}`);
        }
      }
    }

    console.log(`[DEBUG] Toplam Basarili Sonuclar: ${results.length}/${formattedSymbols.length}`);
    console.log('--- [DEBUG] BIST VERI CEKIMI BITTI ---');
    return results;
  } catch (error: any) {
    console.error('[DEBUG] KRITIK HATA:', error.message);
    return [];
  }
}
