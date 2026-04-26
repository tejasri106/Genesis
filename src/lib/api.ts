import type { PatientProfile } from './mockData';

export type SimulationPoint = {
  month: number;
  ca153: number;
  tumorBurdenScore: number;
  dfsProbability: number;
  treatmentResponse: "responding" | "stable" | "progressing";
  note?: string;
};

export type ResearchPaper = {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  citations: number;
  relevance: number;
  summary: string;
  finding: string;
  tag: "Supporting" | "Contextual" | "Caution";
  url?: string;
};

export type ActiveTrial = {
  nctId: string;
  title: string;
  status: string;
  phase: string[];
};

type ChatApiResponse = {
  twin: {
    summary: string;
    reasoning: string[];
    deltas: { ca153: string; tumorBurden: string; dfs: string };
    interventionIds: string[];
  };
  research: {
    summary: string;
    papers: ResearchPaper[];
    trials?: ActiveTrial[];
    synthesis?: string;
  };
  suggestions: { id: string; label: string; reason: string }[];
};

export async function fetchChatResponse(params: {
  patient: PatientProfile;
  stack: string[];
  userText: string;
  deltas: { ca153: string; tumorBurden: string; dfs: string };
  modelId?: string;
}): Promise<ChatApiResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`/api/health-navigator/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return data as ChatApiResponse;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export type SimulateResult = {
  simulation: {
    baseline: SimulationPoint[];
    intervention: SimulationPoint[];
    months: number;
    interventionIds: string[];
    interventionLabels: string[];
    rationale: { statement: string; metric: string; sourceIds: string[] }[];
    confidence?: { score: number; level: "low" | "moderate" | "high"; reasons: string[] };
  };
  research: {
    papers: ResearchPaper[];
    trials: ActiveTrial[];
    sources: { pubmed: number; europepmc: number; trials: number };
    summary: string;
  };
};

export async function fetchSimulation(params: {
  patient: PatientProfile;
  interventionIds: string[];
  months: number;
  modelId?: string;
}): Promise<SimulateResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(`/api/health-navigator/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return data as SimulateResult;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export type ResearchSearchResult = {
  papers: ResearchPaper[];
  trials: ActiveTrial[];
  synthesis: string;
  summary: string;
};

export async function fetchResearchSearch(params: {
  query: string;
  patient?: Partial<PatientProfile>;
  modelId?: string;
}): Promise<ResearchSearchResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`/api/health-navigator/research-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return data as ResearchSearchResult;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export type GeneratePatientResult = {
  patient: PatientProfile;
};

export async function fetchGeneratePatient(hints?: {
  stage?: string;
  age?: number;
  ethnicity?: string;
}): Promise<GeneratePatientResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(`/api/health-navigator/generate-patient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hints }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return data as GeneratePatientResult;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export type AnalyzeExperimentsResult = {
  analysis: string;
};

export async function fetchAnalyzeExperiments(params: {
  patientName: string;
  patientCondition: string;
  experiments: {
    interventionIds: string[];
    interventionLabels: string[];
    finalCA153?: number;
    finalTumorBurden?: number;
    finalDFS?: number;
    months?: number;
  }[];
  modelId?: string;
}): Promise<AnalyzeExperimentsResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(`/api/health-navigator/analyze-experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return data as AnalyzeExperimentsResult;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}
