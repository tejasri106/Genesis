import { streamText, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { getModel } from '@/lib/ai/providers';
import { detectPII, buildSecurityWarning, buildOffTopicWarning, SECURITY_PREFIX, OFF_TOPIC_PREFIX } from '@/lib/security';

const INTERVENTION_LABELS: Record<string, string> = {
  pembrolizumab_chemo: 'Pembrolizumab + Chemotherapy (KEYNOTE-522)',
  parp_inhibitor: 'PARP Inhibitor / Olaparib (OlympiAD)',
  sacituzumab: 'Sacituzumab Govitecan / Trodelvy (ASCENT)',
  neoadjuvant_act: 'Neoadjuvant AC-T',
  adjuvant_cape: 'Adjuvant Capecitabine (CREATE-X)',
};

function staticStream(text: string): Response {
  const stream = createUIMessageStream({
    execute({ writer }) {
      writer.write({ type: 'text-delta', delta: text, id: 'security' });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  const { messages, patient, stack, deltas, modelId } = await req.json();

  // ── Pre-flight: extract last user message text ──────────────────────────────
  const lastUserMsg = [...(messages ?? [])].reverse().find((m: any) => m.role === 'user');
  const userText: string =
    lastUserMsg?.parts?.find((p: any) => p.type === 'text')?.text ??
    lastUserMsg?.content ?? '';

  // ── Security check: PII / HIPAA ─────────────────────────────────────────────
  const piiLabel = detectPII(userText);
  if (piiLabel) {
    return staticStream(buildSecurityWarning(piiLabel));
  }

  // ── Build context ────────────────────────────────────────────────────────────
  const ids: string[] = Array.isArray(stack) && stack.length ? stack : [];
  const labels = ids.map((id) => INTERVENTION_LABELS[id] ?? id).join(' + ') || 'Standard of Care';

  const brcaStatus = patient?.brca1Mutation
    ? 'BRCA1 mutated'
    : patient?.brca2Mutation
    ? 'BRCA2 mutated'
    : 'BRCA wild-type';

  const pdl1 = patient?.pdl1Cps !== undefined
    ? `PD-L1 CPS ${patient.pdl1Cps} (${patient.pdl1Cps >= 10 ? 'immunotherapy eligible' : 'limited signal'})`
    : 'PD-L1 not tested';

  const patientName = patient?.name ?? 'this patient';

  const system = `You are the Genesis Digital Twin — a clinical AI assistant for Triple-Negative Breast Cancer (TNBC) oncology research.

PATIENT PROFILE:
- ${patientName}, Age ${patient?.age ?? '?'}, Stage ${patient?.stage ?? '?'} TNBC
- BRCA: ${brcaStatus} | ${pdl1} | Ki-67: ${patient?.ki67Percent ?? '?'}%
- CA 15-3 baseline: ${patient?.ca153Baseline ?? '?'} U/mL | Tumor: ${patient?.tumorSizeCm ?? '?'} cm | LN: ${patient?.lymphNodePositive ? 'Positive' : 'Negative'}
- Comorbidities: ${(patient?.comorbidities ?? []).join(', ') || 'none'}

ACTIVE INTERVENTION STACK: ${labels}

DIGITAL TWIN PROJECTIONS (vs Standard of Care):
- ΔCA 15-3: ${deltas?.ca153 ?? '—'} U/mL | ΔTumor Burden: ${deltas?.tumorBurden ?? '—'} | ΔDFS: ${deltas?.dfs ?? '—'}%

KEY TRIAL ANCHORS: KEYNOTE-522 (pembrolizumab+chemo, pCR), OlympiAD (olaparib, BRCA+), ASCENT (sacituzumab, Trop-2), CREATE-X (capecitabine, residual disease)

═══════════════════════════════════════════════════════
SECURITY & COMPLIANCE POLICY (NON-NEGOTIABLE):
═══════════════════════════════════════════════════════
1. HIPAA/PHI: Never share, reveal, confirm, or speculate about any patient's SSN, home address, phone number, email, insurance ID, date of birth, medical record number, or any non-clinical identifier. If asked, respond with: "${SECURITY_PREFIX} This involves protected health information that cannot be shared per HIPAA policy."

2. OFF-TOPIC: If the query has no connection to oncology, TNBC, breast cancer, this patient's clinical data, or simulation outcomes — respond ONLY: "${OFF_TOPIC_PREFIX} I'm focused on TNBC oncology for ${patientName}. Please ask me about treatment options, biomarkers, or simulation outcomes."

3. NO HALLUCINATION: Never invent trial names, statistics, or biomarker values not present in the data above. If uncertain, say so explicitly.

4. CLINICAL SCOPE: Do not make definitive treatment recommendations. Present evidence and projections only. Always note uncertainty.

5. CITATION REQUIRED: For any efficacy claim, cite the specific trial (KEYNOTE-522, OlympiAD, ASCENT, CREATE-X, or another named trial).
═══════════════════════════════════════════════════════

PATIENT-SPECIFIC RULES:
- BRCA status: ${brcaStatus !== 'BRCA wild-type' ? 'BRCA mutation present — PARP inhibitor eligibility should be highlighted' : 'BRCA wild-type — note limited PARP inhibitor benefit'}
- PD-L1: ${(patient?.pdl1Cps ?? 0) >= 10 ? 'CPS ≥10 — pembrolizumab benefit is evidence-supported (KEYNOTE-522)' : 'CPS <10 — note limited immunotherapy signal, caution with pembrolizumab claims'}

Respond concisely (2–4 sentences) unless detail is explicitly requested. Use markdown for structure when response is long.`;

  const result = streamText({
    model: getModel(modelId),
    system,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 600,
  });

  return result.toUIMessageStreamResponse();
}
