
import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

/**
 * Hibrit Veri Motoru v26.0 - "Kripto & BIST Tam İsabet".
 * - Ana Kaynak (Kripto): Binance TR API (JSON - En Güvenilir)
 * - Yedek Kaynak (Kripto): Midas "Nokta Atışı" Scraping
 * - BIST, Emtia ve Döviz: CNN Türk
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json([], { status: 200 });
  }

  const requestedSymbols = symbolsParam.split(',').map(s => s.trim());
  console.log(`[API] [GELEN İSTEK] Semboller: ${requestedSymbols.join(', ')}`);

  const updates: any[] = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  };

  let btcPrice: number | null = null;
  let ethPrice: number | null = null;

  try {
    // 1. KRİPTO: BİNANCE TR API (BİRİNCİ ÖNCELİK)
    try {
      const [binanceBtc, binanceEth] = await Promise.all([
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=BTCTRY', { cache: 'no-store' }).then(res => res.json()),
        fetch('https://api.binance.tr/api/v3/ticker/price?symbol=ETHTRY', { cache: 'no-store' }).then(res => res.json())
      ]);
      
      if (binanceBtc?.price) btcPrice = parseFloat(binanceBtc.price);
      if (binanceEth?.price) ethPrice = parseFloat(binanceEth.price);
      
      if (btcPrice) console.log(`[API] [BINANCE] BTC: ${btcPrice.toLocaleString('tr-TR')} ₺`);
      if (ethPrice) console.log(`[API] [BINANCE] ETH: ${ethPrice.toLocaleString('tr-TR')} ₺`);
    } catch (e) {
      console.warn("[API] Binance TR API hatası, yedeklere bakılıyor...");
    }

    // 2. KRİPTO YEDEK: MİDAS (Eğer Binance başarısızsa veya rakamlar çok düşükse)
    if (!btcPrice || btcPrice < 1000000 || !ethPrice || ethPrice < 30000) {
      try {
        const [midasBtcRes, midasEthRes] = await Promise.all([
          fetch('https://www.getmidas.com/canli-kripto/bitcoin-fiyati/', { headers, cache: 'no-store' }),
          fetch('https://www.getmidas.com/canli-kripto/ethereum-fiyati/', { headers, cache: 'no-store' })
        ]);

        const parseMidas = async (res: Response) => {
          if (res.ok) {
            const html = await res.text();
            const $ = cheerio.load(html);
            const pText = $('.currency-price').first().text().trim() || 
                          $('.last-price').first().text().trim() || 
                          $('h1').first().text().trim();
            const match = pText.match(/[\d.,]+/);
            if (match) return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
          }
          return null;
        };

        const mBtc = await parseMidas(midasBtcRes);
        const mEth = await parseMidas(midasEthRes);

        if (mBtc && mBtc > 1000000) btcPrice = mBtc;
        if (mEth && mEth > 30000) ethPrice = mEth;
        
        if (btcPrice) console.log(`[API] [MİDAS] BTC: ${btcPrice.toLocaleString('tr-TR')} ₺`);
        if (ethPrice) console.log(`[API] [MİDAS] ETH: ${ethPrice.toLocaleString('tr-TR')} ₺`);
      } catch (e) {
        console.warn("[API] Midas Scraping hatası.");
      }
    }

    // 3. CNN TÜRK VERİLERİ (BIST, EMTİA, DÖVİZ)
    const mainRequests = [
      fetch('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, cache: 'no-store' }),
      fetch('https://finans.cnnturk.com/altin', { headers, cache: 'no-store' }),
      fetch('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, cache: 'no-store' }),
      fetch('https://finans.cnnturk.com/doviz', { headers, cache: 'no-store' }),
    ];

    const results = await Promise.allSettled(mainRequests);

    // 4. AKILLI EŞLEŞME MOTORU (MIRRORING)
    for (const req of requestedSymbols) {
      const reqUpper = req.toUpperCase().trim();
      
      // BTC EŞLEŞTİRME (Esnek: BTC, Bitcoin, Bitcoin Türk Lirası)
      if (btcPrice && (reqUpper.includes('BITCOIN') || reqUpper.includes('BİTCOİN') || reqUpper === 'BTC')) {
        updates.push({ symbol: req, price: Number(btcPrice.toFixed(4)), change: 0 });
        console.log(`[EŞLEŞME] '${req}' -> ${btcPrice} ₺ (BTC)`);
        continue;
      }

      // ETH EŞLEŞTİRME (Esnek: ETH, Ethereum, Etherium, Ethereum Türk Lirası)
      if (ethPrice && (reqUpper.includes('ETHEREUM') || reqUpper.includes('ETHERİUM') || reqUpper === 'ETH')) {
        updates.push({ symbol: req, price: Number(ethPrice.toFixed(4)), change: 0 });
        console.log(`[EŞLEŞME] '${req}' -> ${ethPrice} ₺ (ETH)`);
        continue;
      }

      // DÖVİZ (CNN Türk)
      const dovizRes = results[3];
      if (dovizRes.status === 'fulfilled' && dovizRes.value.ok) {
        const html = await dovizRes.value.text();
        const $ = cheerio.load(html);
        const key = reqUpper === 'USD' ? 'ABD DOLARI' : reqUpper === 'EUR' ? 'EURO' : null;
        if (key) {
          $('table').first().find('tr').each((_, el) => {
            const tds = $(el).find('td');
            if (tds.length >= 3 && $(tds[0]).text().trim().toUpperCase() === key) {
              const p = parseFloat($(tds[2]).text().trim().replace(/\./g, '').replace(',', '.'));
              if (!isNaN(p)) updates.push({ symbol: req, price: Number(p.toFixed(4)), change: 0 });
            }
          });
          continue;
        }
      }

      // BIST HİSSELERİ (CNN Türk)
      const bistRes = results[0];
      if (bistRes.status === 'fulfilled' && bistRes.value.ok) {
        const html = await bistRes.value.text();
        const $ = cheerio.load(html);
        $('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length < 3) return;
          const symbolInTable = $(tds[0]).text().trim().toUpperCase().split(/[\s-]/)[0];
          if (symbolInTable === reqUpper) {
            let pText = $(tds[1]).text().trim();
            if (pText.includes('%') || !pText.includes(',')) pText = $(tds[2]).text().trim();
            const p = parseFloat(pText.replace(/\./g, '').replace(',', '.'));
            if (!isNaN(p)) updates.push({ symbol: req, price: Number(p.toFixed(4)), change: 0 });
            return false;
          }
        });
      }

      // EMTİA (CNN Türk)
      if (reqUpper === 'ALTIN' || reqUpper === 'GUMUS') {
        const emtiaIdx = reqUpper === 'ALTIN' ? 1 : 2;
        const emtiaRes = results[emtiaIdx];
        if (emtiaRes.status === 'fulfilled' && emtiaRes.value.ok) {
          const html = await emtiaRes.value.text();
          const $ = cheerio.load(html);
          $('table').first().find('tr').each((_, el) => {
            const tds = $(el).find('td');
            if (tds.length >= 3 && $(tds[0]).text().trim().toLowerCase().includes('gram')) {
              const p = parseFloat($(tds[2]).text().trim().replace(/\./g, '').replace(',', '.'));
              if (!isNaN(p)) updates.push({ symbol: req, price: Number(p.toFixed(4)), change: 0 });
              return false;
            }
          });
        }
      }
    }

    // Garanti Ekleme: requestedSymbols içinde olsa da olmasa da BTC/ETH'yi ana sembollerle de ekle
    if (btcPrice && !updates.some(u => u.symbol === 'BTC')) updates.push({ symbol: 'BTC', price: Number(btcPrice.toFixed(4)), change: 0 });
    if (ethPrice && !updates.some(u => u.symbol === 'ETH')) updates.push({ symbol: 'ETH', price: Number(ethPrice.toFixed(4)), change: 0 });

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
