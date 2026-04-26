/**
 * One-time ingestion script: loads all markdown files from data/rag-docs/
 * and data/datasets/ into the LanceDB vector store.
 *
 * Run with: npx tsx scripts/ingest-tnbc-docs.ts
 */

import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ingestFile } from '../src/lib/rag/ingest';

const INGEST_DIRS = [
  resolve(process.cwd(), 'data/rag-docs'),
  resolve(process.cwd(), 'data/datasets'),
];

const SUPPORTED = ['.md', '.txt', '.json'];

async function main() {
  console.log('Helix RAG Ingestion Script');
  console.log('==========================');

  let total = 0;
  let totalChunks = 0;

  for (const dir of INGEST_DIRS) {
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      console.log(`Skipping ${dir} (not found)`);
      continue;
    }

    const supported = files.filter((f) => SUPPORTED.some((ext) => f.endsWith(ext)));
    if (supported.length === 0) {
      console.log(`No supported files in ${dir}`);
      continue;
    }

    console.log(`\nIngesting from ${dir} (${supported.length} files)...`);

    for (const file of supported) {
      const filePath = join(dir, file);
      try {
        const { chunks, fileName } = await ingestFile(filePath);
        console.log(`  ✓ ${fileName} → ${chunks} chunks`);
        totalChunks += chunks;
        total++;
      } catch (err) {
        console.error(`  ✗ ${file}: ${err}`);
      }
    }
  }

  console.log(`\nDone. Ingested ${total} files → ${totalChunks} total chunks.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
