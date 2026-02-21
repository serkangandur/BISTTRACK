
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Gelişmiş Hibrit Scraping API Route v5.0.
 * BIST, Emtia ve Döviz verilerini CNN Türk'ten (Tabelle 1 yöntemi),
 * Kripto (BTC/ETH) verilerini ise Mynet'ten doğrudan ₺ bazlı çeker.
 * Hassasiyet: Kripto miktarları için 7 hane, fiyatlar için 4 hane destekler.
 * Hata Önleme: BIST endeks değerlerinin kripto fiyatlarıyla karışmasını engeller.
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
      axios.get('https://finans.cnnturk.com/doviz', { headers, timeout: 10000 }),
      axios.get('https://finans.mynet.com/bitcoin-try-kripto/', { headers, timeout: 10000 }), // BTC Mynet
      axios.get('https://finans.mynet.com/ethereum-kripto/', { headers, timeout: 10000 }),    // ETH Mynet
    ];

    const results = await Promise.allSettled(requests);

    // 2. DÖVİZ ÖZET TABLO MANTIĞI (CNN Türk)
    const dovizResult = results[3];
    if (dovizResult.status === 'fulfilled') {
      const $ = cheerio.load(dovizResult.value.data);
      const firstTable = $('table').first();
      
      const targets = [
        { symbol: 'USD', key: 'ABD DOLARI' },
        { symbol: 'EUR', key: 'EURO' }
      ];

      targets.forEach(target => {
        firstTable.find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 3) {
            const label = $(tds[0]).text().trim().toUpperCase();
            if (label === target.key) {
              const priceText = $(tds[2]).text().trim();
              if (priceText && priceText.includes(',')) {
                const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(price) && requestedSymbols.includes(target.symbol)) {
                  updates.push({ symbol: target.symbol, price: Number(price.toFixed(4)), change: 0 });
                }
              }
            }
          }
        });
      });
    }

    // 3. BIST TABLO MANTIĞI (CNN Türk)
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

    // 4. EMTİA MANTIĞI (CNN Türk - Tabelle 1)
    const scrapeEmtiaTable = (resultIdx: number, symbol: string) => {
      const result = results[resultIdx];
      if (result.status === 'fulfilled' && requestedSymbols.includes(symbol)) {
        const $ = cheerio.load(result.value.data);
        $('table').first().find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 3) {
            const rowLabel = $(tds[0]).text().trim().toLowerCase();
            if (rowLabel.includes('gram')) {
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

    scrapeEmtiaTable(1, 'ALTIN');
    scrapeEmtiaTable(2, 'GUMUS');

    // 5. KRİPTO MANTIĞI (Mynet Finans - Nokta Atışı & BIST Filtresi)
    const processMynetCrypto = (result: any, symbol: string) => {
      if (result.status === 'fulfilled' && requestedSymbols.includes(symbol)) {
        const $ = cheerio.load(result.value.data);
        
        // Doğrudan fiyat kutularını hedef al
        let priceText = $('.dt-price').first().text().trim() || 
                        $('.last-price').first().text().trim() ||
                        $('.data-price').first().text().trim();

        // Eğer seçicilerle bulunamadıysa regex ile metin içinde ara ama endekslerden kaçın
        if (!priceText) {
          const bodyText = $('body').text();
          // Regex: Binlik noktalı ve virgül ondalıklı yapıyı yakala
          const matches = bodyText.match(/([\d.]+,[\d]+)/g);
          if (matches) {
            for (const m of matches) {
              const p = parseFloat(m.replace(/\./g, '').replace(',', '.'));
              // BIST Filtresi: Eğer BTC bakıyorsak fiyat çok daha yüksek olmalı. 
              // BIST genelde 8k-15k arasındadır. BTC ise milyonlar seviyesindedir.
              if (symbol === 'BTC' && p > 500000) {
                priceText = m;
                break;
              }
              if (symbol === 'ETH' && p > 50000) {
                priceText = m;
                break;
              }
            }
          }
        }

        if (priceText) {
          const cleanPrice = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
          
          if (!isNaN(cleanPrice) && cleanPrice > 0) {
            // BIST Endeks Değeri Kontrolü (Hatalı veriyi engelle)
            // Eğer BTC için 13k-14k gibi bir rakam geldiyse bu BIST'tir, atla.
            if (symbol === 'BTC' && cleanPrice < 100000) {
               console.warn(`[API] ${symbol} için hatalı endeks verisi tespit edildi, atlanıyor: ${cleanPrice}`);
               return;
            }

            console.log(`[API] ${symbol} Mynet Fiyatı: ${cleanPrice.toLocaleString('tr-TR')} ₺`);
            updates.push({
              symbol,
              price: Number(cleanPrice.toFixed(4)), // Fiyatlar için 4 hane
              change: 0
            });
          }
        }
      }
    };

    processMynetCrypto(results[4], 'BTC');
    processMynetCrypto(results[5], 'ETH');

    const foundSymbols = updates.map(u => u.symbol).join(', ');
    console.log(`[API] Güncellenen Varlıklar (${updates.length}): ${foundSymbols}`);

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
