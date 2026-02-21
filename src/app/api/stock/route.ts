
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * BIST ve Emtia (Altın/Gümüş) verilerini çeken genişletilmiş Scraping API Route.
 * Hisseler için ana tabloyu, emtialar için ise özel kur sayfalarını tarar.
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
    // PARALEL VERİ ÇEKME (Hız ve Dayanıklılık için)
    const requests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 12000 }),
    ];

    if (requestedSymbols.includes('ALTIN')) {
      requests.push(axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 8000 }));
    }
    
    if (requestedSymbols.includes('GUMUS')) {
      requests.push(axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 8000 }));
    }

    const responses = await Promise.allSettled(requests);

    // 1. BIST HİSSELERİ İŞLEME
    const bistResult = responses[0];
    if (bistResult.status === 'fulfilled') {
      const $ = cheerio.load(bistResult.value.data);
      $('tr').each((_, element) => {
        const tds = $(element).find('td');
        if (tds.length < 3) return;

        const rawSymbolText = $(tds[0]).text().trim().toUpperCase();
        const extractedSymbol = rawSymbolText.split(/[\s-]/)[0];
        
        if (requestedSymbols.includes(extractedSymbol)) {
          let priceText = "";
          const col2Text = $(tds[1]).text().trim();
          const col3Text = $(tds[2]).text().trim();

          if (col2Text.includes(',') && !col2Text.includes('%')) {
            priceText = col2Text;
          } else if (col3Text.includes(',') && !col3Text.includes('%')) {
            priceText = col3Text;
          }

          if (priceText) {
            const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price) && price > 0 && !updates.find(u => u.symbol === extractedSymbol)) {
              updates.push({ symbol: extractedSymbol, price: price, change: 0 });
            }
          }
        }
      });
    }

    // 2. ALTIN VERİSİ İŞLEME
    if (requestedSymbols.includes('ALTIN')) {
      const goldResponse = responses.find(r => r.status === 'fulfilled' && r.value.config.url.includes('/altin')) as any;
      if (goldResponse) {
        const $ = cheerio.load(goldResponse.value.data);
        // Gram Altın satış fiyatını bulmak için geniş kapsamlı tarama
        let goldPriceText = "";
        $('.kur-box, .kur-item').each((_, el) => {
          const text = $(el).text();
          if (text.includes('Gram Altın')) {
            const matches = text.match(/[\d.]+,[\d]+/);
            if (matches) goldPriceText = matches[0];
          }
        });

        if (goldPriceText) {
          const price = parseFloat(goldPriceText.replace(/\./g, '').replace(',', '.'));
          if (!isNaN(price)) updates.push({ symbol: 'ALTIN', price, change: 0 });
        }
      }
    }

    // 3. GÜMÜŞ VERİSİ İŞLEME
    if (requestedSymbols.includes('GUMUS')) {
      const silverResponse = responses.find(r => r.status === 'fulfilled' && r.value.config.url.includes('/gumus')) as any;
      if (silverResponse) {
        const $ = cheerio.load(silverResponse.value.data);
        // Gümüş gram fiyatı genellikle büyük puntolu bir alandadır
        let silverPriceText = $('.last-val, .current-price, .price-value').first().text().trim();
        
        // Eğer seçicilerle bulunamazsa, virgüllü ilk sayısal yapıyı ara
        if (!silverPriceText || !silverPriceText.includes(',')) {
          $('span, div, p').each((_, el) => {
            const t = $(el).text().trim();
            if (t.includes(',') && t.length < 15 && /^\d+/.test(t)) {
              silverPriceText = t;
              return false;
            }
          });
        }

        const matches = silverPriceText.match(/[\d.]+,[\d]+/);
        if (matches) {
          const price = parseFloat(matches[0].replace(/\./g, '').replace(',', '.'));
          if (!isNaN(price)) updates.push({ symbol: 'GUMUS', price, change: 0 });
        }
      }
    }

    console.log(`[API/STOCK] ${updates.length} varlık için güncel fiyatlar çekildi.`);
    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API/STOCK] GENEL_HATA:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
