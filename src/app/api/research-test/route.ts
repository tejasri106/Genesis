import { NextResponse } from 'next/server';
import { searchPubMed } from '@/lib/tools/pubmed';
import { searchClinicalTrials } from '@/lib/tools/clinical-trials';
import { searchEuropePMC } from '@/lib/tools/europepmc';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query =
      searchParams.get('query') ??
      'triple negative breast cancer pembrolizumab';

    const [pubmed, clinicalTrials, europepmc] = await Promise.all([
      searchPubMed(query, 5),
      searchClinicalTrials('triple negative breast cancer', 'pembrolizumab', 3),
      searchEuropePMC(query, 5),
    ]);

    return NextResponse.json({
      ok: true,
      query,
      counts: {
        pubmed: pubmed.length,
        clinicalTrials: clinicalTrials.length,
        europepmc: europepmc.length,
      },
      pubmed,
      clinicalTrials,
      europepmc,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}