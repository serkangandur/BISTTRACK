"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StockHolding } from "@/lib/types";

interface AddStockDialogProps {
  onAdd: (stock: Omit<StockHolding, "id">) => void;
}

export function AddStockDialog({ onAdd }: AddStockDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    symbol: "",
    name: "",
    quantity: "",
    averageCost: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.symbol || !formData.quantity || !formData.averageCost) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen zorunlu alanları (Sembol, Adet, Maliyet) doldurunuz.",
        variant: "destructive",
      });
      return;
    }

    const cost = Number(formData.averageCost);

    onAdd({
      symbol: formData.symbol.toUpperCase(),
      name: formData.name || formData.symbol.toUpperCase(),
      quantity: Number(formData.quantity),
      averageCost: cost,
      currentPrice: cost, // Başlangıçta maliyet atanır, hemen ardından canlı veri çekilir
      dailyChange: 0,
    });

    setFormData({
      symbol: "",
      name: "",
      quantity: "",
      averageCost: "",
    });
    setOpen(false);
    
    toast({
      title: "Başarılı",
      description: `${formData.symbol.toUpperCase()} portföyünüze eklendi. Fiyatlar birazdan güncellenecektir.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/80 text-primary-foreground gap-2 font-semibold shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" />
          Hisse Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Yeni İşlem Ekle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Sembol (Örn: THYAO)</Label>
              <Input
                id="symbol"
                placeholder="THYAO"
                className="bg-white/5 border-white/10"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Şirket Adı (Opsiyonel)</Label>
              <Input
                id="name"
                placeholder="Türk Hava Yolları"
                className="bg-white/5 border-white/10"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Adet</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="0"
              className="bg-white/5 border-white/10"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="averageCost">Ortalama Fiyat (₺)</Label>
            <Input
              id="averageCost"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="bg-white/5 border-white/10"
              value={formData.averageCost}
              onChange={(e) => setFormData({ ...formData, averageCost: e.target.value })}
            />
          </div>

          <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 mt-2">
            <p className="text-[10px] text-primary font-medium uppercase tracking-tight">Bilgi</p>
            <p className="text-xs text-muted-foreground mt-1">
              Güncel fiyat verileri Yahoo Finance üzerinden otomatik olarak çekilecektir.
            </p>
          </div>

          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full font-bold">Kaydet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
