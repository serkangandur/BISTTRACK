
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockHolding } from "@/lib/types";
import { PORTFOLIO_HISTORY } from "@/lib/mock-data";

interface PortfolioChartsProps {
  holdings: StockHolding[];
}

const COLORS = [
  "hsl(203, 50%, 60%)",
  "hsl(188, 78%, 74%)",
  "hsl(173, 58%, 39%)",
  "hsl(197, 37%, 24%)",
  "hsl(210, 40%, 96.1%)",
  "hsl(203, 50%, 40%)"
];

export function PortfolioCharts({ holdings }: PortfolioChartsProps) {
  // Temettü Sabit hariç veriler
  const filteredHoldings = holdings.filter(h => h.category !== "Temettü Sabit");

  const pieData = filteredHoldings.map((h) => ({
    name: h.symbol,
    value: h.quantity * h.currentPrice,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="lg:col-span-1 bg-card/50 border-white/5 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Varlık Dağılımı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#101418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(value: number) => `₺${value.toLocaleString("tr-TR")}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {pieData.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-xs font-medium text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 bg-card/50 border-white/5 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Performans Geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PORTFOLIO_HISTORY}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255,255,255,0.2)" 
                  fontSize={10} 
                  tickFormatter={(val) => val.split('-').reverse().slice(0, 2).join('/')}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.2)" 
                  fontSize={10}
                  tickFormatter={(val) => `₺${(val/1000)}k`}
                />
                <Tooltip 
                   contentStyle={{ backgroundColor: "#101418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                   itemStyle={{ color: "#fff" }}
                   labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}
                   formatter={(value: number) => `₺${value.toLocaleString("tr-TR")}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-center text-muted-foreground mt-2 italic">
            Son 30 günlük portföy değeri değişimi (Temettü Sabit hariç)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
