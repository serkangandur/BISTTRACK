
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * CNN Türk Finans üzerinden BIST verilerini çeken hassas scraping API Route.
 * Tam sembol eşleşmesi ve sabit fiyat sütunu (3. sütun) yöntemini kullanır.
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
      if (tds.length < 3) return; // Yetersiz sütun varsa atla

      // 1. Sütunda tam olarak sembol kodu yer alır (Örn: TERA, THYAO)
      const symbolInTable = $(tds[0]).text().trim().toUpperCase();
      
      requestedSymbols.forEach(s => {
        // TAM EŞLEŞME KONTROLÜ
        if (symbolInTable === s) {
          // 3. Sütun genellikle "Son Fiyat" bilgisini içerir (td:nth-child(3))
          const priceCell = $(tds[2]).text().trim();
          
          // Özel debug log (TERA için)
          if (s === 'TERA') {
             console.log('[DEBUG] TERA Bulunan Hücre Değeri:', priceCell);
          }

          // Fiyatı normalleştir (Binlik ayracı noktayı sil, ondalık virgülü noktaya çevir)
          const cleanPriceStr = priceCell.replace(/\./g, '').replace(',', '.');
          const price = parseFloat(cleanPriceStr);

          // Geçerli bir sayıysa listeye ekle
          if (!isNaN(price) && price > 0 && !updates.find(u => u.symbol === s)) {
            updates.push({ 
              symbol: s, 
              price: price, 
              change: 0 
            });
          }
        }
      });
    });

    console.log(`[API/STOCK] Toplam ${updates.length} hisse tam eşleşme ile güncellendi.`);
    
    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API/STOCK] KRITIK_HATA:", error.message);
    
    // Uygulamanın çökmemesi için boş liste dön
    return NextResponse.json([], { status: 200 });
  }
}
