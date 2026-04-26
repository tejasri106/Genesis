import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/providers';
import { searchPubMed } from '@/lib/tools/pubmed';
import { searchEuropePMC } from '@/lib/tools/europepmc';

const INTERVENTION_LABELS: Record<string, string> = {
  pembrolizumab_chemo: 'Pembrolizumab + Chemotherapy (KEYNOTE-522)',
  parp_inhibitor: 'PARP Inhibitor / Olaparib (OlympiAD)',
  sacituzumab: 'Sacituzumab Govitecan / Trodelvy (ASCENT)',
  neoadjuvant_act: 'Neoadjuvant AC-T',
  adjuvant_cape: 'Adjuvant Capecitabine (CREATE-X)',
};

const INTERVENTION_QUERIES: Record<string, string> = {
  pembrolizumab_chemo: 'pembrolizumab KEYNOTE-522 neoadjuvant TNBC pathological complete response immunotherapy',
  parp_inhibitor: 'olaparib PARP inhibitor BRCA TNBC OlympiAD progression-free survival',
  sacituzumab: 'sacituzumab govitecan Trop-2 ASCENT metastatic triple-negative breast cancer',
  neoadjuvant_act: 'neoadjuvant AC-T triple-negative breast cancer pathological complete response chemotherapy',
  adjuvant_cape: 'capecitabine CREATE-X adjuvant residual TNBC disease-free survival',
};

const TNBC_INTERVENTIONS = [
  { id: 'pembrolizumab_chemo', label: 'Pembrolizumab + Chemo', category: 'Medication' },
  { id: 'parp_inhibitor', label: 'PARP Inhibitor (Olaparib)', category: 'Medication' },
  { id: 'sacituzumab', label: 'Sacituzumab Govitecan', category: 'Medication' },
  { id: 'neoadjuvant_act', label: 'Neoadjuvant AC-T', category: 'Medication' },
  { id: 'adjuvant_cape', label: 'Adjuvant Capecitabine', category: 'Medication' },
] as const;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ChatResponseSchema = z.object({
  summary: z.string(),
  reasoning: z.array(z.string()).min(1).max(5),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      patient,
      stack,
      userText,
      deltas,
      modelId,
    }: {
      patient: Record<string, any>;
      stack: string[];
      userText: string;
      deltas: { ca153: string; tumorBurden: string; dfs: string };
      modelId?: string;
    } = body;

    const ids: string[] = Array.isArray(stack) && stack.length ? stack : ['pembrolizumab_chemo'];
    const labels = ids.map((id) => INTERVENTION_LABELS[id] ?? id).join(' + ');

    const pubmedQuery = ids.map((id) => INTERVENTION_QUERIES[id]).filter(Boolean).join(' OR ');

    const [articlesResult, aiResult] = await Promise.allSettled([
      Promise.all([
        searchPubMed(`${pubmedQuery} triple negative breast cancer`, 3),
        searchEuropePMC(`${pubmedQuery} TNBC`, 2),
      ]),
      generateObject({
        model: getModel(modelId),
        schema: ChatResponseSchema,
        prompt: `You are a clinical AI assistant for a TNBC (Triple-Negative Breast Cancer) digital twin research platform.

STRICT RULES:
- Present evidence and simulation results only. No definitive clinical recommendations. Be concise and oncology-specific.
- If evidence is limited, contradictory, or uncertain, state this explicitly — do not fabricate outcomes or cite numbers not present in the data.
- If simulation projections seem inconsistent or if evidence is insufficient, note the uncertainty rather than presenting false confidence.

PATIENT:
- Name: ${patient?.name}, Age: ${patient?.age}, Ethnicity: ${patient?.ethnicity ?? 'Unknown'}
- Stage: ${patient?.stage} TNBC
- BRCA1: ${patient?.brca1Mutation ? 'Mutated' : 'Wild-type'}, BRCA2: ${patient?.brca2Mutation ? 'Mutated' : 'Wild-type'}
- PD-L1 CPS: ${patient?.pdl1Cps ?? 'Not tested'}, Ki-67: ${patient?.ki67Percent ?? '?'}%
- CA 15-3 Baseline: ${patient?.ca153Baseline ?? '?'} U/mL
- Tumor Size: ${patient?.tumorSizeCm ?? '?'} cm, Lymph Node: ${patient?.lymphNodePositive ? 'Positive' : 'Negative'}
- Comorbidities: ${(patient?.comorbidities ?? []).join(', ') || 'none'}

INTERVENTION STACK: ${labels}

SIMULATED OUTCOMES:
- ΔCA 15-3: ${deltas?.ca153} U/mL
- ΔTumor Burden: ${deltas?.tumorBurden}
- ΔDFS Probability: ${deltas?.dfs}%

USER QUERY: ${userText || 'What are the projected outcomes for this intervention stack?'}

Generate:
1. summary: 1–2 sentence clinical summary referencing the simulation outcomes and patient-specific biomarkers. If outcomes are uncertain, say so.
2. reasoning: exactly 3 statements — (a) biological mechanism, (b) evidence from relevant trials (KEYNOTE-522/OlympiAD/ASCENT) with honest caveats if data is limited, (c) patient-specific eligibility factors (BRCA/PD-L1). If any aspect is uncertain or conflicting, name the uncertainty explicitly.`,
      }),
    ]);

    const [pubmedArticles, europeArticles] = articlesResult.status === 'fulfilled' ? articlesResult.value : [[], []];
    const allArticles = [...pubmedArticles, ...europeArticles];

    const papers = allArticles.slice(0, 4).map((a: any, i: number) => ({
      id: `pb_${a.pmid ?? a.id ?? i}`,
      title: a.title || 'Untitled',
      authors: 'et al.',
      journal: 'PubMed/EuropePMC',
      year: parseInt(a.year ?? '2020') || 2020,
      citations: 0,
      relevance: Math.max(0.5, 0.9 - i * 0.1),
      summary: (a.abstract ?? '').slice(0, 250) || 'See full text.',
      finding: (a.abstract ?? '').slice(0, 120) || 'See abstract.',
      tag: 'Supporting' as const,
      url: a.url ?? '',
    }));

    let summary = '';
    let reasoning: string[] = [];

    if (aiResult.status === 'fulfilled') {
      summary = aiResult.value.object.summary;
      reasoning = aiResult.value.object.reasoning;
    }

    if (!summary) {
      summary = `${labels} projects ΔCA 15-3 ${deltas?.ca153} U/mL and ΔDFS ${deltas?.dfs}% at the simulated timepoint for ${patient?.name}.`;
    }
    if (reasoning.length === 0) {
      reasoning = [
        `Twin model projected outcomes using Stage ${patient?.stage} TNBC priors and class-effect coefficients.`,
        `KEYNOTE-522 demonstrated pCR improvement with pembrolizumab + chemo; OlympiAD showed PFS benefit with olaparib in BRCA-mutated TNBC.`,
        `${patient?.brca1Mutation || patient?.brca2Mutation ? 'BRCA mutation present — PARP inhibitor eligibility confirmed.' : 'BRCA wild-type — PARP inhibitor benefit is limited.'} PD-L1 CPS ${(patient?.pdl1Cps ?? 0) >= 10 ? '≥10 — pembrolizumab eligible' : '<10 — limited immunotherapy signal'}.`,
      ];
    }

    const suggestions = TNBC_INTERVENTIONS
      .filter((i) => !ids.includes(i.id))
      .slice(0, 3)
      .map((i) => ({
        id: i.id,
        label: i.label,
        reason: i.id === 'parp_inhibitor' && (patient?.brca1Mutation || patient?.brca2Mutation)
          ? 'BRCA mutation detected — eligible'
          : i.id === 'pembrolizumab_chemo' && (patient?.pdl1Cps ?? 0) >= 10
          ? `PD-L1 CPS ${patient?.pdl1Cps} — immunotherapy signal`
          : 'alternative or adjunct regimen',
      }));

    const hasPapers = papers.length > 0;

    // If no peer-reviewed papers found, flag it prominently at the start of reasoning
    if (!hasPapers) {
      reasoning.unshift(
        'Evidence note: No peer-reviewed papers were retrieved for this query. The analysis below is based on class-effect data from known TNBC trials — projections should be treated as exploratory, not as direct evidence.'
      );
    }

    const researchSummary = hasPapers
      ? `${papers.length} peer-reviewed paper${papers.length !== 1 ? 's' : ''} retrieved for this TNBC intervention analysis.`
      : 'No peer-reviewed literature retrieved for this combination. Analysis draws on class-effect data from KEYNOTE-522, OlympiAD, ASCENT, and CREATE-X.';

    return NextResponse.json(
      {
        ok: true,
        twin: { summary, reasoning, deltas, interventionIds: ids },
        research: { summary: researchSummary, papers },
        suggestions,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('HEALTH NAVIGATOR CHAT ERROR:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
