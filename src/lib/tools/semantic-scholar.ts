export type SemanticScholarPaper = {
  paperId: string;
  title: string;
  year?: string;
  url?: string;
  abstract?: string;
  authors?: string[];
  venue?: string;
  externalIds?: {
    PubMed?: string;
    DOI?: string;
    [key: string]: string | undefined;
  };
};

type SemanticScholarApiPaper = {
  paperId: string;
  title?: string;
  year?: number;
  url?: string;
  abstract?: string;
  venue?: string;
  authors?: { name?: string }[];
  externalIds?: {
    PubMed?: string;
    DOI?: string;
    [key: string]: string | undefined;
  };
};

export async function searchSemanticScholar(
  query: string,
  limit = 5
): Promise<SemanticScholarPaper[]> {
  const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');

  url.searchParams.set('query', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set(
    'fields',
    'paperId,title,year,url,abstract,venue,authors,externalIds'
  );

  const headers: HeadersInit = {};

  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }

  const res = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('SEMANTIC SCHOLAR ERROR:', errorText);
    return [];
  }

  const json = await res.json();
  const papers: SemanticScholarApiPaper[] = json?.data ?? [];

  return papers
    .filter((paper) => paper.paperId && paper.title)
    .map((paper) => ({
      paperId: paper.paperId,
      title: paper.title ?? 'Untitled',
      year: paper.year ? String(paper.year) : undefined,
      url: paper.url,
      abstract: paper.abstract,
      venue: paper.venue,
      authors: paper.authors
        ?.map((author) => author.name)
        .filter((name): name is string => Boolean(name)),
      externalIds: paper.externalIds,
    }));
}