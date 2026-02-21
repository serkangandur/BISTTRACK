
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

  // Yahoo Finance kütüphanesinin bazı test/deno hatalarını görmezden gelmek için
  // iç ayarları bazen gerekebilir ancak serverExternalPackages zaten bunu yönetiyor.

  try {
    // Tüm sembollerin sonuna .IS ekliyoruz (Borsa İstanbul için) ve tekrarları temizliyoruz
    const uniqueSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase())));
    const formattedSymbols = uniqueSymbols.map(s => s.endsWith('.IS') ? s : `${s}.IS`);
    
    // Yahoo Finance'dan verileri çekiyoruz
    // quote fonksiyonu tek sembol için obje, çoklu için dizi döner.
    const quotes = await yahooFinance.quote(formattedSymbols);
    const quotesArray = Array.isArray(quotes) ? quotes : [quotes];

    // Gelen verileri işleyip temiz sembollerle eşleştiriyoruz
    const results = quotesArray
      .filter(q => q && q.symbol)
      .map((quote) => {
        // BIST sembolünü temizliyoruz (THYAO.IS -> THYAO)
        const cleanSymbol = quote.symbol.split('.')[0].toUpperCase();
        
        // Fiyat verisi için alternatif alanları kontrol ediyoruz
        const price = quote.regularMarketPrice || 
                      quote.regularMarketPreviousClose || 
                      quote.bid || 
                      quote.ask || 
                      0;
        
        return {
          symbol: cleanSymbol,
          price: price,
          change: quote.regularMarketChangePercent || 0,
        };
      });

    return results;
  } catch (error) {
    console.error('Yahoo Finance API Error:', error);
    // Hata durumunda boş dizi dönüyoruz ki UI takılmasın
    return [];
  }
}
