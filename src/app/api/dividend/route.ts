
import { NextRequest, NextResponse } from 'next/server';

/**
 * Borsa İstanbul temettü verilerini dönen mock API.
 * Gerçek bir veri kaynağına bağlanana kadar yaygın temettü hisselerini simüle eder.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  
  if (!symbolsParam) {
    return NextResponse.json([]);
  }

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  
  // BIST Temettü verileri (Simülasyon)
  const mockDividends: Record<string, { net: number; yield: number; date: string; year: number }> = {
    'TUPRS': { net: 10.38, yield: 6.2, date: '03.04.2024', year: 2024 },
    'FROTO': { net: 38.97, yield: 3.5, date: '08.04.2024', year: 2024 },
    'DOAS': { net: 36.00, yield: 11.2, date: '24.04.2024', year: 2024 },
    'TTRAK': { net: 56.50, yield: 6.1, date: '01.04.2024', year: 2024 },
    'LOGO': { net: 3.60, yield: 4.2, date: '04.05.2024', year: 2024 },
    'ISMEN': { net: 1.05, yield: 2.8, date: '29.05.2024', year: 2024 },
    'PAGYO': { net: 0.85, yield: 12.5, date: '15.06.2024', year: 2024 },
    'ANHYT': { net: 2.10, yield: 3.9, date: '22.03.2024', year: 2024 },
    'CLEBI': { net: 63.00, yield: 3.1, date: '12.04.2024', year: 2024 },
    'AKBNK': { net: 1.66, yield: 3.2, date: '26.03.2024', year: 2024 },
    'GARAN': { net: 3.11, yield: 3.8, date: '29.03.2024', year: 2024 },
    'VESBE': { net: 0.70, yield: 3.4, date: '25.04.2024', year: 2024 },
    'ENJSA': { net: 2.79, yield: 4.1, date: '22.05.2024', year: 2024 },
  };

  const results = requestedSymbols.map(symbol => {
    const data = mockDividends[symbol] || { 
      net: (Math.random() * 4) + 1, 
      yield: (Math.random() * 7) + 2, 
      date: '2024 Belirlenmedi', 
      year: 2024 
    };
    
    return {
      symbol,
      netDividendPerShare: data.net,
      dividendYield: data.yield,
      paymentDate: data.date,
      year: data.year
    };
  });

  return NextResponse.json(results);
}
