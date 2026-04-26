import { z } from 'zod';

export const ConfidenceSchema = z.object({
  score: z.number().min(0).max(100),
  level: z.enum(['low', 'moderate', 'high']),
  reasons: z.array(z.string()),
});

export const SimulationPointSchema = z.object({
  month: z.number().int(),
  ca153: z.number(),
  tumorBurdenScore: z.number().min(0).max(100),
  dfsProbability: z.number().min(0).max(1),
  treatmentResponse: z.enum(['responding', 'stable', 'progressing']),
  note: z.string(),
});

export const SimulationRationaleSchema = z.object({
  statement: z.string(),
  sourceIds: z.array(z.string()),
});

export const SimulationCitationSchema = z.object({
  sourceId: z.string(),
  sourceType: z.enum(['PubMed', 'ClinicalTrials', 'EuropePMC']),
  title: z.string(),
  year: z.string().optional(),
  url: z.string().optional(),
});

export const RawSimulationPointSchema = z.object({
  month: z.number().int(),
  ca153: z.number(),
  tumorBurdenScore: z.number().min(0).max(100),
  dfsProbability: z.number().min(0).max(1),
  treatmentResponse: z.enum(['responding', 'stable', 'progressing']),
});

export const RawSimulationOutputSchema = z.object({
  patientId: z.string(),
  simulationMonths: z.number().int(),
  interventionsApplied: z.array(z.string()),
  progression: z.array(RawSimulationPointSchema),
  rationale: z.array(SimulationRationaleSchema),
});

export const SimulationOutputSchema = z.object({
  patientId: z.string(),
  simulationMonths: z.number().int(),
  interventionsApplied: z.array(z.string()),
  progression: z.array(SimulationPointSchema),
  rationale: z.array(SimulationRationaleSchema),
  explainabilityTrace: z.array(z.string()),
  riskFlags: z.array(z.string()),
  citations: z.array(SimulationCitationSchema),
  confidence: ConfidenceSchema,
});

export type RawSimulationOutput = z.infer<typeof RawSimulationOutputSchema>;
export type SimulationOutput = z.infer<typeof SimulationOutputSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;