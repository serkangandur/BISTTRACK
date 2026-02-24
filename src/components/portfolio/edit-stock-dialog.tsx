"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StockHolding } from "@/lib/types";

interface EditStockDialogProps {
  stock: StockHolding | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updatedData: Partial<StockHolding>) => void;
}

export function EditStockDialog({ stock, isOpen, onClose, onUpdate }: EditStockDialogProps) {
  const [formData, setFormData] = useState({
    quantity: "",
    averageCost: "",
  });

  useEffect(() => {
    if (stock) {
      setFormData({
        quantity: stock.quantity.toString(),
        averageCost: stock.averageCost.toString(),
      });
    }
  }, [stock]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stock || !formData.quantity || !formData.averageCost) return;

    onUpdate(stock.id, {
      quantity: Number(formData.quantity),
      averageCost: Number(formData.averageCost),
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">İşlemi Düzenle: {stock?.symbol}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-quantity">Adet</Label>
            <Input
              id="edit-quantity"
              type="number"
              placeholder="0"
              className="bg-white/[0.04] border-white/[0.08]"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-averageCost">Ortalama Fiyat (₺)</Label>
            <Input
              id="edit-averageCost"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="bg-white/[0.04] border-white/[0.08]"
              value={formData.averageCost}
              onChange={(e) => setFormData({ ...formData, averageCost: e.target.value })}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full font-bold">Değişiklikleri Kaydet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
