import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

async function transcribeWithElevenLabs(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  if (!ELEVENLABS_KEY) throw new Error('No ElevenLabs API key');

  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
  const audioBlob = new Blob([buffer], { type: mimeType });

  const form = new FormData();
  form.append('file', audioBlob, `recording.${ext}`);
  form.append('model_id', 'scribe_v1');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_KEY },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[ElevenLabs STT] ${res.status}: ${body}`);
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  return data.text ?? '';
}

async function transcribeWithGroq(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  if (!GROQ_KEY) throw new Error('No Groq API key');

  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
  const audioBlob = new Blob([buffer], { type: mimeType });

  const form = new FormData();
  form.append('file', audioBlob, `recording.${ext}`);
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Groq Whisper] ${res.status}: ${body}`);
    throw new Error(`Groq ${res.status}: ${body.slice(0, 120)}`);
  }

  const data = await res.json();
  return data.text ?? '';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as File | null;

    if (!audio || audio.size === 0) {
      return NextResponse.json({ error: 'No audio provided or empty recording' }, { status: 400 });
    }

    const mimeType = audio.type || 'audio/webm';
    const buffer = await audio.arrayBuffer();

    console.log(`[transcribe] size=${audio.size} bytes, type=${mimeType}`);

    // Try ElevenLabs first, fall back to Groq Whisper
    let text = '';
    try {
      text = await transcribeWithElevenLabs(buffer, mimeType);
      console.log(`[transcribe] ElevenLabs OK: "${text.slice(0, 60)}"`);
    } catch (elevenErr) {
      console.warn(`[transcribe] ElevenLabs failed, trying Groq: ${elevenErr}`);
      try {
        text = await transcribeWithGroq(buffer, mimeType);
        console.log(`[transcribe] Groq OK: "${text.slice(0, 60)}"`);
      } catch (groqErr) {
        console.error(`[transcribe] Both STT providers failed. Groq: ${groqErr}`);
        return NextResponse.json({ error: 'Transcription failed — both providers unavailable' }, { status: 502 });
      }
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error('[transcribe] Unexpected error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
