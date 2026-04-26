import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/providers';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PatientOutputSchema = z.object({
  name: z.string(),
  age: z.number().int().min(20).max(80),
  sex: z.enum(['F']),
  ethnicity: z.string(),
  avatar: z.string().max(3),
  stage: z.enum(['I', 'II', 'III', 'IV']),
  brca1Mutation: z.boolean(),
  brca2Mutation: z.boolean(),
  pdl1Cps: z.number().min(0).max(100).optional(),
  ki67Percent: z.number().min(20).max(95),
  ca153Baseline: z.number().min(10).max(120),
  tumorSizeCm: z.number().min(0.5).max(8),
  lymphNodePositive: z.boolean(),
  priorTreatments: z.array(z.string()),
  medications: z.array(z.string()),
  comorbidities: z.array(z.string()),
  lifestyleFactors: z.array(z.string()),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const hints = body.hints ?? {};

    const result = await generateObject({
      model: getModel(),
      schema: PatientOutputSchema,
      prompt: `Generate a realistic synthetic TNBC (Triple-Negative Breast Cancer) patient profile for a clinical digital twin simulation.

REQUIREMENTS:
- All fields must be clinically plausible and internally consistent
- BRCA mutations are present in ~20% of TNBC cases; if BRCA1+ then ki67 tends to be higher
- PD-L1 CPS ≥10 in ~40% of TNBC cases; required for pembrolizumab eligibility
- CA 15-3 baseline should be consistent with stage (Stage I ≈ 15-25, II ≈ 25-45, III ≈ 40-80, IV ≈ 60-120)
- Avatar should be 2 uppercase initials from name
- Comorbidities should be realistic for the age group (e.g., hypertension, diabetes, anxiety)
- lifestyleFactors should include 1-3 relevant factors (exercise, diet, smoking history)

HINTS:
${hints.stage ? `- Stage: ${hints.stage}` : '- Stage: any (choose based on clinical realism)'}
${hints.age ? `- Age: approximately ${hints.age}` : '- Age: between 28 and 72'}
${hints.ethnicity ? `- Ethnicity: ${hints.ethnicity}` : '- Ethnicity: realistic US population distribution'}

Generate a diverse, clinically realistic TNBC patient. Do not generate duplicate names or profiles that look like known demo patients.`,
    });

    const p = result.object;
    const id = `gen_${Date.now()}`;
    const stageLabelMap: Record<string, string> = { I: 'Stage I TNBC', II: 'Stage II TNBC', III: 'Stage III TNBC', IV: 'Stage IV TNBC' };

    return NextResponse.json(
      {
        ok: true,
        patient: {
          id,
          name: p.name,
          age: p.age,
          sex: p.sex,
          ethnicity: p.ethnicity,
          avatar: p.avatar,
          subtype: 'TNBC' as const,
          stage: p.stage,
          brca1Mutation: p.brca1Mutation,
          brca2Mutation: p.brca2Mutation,
          pdl1Cps: p.pdl1Cps,
          ki67Percent: p.ki67Percent,
          ca153Baseline: p.ca153Baseline,
          tumorSizeCm: p.tumorSizeCm,
          lymphNodePositive: p.lymphNodePositive,
          priorTreatments: p.priorTreatments,
          medications: p.medications,
          comorbidities: p.comorbidities,
          lifestyleFactors: p.lifestyleFactors,
          condition: stageLabelMap[p.stage] ?? 'TNBC',
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('GENERATE PATIENT ERROR:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
