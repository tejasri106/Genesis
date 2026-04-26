import { streamText, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/providers';
import { runResearchAgent } from './research-agent';
import { runRagAgent } from './rag-agent';
import { runTwinAgent } from './twin-agent';
import { runReviewAgent } from './review-agent';

export interface SupervisorInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patient: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stack: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deltas: Record<string, any> | null;
  modelId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clinician?: Record<string, any> | null;
}

export async function createSupervisorStream(input: SupervisorInput) {
  const { messages, patient, stack, deltas, modelId, clinician } = input;

  // Extract last user message text — used as fallback when model omits tool args
  const lastUserText: string = (() => {
    const last = [...(messages ?? [])].reverse().find((m: any) => m.role === 'user');
    if (!last) return '';
    if (typeof last.content === 'string') return last.content;
    const parts: any[] = Array.isArray(last.parts) ? last.parts : Array.isArray(last.content) ? last.content : [];
    return parts.find((p: any) => p.type === 'text')?.text ?? '';
  })();

  const patientContext = patient
    ? `Patient: ${patient.name}, Stage ${patient.stage} TNBC, BRCA: ${patient.brca}, PD-L1 CPS: ${patient.pdl1Cps}, Ki-67: ${patient.ki67}%`
    : 'No patient loaded';

  const stackContext =
    Array.isArray(stack) && stack.length > 0
      ? `Active interventions: ${stack.map((s) => s.label ?? s.id).join(', ')}`
      : 'No interventions added (standard of care)';

  const clinicianContext = clinician?.name
    ? `Reviewing clinician: ${clinician.name}${clinician.title ? `, ${clinician.title}` : ''}${clinician.affiliation ? ` at ${clinician.affiliation}` : ''}${clinician.credentials ? ` (${clinician.credentials})` : ''}`
    : 'Reviewing clinician: Unknown';

  const systemPrompt = `You are Genesis — an AI clinical decision support agent for triple-negative breast cancer (TNBC) oncology.

YOUR IDENTITY:
- You are GENESIS, an AI agent. You are NOT a doctor and NOT the user.
- The user you are speaking with is the reviewing clinician: ${clinician?.name ?? 'the doctor'}.
- If asked "who am I?", "who are you?", "what are you?", or similar identity questions:
  - Clearly state you are Genesis, an AI clinical decision support agent built to assist oncologists.
  - Identify the user as the reviewing clinician (the doctor reviewing this patient).
  - Never confuse your role (AI agent) with the doctor's role (reviewing clinician).

CONTEXT:
${clinicianContext}
${patientContext}
${stackContext}

MANDATORY RULE: You MUST call a tool for EVERY question. You have NO internal knowledge — do not answer from memory or training data. If you answer without calling a tool, your response is wrong. The ONLY exception is if you need to decline an off-topic query.

TOOL SELECTION — STRICT ROUTING (follow exactly, no exceptions):

analyzeSimulation → use for ANY of these:
- Questions about what the simulation or digital twin shows for this patient
- "What if we add X", "can we do X for N months", "how would X affect this patient"
- ANY question about whether a treatment is needed, effective, or beneficial FOR THIS SPECIFIC PATIENT
- Biomarker trajectory questions (CA 15-3, tumor burden, DFS probability)
- Treatment duration or dosing in the context of this specific patient's projections
- Patient-specific outcome projections, risk assessment, intervention stack analysis
- Examples: "can we do chemo for 8 months", "what if we add pembrolizumab", "do we need chemo", "should we use chemo", "is chemo needed", "will this work for her", "what does the twin show", "project the biomarkers"

searchLiterature → use for:
- Published trial efficacy data, HR values, p-values from named trials
- Drug class evidence NOT specific to simulation of this patient
- Recent publications, clinical trial results, real-world outcome data
- Examples: "KEYNOTE-522 results", "what does ASCENT show", "sacituzumab efficacy data"

searchKnowledgeBase → use for:
- Established clinical guidelines (NCCN, ESMO)
- Biomarker definitions, diagnostic criteria, staging standards
- General TNBC treatment pathways NOT tied to this patient's simulation
- Genesis company information: staff profiles, leadership team, contact details, services, mission
- Questions about who someone is (person names like "who is Diya Kamboj", "who is Dr. Patel", etc.)
- HIPAA/compliance policies, working hours, company goals
- Examples: "NCCN TNBC guidelines", "who is Diya Kamboj", "what is PD-L1 CPS", "Genesis leadership team", "who is the CEO"

validateClinicalClaim → use to fact-check a specific claim against evidence already retrieved.

CRITICAL OUTPUT RULES — you MUST follow these exactly:
1. After EVERY tool call, you MUST write a text response. Never end a turn with only a tool call and no text.
2. When analyzeSimulation returns results, copy the FULL markdown output from the tool into your response verbatim — do not summarize or shorten it.
3. When searchLiterature or searchKnowledgeBase returns results, synthesize the findings into a clear clinical response with citations.
4. For complex questions, chain tools then write a unified response.
5. Always cite specific trials (KEYNOTE-522, OlympiAD, ASCENT, CREATE-X) with HR and p-values where relevant.
6. Never make definitive treatment recommendations — note that clinical judgment is required.
7. Decline off-topic queries politely.`;

  const convertedMessages = await convertToModelMessages(messages);

  // Plain tool objects — tool() is an identity helper; skipping it avoids Zod v4 type issues.
  // The `as any` cast on `tools` lets TypeScript accept the object without resolving overloads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any = {
    searchLiterature: {
      description: 'Search PubMed, EuropePMC, and ClinicalTrials.gov for live TNBC oncology evidence. Clinical terms only.',
      parameters: z.object({ query: z.string().describe('Clinical search query — drug names, biomarkers, trial identifiers') }),
      execute: async (args: { query?: string }) => {
        const query = args?.query?.trim() || lastUserText || 'TNBC chemotherapy evidence';
        try {
          return await runResearchAgent(query, modelId);
        } catch (err) {
          console.error('[Supervisor] searchLiterature failed', err);
          return `Literature search failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    searchKnowledgeBase: {
      description: 'Search local TNBC knowledge base — trial papers, NCCN/ESMO guidelines, biomarker references, staging criteria.',
      parameters: z.object({ query: z.string().describe('Question to search in local knowledge base') }),
      execute: async (args: { query?: string }) => {
        const query = args?.query?.trim() || lastUserText || 'TNBC guidelines';
        try {
          return await runRagAgent(query, patientContext, modelId);
        } catch (err) {
          console.error('[Supervisor] searchKnowledgeBase failed', err);
          return `Knowledge base search failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    analyzeSimulation: {
      description: 'Analyze digital twin simulation outcomes for the current patient and intervention stack.',
      parameters: z.object({ question: z.string().describe('Question about simulation outcomes or biomarker projections') }),
      execute: async (args: { question?: string }) => {
        const question = args?.question?.trim() || lastUserText || 'What does the simulation show for the current intervention stack?';
        try {
          return await runTwinAgent({ question, patient, stack, deltas, modelId });
        } catch (err) {
          console.error('[Supervisor] analyzeSimulation failed', err);
          return `Simulation analysis failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    validateClinicalClaim: {
      description: 'Validate a clinical claim against retrieved evidence. Returns SUPPORTED, CONTRADICTED, or UNCERTAIN.',
      parameters: z.object({
        claim: z.string().describe('The clinical claim to validate'),
        evidence: z.string().describe('The evidence text to validate against'),
      }),
      execute: async (args: { claim?: string; evidence?: string }) => {
        const claim = args?.claim?.trim() || '';
        const evidence = args?.evidence?.trim() || '';
        if (!claim) return 'No claim provided to validate.';
        try {
          return await runReviewAgent(claim, evidence, modelId);
        } catch (err) {
          console.error('[Supervisor] validateClinicalClaim failed', err);
          return `Claim validation failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
  };

  console.log('[Supervisor] Starting stream', { modelId, patientName: patient?.name, stackLen: stack?.length });

  return streamText({
    model: getModel(modelId),
    system: systemPrompt,
    messages: convertedMessages,
    tools,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — maxSteps IS valid at runtime; Zod v4 breaks overload resolution so TS picks wrong signature
    maxSteps: 6,
    maxOutputTokens: 1200,
    // Step 0: force a tool call. Step 1+: let model produce text freely.
    prepareStep: ({ stepNumber }: { stepNumber: number }) => {
      if (stepNumber === 0) return { toolChoice: 'required' as const };
      return { toolChoice: 'auto' as const };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onStepFinish(step: any) {
      console.log('[Supervisor] Step finished', {
        finishReason: step.finishReason,
        textLen: step.text?.length ?? 0,
        toolCalls: step.toolCalls?.map((tc: any) => ({ name: tc.toolName, inputPreview: JSON.stringify(tc.input ?? tc.args ?? {}).slice(0, 80) })),
        toolResults: step.toolResults?.map((tr: any) => ({ name: tr.toolName, outputPreview: String(tr.output ?? tr.result ?? '').slice(0, 120) })),
      });
    },
  });
}
