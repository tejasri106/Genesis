import { NextRequest } from 'next/server';

function getApiKeys(): string[] {
  return [
    process.env.ELEVENLABS_API_KEY,
    process.env.ELEVENLABS_API_KEY_2,
    process.env.ELEVENLABS_API_KEY_3,
    process.env.ELEVENLABS_API_KEY_4,
    process.env.ELEVENLABS_API_KEY_5,
  ].filter(Boolean) as string[];
}

export async function GET(_req: NextRequest) {
  const keys = getApiKeys();

  if (keys.length === 0) {
    console.warn('[voices] No ELEVENLABS_API_KEY configured');
    return Response.json({ voices: [] });
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[voices] Key ${i + 1} failed: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const voices = (data.voices ?? []).map(
        (v: { voice_id: string; name: string; category?: string; labels?: Record<string, string> }) => ({
          voiceId: v.voice_id,
          name: v.name,
          category: v.category ?? 'other',
          gender: v.labels?.gender ?? '',
          accent: v.labels?.accent ?? '',
        })
      );

      console.log(`[voices] Key ${i + 1} OK — returning ${voices.length} voices`);
      return Response.json({ voices });
    } catch (err) {
      console.warn(`[voices] Key ${i + 1} error:`, err);
    }
  }

  console.error('[voices] All keys failed');
  return Response.json({ voices: [], error: 'All ElevenLabs API keys failed' });
}
