import { StockHolding } from './types';

export const INITIAL_HOLDINGS: StockHolding[] = [
  {
    id: '1',
    symbol: 'THYAO',
    name: 'Türk Hava Yolları',
    quantity: 150,
    averageCost: 285.50,
    currentPrice: 298.75,
    dailyChange: 2.45
  },
  {
    id: '2',
    symbol: 'EREGL',
    name: 'Ereğli Demir Çelik',
    quantity: 500,
    averageCost: 45.20,
    currentPrice: 48.12,
    dailyChange: 1.15
  },
  {
    id: '3',
    symbol: 'SASA',
    name: 'Sasa Polyester',
    quantity: 1000,
    averageCost: 42.10,
    currentPrice: 38.90,
    dailyChange: -3.20
  },
  {
    id: '4',
    symbol: 'TUPRS',
    name: 'Tüpraş',
    quantity: 80,
    averageCost: 155.00,
    currentPrice: 168.40,
    dailyChange: 4.80
  },
  {
    id: '5',
    symbol: 'KCHOL',
    name: 'Koç Holding',
    quantity: 200,
    averageCost: 160.20,
    currentPrice: 172.30,
    dailyChange: 0.85
  }
];

export const PORTFOLIO_HISTORY = [
  { date: '2024-05-01', value: 185000 },
  { date: '2024-05-05', value: 188500 },
  { date: '2024-05-10', value: 192000 },
  { date: '2024-05-15', value: 189000 },
  { date: '2024-05-20', value: 195000 },
  { date: '2024-05-25', value: 198500 },
  { date: '2024-05-30', value: 205430 },
];