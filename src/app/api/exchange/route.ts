import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  try {
    let rate: number | null = null;

    if (date) {
      const res = await fetch(
        `https://api.frankfurter.app/${date}?from=USD&to=TRY`,
        { next: { revalidate: 86400 } }
      );
      if (res.ok) {
        const data = await res.json();
        rate = data.rates?.TRY || null;
      }
    }

    if (!rate) {
      const res = await fetch(
        'https://api.frankfurter.app/latest?from=USD&to=TRY',
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const data = await res.json();
        rate = data.rates?.TRY || null;
      }
    }

    if (!rate) {
      return NextResponse.json({ error: 'Kur alinamadi' }, { status: 500 });
    }

    return NextResponse.json({ rate, date: date || 'latest' });
  } catch (err) {
    console.error('Doviz kuru hatasi:', err);
    return NextResponse.json({ error: 'Kur alinamadi' }, { status: 500 });
  }
}
