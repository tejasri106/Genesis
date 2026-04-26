import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/providers';
import { searchPubMed } from '@/lib/tools/pubmed';
import { searchEuropePMC } from '@/lib/tools/europepmc';
import { searchClinicalTrials } from '@/lib/tools/clinical-trials';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SynthesisSchema = z.object({
  synthesis: z.string(),
  keyInsight: z.string(),
  summary: z.string(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, patient, modelId } = body as { query: string; patient?: Record<string, any>; modelId?: string };

    if (!query?.trim()) {
      return NextResponse.json({ ok: false, error: 'query required' }, { status: 400, headers: CORS_HEADERS });
    }

    const tnbcContext = patient
      ? `Stage ${patient.stage ?? '?'} TNBC, ${patient.ethnicity ?? 'unknown ethnicity'}, ${patient.age ?? '?'}y`
      : 'TNBC context';

    const [pubmedResult, europeResult, trialsResult] = await Promise.allSettled([
      searchPubMed(`${query} triple negative breast cancer`, 5),
      searchEuropePMC(`${query} TNBC breast cancer`, 4),
      searchClinicalTrials('triple-negative breast cancer', query, 2),
    ]);

    const pubmed = pubmedResult.status === 'fulfilled' ? pubmedResult.value : [];
    const europepmc = europeResult.status === 'fulfilled' ? europeResult.value : [];
    const trials = trialsResult.status === 'fulfilled' ? trialsResult.value : [];

    const allArticles = [
      ...pubmed.map((p) => ({ id: `PMID:${p.pmid}`, source: 'PubMed', title: p.title, url: p.url, abstract: p.abstract ?? '' })),
      ...europepmc.map((e) => ({ id: `EPMC:${e.id}`, source: 'EuropePMC', title: e.title, url: e.url, abstract: e.abstract ?? '' })),
    ];

    const abstractText = allArticles
      .slice(0, 6)
      .map((a) => `TITLE: ${a.title}\nSOURCE: ${a.source}\nABSTRACT: ${a.abstract.slice(0, 600)}`)
      .join('\n\n---\n\n');

    let synthesis = '';
    let keyInsight = '';
    let summary = '';

    if (abstractText) {
      try {
        const result = await generateObject({
          model: getModel(modelId),
          schema: SynthesisSchema,
          prompt: `You are a TNBC oncology research synthesizer. Be honest about evidence quality.

PATIENT CONTEXT: ${tnbcContext}
QUERY: ${query}

RETRIEVED ABSTRACTS:
${abstractText}

Generate:
- synthesis: 2-3 paragraph evidence synthesis covering what the literature says, key findings, and any limitations or uncertainties. If evidence is limited or conflicting, say so explicitly.
- keyInsight: one sentence most clinically relevant takeaway, with caveats if the evidence base is thin
- summary: one sentence overview for display`,
        });
        synthesis = result.object.synthesis;
        keyInsight = result.object.keyInsight;
        summary = result.object.summary;
      } catch {
        summary = `${allArticles.length} sources retrieved for "${query}".`;
      }
    } else if (trials.length > 0) {
      summary = `No peer-reviewed papers found for "${query}" — ${trials.length} clinical trial record${trials.length !== 1 ? 's' : ''} retrieved. Trial records are investigational context, not published evidence.`;
    } else {
      summary = 'No results found. Try rephrasing with a drug name, trial acronym, or outcome.';
    }

    const papers = allArticles.slice(0, 6).map((a, i) => ({
      id: a.id,
      title: a.title,
      authors: 'et al.',
      journal: a.source,
      year: new Date().getFullYear(),
      citations: 0,
      relevance: Math.max(0.5, 0.9 - i * 0.07),
      summary: a.abstract.slice(0, 250) || 'See full text.',
      finding: a.abstract.slice(0, 120) || 'See abstract.',
      tag: 'Supporting' as const,
      url: a.url,
    }));

    const trialList = trials.slice(0, 3).map((t: any) => ({
      nctId: t.nctId,
      title: t.title,
      status: t.status,
      phase: Array.isArray(t.phase) ? t.phase : [],
    }));

    return NextResponse.json(
      { ok: true, papers, trials: trialList, synthesis, keyInsight, summary },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('RESEARCH SEARCH ERROR:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
