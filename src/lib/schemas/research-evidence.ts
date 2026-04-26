import { z } from 'zod';

export const ConfidenceSchema = z.object({
  score: z.number().min(0).max(100),
  level: z.enum(['low', 'moderate', 'high']),
  reasons: z.array(z.string()),
});

export const SourceTypeSchema = z.enum([
  'PubMed',
  'ClinicalTrials',
  'EuropePMC',
  'SemanticScholar',
]);

export const EvidenceDirectionSchema = z.enum([
  'supports_benefit',
  'mixed',
  'supports_risk',
  'uncertain',
]);

export const EvidenceStrengthSchema = z.enum(['low', 'moderate', 'high']);

export const EvidenceFindingSchema = z.object({
  claim: z.string(),
  relevanceToPatient: z.string(),
  evidenceDirection: EvidenceDirectionSchema,
  strength: EvidenceStrengthSchema,
  sourceIds: z.array(z.string()),
});

export const EvidenceCautionSchema = z.object({
  claim: z.string(),
  sourceIds: z.array(z.string()),
});

export const EvidenceTrialSchema = z.object({
  nctId: z.string(),
  title: z.string(),
  status: z.string().optional(),
  phase: z.array(z.string()).default([]),
  whyRelevant: z.string(),
});

export const EvidenceCitationSchema = z.object({
  sourceId: z.string(),
  sourceType: SourceTypeSchema,
  title: z.string(),
  year: z.string().optional(),
  url: z.string().optional(),
  abstract: z.string().optional(),
  authors: z.array(z.string()).optional(),
  venue: z.string().optional(),
});

export const RawResearchEvidenceSchema = z.object({
  findings: z.array(EvidenceFindingSchema),
  cautions: z.array(EvidenceCautionSchema),
  activeTrials: z.array(EvidenceTrialSchema),
  citations: z.array(EvidenceCitationSchema),
});

export const ResearchEvidenceSchema = RawResearchEvidenceSchema.extend({
  confidence: ConfidenceSchema,
  summary: z.string(),
});

export type ResearchEvidence = z.infer<typeof ResearchEvidenceSchema>;
export type RawResearchEvidence = z.infer<typeof RawResearchEvidenceSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;