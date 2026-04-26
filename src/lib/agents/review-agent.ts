import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';

export type ReviewVerdict = 'supported' | 'contradicted' | 'uncertain';

export interface ReviewResult {
  verdict: ReviewVerdict;
  explanation: string;
  confidence: 'high' | 'moderate' | 'low';
}

export async function runReviewAgent(
  claim: string,
  evidence: string,
  modelId?: string
): Promise<string> {
  const { text } = await generateText({
    model: getModel(modelId),
    system: `You are the Genesis Review Agent — a clinical fact-checker for TNBC oncology.

Given a claim and supporting evidence, determine:
- SUPPORTED: claim is directly backed by evidence with specific citations
- CONTRADICTED: evidence contradicts the claim — explain what the evidence actually shows
- UNCERTAIN: evidence is insufficient or conflicting — note the gaps

Rules:
- Be strict: if numbers don't match, flag it
- If trial population differs from patient profile, note it
- Never expand beyond provided evidence
- Format: start with verdict in bold, then explanation in 2-3 sentences`,
    messages: [
      {
        role: 'user',
        content: `CLAIM: ${claim}\n\nEVIDENCE:\n${evidence}`,
      },
    ],
    maxOutputTokens: 300,
  });

  return text;
}
