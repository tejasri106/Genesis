type ClinicalTrial = {
    nctId: string;
    title: string;
    status?: string;
    phase: string[];
    summary?: string;
  };
  
  export async function searchClinicalTrials(
    condition: string,
    intervention = '',
    pageSize = 3
  ): Promise<ClinicalTrial[]> {
    const url = new URL('https://clinicaltrials.gov/api/v2/studies');
    url.searchParams.set('query.cond', condition);
    if (intervention) {
      url.searchParams.set('query.intr', intervention);
    }
    url.searchParams.set('pageSize', String(pageSize));
    url.searchParams.set('format', 'json');
  
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      throw new Error(`ClinicalTrials search failed: ${res.status}`);
    }
  
    const json = await res.json();
    const studies = json?.studies ?? [];
  
    return studies
      .map((s: any) => {
        const proto = s?.protocolSection ?? {};
        return {
          nctId: proto?.identificationModule?.nctId ?? '',
          title: proto?.identificationModule?.briefTitle ?? 'Untitled trial',
          status: proto?.statusModule?.overallStatus ?? '',
          phase: proto?.designModule?.phases ?? [],
          summary: proto?.descriptionModule?.briefSummary ?? '',
        };
      })
      .filter((x: ClinicalTrial) => x.nctId);
  }