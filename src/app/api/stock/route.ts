
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
    console.log(`[API/STOCK] CNN Türk Finans kazıma başlatılıyor...`);

    // CNN Türk BIST Tüm Hisseler URL
    const targetUrl = 'https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri';

    const { data: html } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000 // 10 saniye zaman aşımı
    });

    const $ = cheerio.load(html);
    const updates: any[] = [];

    // Sayfadaki tabloyu tara
    // Genellikle 'table' veya 'div.table-responsive' içinde yer alır
    $('tr').each((_, element) => {
      const tds = $(element).find('td');
      if (tds.length >= 2) {
        // İlk sütun genellikle semboldür (Örn: ACSEL)
        const symbol = $(tds[0]).text().trim().toUpperCase();
        
        // Eğer bu sembol istenenler arasındaysa veriyi çek
        if (requestedSymbols.includes(symbol)) {
          // Fiyat sütunu genellikle 'td:nth-child(2)' veya 'td:nth-child(3)' olur
          // CNN Türk yapısına göre 'Son' fiyat sütununu bulalım
          const lastPriceStr = $(tds[2]).text().trim(); // 'Son' fiyat kolonu
          const changeStr = $(tds[3]).text().trim();    // 'Yüzde Değişim' kolonu

          // Türkçe formatı (12,50) İngilizce/Kod formatına (12.50) çevir
          const price = parseFloat(lastPriceStr.replace('.', '').replace(',', '.'));
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

    console.log(`[API/STOCK] ${updates.length} hisse için veri başarıyla kazındı.`);
    
    // Eğer bazı semboller eksikse, boş dönmek yerine olanları dön
    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("KRITIK_HATA: CNN Türk kazıma sırasında hata oluştu:", error.message);
    // Hata durumunda boş liste dönerek uygulamanın kilitlenmesini önle
    return NextResponse.json([], { status: 200 });
  }
}
