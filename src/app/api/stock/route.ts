import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: any[] = [];
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

  try {
    // --- 1. DÖVİZ TARAMA (30-100 TL BANDI FİLTRESİ) ---
    const dovizRes = await fetch(`https://finans.cnnturk.com/doviz?t=${Date.now()}`, { headers, cache: 'no-store' });
    if (dovizRes.ok) {
      const $ = cheerio.load(await dovizRes.text());
      const mapping: any = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };

      $('tr').each((_, el) => {
        const label = $(el).find('td').first().text().trim().toUpperCase();
        const matchedKey = Object.keys(mapping).find(k => label.includes(k));

        if (matchedKey) {
          const sym = mapping[matchedKey];
          if (requestedSymbols.includes(sym)) {
            let foundPrice = 0;
            const rowValues: number[] = [];
            
            // Satırdaki tüm hücreleri tara
            $(el).find('td').each((i, td) => {
              const valRaw = $(td).text().trim().replace(/\./g, '').replace(',', '.');
              const valNum = parseFloat(valRaw);
              
              if (!isNaN(valNum)) {
                rowValues.push(valNum);
                // Gerçek Kur Filtresi: 30 ile 100 bandında olmalı (Değişim oranları genellikle < 5 olur)
                if (valNum > 30 && valNum < 100 && foundPrice === 0) {
                  foundPrice = valNum;
                }
              }
            });

            console.log(`[SCAN] ${label} satırında bulunan sayılar: ${rowValues.join(', ')}`);

            if (foundPrice > 0) {
              updates.push({ symbol: sym, price: Number(foundPrice.toFixed(4)), change: 0 });
              console.log(`[DÖVİZ GÜVENLİ] ${sym} Yakalandı: ${foundPrice} ₺`);
            }
          }
        }
      });
    }

    // --- 2. BIST TARAMA (HİSSELER) ---
    const bistRes = await fetch(`https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri?t=${Date.now()}`, { headers, cache: 'no-store' });
    if (bistRes.ok) {
      const $ = cheerio.load(await bistRes.text());
      $('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 2) {
          const rawName = $(tds[0]).text().trim().toUpperCase();
          const sym = rawName.split(/\s+/)[0]; 
          
          if (requestedSymbols.includes(sym)) {
            const rawPrice = $(tds[1]).text().trim().replace(/\./g, '').replace(',', '.');
            const price = parseFloat(rawPrice);
            if (!isNaN(price) && price > 0) {
              updates.push({ symbol: sym, price: Number(price.toFixed(4)), change: 0 });
              console.log(`[BIST] ${sym} Bulundu: ${price} ₺`);
            }
          }
        }
      });
    }
  } catch (e: any) { 
    console.log("[API HATA]:", e.message); 
  }

  return NextResponse.json(updates);
}
