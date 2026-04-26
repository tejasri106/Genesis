import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import { retrieveContext } from '@/lib/rag/retrieve';

export async function runRagAgent(
  query: string,
  patientContext: string,
  modelId?: string
): Promise<string> {
  console.log('[RAG Agent] Starting retrieval', { query: query.slice(0, 80) });
  let context: string;
  try {
    context = await retrieveContext(query, 6);
    console.log('[RAG Agent] Retrieval done', { contextLen: context.length, preview: context.slice(0, 80) });
  } catch (err) {
    console.error('[RAG Agent] Retrieval failed', err);
    return 'Knowledge base retrieval failed. Try again or use the Live Literature Search.';
  }

  if (context.startsWith('No relevant documents')) {
    console.log('[RAG Agent] No relevant documents found');
    return context;
  }

  console.log('[RAG Agent] Calling model', { modelId });
  try {
    const { text } = await generateText({
      model: getModel(modelId),
      system: `You are the Genesis RAG Agent. Answer ONLY using the provided document context.
If the context does not contain sufficient information, say so explicitly — do NOT fabricate.
Always reference the source document when citing specific data (e.g., "Per keynote-522.md...").
Patient context: ${patientContext}`,
      messages: [
        {
          role: 'user',
          content: `Question: ${query}\n\nRetrieved context:\n${context}`,
        },
      ],
      maxOutputTokens: 500,
      abortSignal: AbortSignal.timeout(25000),
    });
    console.log('[RAG Agent] Done', { textLen: text.length });
    return text || 'No answer generated from the knowledge base.';
  } catch (err) {
    console.error('[RAG Agent] Model call failed/timed out', err);
    return `Knowledge base query timed out. Retrieved context (raw):\n\n${context.slice(0, 800)}`;
  }
}
