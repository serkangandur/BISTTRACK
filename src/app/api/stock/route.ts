import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log("--- [API TEST BAŞLADI] ---");
  
  try {
    // Sadece Binance TR Testi
    const btcRes = await fetch('https://api.binance.tr/api/v3/ticker/price?symbol=BTCTRY', { cache: 'no-store' });
    const btcData = await btcRes.json();
    
    console.log("Binance Yanıtı:", btcData);

    if (!btcData || !btcData.price) {
      throw new Error("Binance API'den geçersiz veri döndü.");
    }

    const btcPrice = parseFloat(btcData.price);

    const updates = [
      { symbol: 'BTC', price: btcPrice, change: 0 },
      { symbol: 'Bitcoin Türk Lirası', price: btcPrice, change: 0 },
      { symbol: 'BITCOIN', price: btcPrice, change: 0 }
    ];

    console.log("Gönderilen Veri:", updates);
    return NextResponse.json(updates, { status: 200 });

  } catch (error: any) {
    console.error("KRİTİK HATA:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
