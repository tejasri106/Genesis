import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.resolve(process.cwd(), 'data/rag-docs');

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
}

function scoreChunk(chunkTokens: string[], queryTerms: string[]): number {
  let score = 0;
  for (const qt of queryTerms) {
    for (const ct of chunkTokens) {
      if (ct === qt) score += 2;
      else if (ct.includes(qt) || qt.includes(ct)) score += 1;
    }
  }
  return score;
}

export async function retrieveContext(query: string, limit = 5): Promise<string> {
  console.log('[RAG retrieve] File-based keyword search', { query: query.slice(0, 80) });
  const t0 = Date.now();

  if (!fs.existsSync(DOCS_DIR)) {
    return 'No relevant documents found in the local TNBC knowledge base.';
  }

  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'));
  const queryTerms = tokenize(query);

  const chunks: { text: string; file: string; score: number }[] = [];

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Split on blank lines, keep sections >= 60 chars
    const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length >= 60);

    for (const para of paragraphs) {
      const chunkTokens = tokenize(para);
      const score = scoreChunk(chunkTokens, queryTerms);
      if (score > 0) {
        chunks.push({ text: para, file, score });
      }
    }
  }

  console.log('[RAG retrieve] Done in', Date.now() - t0, 'ms, chunks scored:', chunks.length);

  if (chunks.length === 0) {
    return 'No relevant documents found in the local TNBC knowledge base.';
  }

  return chunks
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c, i) => `[${i + 1}] Source: ${c.file}\n${c.text}`)
    .join('\n\n---\n\n');
}
