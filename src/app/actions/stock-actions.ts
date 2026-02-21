'use server';

/**
 * Borsa İstanbul canlı fiyat verilerini çekmek için kullanılan Server Action.
 * yahoo-finance2 kütüphanesinin bazı ortamlardaki kısıtlamalarını aşmak için
 * doğrudan Yahoo Finance Query API'sini (v7) kullanır.
 */

export interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

export async function getLiveStockPrices(symbols: string[]): Promise<StockPriceUpdate[]> {
  if (!symbols || symbols.length === 0) return [];

  // Sembolleri normalize et (Tekrar edenleri sil, büyük harf yap, .IS uzantısı ekle)
  const uniqueSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase())));
  const formattedSymbols = uniqueSymbols.map(s => s.endsWith('.IS') ? s : `${s}.IS`).join(',');

  // Yahoo Finance v7 API Endpoint
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${formattedSymbols}`;

  try {
    // API isteği (User-Agent eklemek bot korumasını aşmak için kritiktir)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 0 } // Cache'i devre dışı bırak, canlı veri al
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SERVER] Yahoo API Hatası: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const result = data?.quoteResponse?.result;

    if (!result || !Array.isArray(result)) {
      console.warn('[SERVER] Yahoo API boş veya geçersiz veri döndürdü.');
      return [];
    }

    // Gelen ham veriyi uygulama formatına dönüştür
    const updates: StockPriceUpdate[] = result.map((quote: any) => {
      // .IS uzantısını kaldırarak UI sembolüyle eşleştir
      const cleanSymbol = quote.symbol.replace('.IS', '').toUpperCase();
      
      return {
        symbol: cleanSymbol,
        // Piyasa kapalıyken regularMarketPrice gelmeyebilir, alternatiflere bak
        price: quote.regularMarketPrice || 
               quote.regularMarketPreviousClose || 
               quote.bid || 
               quote.ask || 
               0,
        change: quote.regularMarketChangePercent || 0,
      };
    });

    console.log(`[SERVER] ${updates.length} hisse için veri başarıyla çekildi.`);
    return updates;

  } catch (error: any) {
    console.error('[SERVER] Veri çekme sırasında kritik hata:', error.message);
    return [];
  }
}
