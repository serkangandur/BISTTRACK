'use server';

import yahooFinance from 'yahoo-finance2';

// Global yapılandırma: İstek çakışmalarını önlemek için tek tek (concurrency: 1) çekiyoruz
try {
  yahooFinance.setGlobalConfig({
    queue: { concurrency: 1 },
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
  console.log('--- [SERVER-LOG] BIST VERI CEKIMI BASLADI ---');
  console.log('Talep Edilen Semboller:', symbols);

  if (!symbols || symbols.length === 0) {
    console.log('[SERVER-LOG] Sembol listesi bos, islem sonlandirildi.');
    return [];
  }

  try {
    const uniqueSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase())));
    // BIST hisseleri için .IS uzantısı şarttır
    const formattedSymbols = uniqueSymbols.map(s => s.endsWith('.IS') ? s : `${s}.IS`);
    
    console.log('[SERVER-LOG] Sorgulanacak Formatlı Semboller:', formattedSymbols);
    
    const results: StockPriceUpdate[] = [];

    // Hataları daha iyi izlemek için döngü ile tek tek sorguluyoruz
    for (const sym of formattedSymbols) {
      try {
        console.log(`[SERVER-LOG] Veri isteniyor: ${sym}...`);
        
        // quote metodu en hızlı sonuç veren metottur
        const quote = await yahooFinance.quote(sym);
        
        if (quote) {
          // Gelen ham verideki bazı alanları logla (fiyatın neden 0 gelebileceğini anlamak için)
          console.log(`[SERVER-LOG] ${sym} Yanıtı Alındı. Alanlar: price=${quote.regularMarketPrice}, prevClose=${quote.regularMarketPreviousClose}, bid=${quote.bid}`);

          const cleanSymbol = quote.symbol.split('.')[0].toUpperCase();
          
          // Fiyat için sırasıyla mevcut olan en mantıklı alanı seçiyoruz
          const price = quote.regularMarketPrice || 
                        quote.regularMarketPreviousClose || 
                        quote.bid || 
                        quote.ask || 
                        0;
          
          const change = quote.regularMarketChangePercent || 0;

          if (price > 0) {
            console.log(`[SERVER-LOG] BASARILI (${sym}): Fiyat=${price}, Değişim=%${change.toFixed(2)}`);
            results.push({
              symbol: cleanSymbol,
              price: price,
              change: change,
            });
          } else {
            console.warn(`[SERVER-LOG] UYARI: ${sym} için geçerli bir fiyat bulunamadı (Fiyat: 0).`);
          }
        } else {
          console.error(`[SERVER-LOG] HATA: ${sym} için Yahoo Finance boş (null) yanıt döndü.`);
        }
      } catch (err: any) {
        console.error(`[SERVER-LOG] HATA (${sym}):`, err.message);
        // Hata detaylarını (varsa) yazdır
        if (err.response) {
          console.error(`[SERVER-LOG] HTTP Status: ${err.response.status}`);
        }
      }
    }

    console.log(`[SERVER-LOG] Veri Çekimi Tamamlandı. Başarılı Sonuç: ${results.length}/${formattedSymbols.length}`);
    console.log('--- [SERVER-LOG] BIST VERI CEKIMI BITTI ---');
    return results;
  } catch (error: any) {
    console.error('[SERVER-LOG] KRITIK HATA:', error.message);
    return [];
  }
}
