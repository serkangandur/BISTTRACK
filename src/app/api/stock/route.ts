import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

/**
 * BIST Veri Çekme Motoru v33.0 Saf BIST
 * Kaynak: CNN Türk Finans
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  
  if (!symbolsParam) {
    return NextResponse.json([]);
  }

  // Kullanıcının portföyündeki sembolleri temizle ve hazırla
  const requestedSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
  const updates: any[] = [];

  console.log("--- [BIST TARAMA BAŞLADI] ---");
  console.log("Sorgulanan Semboller:", requestedSymbols);

  try {
    // CNN Türk Canlı Borsa Sayfası
    const response = await fetch('https://finans.cnnturk.com/canli-borsa/bist-tum-hisseleri', {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      console.error(`[BIST HATA] CNN Türk'e ulaşılamadı. HTTP Durum: ${response.status}`);
      return NextResponse.json([]);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Tablodaki tüm satırları hedef al
    const rows = $('table tbody tr');

    if (rows.length === 0) {
      console.error("[BIST HATA] CNN Türk sayfasında hisse tablosu bulunamadı.");
      return NextResponse.json([]);
    }

    rows.each((_, element) => {
      const cols = $(element).find('td');
      
      if (cols.length >= 3) {
        // 1. Sütun: Sembol (Örn: PAGYO)
        const symbolInTable = $(cols[0]).text().trim().toUpperCase();
        
        // Eğer bu sembol istenen listede varsa
        if (requestedSymbols.includes(symbolInTable)) {
          // 3. Sütun: Fiyat (Örn: 42,50)
          let priceRaw = $(cols[2]).text().trim();
          
          // Temizlik: Noktaları (binlik ayırıcı) sil, virgülü (ondalık) noktaya çevir
          const priceValue = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'));

          if (!isNaN(priceValue)) {
            updates.push({
              symbol: symbolInTable,
              price: priceValue,
              change: 0 // Değişim şimdilik 0 olarak dönülüyor
            });
            console.log(`[BIST] ${symbolInTable} Bulundu: ${priceValue} ₺`);
          }
        }
      }
    });

    console.log(`--- [TARAMA TAMAMLANDI] Toplam ${updates.length} eşleşme bulundu. ---`);
    return NextResponse.json(updates);

  } catch (error: any) {
    console.error("[BIST HATA] Beklenmeyen bir hata oluştu:", error.message);
    return NextResponse.json(updates);
  }
}
