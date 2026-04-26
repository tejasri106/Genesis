import { NextResponse } from 'next/server';
import { ingestText, ingestFile } from '@/lib/rag/ingest';
import { resolve } from 'node:path';

export const maxDuration = 300; // 5 min for embedding large docs

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      const filePath = form.get('filePath') as string | null;

      if (filePath) {
        // Ingest by absolute file path (server-side only)
        const abs = resolve(filePath);
        const result = await ingestFile(abs);
        return NextResponse.json({ ok: true, ...result });
      }

      if (file) {
        const text = await file.text();
        const result = await ingestText(text, file.name, `upload:${file.name}`);
        return NextResponse.json({ ok: true, ...result });
      }

      return NextResponse.json({ error: 'No file or filePath provided' }, { status: 400 });
    }

    // JSON body: { text, fileName }
    const { text, fileName } = await req.json();
    if (!text || !fileName) {
      return NextResponse.json({ error: 'text and fileName required' }, { status: 400 });
    }
    const result = await ingestText(text, fileName, `manual:${fileName}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('RAG ingest error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
