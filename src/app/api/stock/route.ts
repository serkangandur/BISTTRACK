
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Hibrit Veri Motoru v25.0 - "Nokta Atışı Kripto & BIST".
 * - Ana Kaynak (Kripto): Binance TR API (Resmi & Kurşun Geçirmez)
 * - Yedek Kaynak (Kripto): Midas "Nokta Atışı" Scraping (Görseldeki 86k seviyeleri için)
 * - BIST, Emtia ve Döviz: CNN Türk (Tabelle 1)
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json([], { status: 200 });
  }

  // Frontend'den gelen sembolleri orijinal haliyle koru (Eşleşme için kritik)
  const requestedSymbols = symbolsParam
    .split(',')
    .map(s => s.trim());

  console.log(`[API] [GELEN İSTEK] Toplam ${requestedSymbols.length} sembol: ${requestedSymbols.join(', ')}`);

  const updates: any[] = [];
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  try {
    // 1. KRİPTO: BİNANCE TR API (BİRİNCİ ÖNCELİK - EN GÜVENİLİR)
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

    // 2. YEDEK VE DİĞER VERİLER (CNN + MİDAS)
    const mainRequests = [
      axios.get('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', { headers, timeout: 8000 }),
      axios.get('https://finans.cnnturk.com/altin', { headers, timeout: 8000 }),
      axios.get('https://finans.cnnturk.com/gumus-fiyatlari/gumus-gram-TL-fiyati', { headers, timeout: 8000 }),
      axios.get('https://finans.cnnturk.com/doviz', { headers, timeout: 8000 }),
      // Midas Linkleri (ETH için görseldeki 86k değerini garanti etmek için)
      axios.get('https://www.getmidas.com/canli-kripto/bitcoin-fiyati/', { headers, timeout: 8000 }),
      axios.get('https://www.getmidas.com/canli-kripto/ethereum-fiyati/', { headers, timeout: 8000 }),
    ];

    const results = await Promise.allSettled(mainRequests);

    // MİDAS YEDEĞİ İŞLEME (Binance başarısızsa veya veri 100k altındaysa)
    const processMidas = (idx: number, type: 'BTC' | 'ETH') => {
      const res = results[idx];
      if (res.status === 'fulfilled' && res.value) {
        const $ = cheerio.load(res.value.data);
        // Sayfadaki en büyük fiyat hanesini yakala (.currency-price veya .last-price)
        const pText = $('.currency-price').first().text().trim() || 
                      $('.last-price').first().text().trim() || 
                      $('h1').first().text().trim();
        
        const match = pText.match(/[\d.,]+/);
        if (match) {
          const rawPrice = match[0];
          const p = parseFloat(rawPrice.replace(/\./g, '').replace(',', '.'));
          
          if (!isNaN(p) && p > 0) {
            // Güvenlik: BIST endeksi (13.934) ile karışmaması için alt sınır kontrolü
            if (type === 'BTC' && p > 1000000 && (!btcPrice || btcPrice < 100000)) btcPrice = p;
            if (type === 'ETH' && p > 30000 && (!ethPrice || ethPrice < 15000)) ethPrice = p;
            console.log(`[MİDAS] ${type} Fiyatı: ${p.toLocaleString('tr-TR')} ₺`);
          }
        }
      }
    };
    processMidas(4, 'BTC');
    processMidas(5, 'ETH');

    // 3. AKILLI EŞLEŞME MOTORU (Frontend'den gelen sembolleri tara)
    requestedSymbols.forEach(req => {
      const reqUpper = req.toUpperCase();
      
      // BTC EŞLEŞTİRME (İsimde Bitcoin veya BTC geçiyorsa)
      if (btcPrice && (reqUpper.includes('BITCOIN') || reqUpper.includes('BİTCOİN') || reqUpper === 'BTC')) {
        updates.push({ symbol: req, price: Number(btcPrice.toFixed(4)), change: 0 });
        console.log(`[BAŞARI] '${req}' varlığına ${btcPrice.toLocaleString('tr-TR')} ₺ bağlandı.`);
        return;
      }

      // ETH EŞLEŞTİRME (İsimde Ethereum, Etherium veya ETH geçiyorsa)
      if (ethPrice && (reqUpper.includes('ETHEREUM') || reqUpper.includes('ETHERİUM') || reqUpper === 'ETH')) {
        updates.push({ symbol: req, price: Number(ethPrice.toFixed(4)), change: 0 });
        console.log(`[BAŞARI] '${req}' varlığına ${ethPrice.toLocaleString('tr-TR')} ₺ bağlandı.`);
        return;
      }

      // DÖVİZ İŞLEME (CNN Türk Tabelle 1)
      const dovizResult = results[3];
      if (dovizResult.status === 'fulfilled' && (reqUpper === 'USD' || reqUpper === 'EUR')) {
        const $ = cheerio.load(dovizResult.value.data);
        const key = reqUpper === 'USD' ? 'ABD DOLARI' : 'EURO';
        $('table').first().find('tr').each((_, el) => {
          const tds = $(el).find('td');
          if (tds.length >= 3 && $(tds[0]).text().trim().toUpperCase() === key) {
            const p = parseFloat($(tds[2]).text().trim().replace(/\./g, '').replace(',', '.'));
            if (!isNaN(p)) updates.push({ symbol: req, price: Number(p.toFixed(4)), change: 0 });
          }
        });
        return;
      }

      // BIST HİSSELERİ (CNN Türk)
      const bistResult = results[0];
      if (bistResult.status === 'fulfilled' && bistResult.value) {
        const $ = cheerio.load(bistResult.value.data);
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
        const emtiaResult = reqUpper === 'ALTIN' ? results[1] : results[2];
        if (emtiaResult.status === 'fulfilled' && emtiaResult.value) {
          const $ = cheerio.load(emtiaResult.value.data);
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
    });

    // Zorunlu Çıktı (Frontend'de eksik kalmaması için her zaman gönder)
    if (btcPrice) updates.push({ symbol: 'BTC', price: Number(btcPrice.toFixed(4)), change: 0 });
    if (ethPrice) updates.push({ symbol: 'ETH', price: Number(ethPrice.toFixed(4)), change: 0 });

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API] Kritik Hata:", error.message);
    return NextResponse.json(updates, { status: 200 });
  }
}
