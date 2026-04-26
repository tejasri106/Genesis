import { z } from 'zod';

export const RoutingDecisionSchema = z.object({
  intent: z.enum([
    'simulation_request',
    'research_query',
    'what_if_scenario',
    'profile_update',
    'memory_recall',
    'general_question',
  ]),
  invokeTwin: z.boolean(),
  invokeResearch: z.boolean(),
  months: z.number().int().min(1).max(24).default(12),
  interventions: z.array(z.string()).default([]),
  researchContext: z.string().default(''),
});

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;