import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  if (!symbolsParam) return NextResponse.json([]);

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: any[] = [];

  try {
    const response = await fetch('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) return NextResponse.json([]);

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Excel'deki "Tabelle 1" yapısına göre tüm satırları tara
    $('tr').each((_, element) => {
      const cols = $(element).find('td');
      if (cols.length >= 2) {
        // Excel Sütun 0: Menkul (Sembol + Ad) -> İlk kelimeyi al
        const rawText = $(cols[0]).text().trim().toUpperCase();
        const symbolInTable = rawText.split(/\s+/)[0]; 
        
        if (requestedSymbols.includes(symbolInTable)) {
          // Excel Sütun 1: Son Fiyat
          let priceRaw = $(cols[1]).text().trim();
          const priceValue = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'));

          if (!isNaN(priceValue)) {
            updates.push({
              symbol: symbolInTable,
              price: priceValue,
              change: 0
            });
            console.log(`[BIST-EXCEL] ${symbolInTable} Bulundu: ${priceValue} ₺`);
          }
        }
      }
    });

    return NextResponse.json(updates);
  } catch (error) {
    return NextResponse.json(updates);
  }
}
