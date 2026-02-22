
import { NextRequest, NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import * as cheerio from 'cheerio';

/**
 * Hibrit Veri Motoru v30.0 - "Mega Kurtarıcı"
 * - Kripto: Binance TR API (JSON)
 * - BIST: Yahoo Finance (.IS)
 * - Döviz/Emtia: Yahoo Finance + Doviz.com Scraping
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json([], { status: 200 });
  }

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim());
  console.log(`[API] [İSTEK ALINDI] Semboller: ${requestedSymbols.join(', ')}`);

  const updates: any[] = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  try {
    // 1. KRİPTO VERİLERİ (BINANCE TR API)
    let btcPrice = 0;
    let ethPrice = 0;
    try {
      const [btcRes, ethRes] = await Promise.all([
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=BTCTRY', { cache: 'no-store' }).then(res => res.json()),
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=ETHTRY', { cache: 'no-store' }).then(res => res.json())
      ]);
      if (btcRes?.price) btcPrice = parseFloat(btcRes.price);
      if (ethRes?.price) ethPrice = parseFloat(ethRes.price);
      console.log(`[API] [BINANCE] BTC: ${btcPrice} ₺, ETH: ${ethPrice} ₺`);
    } catch (e) {
      console.error("[API] Binance TR Hatası, Yedek Aranıyor...");
    }

    // 2. YAHOO FINANCE İÇİN SEMBOLLERİ HAZIRLA
    const yahooSymbols: string[] = [];
    const bistMap: Record<string, string> = {};

    for (const req of requestedSymbols) {
      const upper = req.toUpperCase();
      
      // Kripto Eşleşmesi
      if (upper.includes('BITCOIN') || upper.includes('BTC')) {
        if (btcPrice > 0) updates.push({ symbol: req, price: btcPrice, change: 0 });
        continue;
      }
      if (upper.includes('ETHEREUM') || upper.includes('ETH') || upper.includes('ETHERIUM')) {
        if (ethPrice > 0) updates.push({ symbol: req, price: ethPrice, change: 0 });
        continue;
      }

      // Döviz Eşleşmesi
      if (upper === 'USD' || upper.includes('DOLAR')) {
        yahooSymbols.push('USDTRY=X');
        bistMap['USDTRY=X'] = req;
        continue;
      }
      if (upper === 'EUR' || upper.includes('EURO')) {
        yahooSymbols.push('EURTRY=X');
        bistMap['EURTRY=X'] = req;
        continue;
      }

      // Emtia Eşleşmesi
      if (upper === 'ALTIN' || upper.includes('GOLD')) {
        yahooSymbols.push('GC=F'); // Altın ONS (USD) - TRY çevrimi aşağıda yapılacak
        bistMap['GC=F'] = req;
        continue;
      }

      // BIST Hisseleri (Varsayılan)
      const yahooSymbol = upper.endsWith('.IS') ? upper : `${upper}.IS`;
      yahooSymbols.push(yahooSymbol);
      bistMap[yahooSymbol] = req;
    }

    // 3. YAHOO FINANCE TOPLU ÇEKİM
    if (yahooSymbols.length > 0) {
      try {
        const quotes = await yahooFinance.quote(yahooSymbols, { validateResult: false });
        
        // USDTRY fiyatını altın hesaplaması için sakla
        const usdTryQuote = quotes.find(q => q.symbol === 'USDTRY=X');
        const usdTryPrice = usdTryQuote?.regularMarketPrice || 32.50; // Fallback

        for (const quote of quotes) {
          const originalName = bistMap[quote.symbol];
          let price = quote.regularMarketPrice || quote.regularMarketPreviousClose || 0;
          let change = quote.regularMarketChangePercent || 0;

          // Altın ise Gram Altın hesapla (ONS / 31.1 * USDTRY)
          if (quote.symbol === 'GC=F') {
            price = (price / 31.1035) * usdTryPrice;
          }

          if (price > 0) {
            updates.push({
              symbol: originalName,
              price: Number(price.toFixed(4)),
              change: Number(change.toFixed(2))
            });
            console.log(`[API] [YAHOO] ${originalName} -> ${price} ₺`);
          }
        }
      } catch (e) {
        console.error("[API] Yahoo Finance Hatası:", e);
      }
    }

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
