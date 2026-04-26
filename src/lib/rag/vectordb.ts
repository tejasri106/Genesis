import { type Connection, type Table, connect } from '@lancedb/lancedb';

export interface VectorStoreConfig {
  dbPath: string;
  tableName: string;
}

export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  section?: string;
}

export interface VectorChunk {
  id: string;
  filePath: string;
  chunkIndex: number;
  text: string;
  vector: number[];
  metadata: DocumentMetadata;
  timestamp: string;
}

export interface SearchResult {
  filePath: string;
  chunkIndex: number;
  text: string;
  score: number;
  metadata: DocumentMetadata;
}

export class VectorStore {
  private db: Connection | null = null;
  private table: Table | null = null;
  private readonly config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.db = await connect(this.config.dbPath);
    const tableNames = await this.db.tableNames();
    if (tableNames.includes(this.config.tableName)) {
      this.table = await this.db.openTable(this.config.tableName);
    }
  }

  async deleteChunks(filePath: string): Promise<void> {
    if (!this.table) return;
    try {
      const escaped = filePath.replace(/'/g, "''");
      await this.table.delete(`\`filePath\` = '${escaped}'`);
    } catch {
      // ignore "not found" errors
    }
  }

  async insertChunks(chunks: VectorChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const records = chunks as unknown as Record<string, unknown>[];
    if (!this.table) {
      if (!this.db) throw new Error('VectorStore not initialized');
      this.table = await this.db.createTable(this.config.tableName, records);
    } else {
      await this.table.add(records);
    }
  }

  async search(queryVector: number[], limit = 5): Promise<SearchResult[]> {
    if (!this.table) return [];
    const results = await this.table.vectorSearch(queryVector).limit(limit).toArray();
    return results.map((r) => ({
      filePath: r.filePath as string,
      chunkIndex: r.chunkIndex as number,
      text: r.text as string,
      score: r._distance as number,
      metadata: r.metadata as DocumentMetadata,
    }));
  }

  async getStatus(): Promise<{ documentCount: number; chunkCount: number }> {
    if (!this.table) return { documentCount: 0, chunkCount: 0 };
    const all = await this.table.query().toArray();
    const unique = new Set(all.map((r) => r.filePath as string));
    return { documentCount: unique.size, chunkCount: all.length };
  }
}
