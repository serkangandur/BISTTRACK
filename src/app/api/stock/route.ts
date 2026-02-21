
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Hibrit Veri Motoru v18.0 - "Midas Kripto Entegrasyonu & Esnek Eşleşme".
 * - BIST, Emtia ve Döviz: CNN Türk (Tabelle 1 / İlk Tablo Yöntemi)
 * - Kripto (BTC ve ETH): Midas Canlı Kripto (Nokta Atışı Scraping)
 * - Güvenlik: Esnek sembol eşleşmesi ve zorunlu veri gönderimi.
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

  console.log(`[API] [GELEN İSTEK] Semboller: ${requestedSymbols.join(', ')}`);

  const updates: any[] = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  try {
    // 1. PARALEL İSTEKLER (CNN Türk + Midas)
    const mainRequests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/doviz', { headers, timeout: 10000 }),
      axios.get('https://www.getmidas.com/canli-kripto/bitcoin-fiyati/', { headers, timeout: 10000 }),
      axios.get('https://www.getmidas.com/canli-kripto/ethereum-fiyati/', { headers, timeout: 10000 }),
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

    // 5. KRİPTO (MİDAS - NOKTA ATIŞI SCRAPING & ZORUNLU EKLEME)
    const cryptoConfig = [
      { id: 'BTC', keywords: ['BTC', 'BITCOIN', 'BİTCOİN', 'BİTCOİN TÜRK LİRASI'], midasIdx: 4 },
      { id: 'ETH', keywords: ['ETH', 'ETHEREUM', 'ETHERİUM', 'ETHEREUM TÜRK LİRASI'], midasIdx: 5 },
    ];

    cryptoConfig.forEach(crypto => {
      const res = results[crypto.midasIdx];
      if (res.status === 'fulfilled') {
        const $ = cheerio.load(res.value.data);
        
        // Midas'ta fiyat genellikle büyük bir başlık veya spesifik bir class içindedir
        let priceText = $('.currency-price').first().text().trim() || 
                        $('h1').first().text().trim() || 
                        $('div[class*="price"]').first().text().trim();

        if (priceText) {
          // Temizlik: "3.150.450,23 TL" -> "3150450.23"
          const cleanedPrice = priceText
            .replace(/[^\d,.]/g, '') // Rakam, nokta ve virgül dışındaki her şeyi sil
            .replace(/\./g, '')      // Binlik ayırıcı noktaları sil
            .replace(',', '.');      // Ondalık virgülü noktaya çevir

          const finalPrice = parseFloat(cleanedPrice);

          if (!isNaN(finalPrice) && finalPrice > 0) {
            const priceRounded = Number(finalPrice.toFixed(4));
            
            // ZORUNLU EKLEME: 'BTC' ve 'ETH' olarak her zaman ekle
            updates.push({ symbol: crypto.id, price: priceRounded, change: 0 });

            // ESNEK EŞLEŞME: Kullanıcı 'BITCOIN' falan dediyse onu da ekle
            requestedSymbols.forEach(req => {
              if (crypto.keywords.includes(req) && req !== crypto.id) {
                updates.push({ symbol: req, price: priceRounded, change: 0 });
              }
            });

            console.log(`[MİDAS] ${crypto.id} Fiyatı: ${priceRounded.toLocaleString('tr-TR')} ₺`);
          }
        }
      }
    });

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
