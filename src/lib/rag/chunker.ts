import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export interface TextChunk {
  text: string;
  index: number;
}

export class DocumentChunker {
  private splitter: RecursiveCharacterTextSplitter | null = null;
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(config: { chunkSize: number; chunkOverlap: number }) {
    this.chunkSize = config.chunkSize;
    this.chunkOverlap = config.chunkOverlap;
  }

  async initialize(): Promise<void> {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });
  }

  async chunkText(text: string): Promise<TextChunk[]> {
    if (!this.splitter) throw new Error('DocumentChunker not initialized');
    if (text.length === 0) return [];
    const chunks = await this.splitter.splitText(text);
    return chunks.map((chunk, index) => ({ text: chunk, index }));
  }
}
