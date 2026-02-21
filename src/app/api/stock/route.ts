
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Gelişmiş Hibrit Veri Motoru v7.0.
 * - BIST, Emtia ve Döviz: CNN Türk (Tabelle 1 / İlk Tablo Yöntemi)
 * - BTC ve ETH (Kripto): Mynet Finans (Doğrudan ₺ Sayfaları)
 * - Güvenlik: BTC fiyatının BIST endeksiyle (13k bandı) karışmasını önleyen 100k filtresi.
 * - Hassasiyet: Fiyatlar 4 hane, kripto miktarları 7 hane.
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
    // 1. PARALEL İSTEKLER (CNN TÜRK & MYNET HİBRİT)
    const mainRequests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/doviz', { headers, timeout: 10000 }),
    ];

    // Kripto varsa Mynet isteklerini ekle
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

    // 5. KRİPTO (MYNET - NOKTA ATIŞI & 100K FİLTRESİ)
    cryptoTasks.forEach((task, i) => {
      const resIdx = 4 + i;
      const res = results[resIdx];
      if (res && res.status === 'fulfilled') {
        const $ = cheerio.load(res.value.data);
        
        // Mynet fiyat kutuları .dt-price veya .last-price içindedir
        let priceText = $('.dt-price').first().text().trim() || 
                        $('.last-price').first().text().trim() ||
                        $('span[class*="price"]').first().text().trim();

        if (priceText) {
          const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
          
          // BTC Güvenlik Filtresi (BIST endeksi 13k bandında, BTC 3.3M+ bandında)
          if (task.symbol === 'BTC' && price < 100000) {
            // Rakam küçükse diğer seçicileri tara
            $('span, div').each((_, el) => {
              const text = $(el).text().trim();
              if (text.includes('.') && text.includes(',') && text.length > 8) {
                const altPrice = parseFloat(text.replace(/\./g, '').replace(',', '.'));
                if (altPrice > 100000) {
                   updates.push({ symbol: task.symbol, price: Number(altPrice.toFixed(4)), change: 0 });
                   console.log(`[OK] BTC Mynet (Alt Seçici): ${altPrice.toLocaleString('tr-TR')} ₺`);
                   return false;
                }
              }
            });
          } else if (!isNaN(price) && price > 0) {
            console.log(`[OK] ${task.symbol} Mynet: ${price.toLocaleString('tr-TR')} ₺`);
            updates.push({ symbol: task.symbol, price: Number(price.toFixed(4)), change: 0 });
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
