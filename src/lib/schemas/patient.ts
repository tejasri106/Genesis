import { z } from 'zod';

export const PatientProfileSchema = z.object({
  patientId: z.string(),
  age: z.number().int().min(18).max(100),
  ethnicity: z.string(),
  subtype: z.enum(['TNBC']),
  stage: z.enum(['I', 'II', 'III', 'IV']),
  brca1Mutation: z.boolean(),
  brca2Mutation: z.boolean(),
  pdl1Cps: z.number().min(0).max(100).optional(),
  ki67Percent: z.number().min(0).max(100),
  ca153Baseline: z.number().min(0),
  tumorSizeCm: z.number().min(0),
  lymphNodePositive: z.boolean(),
  priorTreatments: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  comorbidities: z.array(z.string()).default([]),
  lifestyleFactors: z.array(z.string()).default([]),
});

export type PatientProfile = z.infer<typeof PatientProfileSchema>;