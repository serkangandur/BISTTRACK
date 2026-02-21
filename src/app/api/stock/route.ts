
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Gelişmiş Hibrit Scraping API Route v3.0.
 * BIST, Emtia (Altın/Gümüş), Döviz (USD/EUR) ve Kripto (BTC/ETH) verilerini toplu çeker.
 * Kripto paralar için Dolar fiyatını çekip güncel kurla ₺'ye çevirir.
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
    // 1. PARALEL İSTEKLER (BIST, Altın, Gümüş, Döviz ve Kripto)
    const requests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/doviz', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/kripto-paralar', { headers, timeout: 10000 }),
    ];

    const results = await Promise.allSettled(requests);

    // 2. DÖVİZ ÖZET TABLO MANTIĞI (Önce kuru çekelim ki kripto hesaplamada kullanalım)
    let usdTryRate = 0;
    const dovizResult = results[3];
    if (dovizResult.status === 'fulfilled') {
      const $ = cheerio.load(dovizResult.value.data);
      const firstTable = $('table').first();
      
      const targets = [
        { symbol: 'USD', key: 'ABD DOLARI' },
        { symbol: 'EUR', key: 'EURO' }
      ];

      targets.forEach(target => {
        let found = false;
        firstTable.find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 3) {
            const label = $(tds[0]).text().trim().toUpperCase();
            if (label === target.key) {
              const priceText = $(tds[2]).text().trim();
              if (priceText && priceText.includes(',')) {
                const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(price)) {
                  if (requestedSymbols.includes(target.symbol)) {
                    updates.push({ symbol: target.symbol, price, change: 0 });
                  }
                  if (target.symbol === 'USD') usdTryRate = price;
                  found = true;
                  return false;
                }
              }
            }
          }
        });

        if (!found) {
          const bodyText = $('body').text();
          const regex = new RegExp(`${target.key}[\\s:]+([\\d.]+,[\\d]+)`, 'i');
          const match = bodyText.match(regex);
          if (match && match[1]) {
            const price = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price)) {
              if (requestedSymbols.includes(target.symbol)) {
                updates.push({ symbol: target.symbol, price, change: 0 });
              }
              if (target.symbol === 'USD') usdTryRate = price;
            }
          }
        }
      });
    }

    // 3. BIST TABLO MANTIĞI
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
              updates.push({ symbol, price, change: 0 });
            }
          }
        }
      });
    }

    // 4. EMTİA MANTIĞI
    const scrapeEmtiaTable = (resultIdx: number, symbol: string, targetKey: string) => {
      const result = results[resultIdx];
      if (result.status === 'fulfilled' && requestedSymbols.includes(symbol)) {
        const $ = cheerio.load(result.value.data);
        let found = false;

        $('table').first().find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 3) {
            const rowLabel = $(tds[0]).text().trim().toLowerCase();
            if (rowLabel.includes(targetKey.toLowerCase())) {
              const priceText = $(tds[2]).text().trim();
              if (priceText && priceText.includes(',')) {
                const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(price)) {
                  updates.push({ symbol, price, change: 0 });
                  found = true;
                  return false;
                }
              }
            }
          }
        });
      }
    };

    scrapeEmtiaTable(1, 'ALTIN', 'Gram');
    scrapeEmtiaTable(2, 'GUMUS', 'Gram');

    // 5. KRİPTO MANTIĞI (₺ Hesaplamalı)
    const kriptoResult = results[4];
    if (kriptoResult.status === 'fulfilled') {
      const $ = cheerio.load(kriptoResult.value.data);
      const firstTable = $('table').first();

      const cryptoTargets = [
        { symbol: 'BTC', keys: ['BITCOIN', 'BTC'] },
        { symbol: 'ETH', keys: ['ETHEREUM', 'ETH'] }
      ];

      cryptoTargets.forEach(target => {
        if (!requestedSymbols.includes(target.symbol)) return;

        firstTable.find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 2) {
            const label = $(tds[0]).text().trim().toUpperCase();
            if (target.keys.some(k => label.includes(k))) {
              // Fiyat genellikle 2. veya 3. sütundadır
              let priceText = $(tds[1]).text().trim() || $(tds[2]).text().trim();
              
              if (priceText) {
                // Kripto fiyatları bazen 65.400,50 bazen 65400.50 formatında gelebilir
                // Virgül binlik, nokta ondalık olabilir veya tam tersi. CNN Türk genellikle virgül ondalık kullanır.
                const usdPrice = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
                
                if (!isNaN(usdPrice)) {
                  // Eğer kur varsa ₺'ye çevir, yoksa ham doları bırak (ama hedefimiz ₺)
                  const finalPrice = usdTryRate > 0 ? usdPrice * usdTryRate : usdPrice;
                  updates.push({ 
                    symbol: target.symbol, 
                    price: Number(finalPrice.toFixed(4)), 
                    change: 0 
                  });
                  return false;
                }
              }
            }
          }
        });
      });
    }

    const foundSymbols = updates.map(u => u.symbol).join(', ');
    console.log(`[API] Güncellenen Varlıklar (${updates.length}): ${foundSymbols}`);

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
