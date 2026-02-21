
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Hibrit Veri Motoru v22.0 - "Kurşun Geçirmez Kripto & BIST".
 * - Ana Kaynak (Kripto): Binance TR API (En güvenilir ₺ fiyatı)
 * - Yedek Kaynak (Kripto): Midas Nokta Atışı Scraping (Görseldeki 86k ₺ değerini yakalar)
 * - BIST, Emtia ve Döviz: CNN Türk (Tabelle 1)
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
    // 1. KRİPTO: BİNANCE TR API (BİRİNCİL KAYNAK)
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
      // Midas yedeği
      axios.get('https://www.getmidas.com/canli-kripto/bitcoin-fiyati/', { headers, timeout: 8000 }),
      axios.get('https://www.getmidas.com/canli-kripto/ethereum-fiyati/', { headers, timeout: 8000 }),
    ];

    const results = await Promise.allSettled(mainRequests);

    // 3. DÖVİZ İŞLEME
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

    // 4. BIST HİSSELERİ
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

    // 5. EMTİA
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

    // 6. MİDAS SCRAPING (BİNANCE BAŞARISIZSA VEYA EK DOĞRULAMA İÇİN)
    const processMidasFallback = (idx: number, type: 'BTC' | 'ETH') => {
      const res = results[idx];
      if (res.status === 'fulfilled' && res.value) {
        const $ = cheerio.load(res.value.data);
        // Midas'ta fiyat genellikle büyük bir currency-price class'ında veya H1'dedir
        let pText = $('.currency-price').first().text().trim() || 
                    $('.last-price').first().text().trim() || 
                    $('h1').first().text().trim();
        
        // Rakamı ayıkla (Noktalar binlik, virgül ondalık olabilir)
        const match = pText.match(/[\d.,]+/);
        if (match) {
          const rawPrice = match[0];
          const p = parseFloat(rawPrice.replace(/\./g, '').replace(',', '.'));
          if (!isNaN(p) && p > 0) {
            if (type === 'BTC' && (!btcPrice || btcPrice < 100000)) btcPrice = p;
            if (type === 'ETH' && (!ethPrice || ethPrice < 10000)) ethPrice = p;
            console.log(`[MİDAS] ${type} Fiyatı Yakalandı: ${p.toLocaleString('tr-TR')} ₺`);
          }
        }
      }
    };
    processMidasFallback(4, 'BTC');
    processMidasFallback(5, 'ETH');

    // 7. AKILLI EŞLEŞME (SEMBOLLERİ BAĞLA)
    requestedSymbols.forEach(req => {
      const reqUpper = req.toUpperCase();
      
      // Bitcoin Eşleşmesi (BTC, BITCOIN, BİTCOİN içeren her şey)
      if (btcPrice && (reqUpper.includes('BITCOIN') || reqUpper.includes('BİTCOİN') || reqUpper === 'BTC')) {
        updates.push({ symbol: req, price: Number(btcPrice.toFixed(4)), change: 0 });
        console.log(`[EŞLEŞME] '${req}' -> ${btcPrice.toLocaleString('tr-TR')} ₺`);
      }
      
      // Ethereum Eşleşmesi (ETH, ETHEREUM, ETHERİUM içeren her şey)
      if (ethPrice && (reqUpper.includes('ETHEREUM') || reqUpper.includes('ETHERİUM') || reqUpper === 'ETH')) {
        updates.push({ symbol: req, price: Number(ethPrice.toFixed(4)), change: 0 });
        console.log(`[EŞLEŞME] '${req}' -> ${ethPrice.toLocaleString('tr-TR')} ₺`);
      }
    });

    // Zorunlu Gönderim (İstemese bile anahtar kelimelerle ekle)
    if (btcPrice) updates.push({ symbol: 'BTC', price: Number(btcPrice.toFixed(4)), change: 0 });
    if (ethPrice) updates.push({ symbol: 'ETH', price: Number(ethPrice.toFixed(4)), change: 0 });

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
