'use server';

import yahooFinance from 'yahoo-finance2';

/**
 * Yahoo Finance API yapılandırması. 
 * Bazı ortamlarda Yahoo isteği engelleyebildiği için doğrulama kurallarını esnetiyoruz.
 */
try {
  yahooFinance.setGlobalConfig({
    queue: { concurrency: 4 }, // Toplu isteklerde daha hızlı sonuç için
    validation: { logErrors: false }, // Şema hatalarını görmezden gel
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
 * Yahoo Finance üzerinden BIST verilerini toplu olarak çeker.
 */
export async function getLiveStockPrices(symbols: string[]): Promise<StockPriceUpdate[]> {
  if (!symbols || symbols.length === 0) return [];

  try {
    const uniqueSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase())));
    const formattedSymbols = uniqueSymbols.map(s => s.endsWith('.IS') ? s : `${s}.IS`);
    
    console.log(`[SERVER] ${formattedSymbols.length} hisse sorgulanıyor:`, formattedSymbols);

    // Toplu sorgu (bulk query) yapıyoruz. 
    // validateResult: false ile Yahoo'nun bazen eksik gönderdiği alanlar için hata fırlatmasını önlüyoruz.
    const quotes = await yahooFinance.quote(formattedSymbols, {}, { validateResult: false });

    // Yahoo bazen tek sembol için nesne, çoklu için dizi döner. Bunu normalize edelim.
    const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
    
    const results: StockPriceUpdate[] = quoteArray
      .filter(q => q !== null && q !== undefined)
      .map(quote => {
        const cleanSymbol = quote.symbol.split('.')[0].toUpperCase();
        
        // Fiyat hiyerarşisi: Piyasa fiyatı -> Önceki kapanış -> Alış -> Satış
        const price = quote.regularMarketPrice || 
                      quote.regularMarketPreviousClose || 
                      quote.bid || 
                      quote.ask || 
                      0;
        
        const change = quote.regularMarketChangePercent || 0;

        return {
          symbol: cleanSymbol,
          price: price,
          change: change,
        };
      })
      .filter(r => r.price > 0);

    console.log(`[SERVER] ${results.length} hisse için güncel fiyat başarıyla alındı.`);
    return results;
  } catch (error: any) {
    console.error('[SERVER] Yahoo Finance Çekim Hatası:', error.message);
    // Hata durumunda boş dizi dönerek UI'daki toast mekanizmasını tetikliyoruz
    return [];
  }
}
