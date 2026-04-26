import { NextResponse } from 'next/server';
import { retrieveContext } from '@/lib/rag/retrieve';
import { getRagStore, getRagEmbedder } from '@/lib/rag/store';

export async function POST(req: Request) {
  try {
    const { query, limit = 5 } = await req.json();
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

    const [embedder, store] = await Promise.all([getRagEmbedder(), getRagStore()]);
    const vector = await embedder.embed(query);
    const results = await store.search(vector, Math.min(limit, 10));

    return NextResponse.json({
      results: results.map((r) => ({
        fileName: r.metadata.fileName,
        text: r.text,
        score: parseFloat((1 - r.score).toFixed(4)),
      })),
      context: await retrieveContext(query, limit),
    });
  } catch (err) {
    console.error('RAG search error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
