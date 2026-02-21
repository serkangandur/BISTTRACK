
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Gelişmiş Hibrit Scraping API Route v6.0.
 * BIST, Emtia ve Döviz verilerini CNN Türk'ten (Tabelle 1 yöntemi),
 * Kripto (BTC/ETH) verilerini ise CNN Türk Kripto özet tablosundan ₺ bazlı çeker.
 * Hassasiyet: Kripto miktarları için 7 hane, fiyatlar için 4 hane destekler.
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
      axios.get('https://finans.cnnturk.com/kripto-paralar', { headers, timeout: 10000 }), // Kripto Özet Sayfası
    ];

    const results = await Promise.allSettled(requests);

    // 2. DÖVİZ ÖZET TABLO MANTIĞI
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
              updates.push({ symbol, price: Number(price.toFixed(4)), change: 0 });
            }
          }
        }
      });
    }

    // 4. EMTİA MANTIĞI (Tabelle 1)
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

    // 5. KRİPTO MANTIĞI (Excel Satır Sayma - Nokta Atışı)
    const kriptoResult = results[4];
    if (kriptoResult.status === 'fulfilled' && (requestedSymbols.includes('BTC') || requestedSymbols.includes('ETH'))) {
      const $ = cheerio.load(kriptoResult.value.data);
      const table = $('table').first();
      
      const processCryptoRow = (rowIdx: number, symbol: string, expectedName: string) => {
        if (!requestedSymbols.includes(symbol)) return;
        
        let row = table.find('tr').eq(rowIdx); // Direct index access
        let label = row.find('td').eq(0).text().trim();
        
        // Güvenlik Filtresi: Eğer satır beklenen değilse veya isim uyuşmuyorsa tara
        if (!label.toLowerCase().includes(expectedName.toLowerCase())) {
          table.find('tr').each((_, el) => {
            const currentLabel = $(el).find('td').eq(0).text().trim();
            // Hem coin adını hem de 'Türk Lirası' ibaresini aynı anda barındıran satırı bul
            if (currentLabel.toLowerCase().includes(expectedName.toLowerCase()) && 
                currentLabel.toLowerCase().includes('türk lirası')) {
              row = $(el);
              label = currentLabel;
              return false;
            }
          });
        }

        const priceText = row.find('td').eq(1).text().trim();
        if (priceText && priceText.includes(',')) {
          // Binlik noktalarını sil, virgülü noktaya çevir
          const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
          if (!isNaN(price)) {
            console.log(`[OK] ${symbol} Bulundu: ${price.toLocaleString('tr-TR')} ₺`);
            updates.push({ symbol, price: Number(price.toFixed(4)), change: 0 });
          }
        }
      };

      // BTC: 3. Satır (Index 2)
      processCryptoRow(2, 'BTC', 'Bitcoin');
      // ETH: 7. Satır (Index 6)
      processCryptoRow(6, 'ETH', 'Ethereum');
    }

    const foundSymbols = updates.map(u => u.symbol).join(', ');
    console.log(`[API] Güncellenen Varlıklar (${updates.length}): ${foundSymbols}`);

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
