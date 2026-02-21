
import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

/**
 * Borsa İstanbul verilerini çeken güvenli API Route.
 * Hataları yakalar ve uygulamanın çökmesini önlemek için her zaman geçerli bir JSON döner.
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json([], { status: 200 });
  }

  // Sembolleri temizle ve BIST formatına (.IS) uygun hale getir
  const symbols = symbolsParam
    .split(',')
    .map(s => s.trim().toUpperCase())
    .map(s => (s.endsWith('.IS') ? s : `${s}.IS`));

  try {
    console.log(`[API/STOCK] Sorgu başlatıldı: ${symbols.join(', ')}`);

    // Her sembol için ayrı sorgu yaparak hataları izole ediyoruz
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          // Yahoo Finance API çağrısı
          const quote = await yahooFinance.quote(symbol, { validateResult: false });
          
          if (!quote) {
            console.warn(`[API/STOCK] ${symbol} için veri bulunamadı.`);
            return null;
          }

          // UI ile eşleşmesi için sembolü temizle (.IS kısmını at)
          const cleanSymbol = symbol.replace('.IS', '');
          
          return {
            symbol: cleanSymbol,
            price: quote.regularMarketPrice || 
                   quote.regularMarketPreviousClose || 
                   quote.bid || 
                   quote.ask || 
                   0,
            change: quote.regularMarketChangePercent || 0,
          };
        } catch (e: any) {
          console.error(`[API/STOCK] ${symbol} çekilirken hata oluştu:`, e.message);
          return null;
        }
      })
    );

    // Başarısız olan (null dönen) kayıtları temizle
    const filteredResults = results.filter(r => r !== null);

    console.log(`[API/STOCK] Başarılı sonuç sayısı: ${filteredResults.length}`);
    return NextResponse.json(filteredResults, { status: 200 });

  } catch (error: any) {
    // Kritik hata durumunda 500 yerine 200 ve boş liste dönerek UI'ı koru
    console.error("[API/STOCK] Kritik Sistem Hatası:", error.message);
    return NextResponse.json([], { status: 200 });
  }
}
