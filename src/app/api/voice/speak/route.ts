import { NextRequest } from 'next/server';

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';

function getApiKeys(): string[] {
  return [
    process.env.ELEVENLABS_API_KEY,
    process.env.ELEVENLABS_API_KEY_2,
    process.env.ELEVENLABS_API_KEY_3,
    process.env.ELEVENLABS_API_KEY_4,
    process.env.ELEVENLABS_API_KEY_5,
  ].filter(Boolean) as string[];
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/^[-=]{3,}$/gm, '')
    .replace(/>\s+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(req: NextRequest) {
  const keys = getApiKeys();
  if (keys.length === 0) return new Response('ElevenLabs API key not configured', { status: 500 });

  const { text, voiceId } = await req.json();
  if (!text?.trim()) return new Response('No text provided', { status: 400 });

  const clean = stripMarkdown(text).slice(0, 1200);
  const selectedVoice = voiceId || VOICE_ID;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: clean,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (response.ok) {
      console.log(`[speak] Using ElevenLabs key ${i + 1}`);
      return new Response(response.body, {
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
      });
    }

    console.warn(`[speak] Key ${i + 1} failed with ${response.status}`);
  }

  return new Response('All ElevenLabs API keys failed', { status: 502 });
}
