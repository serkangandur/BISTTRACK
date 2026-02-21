
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Gelişmiş Hibrit Veri Motoru v10.0 - "Excel Satır Sayma" & "Kesin ₺ Filtresi".
 * - BIST, Emtia ve Döviz: CNN Türk (Tabelle 1 / İlk Tablo Yöntemi)
 * - Kripto (BTC ve ETH): CNN Türk Kripto Tablosu (Nokta Atışı Satır Sayma)
 * - Güvenlik: BTC > 2M ₺ ve ETH > 60K ₺ altındaki tüm verileri (BIST 13k veya Dolar fiyatı) eler.
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
      axios.get('https://finans.cnnturk.com/kripto-paralar', { headers, timeout: 10000 }),
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

    // 5. KRİPTO (NOKTA ATIŞI SATIR SAYMA - EXCEL MANTIĞI)
    const cnnKriptoRes = results[4];
    if (cnnKriptoRes.status === 'fulfilled') {
      const $ = cheerio.load(cnnKriptoRes.value.data);
      const cryptoTable = $('table').first();

      const processCryptoRow = (rowIndex: number, expectedLabel: string, targetSymbol: string, minPrice: number) => {
        if (!requestedSymbols.includes(targetSymbol)) return;

        const row = cryptoTable.find('tr').eq(rowIndex);
        const tds = row.find('td');
        if (tds.length < 2) return;

        const label = $(tds[0]).text().trim();
        let priceText = "";

        // Doğrudan satır numarasından veya etiket kontrolünden fiyatı al
        if (label.includes(expectedLabel) && label.includes('Türk Lirası')) {
          priceText = $(tds[1]).text().trim();
        } else {
          // Eğer satır kaymışsa tüm tabloyu tara (B Planı)
          cryptoTable.find('tr').each((_, el) => {
            const cells = $(el).find('td');
            const cellLabel = $(cells[0]).text().trim();
            if (cellLabel.includes(expectedLabel) && cellLabel.includes('Türk Lirası')) {
              priceText = $(cells[1]).text().trim();
              return false;
            }
          });
        }

        if (priceText) {
          const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
          // MANTIKSAL SINIR (GUARDRAIL) KONTROLÜ
          if (!isNaN(price) && price > minPrice) {
            if (!updates.some(u => u.symbol === targetSymbol)) {
              updates.push({ symbol: targetSymbol, price: Number(price.toFixed(4)), change: 0 });
              console.log(`[OK] ${targetSymbol} Bulundu: ${price.toLocaleString('tr-TR')} ₺`);
            }
          }
        }
      };

      // BTC (Excel: 3. Satır -> eq(2)) - Guardrail: 2M ₺
      processCryptoRow(2, 'Bitcoin', 'BTC', 2000000);

      // ETH (Excel: 7. Satır -> eq(6)) - Guardrail: 60K ₺
      processCryptoRow(6, 'Ethereum', 'ETH', 60000);
    }

    const foundSymbols = updates.map(u => u.symbol).join(', ');
    console.log(`[API] Güncellenen Varlıklar (${updates.length}): ${foundSymbols}`);

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
