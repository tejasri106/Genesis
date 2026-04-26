import { createMistral } from '@ai-sdk/mistral';
import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';
import { google } from '@ai-sdk/google';
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai';
import type { LanguageModel } from 'ai';

// Mistral key pool — tries each in order when a previous one fails (auth/rate limit)
const MISTRAL_KEYS = [
  process.env.MISTRAL_API_KEY,
  process.env.MISTRAL_API_KEY_2,
  process.env.MISTRAL_API_KEY_3,
].filter(Boolean) as string[];

function mistralWithFallback(modelName: string): LanguageModel {
  async function withFallback<T>(fn: (model: LanguageModel) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < MISTRAL_KEYS.length; i++) {
      const client = createMistral({ apiKey: MISTRAL_KEYS[i] })(modelName) as LanguageModel;
      try {
        return await fn(client);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const retryable =
          msg.includes('401') || msg.includes('403') || msg.includes('429') ||
          msg.includes('Unauthorized') || msg.includes('quota') || msg.includes('rate limit');
        if (retryable && i < MISTRAL_KEYS.length - 1) {
          console.warn(`Mistral key ${i + 1} failed (${msg.slice(0, 60)}), trying key ${i + 2}`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  const base = createMistral({ apiKey: MISTRAL_KEYS[0] })(modelName);
  return {
    ...base,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doGenerate: (params: any) => withFallback((m) => (m as any).doGenerate(params)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doStream: (params: any) => withFallback((m) => (m as any).doStream(params)),
  } as unknown as LanguageModel;
}

export const MODEL_IDS = [
  'mistral-large',
  'mistral-large-3',
  'mistral-small',
  'claude-sonnet',
  'claude-haiku',
  'gemini-flash',
  'gemini-pro',
  'llama-70b',
  'deepseek-r1',
] as const;

export type ModelID = (typeof MODEL_IDS)[number];

export const DEFAULT_MODEL: ModelID = 'mistral-large';

export interface ModelInfo {
  id: ModelID;
  label: string;
  provider: 'mistral' | 'anthropic' | 'google' | 'groq';
  description: string;
}

export const MODEL_DETAILS: Record<ModelID, ModelInfo> = {
  'mistral-large': { id: 'mistral-large', label: 'Mistral Large', provider: 'mistral', description: 'Most capable Mistral model' },
  'mistral-large-3': { id: 'mistral-large-3', label: 'Mistral Large 3', provider: 'mistral', description: 'Deep research · long context' },
  'mistral-small': { id: 'mistral-small', label: 'Mistral Small', provider: 'mistral', description: 'Fast & efficient' },
  'claude-sonnet': { id: 'claude-sonnet', label: 'Claude Sonnet', provider: 'anthropic', description: 'Balanced intelligence' },
  'claude-haiku': { id: 'claude-haiku', label: 'Claude Haiku', provider: 'anthropic', description: 'Fast & cost-efficient' },
  'gemini-flash': { id: 'gemini-flash', label: 'Gemini Flash', provider: 'google', description: 'Ultra-fast multimodal' },
  'gemini-pro': { id: 'gemini-pro', label: 'Gemini Pro', provider: 'google', description: 'Advanced reasoning' },
  'llama-70b': { id: 'llama-70b', label: 'Llama 3.3 70B', provider: 'groq', description: 'Meta Llama via Groq' },
  'deepseek-r1': { id: 'deepseek-r1', label: 'DeepSeek R1', provider: 'groq', description: 'Reasoning model via Groq' },
};

const languageModels: Record<ModelID, LanguageModel> = {
  'mistral-large': mistralWithFallback('mistral-large-latest'),
  'mistral-large-3': mistralWithFallback('mistral-large-2501'),
  'mistral-small': mistralWithFallback('mistral-small-latest'),
  'claude-sonnet': anthropic('claude-sonnet-4-6'),
  'claude-haiku': anthropic('claude-haiku-4-5-20251001'),
  'gemini-flash': google('gemini-2.0-flash'),
  'gemini-pro': google('gemini-1.5-pro'),
  'llama-70b': groq('llama-3.3-70b-versatile'),
  'deepseek-r1': wrapLanguageModel({
    model: groq('deepseek-r1-distill-llama-70b'),
    middleware: extractReasoningMiddleware({ tagName: 'think' }),
  }),
};

export function getModel(modelId?: string | null): LanguageModel {
  if (modelId && (MODEL_IDS as readonly string[]).includes(modelId)) {
    return languageModels[modelId as ModelID];
  }
  return languageModels[DEFAULT_MODEL];
}
