
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StockHolding, AssetCategory } from "@/lib/types";

interface AddStockDialogProps {
  onAdd: (stock: Omit<StockHolding, "id">) => void;
}

const CATEGORIES: AssetCategory[] = [
  "Temettü", "Temettü Sabit", "Büyüme", "Nakit", "Emtia", "Kripto", "Döviz", "Sigorta"
];

export function AddStockDialog({ onAdd }: AddStockDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    symbol: "",
    name: "",
    quantity: "",
    averageCost: "",
    category: "Büyüme" as AssetCategory,
    monthlySalary: "",
  });

  const isEmtia = formData.category === "Emtia";
  const isDoviz = formData.category === "Döviz";
  const needsDropdown = isEmtia || isDoviz;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.symbol || !formData.quantity || !formData.averageCost) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen zorunlu alanları doldurunuz.",
        variant: "destructive",
      });
      return;
    }

    const cost = Number(formData.averageCost);
    const symbolUpper = formData.symbol.toUpperCase().trim();

    const stockData: Omit<StockHolding, "id"> = {
      symbol: symbolUpper,
      name: formData.name || symbolUpper,
      quantity: Number(formData.quantity),
      averageCost: cost,
      currentPrice: cost,
      dailyChange: 0,
      category: formData.category,
    };

    if (formData.category === "Sigorta" && formData.monthlySalary) {
      stockData.monthlySalary = Number(formData.monthlySalary);
    }

    onAdd(stockData);

    setFormData({
      symbol: "",
      name: "",
      quantity: "",
      averageCost: "",
      category: "Büyüme",
      monthlySalary: "",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/80 text-primary-foreground gap-2 font-semibold shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" />
          Varlık Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Yeni Varlık/İşlem Ekle
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Varlık Kategorisi</Label>
            <Select 
              value={formData.category} 
              onValueChange={(val) => {
                const cat = val as AssetCategory;
                let defaultSymbol = "";
                let defaultName = "";
                
                if (cat === "Emtia") {
                  defaultSymbol = "ALTIN";
                  defaultName = "Gram Altın";
                } else if (cat === "Döviz") {
                  defaultSymbol = "USD";
                  defaultName = "ABD Doları";
                }

                setFormData({ 
                  ...formData, 
                  category: cat,
                  symbol: defaultSymbol,
                  name: defaultName
                });
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10">
                <SelectValue placeholder="Kategori Seçin" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Sembol/Kod</Label>
              {needsDropdown ? (
                <Select 
                  value={formData.symbol} 
                  onValueChange={(val) => {
                    let name = val;
                    if (val === "ALTIN") name = "Gram Altın";
                    if (val === "GUMUS") name = "Gram Gümüş";
                    if (val === "USD") name = "ABD Doları";
                    if (val === "EUR") name = "Euro";
                    setFormData({ ...formData, symbol: val, name });
                  }}
                >
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {isEmtia && (
                      <>
                        <SelectItem value="ALTIN">Gram Altın (ALTIN)</SelectItem>
                        <SelectItem value="GUMUS">Gram Gümüş (GUMUS)</SelectItem>
                      </>
                    )}
                    {isDoviz && (
                      <>
                        <SelectItem value="USD">ABD Doları (USD)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="symbol"
                  placeholder="Örn: THYAO, BTC"
                  className="bg-white/5 border-white/10"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Varlık Adı</Label>
              <Input
                id="name"
                placeholder="Örn: Bitcoin"
                className="bg-white/5 border-white/10"
                value={formData.name}
                disabled={needsDropdown}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Adet/Miktar</Label>
              <Input
                id="quantity"
                type="number"
                step={(isEmtia || isDoviz) ? "0.0001" : "1"}
                placeholder="0"
                className="bg-white/5 border-white/10"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="averageCost">Maliyet/Fiyat (₺)</Label>
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
          </div>

          {formData.category === "Sigorta" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <Label htmlFor="monthlySalary" className="text-accent">Aylık Maaş (Sigorta Hedefi İçin)</Label>
              <Input
                id="monthlySalary"
                type="number"
                placeholder="0"
                className="bg-accent/5 border-accent/20 focus:border-accent"
                value={formData.monthlySalary}
                onChange={(e) => setFormData({ ...formData, monthlySalary: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">Maaşınızın 60 katı otomatik olarak hedef belirlenir.</p>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full font-bold">Portföye Ekle</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
