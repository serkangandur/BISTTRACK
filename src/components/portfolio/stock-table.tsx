"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StockHolding } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StockTableProps {
  holdings: StockHolding[];
  onDelete: (id: string) => void;
}

export function StockTable({ holdings, onDelete }: StockTableProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl">
      <Table>
        <TableHeader className="bg-white/5">
          <TableRow className="hover:bg-transparent border-white/5">
            <TableHead className="font-semibold py-4">Sembol</TableHead>
            <TableHead className="font-semibold">Adet</TableHead>
            <TableHead className="font-semibold">Ortalama Fiyat</TableHead>
            <TableHead className="font-semibold">Güncel Fiyat</TableHead>
            <TableHead className="font-semibold">Toplam Tutar</TableHead>
            <TableHead className="font-semibold">Kâr/Zarar</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((stock) => {
            const totalValue = stock.quantity * stock.currentPrice;
            const totalCost = stock.quantity * stock.averageCost;
            const pl = totalValue - totalCost;
            const plPercentage = (pl / totalCost) * 100;
            const isUp = pl >= 0;

            return (
              <TableRow key={stock.id} className="hover:bg-white/5 border-white/5 transition-colors group">
                <TableCell className="font-bold py-4">
                  <div className="flex flex-col">
                    <span className="text-foreground group-hover:text-primary transition-colors">{stock.symbol}</span>
                    <span className="text-[10px] font-normal text-muted-foreground uppercase">{stock.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-muted-foreground">{stock.quantity.toLocaleString("tr-TR")}</TableCell>
                <TableCell className="text-muted-foreground">₺{stock.averageCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-semibold">
                    ₺{stock.currentPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    <span className={cn(
                      "text-[10px] flex items-center",
                      stock.dailyChange >= 0 ? "text-bist-up" : "text-bist-down"
                    )}>
                      {stock.dailyChange >= 0 ? <ArrowUp className="w-2 h-2 mr-0.5" /> : <ArrowDown className="w-2 h-2 mr-0.5" />}
                      %{Math.abs(stock.dailyChange).toFixed(2)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-bold">₺{totalValue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className={cn("font-bold text-sm", isUp ? "text-bist-up" : "text-bist-down")}>
                      {isUp ? "+" : ""}₺{pl.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </span>
                    <Badge variant="outline" className={cn(
                      "w-fit text-[10px] py-0 px-1.5 border-none bg-opacity-10",
                      isUp ? "bg-bist-up text-bist-up" : "bg-bist-down text-bist-down"
                    )}>
                      {isUp ? "+" : ""}{plPercentage.toFixed(2)}%
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-white/10">
                      <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" onClick={() => onDelete(stock.id)}>
                        Sil
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
