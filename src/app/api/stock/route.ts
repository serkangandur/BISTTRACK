
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Gelişmiş Hibrit Scraping API Route.
 * Hem BIST tablolarını hem de Altın/Gümüş sayfalarını Tablo odaklı tarama yöntemiyle okur.
 * Altın ve Gümüş için garantici "Tablo 1" mantığı kullanılır.
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json([], { status: 200 });
  }

  const requestedSymbols = symbolsParam
    .split(',')
    .map(s => s.trim().toUpperCase());

  const updates: any[] = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  try {
    // 1. PARALEL İSTEKLER
    const requests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 10000 }),
    ];

    const results = await Promise.allSettled(requests);

    // 2. BIST TABLO MANTIĞI (Hisseler İçin)
    const bistResult = results[0];
    if (bistResult.status === 'fulfilled') {
      const $ = cheerio.load(bistResult.value.data);
      $('tr').each((_, element) => {
        const tds = $(element).find('td');
        if (tds.length < 3) return;

        const rawText = $(tds[0]).text().trim().toUpperCase();
        const symbol = rawText.split(/[\s-]/)[0];

        if (requestedSymbols.includes(symbol)) {
          let priceText = "";
          const col2 = $(tds[1]).text().trim();
          const col3 = $(tds[2]).text().trim();

          if (col2.includes(',') && !col2.includes('%')) priceText = col2;
          else if (col3.includes(',') && !col3.includes('%')) priceText = col3;

          if (priceText) {
            const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price) && price > 0) {
              updates.push({ symbol, price, change: 0 });
            }
          }
        }
      });
    }

    // 3. ALTIN MANTIĞI (Garantici Tablo Odaklı)
    const goldResult = results[1];
    if (goldResult.status === 'fulfilled' && requestedSymbols.includes('ALTIN')) {
      const $ = cheerio.load(goldResult.value.data);
      let found = false;
      
      // Sayfadaki ilk tabloyu hedef al
      $('table').first().find('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 3) {
          const col0 = $(tds[0]).text().trim();
          // İlk sütunda 'Gram' geçen satırı bul
          if (col0.toLowerCase().includes('gram')) {
            const priceText = $(tds[2]).text().trim(); // SATIŞ (TL) sütunu (td[2])
            if (priceText && priceText.includes(',')) {
              const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
              if (!isNaN(price)) {
                updates.push({ symbol: 'ALTIN', price, change: 0 });
                console.log(`[API] ALTIN (Tablo): ${price}`);
                found = true;
                return false; // Break each
              }
            }
          }
        }
      });

      // Regex Fallback (Tablo bulunamazsa)
      if (!found) {
        const bodyText = $('body').text();
        const goldMatch = bodyText.match(/Gram Altın[\s:]+([\d.]+,[\d]+)/i);
        if (goldMatch && goldMatch[1]) {
          const price = parseFloat(goldMatch[1].replace(/\./g, '').replace(',', '.'));
          if (!isNaN(price)) {
            updates.push({ symbol: 'ALTIN', price, change: 0 });
          }
        }
      }
    }

    // 4. GÜMÜŞ MANTIĞI (Garantici Tablo Odaklı)
    const silverResult = results[2];
    if (silverResult.status === 'fulfilled' && requestedSymbols.includes('GUMUS')) {
      const $ = cheerio.load(silverResult.value.data);
      let found = false;

      // Sayfadaki ilk tabloyu hedef al
      $('table').first().find('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 3) {
          const col0 = $(tds[0]).text().trim();
          // İlk sütunda 'Gram' geçen satırı bul
          if (col0.toLowerCase().includes('gram')) {
            const priceText = $(tds[2]).text().trim(); // SATIŞ (TL) sütunu (td[2])
            if (priceText && priceText.includes(',')) {
              const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
              if (!isNaN(price)) {
                updates.push({ symbol: 'GUMUS', price, change: 0 });
                console.log(`[API] GUMUS (Tablo): ${price}`);
                found = true;
                return false; // Break each
              }
            }
          }
        }
      });

      // Regex Fallback (Tablo bulunamazsa)
      if (!found) {
        const bodyText = $('body').text();
        const silverMatch = bodyText.match(/Gümüş Gram[\s:]+([\d.]+,[\d]+)/i) || 
                            bodyText.match(/Gram Gümüş[\s:]+([\d.]+,[\d]+)/i);
        if (silverMatch && silverMatch[1]) {
          const price = parseFloat(silverMatch[1].replace(/\./g, '').replace(',', '.'));
          if (!isNaN(price)) {
            updates.push({ symbol: 'GUMUS', price, change: 0 });
          }
        }
      }
    }

    const foundSymbols = updates.map(u => u.symbol).join(', ');
    console.log(`[API] Güncellenen Varlıklar (${updates.length}): ${foundSymbols}`);

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
