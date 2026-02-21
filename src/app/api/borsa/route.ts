
import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

/**
 * Borsa İstanbul verilerini çeken Server-side API Route.
 * yahoo-finance2 kütüphanesini sunucu tarafında kullanarak CORS engellerini aşar.
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json({ error: 'Symbols parameter is required' }, { status: 400 });
  }

  // Sembolleri temizle ve BIST formatına (.IS) uygun hale getir
  const symbols = symbolsParam
    .split(',')
    .map(s => s.trim().toUpperCase())
    .map(s => (s.endsWith('.IS') ? s : `${s}.IS`));

  try {
    console.log(`[API/BORSA] Sorgulanan semboller: ${symbols.join(', ')}`);

    // Yahoo Finance'den toplu veri çek (Validation kapalı kalsın ki eksik veri hata fırlatmasın)
    const results = await yahooFinance.quote(symbols, { validateResult: false });

    // Veriyi uygulama formatına dönüştür
    const formattedData = results.map((quote: any) => {
      // Sembolü temizle (UI ile eşleşmesi için .IS kısmını at)
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

    return NextResponse.json(formattedData);

  } catch (error: any) {
    console.error(`[API/BORSA] HATA: ${error.message}`);
    
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: error.message },
      { status: 500 }
    );
  }
}
