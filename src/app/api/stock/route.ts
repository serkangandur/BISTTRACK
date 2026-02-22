import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: any[] = [];
  
  // Excel benzeri temiz başlıklar
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Connection': 'keep-alive'
  };

  const urls = [
    'https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri',
    'https://finans.cnnturk.com/doviz'
  ];

  try {
    for (const url of urls) {
      // Url sonuna ?t= ekleyerek cache'i patlatıyoruz (Excel'in yaptığı gibi)
      const res = await fetch(`${url}?t=${Date.now()}`, { headers, cache: 'no-store' });
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      $('tr').each((_, el) => {
        const text = $(el).text().toUpperCase();
        const tds = $(el).find('td');
        
        if (tds.length >= 2) {
          requestedSymbols.forEach(s => {
            // Satırın içinde sembol geçiyor mu? (Örn: PAGYO veya ABD DOLARI)
            const isMatch = text.includes(s) || 
                          (s === 'USD' && text.includes('ABD DOLARI')) || 
                          (s === 'EUR' && text.includes('EURO'));

            if (isMatch) {
              // Satırdaki tüm sayıları bul ve fiyat olabilecek olanı seç
              tds.each((i, td) => {
                // Sütun 0 genellikle isimdir, fiyata 1. sütundan itibaren bakıyoruz
                if (i === 0) return true; 

                const rawVal = $(td).text().trim();
                const val = rawVal.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(val);

                // 0.1 ile 10.000.000 arasındaki mantıklı ilk sayıyı al
                if (!isNaN(num) && num > 0.1) {
                  // Aynı sembolü mükerrer eklememek için kontrol
                  if (!updates.find(u => u.symbol === s)) {
                    updates.push({ symbol: s, price: Number(num.toFixed(4)), change: 0 });
                    console.log(`[EXCEL-SIM] ${s} Yakalandı: ${num}`);
                  }
                  return false; // Satır taramasını bitir
                }
              });
            }
          });
        }
      });
    }
  } catch (e: any) {
    console.log("Hata:", e.message);
  }

  console.log(`[API SONUÇ] ${updates.length} veri yakalandı.`);
  return NextResponse.json(updates);
}