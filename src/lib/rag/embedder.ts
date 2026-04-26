import { env, pipeline } from '@huggingface/transformers';

export interface EmbedderConfig {
  modelPath: string;
  batchSize: number;
  cacheDir: string;
}

export class Embedder {
  private model: Awaited<ReturnType<typeof pipeline>> | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly config: EmbedderConfig;

  constructor(config: EmbedderConfig) {
    this.config = config;
  }

  private async initialize(): Promise<void> {
    if (this.model) return;
    env.cacheDir = this.config.cacheDir;
    this.model = await pipeline('feature-extraction', this.config.modelPath);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.model) return;
    if (!this.initPromise) {
      this.initPromise = this.initialize().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    await this.initPromise;
  }

  async embed(text: string): Promise<number[]> {
    await this.ensureInitialized();
    if (text.length === 0) return new Array(384).fill(0);
    const call = this.model as (t: string, o: unknown) => Promise<{ data: Float32Array }>;
    const output = await call(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.ensureInitialized();
    if (texts.length === 0) return [];
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const embeddings = await Promise.all(batch.map((t) => this.embed(t)));
      results.push(...embeddings);
    }
    return results;
  }
}
