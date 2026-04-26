import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { detectPII, buildSecurityWarning } from '@/lib/security';
import { createSupervisorStream } from '@/lib/agents/supervisor';

function staticStream(text: string): Response {
  const stream = createUIMessageStream({
    execute({ writer }) {
      writer.write({ type: 'text-delta', delta: text, id: 'security' });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  const { messages, patient, stack, deltas, modelId, clinician } = await req.json();

  const lastUserMsg = [...(messages ?? [])].reverse().find((m: { role: string }) => m.role === 'user');
  const userText: string =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lastUserMsg as any)?.parts?.find((p: any) => p.type === 'text')?.text ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lastUserMsg as any)?.content ?? '';

  console.log('[/api/agent/chat] POST', {
    modelId,
    patient: patient?.name,
    stackLen: stack?.length,
    clinician: clinician?.name,
    userText: userText.slice(0, 100),
  });

  // Pre-flight: HIPAA/PII check
  const piiLabel = detectPII(userText);
  if (piiLabel) {
    console.log('[/api/agent/chat] PII blocked:', piiLabel);
    return staticStream(buildSecurityWarning(piiLabel));
  }

  try {
    const result = await createSupervisorStream({ messages, patient, stack, deltas, modelId, clinician });
    console.log('[/api/agent/chat] Stream created, returning response');
    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error('[/api/agent/chat] createSupervisorStream threw:', err);
    throw err;
  }
}
