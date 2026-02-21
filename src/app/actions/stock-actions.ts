'use server';

import yahooFinance from 'yahoo-finance2';

/**
 * Yahoo Finance API yapılandırması.
 * Hata ayıklama günlüklerini kapatıyoruz ve kuyruk yapısını basitleştiriyoruz.
 */
try {
  yahooFinance.setGlobalConfig({
    queue: { concurrency: 1 }, // Daha az agresif sorgu
    validation: { logErrors: false },
  });
} catch (e) {
  // Config hatası kritik değil
}

export interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

/**
 * Borsa İstanbul verilerini bireysel sorgularla çeker. 
 * Toplu sorgular bazı ortamlarda engellendiği için tek tek denemek daha güvenlidir.
 */
export async function getLiveStockPrices(symbols: string[]): Promise<StockPriceUpdate[]> {
  if (!symbols || symbols.length === 0) return [];

  const uniqueSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase())));
  const results: StockPriceUpdate[] = [];

  console.log(`[SERVER] ${uniqueSymbols.length} hisse için bireysel sorgu başlıyor...`);

  // Paralel ama kontrollü bir şekilde her hisseyi tek tek sorguluyoruz
  const fetchPromises = uniqueSymbols.map(async (symbol) => {
    const formattedSymbol = symbol.endsWith('.IS') ? symbol : `${symbol}.IS`;
    
    try {
      // Bireysel sorgu atıyoruz
      const quote = await yahooFinance.quote(formattedSymbol, {}, { validateResult: false });
      
      if (quote) {
        // Fiyat hiyerarşisi: Piyasa -> Önceki Kapanış -> Alış -> Satış
        const price = quote.regularMarketPrice || 
                      quote.regularMarketPreviousClose || 
                      quote.bid || 
                      quote.ask || 
                      0;
        
        const change = quote.regularMarketChangePercent || 0;

        if (price > 0) {
          return {
            symbol: symbol,
            price: price,
            change: change,
          };
        }
      }
      console.warn(`[SERVER] ${symbol} için geçerli fiyat bulunamadı.`);
    } catch (error: any) {
      console.error(`[SERVER] ${symbol} çekilirken hata:`, error.message);
    }
    return null;
  });

  const responses = await Promise.all(fetchPromises);
  
  // Boş olmayan sonuçları filtrele
  responses.forEach(r => {
    if (r) results.push(r);
  });

  console.log(`[SERVER] Sorgu tamamlandı. Başarılı: ${results.length}/${uniqueSymbols.length}`);
  return results;
}
