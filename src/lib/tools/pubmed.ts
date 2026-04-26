const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export type PubMedArticle = {
  pmid: string;
  title: string;
  year?: string;
  url: string;
  abstract?: string;
};

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function stripXml(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(xml: string, tag: string) {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  );
  return match ? stripXml(match[1]) : '';
}

function extractAbstract(articleXml: string) {
  const matches = [
    ...articleXml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi),
  ];

  return matches
    .map((m) => stripXml(m[1]))
    .filter(Boolean)
    .join(' ');
}

const FETCH_TIMEOUT_MS = 6000;

function buildQueries(baseTerm: string): string[] {
  return [
    baseTerm.replaceAll('"', ''),
    'triple negative breast cancer ' + baseTerm.split(' ')[0],
  ].filter(Boolean);
}

async function esearch(query: string, retmax = 5): Promise<string[]> {
  const params = new URLSearchParams();

  params.set('db', 'pubmed');
  params.set('term', query);
  params.set('retmode', 'json');
  params.set('retmax', String(retmax));
  params.set('sort', 'relevance');
  params.set('tool', 'OncaTwin');

  if (process.env.NCBI_API_KEY) {
    params.set('api_key', process.env.NCBI_API_KEY);
  }

  const res = await fetch(`${BASE_URL}/esearch.fcgi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PubMed search failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.esearchresult?.idlist ?? [];
}

async function efetch(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  const params = new URLSearchParams();

  params.set('db', 'pubmed');
  params.set('id', pmids.join(','));
  params.set('retmode', 'xml');
  params.set('tool', 'OncaTwin');

  if (process.env.NCBI_API_KEY) {
    params.set('api_key', process.env.NCBI_API_KEY);
  }

  const res = await fetch(`${BASE_URL}/efetch.fcgi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PubMed fetch failed: ${res.status} ${text}`);
  }

  const xml = await res.text();

  const articleBlocks =
    xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? [];

  return articleBlocks
    .map((articleXml) => {
      const pmid = extractTag(articleXml, 'PMID');
      const title = extractTag(articleXml, 'ArticleTitle') || 'Untitled';
      const year =
        extractTag(articleXml, 'Year') ||
        extractTag(articleXml, 'MedlineDate')?.slice(0, 4) ||
        undefined;

      return {
        pmid,
        title,
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        abstract: extractAbstract(articleXml),
      };
    })
    .filter((article) => article.pmid && article.title);
}

export async function searchPubMed(
  baseTerm: string,
  retmax = 5
): Promise<PubMedArticle[]> {
  const queries = buildQueries(baseTerm);

  for (const query of queries) {
    try {
      const ids = await esearch(query, retmax);

      if (ids.length > 0) {
        const articles = await efetch(ids);

        if (articles.length > 0) {
          return articles;
        }
      }

      await sleep(150);
    } catch (err) {
      console.error(`PubMed query failed for "${query}":`, err);
    }
  }

  return [];
}