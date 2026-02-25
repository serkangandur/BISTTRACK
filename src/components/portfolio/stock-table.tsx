
"use client";

import { useState } from "react";
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
import { MoreHorizontal, ArrowUp, ArrowDown, Edit2, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditStockDialog } from "./edit-stock-dialog";

interface StockTableProps {
  holdings: StockHolding[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updatedData: Partial<StockHolding>) => void;
}

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  "Temettü": "border-category-temettu/30 bg-category-temettu/10 text-category-temettu",
  "Temettü Sabit": "border-category-temettu-sabit/30 bg-category-temettu-sabit/10 text-category-temettu-sabit",
  "Büyüme": "border-category-buyume/30 bg-category-buyume/10 text-category-buyume",
  "Nakit": "border-category-nakit/30 bg-category-nakit/10 text-category-nakit",
  "Emtia": "border-category-emtia/30 bg-category-emtia/10 text-category-emtia",
  "Kripto": "border-category-kripto/30 bg-category-kripto/10 text-category-kripto",
  "Döviz": "border-category-doviz/30 bg-category-doviz/10 text-category-doviz",
  "Sigorta": "border-category-sigorta/30 bg-category-sigorta/10 text-category-sigorta",
};

export function StockTable({ holdings, onDelete, onUpdate }: StockTableProps) {
  const [editingStock, setEditingStock] = useState<StockHolding | null>(null);

  const getCurrencySymbol = (symbol: string, category: string) => {
    if (category === "Döviz") {
      if (symbol.toUpperCase() === "USD") return "$";
      if (symbol.toUpperCase() === "EUR") return "€";
    }
    if (category === "Kripto") return "₺";
    return "";
  };

  const formatQuantity = (stock: StockHolding) => {
    if (stock.category === "Kripto") {
      return stock.quantity.toFixed(7).replace('.', ',');
    }
    if (stock.category === "Emtia" || stock.category === "Döviz") {
      return `${stock.quantity.toFixed(4).replace('.', ',')} ${stock.category === "Emtia" ? "gr" : ""}`;
    }
    return stock.quantity.toLocaleString("tr-TR");
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl">
      <Table>
        <TableHeader className="bg-white/[0.04]">
          <TableRow className="hover:bg-transparent border-white/[0.04]">
            <TableHead className="font-semibold py-4">Varlık & Kategori</TableHead>
            <TableHead className="font-semibold">Anapara (₺)</TableHead>
            <TableHead className="font-semibold">Miktar</TableHead>
            <TableHead className="font-semibold">Maliyet (₺)</TableHead>
            <TableHead className="font-semibold">Güncel Fiyat (₺)</TableHead>
            <TableHead className="font-semibold">Toplam Değer (₺)</TableHead>
            <TableHead className="font-semibold">Performans</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((stock) => {
            const totalValue = stock.quantity * stock.currentPrice;
            const totalCost = stock.quantity * stock.averageCost;
            const pl = totalValue - totalCost;
            const plPercentage = totalCost > 0 ? (pl / totalCost) * 100 : 0;
            const isUp = pl >= 0;
            
            const isLoading = !stock.isLoaded;
            const currencySymbol = getCurrencySymbol(stock.symbol, stock.category);

            return (
              <TableRow key={stock.id} className="hover:bg-white/[0.04] border-white/[0.04] transition-colors group">
                <TableCell className="font-bold py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                      {currencySymbol && <span className="text-primary">{currencySymbol}</span>}
                      {stock.symbol}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={cn("text-[9px] py-0 h-4", CATEGORY_BADGE_COLORS[stock.category] || "border-white/10 bg-white/5")}>
                        <Tag className="w-2 h-2 mr-1" />
                        {stock.category}
                      </Badge>
                      <span className="text-[10px] font-normal text-muted-foreground uppercase">{stock.name}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  ₺{totalCost.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="font-medium text-muted-foreground">
                  {formatQuantity(stock)}
                </TableCell>
                <TableCell className="text-muted-foreground">₺{stock.averageCost.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-semibold">
                    {isLoading && ["Büyüme", "Emtia", "Temettü", "Döviz", "Kripto"].includes(stock.category) ? (
                      <span className="text-[10px] text-muted-foreground animate-pulse">Piyasa Bekleniyor...</span>
                    ) : (
                      <>
                        ₺{stock.currentPrice.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                        {stock.dailyChange !== 0 && (
                          <span className={cn(
                            "text-[10px] flex items-center",
                            stock.dailyChange >= 0 ? "text-bist-up" : "text-bist-down"
                          )}>
                            {stock.dailyChange >= 0 ? <ArrowUp className="w-2 h-2 mr-0.5" /> : <ArrowDown className="w-2 h-2 mr-0.5" />}
                            %{Math.abs(stock.dailyChange).toFixed(2)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-bold">₺{totalValue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className={cn("font-bold text-sm", isUp ? "text-bist-up" : "text-bist-down")}>
                      {isUp ? "+" : ""}₺{pl.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className={cn("text-[10px] font-medium", isUp ? "text-bist-up/70" : "text-bist-down/70")}>
                      {isUp ? "+" : ""}{plPercentage.toFixed(2)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-white/[0.08]">
                      <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setEditingStock(stock)}>
                        <Edit2 className="w-3.5 h-3.5" />
                        Düzenle
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer gap-2" onClick={() => onDelete(stock.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
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

      <EditStockDialog 
        stock={editingStock}
        isOpen={!!editingStock}
        onClose={() => setEditingStock(null)}
        onUpdate={onUpdate}
      />
    </div>
  );
}
