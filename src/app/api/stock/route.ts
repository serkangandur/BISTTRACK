import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([], { status: 200 });

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim());
  const updates: any[] = [];
  
  try {
    let btcPrice = 0; let ethPrice = 0;
    try {
      const [btcRes, ethRes] = await Promise.all([
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=BTCTRY', { next: { revalidate: 0 } }).then(res => res.json()),
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=ETHTRY', { next: { revalidate: 0 } }).then(res => res.json())
      ]);
      if (btcRes?.price) btcPrice = parseFloat(btcRes.price);
      if (ethRes?.price) ethPrice = parseFloat(ethRes.price);
    } catch (e) { console.error("Binance hatası."); }

    const yahooQuerySymbols: string[] = [];
    const symbolMapping: Record<string, string[]> = {};

    for (const req of requestedSymbols) {
      const upper = req.toUpperCase();
      if (upper.includes('BITCOIN') || upper === 'BTC') {
        if (btcPrice > 0) updates.push({ symbol: req, price: btcPrice, change: 0 });
        continue;
      }
      if (upper.includes('ETHEREUM') || upper.includes('ETH') || upper.includes('ETHERİUM')) {
        if (ethPrice > 0) updates.push({ symbol: req, price: ethPrice, change: 0 });
        continue;
      }

      let yahooSym = '';
      if (upper === 'USD' || upper.includes('DOLAR')) yahooSym = 'USDTRY=X';
      else if (upper === 'EUR' || upper.includes('EURO')) yahooSym = 'EURTRY=X';
      else if (upper === 'ALTIN' || upper.includes('GOLD')) yahooSym = 'GC=F';
      else if (upper === 'GUMUS' || upper.includes('SILVER')) yahooSym = 'SI=F';
      else { yahooSym = upper.endsWith('.IS') ? upper : `${upper}.IS`; }

      if (yahooSym) {
        yahooQuerySymbols.push(yahooSym);
        if (!symbolMapping[yahooSym]) symbolMapping[yahooSym] = [];
        symbolMapping[yahooSym].push(req);
      }
    }

    if (yahooQuerySymbols.length > 0) {
      const uniqueSymbols = Array.from(new Set(yahooQuerySymbols));
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${uniqueSymbols.join(',')}`;
      const response = await fetch(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
        }, 
        next: { revalidate: 0 } 
      });

      if (response.ok) {
        const data = await response.json();
        const results = data?.quoteResponse?.result || [];
        
        // Altın hesaplaması için USDTRY kurunu bul (eğer sorguda yoksa varsayılan)
        const usdQuote = results.find((q: any) => q.symbol === 'USDTRY=X');
        const currentUsdTry = usdQuote?.regularMarketPrice || 34.50;

        for (const quote of results) {
          const originalNames = symbolMapping[quote.symbol] || [];
          let price = quote.regularMarketPrice || quote.regularMarketPreviousClose || 0;
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
                change: quote.regularMarketChangePercent || 0 
              });
            }
          }
        }
      }
    }
    return NextResponse.json(updates, { status: 200 });
  } catch (error) { 
    console.error("API Hatası:", error);
    return NextResponse.json(updates, { status: 200 }); 
  }
}