import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';

interface TwinAgentInput {
  question: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patient: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stack: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deltas: Record<string, any> | null;
  modelId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRiskFlags(patient: Record<string, any>): string[] {
  const flags: string[] = [];
  if (patient.stage) flags.push(`Stage ${patient.stage} TNBC`);
  if (patient.brca1Mutation || patient.brca === 'BRCA1+' || patient.brca === 'Positive')
    flags.push('BRCA1 mutation present');
  if (patient.brca2Mutation || patient.brca === 'BRCA2+') flags.push('BRCA2 mutation present');
  if (patient.lymphNodePositive) flags.push('Lymph node involvement present');
  const ki67 = patient.ki67Percent ?? patient.ki67;
  if ((ki67 ?? 0) >= 60) flags.push(`Very high Ki-67 (${ki67}%) — aggressive proliferation`);
  else if ((ki67 ?? 0) >= 30) flags.push(`Elevated Ki-67 (${ki67}%)`);
  if ((patient.tumorSizeCm ?? 0) >= 5) flags.push('Large baseline tumor size');
  const ca153 = patient.ca153Baseline ?? patient.ca153;
  if ((ca153 ?? 0) >= 35) flags.push(`Elevated CA 15-3 baseline (${ca153} U/mL)`);
  if ((patient.pdl1Cps ?? 0) >= 10) flags.push(`PD-L1 CPS ≥10 — strong immunotherapy signal`);
  return flags;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildExplainabilityTrace(patient: Record<string, any>, scenario: string, deltaKeys: string[]): string[] {
  const trace: string[] = [];
  trace.push(`Scenario: ${scenario}`);
  trace.push(`Stage ${patient.stage} TNBC sets the baseline disease-risk context.`);
  const pdl1 = patient.pdl1Cps;
  if (pdl1 !== undefined)
    trace.push(`PD-L1 CPS ${pdl1} makes immunotherapy evidence relevant but doesn't guarantee individual response.`);
  const ki67 = patient.ki67Percent ?? patient.ki67;
  if (ki67 !== undefined) trace.push(`Ki-67 ${ki67}% suggests highly proliferative tumor biology.`);
  const tumorSize = patient.tumorSizeCm;
  if (tumorSize !== undefined) trace.push(`Tumor size ${tumorSize} cm contributes to baseline tumor-burden context.`);
  if (patient.lymphNodePositive)
    trace.push('Positive lymph node status increases baseline concern for higher-risk disease behavior.');
  if (patient.brca1Mutation || patient.brca === 'BRCA1+')
    trace.push('BRCA1 mutation is a relevant factor affecting PARP inhibitor eligibility.');
  if (deltaKeys.length === 0)
    trace.push('No simulation deltas available — trajectory remains speculative and conservative.');
  else
    trace.push(`Delta signals available for: ${deltaKeys.join(', ')} — interpreted conservatively given disease stage.`);
  return trace;
}

export async function runTwinAgent({ question, patient, stack, deltas, modelId }: TwinAgentInput): Promise<string> {
  if (!patient) return 'No patient is currently loaded. Please load a patient profile first.';

  const stackDesc =
    Array.isArray(stack) && stack.length > 0
      ? stack.map((s) => s.label ?? s.id ?? String(s)).join(' + ')
      : 'Standard of care (no interventions added)';

  const deltaKeys = deltas ? Object.keys(deltas) : [];
  const deltaDesc = deltas
    ? Object.entries(deltas)
        .map(([k, v]) => `${k}: ${typeof v === 'number' ? (v > 0 ? '+' : '') + v.toFixed(2) : v}`)
        .join(' | ')
    : 'No simulation data available yet';

  const riskFlags = buildRiskFlags(patient);
  const trace = buildExplainabilityTrace(patient, stackDesc, deltaKeys);
  const ki67 = patient.ki67Percent ?? patient.ki67;
  const ca153 = patient.ca153Baseline ?? patient.ca153;

  console.log('[Twin Agent] Starting', { question: question.slice(0, 80), modelId, patient: patient?.name });
  const { text } = await generateText({
    model: getModel(modelId),
    abortSignal: AbortSignal.timeout(25000),
    system: `You are the Genesis Twin Agent — a TNBC digital twin simulation interpreter for clinical decision support.

STRICT RULES:
- Base ALL interpretation ONLY on the provided patient data and simulation deltas below.
- Do NOT invent clinical outcomes, trial names, or statistics not present in the data.
- Always note that simulation results are exploratory projections, not clinical predictions.
- Do NOT recommend specific treatments — present projections and note that clinical judgment is required.

REALISM RULES:
- Gradual improvements are realistic; instant normalization is not.
- Stage III/IV disease carries ongoing baseline risk regardless of intervention response.
- Mixed or absent deltas should be interpreted conservatively.
- Reference specific biomarkers by name: CA 15-3, Tumor Burden Score (TBS), Ki-67, DFS probability.

OUTPUT FORMAT — use markdown with these exact sections:
## Simulation Summary
(What the projection shows for the current intervention stack — 2-3 sentences)

## Biomarker Trajectory
(Interpret each available delta: CA 15-3, tumor burden, DFS probability — direction and clinical meaning)

## Risk Context
(Reference the patient's specific risk flags and how they affect the projection)

## Uncertainty
(Limitations of this projection for this patient profile — be specific)

## Clinical Note
(What this means for decision support — NOT a treatment recommendation)`,
    messages: [
      {
        role: 'user',
        content: `PATIENT PROFILE:
- Name: ${patient.name ?? 'Unknown'}
- Stage: ${patient.stage} TNBC
- BRCA1: ${patient.brca1Mutation ?? (patient.brca === 'BRCA1+' || patient.brca === 'Positive' ? 'Yes' : 'No')}
- BRCA2: ${patient.brca2Mutation ?? (patient.brca === 'BRCA2+' ? 'Yes' : 'No')}
- PD-L1 CPS: ${patient.pdl1Cps ?? 'unknown'}
- Ki-67: ${ki67 ?? 'unknown'}%
- CA 15-3 baseline: ${ca153 ?? 'unknown'} U/mL
- Tumor size: ${patient.tumorSizeCm ?? 'unknown'} cm
- Lymph nodes: ${patient.lymphNodePositive ? 'Positive' : 'Negative'}
- Prior treatments: ${(patient.priorTreatments ?? []).join(', ') || 'none'}

RISK FLAGS: ${riskFlags.join(' | ') || 'none'}

INTERVENTION STACK: ${stackDesc}

SIMULATION DELTAS (vs standard of care baseline):
${deltaDesc}

INTERPRETIVE TRACE:
${trace.map((t, i) => `${i + 1}. ${t}`).join('\n')}

QUESTION: ${question}`,
      },
    ],
    maxOutputTokens: 700,
  });

  console.log('[Twin Agent] Done', { textLen: text.length });
  return text;
}
