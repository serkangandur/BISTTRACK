import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date'); // format: YYYY-MM-DD, optional

  try {
    let rate: number | null = null;

    if (date) {
      // Geçmiş tarih kuru — frankfurter.app (ücretsiz, API key gerekmez)
      const res = await fetch(
        `https://api.frankfurter.app/${date}?from=USD&to=TRY`,
        { next: { revalidate: 86400 } } // 24 saat cache
      );
      if (res.ok) {
        const data = await res.json();
        rate = data.rates?.TRY || null;
      }
    }

    if (!rate) {
      // Güncel kur
      const res = await fetch(
        'https://api.frankfurter.app/latest?from=USD&to=TRY',
        { next: { revalidate: 3600 } } // 1 saat cache
      );
      if (res.ok) {
        const data = await res.json();
        rate = data.rates?.TRY || null;
      }
    }

    if (!rate) {
      return NextResponse.json({ error: 'Kur alınamadı' }, { status: 500 });
    }

    return NextResponse.json({ rate, date: date || 'latest' });
  } catch (err) {
    console.error('Döviz kuru hatası:', err);
    return NextResponse.json({ error: 'Kur alınamadı' }, { status: 500 });
  }
}
