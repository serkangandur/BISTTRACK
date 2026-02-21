
export interface StockHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  dailyChange: number;
  isLoaded?: boolean; // Market verisinin başarıyla çekilip çekilmediğini takip eder
}

export interface PortfolioSummary {
  totalAssets: number;
  dailyProfitLoss: number;
  dailyProfitLossPercentage: number;
  topGainer: string;
  topGainerChange: number;
}
