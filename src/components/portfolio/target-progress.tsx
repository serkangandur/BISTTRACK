
"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TargetProgressProps {
  currentTotal: number;
}

const GLOBAL_TARGET = 104108716.80;

export function TargetProgress({ currentTotal }: TargetProgressProps) {
  const progress = Math.min((currentTotal / GLOBAL_TARGET) * 100, 100);

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-accent/5 border-primary/20 shadow-2xl overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Target className="w-24 h-24 rotate-12" />
      </div>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-primary uppercase tracking-widest">Ana Hedef İlerlemesi</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Finansal özgürlük hedefi: ₺104.108.716,80</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">%{progress.toFixed(1)}</span>
              <span className="text-muted-foreground text-sm">tamamlandı</span>
            </div>
          </div>

          <div className="flex-1 max-w-2xl w-full space-y-3">
            <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
              <span className="text-muted-foreground">Başlangıç</span>
              <span className="text-white">Hedef: ₺{GLOBAL_TARGET.toLocaleString("tr-TR")}</span>
            </div>
            <div className="relative h-4 w-full bg-white/[0.06] rounded-full overflow-hidden border border-white/[0.04]">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-out shadow-[0_0_25px_hsl(var(--primary)/0.4),_0_0_50px_hsl(var(--accent)/0.15)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
               <p className="text-[11px] text-muted-foreground font-medium">
                Mevcut Varlık: <span className="text-white">₺{currentTotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</span>
               </p>
               <div className="flex items-center gap-1 text-[11px] text-accent font-bold">
                 <TrendingUp className="w-3 h-3" />
                 Yolun başındayız!
               </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
