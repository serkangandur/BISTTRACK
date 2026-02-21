
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * CNN Türk Finans üzerinden BIST verilerini çeken güvenli API Route.
 * Veri kazıma (Scraping) yöntemi ile Borsa İstanbul tüm hisselerini tarar.
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

  try {
    console.log(`[API/STOCK] CNN Türk Finans kazıma başlatılıyor... URL: https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri`);

    const targetUrl = 'https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri';

    // Sayfayı indir
    const { data: html } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 15000 // 15 saniye zaman aşımı
    });

    const $ = cheerio.load(html);
    const updates: any[] = [];

    // Sayfadaki tüm tablo satırlarını (tr) tara
    $('tr').each((_, element) => {
      const tds = $(element).find('td');
      
      // CNN Türk tablosunda genellikle:
      // td[0]: Sembol (ACSEL)
      // td[2]: Son Fiyat
      // td[3]: Değişim (%)
      if (tds.length >= 4) {
        const symbol = $(tds[0]).text().trim().toUpperCase();
        
        // Eğer bu sembol portföyde varsa veriyi işle
        if (requestedSymbols.includes(symbol)) {
          const lastPriceStr = $(tds[2]).text().trim();
          const changeStr = $(tds[3]).text().trim();

          // Türkçe formatı (1.250,50) -> Standart sayı formatına (1250.50) çevir
          // Önce binlik ayracı olan noktayı sil, sonra ondalık ayracı olan virgülü noktaya çevir
          const price = parseFloat(lastPriceStr.replace(/\./g, '').replace(',', '.'));
          const change = parseFloat(changeStr.replace('%', '').replace(',', '.'));

          if (!isNaN(price)) {
            updates.push({
              symbol: symbol,
              price: price,
              change: isNaN(change) ? 0 : change
            });
          }
        }
      }
    });

    console.log(`[API/STOCK] Başarılı: ${updates.length} hisse güncellendi.`);
    
    // Eğer bazı hisseler bulunamadıysa terminale log bas
    if (updates.length < requestedSymbols.length) {
      const foundSymbols = updates.map(u => u.symbol);
      const missingSymbols = requestedSymbols.filter(s => !foundSymbols.includes(s));
      console.warn(`[API/STOCK] Bazı semboller tabloda bulunamadı: ${missingSymbols.join(', ')}`);
    }

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("KRITIK_HATA: CNN Türk kazıma sırasında bir sorun oluştu!");
    console.error("Hata Mesajı:", error.message);
    
    if (error.code === 'ECONNABORTED') {
      console.error("Hata Detayı: Bağlantı zaman aşımına uğradı (Timeout).");
    } else if (error.response) {
      console.error(`Hata Detayı: Sunucu ${error.response.status} koduyla yanıt verdi.`);
    }

    // Uygulamanın çökmemesi için boş liste dön
    return NextResponse.json([], { status: 200 });
  }
}
