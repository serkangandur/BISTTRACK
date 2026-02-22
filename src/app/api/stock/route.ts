import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: any[] = [];
  
  // Profesyonel tarayıcı başlığı (CNN'in bizi engellemesini önlemek için)
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  console.log("--- [API TARAMA BAŞLADI - PARALEL MOD] ---");

  try {
    // İki sayfayı aynı anda çekerek hız kazanıyoruz
    const [bistRes, dovizRes] = await Promise.allSettled([
      fetch('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { cache: 'no-store', headers }),
      fetch('https://finans.cnnturk.com/doviz', { cache: 'no-store', headers })
    ]);

    // 1. BIST PARSER
    if (bistRes.status === 'fulfilled' && bistRes.value.ok) {
      const html = await bistRes.value.text();
      const $ = cheerio.load(html);
      $('tr').each((_, element) => {
        const cols = $(element).find('td');
        if (cols.length >= 2) {
          const rawText = $(cols[0]).text().trim().toUpperCase();
          const symbolInTable = rawText.split(/\s+/)[0]; 
          if (requestedSymbols.includes(symbolInTable)) {
            const priceRaw = $(cols[1]).text().trim();
            const priceValue = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(priceValue)) updates.push({ symbol: symbolInTable, price: priceValue, change: 0 });
          }
        }
      });
    }

    // 2. DÖVİZ PARSER
    if (dovizRes.status === 'fulfilled' && dovizRes.value.ok) {
      const html = await dovizRes.value.text();
      const $ = cheerio.load(html);
      const mapping: Record<string, string> = { 'ABD DOLARI': 'USD', 'EURO': 'EUR' };

      $('tr').each((_, element) => {
        const cols = $(element).find('td');
        if (cols.length >= 3) {
          const label = $(cols[0]).text().trim().toUpperCase();
          // Eşleşmeyi kolaylaştırmak için .includes kullanıyoruz
          const matchedKey = Object.keys(mapping).find(key => label.includes(key));
          
          if (matchedKey) {
            const finalSymbol = mapping[matchedKey];
            if (requestedSymbols.includes(finalSymbol)) {
              const priceRaw = $(cols[2]).text().trim();
              const priceValue = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'));
              if (!isNaN(priceValue)) updates.push({ symbol: finalSymbol, price: priceValue, change: 0 });
            }
          }
        }
      });
    }

  } catch (e: any) {
    console.error("Sistem Hatası:", e.message);
  }

  console.log(`--- [TARAMA BİTTİ] Bulunan Veri Sayısı: ${updates.length} ---`);
  return NextResponse.json(updates);
}
