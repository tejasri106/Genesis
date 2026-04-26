import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: [
    '@lancedb/lancedb',
    '@huggingface/transformers',
    '@langchain/textsplitters',
  ],
};

export default nextConfig;
