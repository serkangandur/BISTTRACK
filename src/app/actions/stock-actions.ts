'use server';

import yahooFinance from 'yahoo-finance2';

export interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

/**
 * Yahoo Finance API kullanarak hisse senedi fiyatlarını toplu halde çeker.
 * @param symbols Hisse senedi sembolleri (Örn: ['THYAO', 'SASA'])
 */
export async function getLiveStockPrices(symbols: string[]): Promise<StockPriceUpdate[]> {
  if (!symbols || symbols.length === 0) return [];

  try {
    const formattedSymbols = symbols.map(s => s.endsWith('.IS') ? s : `${s}.IS`);
    
    // Yahoo Finance'dan verileri toplu halde çekiyoruz
    // quote fonksiyonu dizi kabul eder ve dizi döndürür
    const quotes = await yahooFinance.quote(formattedSymbols);
    
    // Tek bir sembol gönderildiğinde dizi yerine obje dönebilir, garantiye alıyoruz
    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

    return quotesArray.map((quote) => {
      // BIST sembolünü temizliyoruz (THYAO.IS -> THYAO)
      const cleanSymbol = quote.symbol.replace('.IS', '');
      
      // Fiyat verisi için alternatif alanları kontrol ediyoruz
      const price = quote.regularMarketPrice || quote.regularMarketPreviousClose || quote.bid || quote.ask || 0;
      
      return {
        symbol: cleanSymbol,
        price: price,
        change: quote.regularMarketChangePercent || 0,
      };
    });
  } catch (error) {
    console.error('General error fetching stock prices:', error);
    return [];
  }
}
