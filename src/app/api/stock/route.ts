
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Hibrit Veri Motoru v21.0 - "Akıllı Kripto Eşleşme & Kurşun Geçirmez Veri".
 * - Ana Kaynak: Binance TR API (BTCTRY, ETHTRY)
 * - Yedek Kaynak: Midas Nokta Atışı Scraping
 * - BIST, Emtia ve Döviz: CNN Türk (Tabelle 1)
 * - Özellik: 'Bitcoin Türk Lirası' gibi uzun isimleri otomatik tanıma.
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
    // 1. KRİPTO: BİNANCE TR API (ANA KAYNAK)
    let btcPrice: number | null = null;
    let ethPrice: number | null = null;

    try {
      const [binanceBtc, binanceEth] = await Promise.all([
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=BTCTRY', { next: { revalidate: 0 } }).then(res => res.json()),
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=ETHTRY', { next: { revalidate: 0 } }).then(res => res.json())
      ]);
      
      if (binanceBtc?.price) btcPrice = parseFloat(binanceBtc.price);
      if (binanceEth?.price) ethPrice = parseFloat(binanceEth.price);
      
      if (btcPrice) console.log(`[BINANCE] BTC: ${btcPrice.toLocaleString('tr-TR')} ₺`);
      if (ethPrice) console.log(`[BINANCE] ETH: ${ethPrice.toLocaleString('tr-TR')} ₺`);
    } catch (e) {
      console.warn("[API] Binance TR API hatası, Midas yedeğine geçiliyor...");
    }

    // 2. DİĞER VERİLER VE YEDEK KRİPTO (CNN + MİDAS)
    const mainRequests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 8000 }),
      axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 8000 }),
      axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 8000 }),
      axios.get('https://finans.cnnturk.com/doviz', { headers, timeout: 8000 }),
      // Sadece Binance başarısızsa Midas'tan çekmeye çalışmak için buradalar
      !btcPrice ? axios.get('https://www.getmidas.com/canli-kripto/bitcoin-fiyati/', { headers, timeout: 8000 }) : Promise.resolve(null),
      !ethPrice ? axios.get('https://www.getmidas.com/canli-kripto/ethereum-fiyati/', { headers, timeout: 8000 }) : Promise.resolve(null),
    ];

    const results = await Promise.allSettled(mainRequests);

    // 3. DÖVİZ İŞLEME (CNN DOLAR VE EURO)
    const dovizResult = results[3];
    if (dovizResult.status === 'fulfilled' && dovizResult.value) {
      const $ = cheerio.load(dovizResult.value.data);
      const firstTable = $('table').first();
      const targets = [{ s: 'USD', k: 'ABD DOLARI' }, { s: 'EUR', k: 'EURO' }];

      targets.forEach(t => {
        if (!requestedSymbols.includes(t.s)) return;
        firstTable.find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 3 && $(tds[0]).text().trim().toUpperCase() === t.k) {
            const pText = $(tds[2]).text().trim();
            const p = parseFloat(pText.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(p)) updates.push({ symbol: t.s, price: Number(p.toFixed(4)), change: 0 });
          }
        });
      });
    }

    // 4. BIST HİSSELERİ (CNN)
    const bistResult = results[0];
    if (bistResult.status === 'fulfilled' && bistResult.value) {
      const $ = cheerio.load(bistResult.value.data);
      $('tr').each((_, el) => {
        const tds = $(el).find('td');
        if (tds.length < 3) return;
        const symbol = $(tds[0]).text().trim().toUpperCase().split(/[\s-]/)[0];
        if (requestedSymbols.includes(symbol)) {
          let pText = $(tds[1]).text().trim();
          if (pText.includes('%') || !pText.includes(',')) pText = $(tds[2]).text().trim();
          const p = parseFloat(pText.replace(/\./g, '').replace(',', '.'));
          if (!isNaN(p) && p > 0) updates.push({ symbol, price: Number(p.toFixed(4)), change: 0 });
        }
      });
    }

    // 5. EMTİA (ALTIN/GÜMÜŞ)
    const scrapeEmtia = (idx: number, sym: string) => {
      const res = results[idx];
      if (res.status === 'fulfilled' && res.value && requestedSymbols.includes(sym)) {
        const $ = cheerio.load(res.value.data);
        $('table').first().find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 3 && $(tds[0]).text().trim().toLowerCase().includes('gram')) {
            const pText = $(tds[2]).text().trim();
            const p = parseFloat(pText.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(p)) {
              updates.push({ symbol: sym, price: Number(p.toFixed(4)), change: 0 });
              return false;
            }
          }
        });
      }
    };
    scrapeEmtia(1, 'ALTIN');
    scrapeEmtia(2, 'GUMUS');

    // 6. YEDEK KRİPTO (MİDAS SCRAPING) - Binance başarısız olduysa
    const processMidasFallback = (idx: number, type: 'BTC' | 'ETH') => {
      const res = results[idx];
      if (res.status === 'fulfilled' && res.value) {
        const $ = cheerio.load(res.value.data);
        const pText = $('.currency-price').first().text().trim() || $('h1').first().text().trim();
        const p = parseFloat(pText.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.'));
        if (!isNaN(p) && p > 0) {
          if (type === 'BTC') btcPrice = p;
          else ethPrice = p;
        }
      }
    };
    if (!btcPrice) processMidasFallback(4, 'BTC');
    if (!ethPrice) processMidasFallback(5, 'ETH');

    // 7. AKILLI EŞLEŞME (ÇOK ÖNEMLİ)
    // requestedSymbols içinde 'BITCOIN', 'BTC' veya 'ETHEREUM', 'ETH' geçen her şeyi yakala
    requestedSymbols.forEach(req => {
      const reqUpper = req.toUpperCase();
      
      // Bitcoin Eşleşmesi
      if (btcPrice && (reqUpper.includes('BITCOIN') || reqUpper.includes('BİTCOİN') || reqUpper === 'BTC')) {
        const finalPrice = Number(btcPrice.toFixed(4));
        updates.push({ symbol: req, price: finalPrice, change: 0 });
        console.log(`[BAŞARI] '${req}' varlığına ${finalPrice.toLocaleString('tr-TR')} ₺ fiyatı bağlandı.`);
      }
      
      // Ethereum Eşleşmesi
      if (ethPrice && (reqUpper.includes('ETHEREUM') || reqUpper.includes('ETHERİUM') || reqUpper === 'ETH')) {
        const finalPrice = Number(ethPrice.toFixed(4));
        updates.push({ symbol: req, price: finalPrice, change: 0 });
        console.log(`[BAŞARI] '${req}' varlığına ${finalPrice.toLocaleString('tr-TR')} ₺ fiyatı bağlandı.`);
      }
    });

    // Zorunlu Gönderim (İstenmese bile BTC ve ETH anahtar kelimeleriyle ekle)
    if (btcPrice) updates.push({ symbol: 'BTC', price: Number(btcPrice.toFixed(4)), change: 0 });
    if (ethPrice) updates.push({ symbol: 'ETH', price: Number(ethPrice.toFixed(4)), change: 0 });

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
