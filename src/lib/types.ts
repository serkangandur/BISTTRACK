
export type AssetCategory = 
  | "Temettü" 
  | "Büyüme" 
  | "Nakit" 
  | "Emtia" 
  | "Kripto" 
  | "Döviz" 
  | "Sigorta";

export interface StockHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  dailyChange: number;
  category: AssetCategory;
  monthlySalary?: number; // Sadece "Sigorta" kategorisi için
  isLoaded?: boolean;
}

export interface PortfolioSummary {
  totalAssets: number;
  dailyProfitLoss: number;
  dailyProfitLossPercentage: number;
  topGainer: string;
  topGainerChange: number;
}
