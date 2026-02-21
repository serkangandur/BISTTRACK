
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Gelişmiş Hibrit Scraping API Route.
 * BIST, Emtia (Altın/Gümüş) ve Döviz (USD/EUR) verilerini toplu çeker.
 * Döviz verileri için merkezi döviz özet sayfası (Tabelle 1 metodu) kullanılır.
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
    // 1. PARALEL İSTEKLER (BIST, Altın, Gümüş ve Merkezi Döviz Sayfası)
    const requests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 10000 }),
      axios.get('https://finans.cnnturk.com/doviz', { headers, timeout: 10000 }), // USD ve EUR için merkezi sayfa
    ];

    const results = await Promise.allSettled(requests);

    // 2. BIST TABLO MANTIĞI (Garantici Scraping)
    const bistResult = results[0];
    if (bistResult.status === 'fulfilled') {
      const $ = cheerio.load(bistResult.value.data);
      $('tr').each((_, element) => {
        const tds = $(element).find('td');
        if (tds.length < 3) return;

        // Sembol Ayıklama: ilk sütun (td[0]), trim yap, ilk kelimeyi al (split)
        const rawText = $(tds[0]).text().trim().toUpperCase();
        const symbol = rawText.split(/[\s-]/)[0];

        if (requestedSymbols.includes(symbol)) {
          // Akıllı Fiyat Seçimi: 2. veya 3. sütun hangisinde virgül varsa
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

    // 3. EMTİA MANTIĞI (Excel/Tabelle 1 Metodu)
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
              const priceText = $(tds[2]).text().trim(); // SATIŞ sütunu
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

        // Fallback Regex
        if (!found) {
          const bodyText = $('body').text();
          const regex = new RegExp(`${targetKey}[\\s:]+([\\d.]+,[\\d]+)`, 'i');
          const match = bodyText.match(regex);
          if (match && match[1]) {
            const price = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(price)) {
              updates.push({ symbol, price, change: 0 });
            }
          }
        }
      }
    };

    scrapeEmtiaTable(1, 'ALTIN', 'Gram');
    scrapeEmtiaTable(2, 'GUMUS', 'Gram');

    // 4. DÖVİZ ÖZET TABLO MANTIĞI (USD ve EUR)
    const scrapeDovizOzet = (resultIdx: number) => {
      const result = results[resultIdx];
      if (result.status === 'fulfilled') {
        const $ = cheerio.load(result.value.data);
        const firstTable = $('table').first();
        
        const targets = [
          { symbol: 'USD', key: 'ABD DOLARI' },
          { symbol: 'EUR', key: 'EURO' }
        ];

        targets.forEach(target => {
          if (!requestedSymbols.includes(target.symbol)) return;
          
          let found = false;
          firstTable.find('tr').each((_, el) => {
            const tds = $(el).find('td');
            if (tds.length >= 3) {
              const label = $(tds[0]).text().trim().toUpperCase();
              // Tam eşleşme (ABD DOLARI veya EURO)
              if (label === target.key) {
                const priceText = $(tds[2]).text().trim(); // SATIŞ (TL) sütunu
                if (priceText && priceText.includes(',')) {
                  const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
                  if (!isNaN(price)) {
                    updates.push({ symbol: target.symbol, price, change: 0 });
                    found = true;
                    return false;
                  }
                }
              }
            }
          });

          // Fallback regex (Sayfadaki metin içinden çekme)
          if (!found) {
            const bodyText = $('body').text();
            const regex = new RegExp(`${target.key}[\\s:]+([\\d.]+,[\\d]+)`, 'i');
            const match = bodyText.match(regex);
            if (match && match[1]) {
              const price = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
              if (!isNaN(price)) {
                updates.push({ symbol: target.symbol, price, change: 0 });
              }
            }
          }
        });
      }
    };

    scrapeDovizOzet(3); // Döviz özet sayfası 3. index'te

    const foundSymbols = updates.map(u => u.symbol).join(', ');
    console.log(`[API] Güncellenen Varlıklar (${updates.length}): ${foundSymbols}`);

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
