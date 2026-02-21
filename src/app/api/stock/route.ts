
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * CNN Türk Finans üzerinden BIST verilerini çeken esnek scraping API Route.
 * Satır bazlı metin arama ve regex ile fiyat tespiti yöntemini kullanır.
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
    console.log(`[API/STOCK] CNN Türk kazıma başlatılıyor... URL: https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri`);

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

      // Satırdaki tüm metni birleştirip hangi hisse olduğunu anlıyoruz
      const rowText = $(element).text().toUpperCase();
      
      requestedSymbols.forEach(s => {
        // Satırın içinde sembol (örn: ISMEN) geçiyor mu?
        // Tam eşleşme sağlamak için ilk sütuna bakmak daha güvenlidir
        const firstTdText = $(tds[0]).text().trim().toUpperCase();
        
        if (firstTdText === s || rowText.includes(s)) {
          // Bu satırda fiyatı bulmaya çalış
          let priceFoundForThisSymbol = false;
          
          tds.each((i, td) => {
            if (priceFoundForThisSymbol) return;
            
            const cellVal = $(td).text().trim();
            // İçinde rakam ve virgül olan hücre fiyattır (Örn: 1.250,50 veya 41,50)
            // Noktaları (binlik ayracı) silip kontrol ediyoruz
            const cleanCheck = cellVal.replace(/\./g, '');
            if (/^\d+([,]\d+)?$/.test(cleanCheck) && cleanCheck.length > 0) {
               const price = parseFloat(cleanCheck.replace(',', '.'));
               
               // Sadece gerçekçi fiyatları al ve mükerrer eklemeyi engelle
               if (!isNaN(price) && price > 0 && !updates.find(u => u.symbol === s)) {
                 updates.push({ 
                   symbol: s, 
                   price: price, 
                   change: 0 // Değişim oranı opsiyonel, ana odak fiyat
                 });
                 priceFoundForThisSymbol = true;
               }
            }
          });
        }
      });
    });

    console.log(`[BAŞARILI] Bulunan hisseler:`, updates.map(u => u.symbol));
    
    // Eğer bazı hisseler bulunamadıysa terminale log bas
    if (updates.length < requestedSymbols.length) {
      const foundSymbols = updates.map(u => u.symbol);
      const missingSymbols = requestedSymbols.filter(s => !foundSymbols.includes(s));
      console.warn(`[API/STOCK] Bazı semboller tabloda bulunamadı: ${missingSymbols.join(', ')}`);
    }

    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("KRITIK_HATA:", error.message);
    
    // Uygulamanın çökmemesi için boş liste dön
    return NextResponse.json([], { status: 200 });
  }
}
