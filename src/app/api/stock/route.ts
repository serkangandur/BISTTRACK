
import { NextRequest, NextResponse } from 'next/server';

/**
 * Borsa İstanbul verilerini çeken güvenli ve detaylı loglamalı API Route.
 * Yahoo Finance kütüphanesi yerine doğrudan API çağrısı yaparak CORS ve 
 * bot engellerini aşmak için tarayıcı başlıklarını taklit eder.
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

  const formattedSymbols = symbols.join(',');
  // Yahoo Finance v7 Query API Endpoint
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${formattedSymbols}`;

  try {
    console.log(`[API/STOCK] Sorgu başlatılıyor: ${formattedSymbols}`);

    // Yahoo'nun bot korumasını aşmak için gerçek bir tarayıcı başlığı (User-Agent) ekliyoruz
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      next: { revalidate: 0 } // Next.js cache'ini devre dışı bırak
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`KRITIK_HATA: Yahoo API Yanıtı Olumsuz (HTTP ${response.status}):`, errorText);
      return NextResponse.json([], { status: 200 });
    }

    const data = await response.json();
    const result = data?.quoteResponse?.result;

    if (!result || !Array.isArray(result)) {
      console.error("KRITIK_HATA: Yahoo API geçersiz veri döndürdü veya yetki sorunu var:", data);
      return NextResponse.json([], { status: 200 });
    }

    // Gelen ham veriyi UI formatına dönüştür
    const updates = result.map((quote: any) => {
      // .IS uzantısını temizle
      const cleanSymbol = quote.symbol.replace('.IS', '').toUpperCase();
      
      return {
        symbol: cleanSymbol,
        // Piyasa kapalıyken veya veri gecikmeliyken en yakın fiyatı al
        price: quote.regularMarketPrice || 
               quote.regularMarketPreviousClose || 
               quote.bid || 
               quote.ask || 
               0,
        change: quote.regularMarketChangePercent || 0,
      };
    });

    console.log(`[API/STOCK] ${updates.length} hisse için veri başarıyla işlendi.`);
    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    // İstediğiniz kritik hata logu
    console.error("KRITIK_HATA: Veri çekme sırasında beklenmedik istisna oluştu:", error.message);
    return NextResponse.json([], { status: 200 });
  }
}
