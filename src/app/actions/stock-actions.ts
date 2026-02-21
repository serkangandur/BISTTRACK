'use server';

import yahooFinance from 'yahoo-finance2';

export interface StockPriceUpdate {
  symbol: string;
  price: number;
  change: number;
}

/**
 * Yahoo Finance API kullanarak hisse senedi fiyatlarını çeker.
 * @param symbols Hisse senedi sembolleri (Örn: ['THYAO', 'SASA'])
 */
export async function getLiveStockPrices(symbols: string[]): Promise<StockPriceUpdate[]> {
  try {
    const formattedSymbols = symbols.map(s => s.endsWith('.IS') ? s : `${s}.IS`);
    
    // Yahoo Finance'dan verileri toplu halde çekiyoruz
    const results = await Promise.all(
      formattedSymbols.map(async (symbol) => {
        try {
          const quote = await yahooFinance.quote(symbol);
          return {
            symbol: symbol.replace('.IS', ''),
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChangePercent || 0,
          };
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
          return null;
        }
      })
    );

    return results.filter((r): r is StockPriceUpdate => r !== null);
  } catch (error) {
    console.error('General error fetching stock prices:', error);
    return [];
  }
}
