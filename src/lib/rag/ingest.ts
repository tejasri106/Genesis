import { readFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { basename } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { getRagStore, getRagEmbedder, getRagChunker } from './store';
import type { VectorChunk } from './vectordb';

export async function ingestFile(filePath: string): Promise<{ chunks: number; fileName: string }> {
  const text = await readFile(filePath, 'utf-8');
  return ingestText(text, basename(filePath), filePath);
}

export async function ingestText(
  text: string,
  fileName: string,
  fileId: string
): Promise<{ chunks: number; fileName: string }> {
  const [store, embedder, chunker] = await Promise.all([
    getRagStore(),
    getRagEmbedder(),
    getRagChunker(),
  ]);

  await store.deleteChunks(fileId);

  const textChunks = await chunker.chunkText(text);
  if (textChunks.length === 0) return { chunks: 0, fileName };

  const vectors = await embedder.embedBatch(textChunks.map((c) => c.text));

  const fileSize = (() => {
    try { return statSync(fileId).size; } catch { return text.length; }
  })();

  const chunks: VectorChunk[] = textChunks.map((chunk, i) => ({
    id: uuidv4(),
    filePath: fileId,
    chunkIndex: chunk.index,
    text: chunk.text,
    vector: vectors[i],
    metadata: { fileName, fileSize, fileType: fileName.split('.').pop() ?? 'txt' },
    timestamp: new Date().toISOString(),
  }));

  await store.insertChunks(chunks);
  return { chunks: chunks.length, fileName };
}
