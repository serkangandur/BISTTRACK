
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Gelişmiş Hibrit Veri Motoru v8.0.
 * - BIST, Emtia ve Döviz: CNN Türk (Tabelle 1 / İlk Tablo Yöntemi)
 * - BTC ve ETH (Kripto): Mynet Finans (Doğrudan ₺ Sayfaları)
 * - Güvenlik: BTC (>100k) ve ETH (>50k) filtreleri ile BIST endeksi (13k) karışıklığı önlenir.
 * - Yedek Mekanizma: Mynet başarısız olursa CNN Türk Kripto tablosundan veri çekilir.
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
    // 1. PARALEL İSTEKLER (CNN TÜRK & MYNET & CNN KRİPTO YEDEK)
    const mainRequests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/doviz', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/kripto-paralar', { headers, timeout: 10000 }), // CNN Kripto Yedek
    ];

    const cryptoTasks: { symbol: string; url: string }[] = [];
    if (requestedSymbols.includes('BTC')) cryptoTasks.push({ symbol: 'BTC', url: 'https://finans.mynet.com/bitcoin-try-kripto/' });
    if (requestedSymbols.includes('ETH')) cryptoTasks.push({ symbol: 'ETH', url: 'https://finans.mynet.com/ethereum-kripto/' });

    const allRequests = [...mainRequests, ...cryptoTasks.map(t => axios.get(t.url, { headers, timeout: 10000 }))];
    const results = await Promise.allSettled(allRequests);

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

    // 3. BIST HİSSELERİ (CNN - TABLO MANTIĞI)
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

    // 4. EMTİA (CNN - TABELLE 1)
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

    // 5. KRİPTO (MYNET NOKTA ATIŞI + CNN YEDEK)
    const cnnKriptoRes = results[4];
    
    cryptoTasks.forEach((task, i) => {
      const resIdx = 5 + i;
      const res = results[resIdx];
      let priceFound = false;

      // MYNET TARAMA
      if (res && res.status === 'fulfilled') {
        const $ = cheerio.load(res.value.data);
        
        // Sadece ana fiyat kutusuna odaklan
        let priceText = $('.dt-price').first().text().trim() || 
                        $('.last-price').first().text().trim() ||
                        $('span[class*="price"]').first().text().trim();

        if (priceText) {
          let price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
          
          // BIST Endeksi Filtresi (13.934 civarı yanlış veriyi reddet)
          const isInvalidBTC = task.symbol === 'BTC' && price < 100000;
          const isInvalidETH = task.symbol === 'ETH' && price < 50000;

          if (isInvalidBTC || isInvalidETH) {
            // Yanlış veri gelirse alternatif seçicileri tara
            $('span, div, p').each((_, el) => {
              const text = $(el).text().trim();
              if (text.includes('.') && text.includes(',') && text.length > 5) {
                const altPrice = parseFloat(text.replace(/\./g, '').replace(',', '.'));
                if ((task.symbol === 'BTC' && altPrice > 100000) || (task.symbol === 'ETH' && altPrice > 50000)) {
                   price = altPrice;
                   priceFound = true;
                   return false;
                }
              }
            });
          } else if (!isNaN(price) && price > 0) {
            priceFound = true;
          }

          if (priceFound) {
            updates.push({ symbol: task.symbol, price: Number(price.toFixed(4)), change: 0 });
            console.log(`[OK] ${task.symbol} Mynet: ${price.toLocaleString('tr-TR')} ₺`);
          }
        }
      }

      // CNN YEDEK TARAMA (Mynet başarısız olursa)
      if (!priceFound && cnnKriptoRes.status === 'fulfilled') {
        const $ = cheerio.load(cnnKriptoRes.value.data);
        const rowIdx = task.symbol === 'BTC' ? 2 : 6; // 3. ve 7. satırlar (0 tabanlı index)
        const row = $('table').first().find('tr').eq(rowIdx);
        
        if (row.length > 0) {
          const label = row.find('td').first().text().trim();
          if (label.includes(task.symbol === 'BTC' ? 'Bitcoin' : 'Ethereum')) {
            const priceText = row.find('td').eq(1).text().trim();
            const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price) && price > 0) {
              updates.push({ symbol: task.symbol, price: Number(price.toFixed(4)), change: 0 });
              console.log(`[YEDEK] ${task.symbol} CNN: ${price.toLocaleString('tr-TR')} ₺`);
              priceFound = true;
            }
          }
        }
      }
    });

    const foundSymbols = updates.map(u => u.symbol).join(', ');
    console.log(`[API] Güncellenen Varlıklar (${updates.length}): ${foundSymbols}`);

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
