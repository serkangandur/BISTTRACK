
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Gelişmiş Hibrit Veri Motoru v12.0 - "Doviz.com Kripto Entegrasyonu".
 * - BIST, Emtia ve Döviz: CNN Türk (Tabelle 1 / İlk Tablo Yöntemi)
 * - Kripto (BTC ve ETH): Doviz.com (Bot Dostu ve Doğrudan ₺)
 * - Güvenlik: BTC > 1M ₺ ve ETH > 30K ₺ altındaki verileri eler.
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
    const mainRequests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/doviz', { headers, timeout: 10000 }),
      axios.get('https://www.doviz.com/kripto-paralar', { headers, timeout: 10000 }), // YENİ KAYNAK: DOVIZ.COM
    ];

    const results = await Promise.allSettled(mainRequests);

    // 2. DÖVİZ (CNN - TABELLE 1)
    const dovizResult = results[3];
    if (dovizResult.status === 'fulfilled') {
      const $ = cheerio.load(dovizResult.value.data);
      const firstTable = $('table').first();
      
      const targets = [
        { symbol: 'USD', key: 'ABD DOLARI' },
        { symbol: 'EUR', key: 'EURO' }
      ];

      targets.forEach(target => {
        if (!requestedSymbols.includes(target.symbol)) return;
        firstTable.find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 3) {
            const label = $(tds[0]).text().trim().toUpperCase();
            if (label === target.key) {
              const priceText = $(tds[2]).text().trim();
              if (priceText && priceText.includes(',')) {
                const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(price)) updates.push({ symbol: target.symbol, price: Number(price.toFixed(4)), change: 0 });
              }
            }
          }
        });
      });
    }

    // 3. BIST HİSSELERİ (CNN)
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
          const col1 = $(tds[1]).text().trim();
          const col2 = $(tds[2]).text().trim();
          if (col1.includes(',') && !col1.includes('%')) priceText = col1;
          else if (col2.includes(',') && !col2.includes('%')) priceText = col2;

          if (priceText) {
            const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price) && price > 0) {
              updates.push({ symbol, price: Number(price.toFixed(4)), change: 0 });
            }
          }
        }
      });
    }

    // 4. EMTİA (CNN)
    const scrapeEmtia = (idx: number, symbol: string) => {
      const res = results[idx];
      if (res.status === 'fulfilled' && requestedSymbols.includes(symbol)) {
        const $ = cheerio.load(res.value.data);
        $('table').first().find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 3) {
            const label = $(tds[0]).text().trim().toLowerCase();
            if (label.includes('gram')) {
              const priceText = $(tds[2]).text().trim();
              if (priceText && priceText.includes(',')) {
                const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(price)) {
                  updates.push({ symbol, price: Number(price.toFixed(4)), change: 0 });
                  return false;
                }
              }
            }
          }
        });
      }
    };
    scrapeEmtia(1, 'ALTIN');
    scrapeEmtia(2, 'GUMUS');

    // 5. KRİPTO (YENİ KAYNAK: DOVIZ.COM)
    const dovizKriptoRes = results[4];
    if (dovizKriptoRes.status === 'fulfilled') {
      const $ = cheerio.load(dovizKriptoRes.value.data);
      console.log("[TEST] Doviz.com Kripto verileri taranıyor...");

      const processCoin = (symbol: string, nameSearch: string, minPrice: number) => {
        if (!requestedSymbols.includes(symbol)) return;
        
        $('table').first().find('tr').each((_, row) => {
          const rowText = $(row).text().toLowerCase();
          if (rowText.includes(nameSearch)) {
            const tds = $(row).find('td');
            // Doviz.com'da fiyata sahip hücreyi bul
            tds.each((_, td) => {
              const cellText = $(td).text().trim();
              if (cellText.includes(',') && !cellText.includes('%')) {
                const price = parseFloat(cellText.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(price) && price > minPrice) {
                  if (!updates.some(u => u.symbol === symbol)) {
                    updates.push({ symbol, price: Number(price.toFixed(4)), change: 0 });
                    console.log(`[BULDUM] Doviz.com ${symbol} Fiyat: ${price.toLocaleString('tr-TR')} ₺`);
                    return false;
                  }
                }
              }
            });
            if (updates.some(u => u.symbol === symbol)) return false;
          }
        });
      };

      processCoin('BTC', 'bitcoin', 1000000);
      processCoin('ETH', 'ethereum', 30000);
    } else {
      console.error("[HATA] Doviz.com'a bağlanılamadı");
    }

    const foundSymbols = updates.map(u => u.symbol).join(', ');
    console.log(`[API] Güncellenen Varlıklar (${updates.length}): ${foundSymbols}`);

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
