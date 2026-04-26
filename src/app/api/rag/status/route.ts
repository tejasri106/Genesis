import { NextResponse } from 'next/server';
import { getRagStore } from '@/lib/rag/store';

export async function GET() {
  try {
    const store = await getRagStore();
    const status = await store.getStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (err) {
    return NextResponse.json({ ok: false, documentCount: 0, chunkCount: 0, error: String(err) });
  }
}
