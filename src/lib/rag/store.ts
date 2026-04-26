import { VectorStore } from './vectordb';
import { Embedder } from './embedder';
import { DocumentChunker } from './chunker';

const DB_PATH = process.env.RAG_DB_PATH ?? './data/rag-lancedb';
const MODEL_PATH = 'Xenova/all-MiniLM-L6-v2';
const CACHE_DIR = process.env.RAG_MODEL_CACHE ?? './data/rag-model-cache';

let _store: VectorStore | null = null;
let _embedder: Embedder | null = null;
let _chunker: DocumentChunker | null = null;

export async function getRagStore(): Promise<VectorStore> {
  if (!_store) {
    _store = new VectorStore({ dbPath: DB_PATH, tableName: 'tnbc_documents' });
    await _store.initialize();
  }
  return _store;
}

export async function getRagEmbedder(): Promise<Embedder> {
  if (!_embedder) {
    _embedder = new Embedder({ modelPath: MODEL_PATH, batchSize: 8, cacheDir: CACHE_DIR });
  }
  return _embedder;
}

export async function getRagChunker(): Promise<DocumentChunker> {
  if (!_chunker) {
    _chunker = new DocumentChunker({ chunkSize: 512, chunkOverlap: 100 });
    await _chunker.initialize();
  }
  return _chunker;
}
