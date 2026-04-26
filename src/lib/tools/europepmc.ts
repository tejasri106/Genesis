export type EuropePmcArticle = {
  id: string;
  title: string;
  year?: string;
  url: string;
  abstract?: string;
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function searchEuropePMC(
  query: string,
  limit = 5
): Promise<EuropePmcArticle[]> {
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');

  url.searchParams.set('query', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('pageSize', String(limit));
  url.searchParams.set('resultType', 'core');

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    console.error('EuropePMC failed:', await res.text());
    return [];
  }

  const json = await res.json();
  const results = json?.resultList?.result ?? [];

  return results
    .filter((item: any) => item.id && item.title)
    .map((item: any) => ({
      id: String(item.id),
      title: item.title,
      year: item.pubYear ? String(item.pubYear) : undefined,
      url:
        item.doi
          ? `https://doi.org/${item.doi}`
          : `https://europepmc.org/article/${item.source || 'MED'}/${item.id}`,
      abstract: stripHtml(item.abstractText ?? ''),
    }));
}