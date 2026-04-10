import { NextResponse } from 'next/server';

const MADRID_LAT = 40.4168;
const MADRID_LON = -3.7038;
const CACHE_TTL_MS = 30 * 60 * 1000;

type CachedWeather = {
  expiresAt: number;
  payload: unknown;
};

const globalCache = globalThis as unknown as {
  madridWeatherCache?: CachedWeather;
};

function mapWeatherCodeToSymbol(code: number) {
  if (code === 0) return { label: 'Soleado', icon: 'sun' as const, emoji: '☀️' };
  if ([1, 2].includes(code)) return { label: 'Poco nuboso', icon: 'cloud-sun' as const, emoji: '🌤️' };
  if (code === 3) return { label: 'Nublado', icon: 'cloud' as const, emoji: '☁️' };
  if ([45, 48].includes(code)) return { label: 'Niebla', icon: 'cloud' as const, emoji: '🌫️' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Lluvia', icon: 'rain' as const, emoji: '🌧️' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Nieve', icon: 'snow' as const, emoji: '❄️' };
  if ([95, 96, 99].includes(code)) return { label: 'Tormenta', icon: 'storm' as const, emoji: '⛈️' };
  return { label: 'Variable', icon: 'cloud' as const, emoji: '🌥️' };
}

export async function GET() {
  try {
    const now = Date.now();
    const cached = globalCache.madridWeatherCache;
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.payload, {
        headers: { 'Cache-Control': 'public, max-age=1800' },
      });
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(MADRID_LAT));
    url.searchParams.set('longitude', String(MADRID_LON));
    url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min');
    url.searchParams.set('timezone', 'Europe/Madrid');
    url.searchParams.set('forecast_days', '16');

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Open-Meteo ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const payload = {
      location: 'Comunidad de Madrid',
      days: (data?.daily?.time || []).map((date: string, index: number) => {
        const weatherCode = Number(data.daily.weathercode?.[index] ?? -1);
        const mapped = mapWeatherCodeToSymbol(weatherCode);
        return {
          date,
          weatherCode,
          ...mapped,
          tempMax: Math.round(Number(data.daily.temperature_2m_max?.[index] ?? 0)),
          tempMin: Math.round(Number(data.daily.temperature_2m_min?.[index] ?? 0)),
        };
      }),
      source: 'open-meteo',
      fetchedAt: new Date().toISOString(),
    };

    globalCache.madridWeatherCache = {
      expiresAt: now + CACHE_TTL_MS,
      payload,
    };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=1800' },
    });
  } catch (error) {
    console.error('Madrid weather route error:', error);
    return NextResponse.json({ error: 'Failed to fetch Madrid weather' }, { status: 500 });
  }
}
