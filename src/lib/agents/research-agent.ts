import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import { searchPubMed, type PubMedArticle } from '@/lib/tools/pubmed';
import { searchEuropePMC, type EuropePmcArticle } from '@/lib/tools/europepmc';
import { searchClinicalTrials } from '@/lib/tools/clinical-trials';
import { searchSemanticScholar, type SemanticScholarPaper } from '@/lib/tools/semantic-scholar';

const MAX_ABSTRACT = 900;
const MAX_PUBMED = 5;
const MAX_EUROPEPMC = 3;
const MAX_SEMANTIC = 3;
const MAX_TRIALS = 2;

function truncate(value: string | undefined | null, max = MAX_ABSTRACT): string {
  if (!value) return '';
  const clean = String(value).replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

interface SourceInputs {
  pubmed: PubMedArticle[];
  europepmc: EuropePmcArticle[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clinicalTrials: any[];
  semanticScholar: SemanticScholarPaper[];
}

function buildSourceText(sources: SourceInputs) {
  const pubmedText = sources.pubmed
    .slice(0, MAX_PUBMED)
    .map(
      (p) =>
        `[PMID:${p.pmid}] ${p.title} (${p.year ?? ''})\nURL: ${p.url ?? 'N/A'}\n${truncate(p.abstract)}`
    )
    .join('\n\n');

  const trialsText = sources.clinicalTrials
    .slice(0, MAX_TRIALS)
    .map(
      (t) =>
        `[NCT:${t.nctId}] ${t.title} — Status: ${t.status ?? ''}, Phase: ${Array.isArray(t.phase) ? t.phase.join(', ') : ''}\n${truncate(t.summary, 400)}`
    )
    .join('\n\n');

  const europeText = sources.europepmc
    .slice(0, MAX_EUROPEPMC)
    .map(
      (e) =>
        `[EPMC:${e.id}] ${e.title} (${e.year ?? ''})\nURL: ${e.url ?? 'N/A'}\n${truncate(e.abstract)}`
    )
    .join('\n\n');

  const semanticText = sources.semanticScholar
    .slice(0, MAX_SEMANTIC)
    .map(
      (s) =>
        `[S2:${s.paperId}] ${s.title} (${s.year ?? ''}) — ${s.venue ?? ''}\nAuthors: ${s.authors?.slice(0, 5).join(', ') ?? ''}\n${truncate(s.abstract)}`
    )
    .join('\n\n');

  return { pubmedText, trialsText, europeText, semanticText };
}

function fallbackToMarkdown(sources: SourceInputs, query: string): string {
  const lines = [`## Research Results — ${query}`, '', '> Structured synthesis unavailable. Retrieved sources below.', '', '### Sources'];
  sources.pubmed.slice(0, 3).forEach((p) => lines.push(`- [PMID:${p.pmid}] ${p.title} (${p.year ?? ''})`));
  sources.europepmc.slice(0, 2).forEach((e) => lines.push(`- [EPMC:${e.id}] ${e.title} (${e.year ?? ''})`));
  sources.clinicalTrials.slice(0, 2).forEach((t) => lines.push(`- [NCT:${t.nctId}] ${t.title} (${t.status ?? ''})`));
  return lines.join('\n');
}

export async function runResearchAgent(
  query: string,
  modelId?: string,
  patientContext = 'No patient context provided'
): Promise<string> {
  console.log('[Research Agent] Starting', { query: query.slice(0, 80), modelId });
  const [pubmedRes, europeRes, trialsRes, semanticRes] = await Promise.allSettled([
    searchPubMed(query, MAX_PUBMED),
    searchEuropePMC(query, MAX_EUROPEPMC),
    searchClinicalTrials('triple negative breast cancer', query.split(' ')[0], MAX_TRIALS),
    searchSemanticScholar(query, MAX_SEMANTIC),
  ]);

  const sources: SourceInputs = {
    pubmed: pubmedRes.status === 'fulfilled' ? pubmedRes.value : [],
    europepmc: europeRes.status === 'fulfilled' ? europeRes.value : [],
    clinicalTrials: trialsRes.status === 'fulfilled' ? trialsRes.value : [],
    semanticScholar: semanticRes.status === 'fulfilled' ? semanticRes.value : [],
  };

  const totalSources =
    sources.pubmed.length +
    sources.europepmc.length +
    sources.clinicalTrials.length +
    sources.semanticScholar.length;

  console.log('[Research Agent] Sources fetched', {
    pubmed: sources.pubmed.length,
    europepmc: sources.europepmc.length,
    clinicalTrials: sources.clinicalTrials.length,
    semanticScholar: sources.semanticScholar.length,
    total: totalSources,
  });

  if (totalSources === 0) {
    return `No literature found for: *${query}*\n\nTry rephrasing with specific drug names or trial identifiers (e.g., KEYNOTE-522, pembrolizumab, sacituzumab govitecan, olaparib).`;
  }

  const { pubmedText, trialsText, europeText, semanticText } = buildSourceText(sources);

  console.log('[Research Agent] Calling model for synthesis', { modelId });
  try {
    const { text } = await generateText({
      model: getModel(modelId),
      abortSignal: AbortSignal.timeout(25000),
      system: `You are a TNBC oncology research synthesizer for clinical decision support.

STRICT RULES:
- Use ONLY the provided sources. Do NOT fabricate citations, statistics, or trial results.
- Reference sources by their IDs: PMID:, EPMC:, NCT:, S2: format.
- Do NOT make treatment recommendations — present evidence only.
- Use cautious, evidence-based language.
- Note evidence strength: high (RCT), moderate (cohort/meta-analysis), low (case series/hypothesis).
- If evidence is limited or indirect, say so explicitly.

PATIENT CONTEXT: ${patientContext}`,
      messages: [
        {
          role: 'user',
          content: `Synthesize the TNBC evidence for: ${query}

Write a clinical research summary in this exact markdown format:

## Research Synthesis — ${query}

*[2-3 sentence summary of key takeaways and overall evidence quality]*

### Key Findings
[List 3-5 most important findings. For each: state the finding, evidence strength, direction, and source IDs]

### Cautions & Limitations
[Important caveats, risks, evidence gaps, or uncertainties]

### Relevant Trials
[Active or recently completed trials relevant to this query, if any]

### Sources
[Numbered list: source ID, title, year]

---

PUBMED SOURCES:
${pubmedText || 'None retrieved'}

CLINICAL TRIALS:
${trialsText || 'None retrieved'}

EUROPE PMC:
${europeText || 'None retrieved'}

SEMANTIC SCHOLAR:
${semanticText || 'None retrieved'}`,
        },
      ],
      maxOutputTokens: 900,
    });

    console.log('[Research Agent] Done', { textLen: text.length });
    return text.trim() || fallbackToMarkdown(sources, query);
  } catch (err) {
    console.error('[Research Agent] Synthesis failed:', err);
    return fallbackToMarkdown(sources, query);
  }
}
