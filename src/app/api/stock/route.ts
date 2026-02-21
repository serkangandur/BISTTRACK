
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * CNN Türk Finans üzerinden BIST verilerini çeken "Garantici" scraping API Route.
 * Sembolleri ayıklamak için split mantığı, fiyatı bulmak için ise akıllı sütun seçimi kullanır.
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

      // 1. SÜTUN: Sembol Ayıklama
      // Örn: "ISMEN - İŞ MENKUL" metninden sadece "ISMEN" kısmını alır.
      const rawSymbolText = $(tds[0]).text().trim().toUpperCase();
      const extractedSymbol = rawSymbolText.split(/[\s-]/)[0]; // Boşluk veya tireye göre böl, ilkini al
      
      // Eğer bu sembol aradıklarımız arasındaysa devam et
      if (requestedSymbols.includes(extractedSymbol)) {
        
        // 2. & 3. SÜTUN: Akıllı Fiyat Seçimi
        // Fiyat hücresini bulmak için 2. ve 3. sütunu kontrol ederiz.
        // Kural: İçinde virgül (,) olan ama yüzde (%) işareti OLMAYAN hücre fiyattır.
        let priceText = "";
        const col2Text = $(tds[1]).text().trim();
        const col3Text = $(tds[2]).text().trim();

        if (col2Text.includes(',') && !col2Text.includes('%')) {
          priceText = col2Text;
        } else if (col3Text.includes(',') && !col3Text.includes('%')) {
          priceText = col3Text;
        }

        if (priceText) {
          // VERİ TEMİZLEME
          // Binlik ayırıcı noktayı sil, ondalık virgülü noktaya çevir
          const cleanPriceStr = priceText.replace(/\./g, '').replace(',', '.');
          const price = parseFloat(cleanPriceStr);

          // Geçerli bir sayıysa ve daha önce eklenmemişse listeye ekle
          if (!isNaN(price) && price > 0 && !updates.find(u => u.symbol === extractedSymbol)) {
            updates.push({ 
              symbol: extractedSymbol, 
              price: price, 
              change: 0 
            });
          }
        }
      }
    });

    console.log(`[API/STOCK] Toplam ${updates.length} hisse başarıyla bulundu.`);
    
    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("[API/STOCK] KRITIK_HATA:", error.message);
    
    // Uygulamanın çökmemesi için boş liste dön
    return NextResponse.json([], { status: 200 });
  }
}
