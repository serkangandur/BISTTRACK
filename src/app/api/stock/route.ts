
import { NextRequest, NextResponse } from 'next/server';

/**
 * Hibrit Veri Motoru v31.0 - "Mega Kurtarıcı Fix"
 * - Kripto: Binance TR API (Resmi JSON)
 * - BIST: Yahoo Finance v7 (Doğrudan Fetch - Bot Engeline Takılmaz)
 * - Döviz/Emtia: Yahoo Finance v7
 * - Akıllı Mirroring: İstek gelen sembol ismini koruyarak veriyi üzerine yapıştırır.
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json([], { status: 200 });
  }

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim());
  console.log(`[API] [İSTEK] Semboller: ${requestedSymbols.join(', ')}`);

  const updates: any[] = [];
  
  try {
    // 1. KRİPTO VERİLERİ (BINANCE TR API) - Saniyelik ve Bot Engeli Yok
    let btcPrice = 0;
    let ethPrice = 0;
    try {
      const [btcRes, ethRes] = await Promise.all([
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=BTCTRY', { next: { revalidate: 0 } }).then(res => res.json()),
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=ETHTRY', { next: { revalidate: 0 } }).then(res => res.json())
      ]);
      if (btcRes?.price) btcPrice = parseFloat(btcRes.price);
      if (ethRes?.price) ethPrice = parseFloat(ethRes.price);
    } catch (e) {
      console.error("[API] [BİNANCE] Hata: API'ye ulaşılamadı.");
    }

    // 2. YAHOO FINANCE İÇİN SEMBOLLERİ HAZIRLA
    const yahooQuerySymbols: string[] = [];
    const symbolMapping: Record<string, string[]> = {}; // YahooSymbol -> OriginalRequestedNames[]

    for (const req of requestedSymbols) {
      const upper = req.toUpperCase();
      
      // Kripto Akıllı Eşleşme
      if (upper.includes('BITCOIN') || upper === 'BTC') {
        if (btcPrice > 0) {
          updates.push({ symbol: req, price: btcPrice, change: 0 });
          console.log(`[API] [EŞLEŞME] ${req} -> ${btcPrice} ₺`);
        }
        continue;
      }
      if (upper.includes('ETHEREUM') || upper.includes('ETH') || upper.includes('ETHERİUM')) {
        if (ethPrice > 0) {
          updates.push({ symbol: req, price: ethPrice, change: 0 });
          console.log(`[API] [EŞLEŞME] ${req} -> ${ethPrice} ₺`);
        }
        continue;
      }

      // Döviz / Emtia / BIST Eşleşmeleri
      let yahooSym = '';
      if (upper === 'USD' || upper.includes('DOLAR')) yahooSym = 'USDTRY=X';
      else if (upper === 'EUR' || upper.includes('EURO')) yahooSym = 'EURTRY=X';
      else if (upper === 'ALTIN' || upper.includes('GOLD')) yahooSym = 'GC=F';
      else if (upper === 'GUMUS' || upper.includes('SILVER')) yahooSym = 'SI=F';
      else {
        // BIST Hisseleri
        yahooSym = upper.endsWith('.IS') ? upper : `${upper}.IS`;
      }

      if (yahooSym) {
        yahooQuerySymbols.push(yahooSym);
        if (!symbolMapping[yahooSym]) symbolMapping[yahooSym] = [];
        symbolMapping[yahooSym].push(req);
      }
    }

    // 3. YAHOO FINANCE TOPLU ÇEKİM (FETCH V7 API)
    if (yahooQuerySymbols.length > 0) {
      try {
        const uniqueSymbols = Array.from(new Set(yahooQuerySymbols));
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${uniqueSymbols.join(',')}`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          next: { revalidate: 0 }
        });

        if (response.ok) {
          const data = await response.json();
          const results = data?.quoteResponse?.result || [];

          // Altın hesaplaması için USDTRY kurunu bul
          const usdTryQuote = results.find((q: any) => q.symbol === 'USDTRY=X');
          const currentUsdTry = usdTryQuote?.regularMarketPrice || 32.50;

          for (const quote of results) {
            const originalNames = symbolMapping[quote.symbol] || [];
            let price = quote.regularMarketPrice || quote.regularMarketPreviousClose || 0;
            const change = quote.regularMarketChangePercent || 0;

            for (const name of originalNames) {
              let finalPrice = price;
              
              // Gram Altın / Gümüş Dönüşümü (ONS / 31.1035 * USDTRY)
              if (quote.symbol === 'GC=F' || quote.symbol === 'SI=F') {
                finalPrice = (price / 31.1035) * currentUsdTry;
              }

              if (finalPrice > 0) {
                updates.push({
                  symbol: name,
                  price: Number(finalPrice.toFixed(4)),
                  change: Number(change.toFixed(2))
                });
                console.log(`[API] [YAHOO] ${name} -> ${finalPrice} ₺`);
              }
            }
          }
        }
      } catch (e) {
        console.error("[API] [YAHOO] Hata:", e);
      }
    }

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
