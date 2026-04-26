import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/providers';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const AnalysisSchema = z.object({
  analysis: z.string(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { patientName, patientCondition, experiments, modelId } = body as {
      patientName: string;
      patientCondition: string;
      modelId?: string;
      experiments: {
        interventionIds: string[];
        interventionLabels: string[];
        finalCA153?: number;
        finalTumorBurden?: number;
        finalDFS?: number;
        months?: number;
      }[];
    };

    if (!experiments?.length) {
      return NextResponse.json({ ok: false, error: 'No experiments provided' }, { status: 400, headers: CORS_HEADERS });
    }

    const experimentsText = experiments
      .map((e, i) => {
        const labels = e.interventionLabels.join(' + ') || 'Standard of Care';
        const duration = e.months ?? 24;
        const ca153 = e.finalCA153 !== undefined ? `CA 15-3: ${e.finalCA153} U/mL` : '';
        const tb = e.finalTumorBurden !== undefined ? `Tumor Burden: ${e.finalTumorBurden}` : '';
        const dfs = e.finalDFS !== undefined ? `DFS Probability: ${e.finalDFS}%` : '';
        return `Run ${i + 1}: ${labels} (${duration} months)\n  Outcomes: ${[ca153, tb, dfs].filter(Boolean).join(', ')}`;
      })
      .join('\n\n');

    const result = await generateObject({
      model: getModel(modelId),
      schema: AnalysisSchema,
      prompt: `You are a TNBC oncology research analyst. Analyze the following simulation experiments for patient ${patientName} (${patientCondition}).

EXPERIMENTS:
${experimentsText}

Write a 3-5 paragraph cross-experiment analysis that:
1. Compares the efficacy trajectories across intervention arms using the biomarker outcomes
2. Identifies which intervention(s) showed the most favorable CA 15-3 reduction, tumor burden reduction, and DFS improvement
3. Notes any patterns in combination vs. monotherapy performance
4. Discusses TNBC-specific clinical context (e.g., BRCA status relevance, immunotherapy eligibility) where applicable
5. Concludes with a nuanced evidence-based recommendation

Use clinical language appropriate for an oncology research context. Be cautious about overstating benefits — reflect uncertainty where appropriate.`,
    });

    return NextResponse.json(
      { ok: true, analysis: result.object.analysis },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('ANALYZE EXPERIMENTS ERROR:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
