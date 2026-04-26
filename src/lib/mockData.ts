export type PatientProfile = {
  id: string;
  name: string;
  age: number;
  sex: "M" | "F";
  ethnicity: string;
  avatar: string;
  subtype: "TNBC";
  stage: "I" | "II" | "III" | "IV";
  brca1Mutation: boolean;
  brca2Mutation: boolean;
  pdl1Cps?: number;
  ki67Percent: number;
  ca153Baseline: number;
  tumorSizeCm: number;
  lymphNodePositive: boolean;
  priorTreatments: string[];
  medications: string[];
  comorbidities: string[];
  lifestyleFactors: string[];
  condition: string;
};

export type Intervention = {
  id: string;
  label: string;
  category: "Medication" | "Lifestyle" | "Procedure";
  description: string;
};

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

export type Clinician = {
  name: string;
  initials: string;
  title: string;
  credentials: string[];
  affiliation: string;
  npi: string;
  email: string;
  specialties: string[];
};

export const CURRENT_CLINICIAN: Clinician = {
  name: "Dr. Maya Patel",
  initials: "MP",
  title: "Oncologist · Breast Cancer Specialist",
  credentials: ["MD", "PhD", "FACP"],
  affiliation: "Memorial Cancer Center · TNBC Program",
  npi: "1234567890",
  email: "mpatel@helix-research.org",
  specialties: ["Triple-Negative Breast Cancer", "Immunotherapy", "BRCA therapeutics"],
};

export const defaultPatients: PatientProfile[] = [
  {
    id: "p1",
    name: "Aaliyah Washington",
    age: 38,
    sex: "F",
    ethnicity: "Black",
    avatar: "AW",
    subtype: "TNBC",
    stage: "III",
    brca1Mutation: true,
    brca2Mutation: false,
    pdl1Cps: 22,
    ki67Percent: 75,
    ca153Baseline: 48,
    tumorSizeCm: 4.2,
    lymphNodePositive: true,
    priorTreatments: [],
    medications: [],
    comorbidities: ["Hypertension"],
    lifestyleFactors: ["Moderate activity"],
    condition: "Stage III TNBC",
  },
  {
    id: "p2",
    name: "Sarah Kim",
    age: 45,
    sex: "F",
    ethnicity: "Asian",
    avatar: "SK",
    subtype: "TNBC",
    stage: "II",
    brca1Mutation: false,
    brca2Mutation: true,
    pdl1Cps: 8,
    ki67Percent: 60,
    ca153Baseline: 32,
    tumorSizeCm: 2.8,
    lymphNodePositive: false,
    priorTreatments: [],
    medications: [],
    comorbidities: [],
    lifestyleFactors: ["Regular exercise", "Low alcohol"],
    condition: "Stage II TNBC",
  },
  {
    id: "p3",
    name: "Emily Hartwell",
    age: 52,
    sex: "F",
    ethnicity: "White",
    avatar: "EH",
    subtype: "TNBC",
    stage: "II",
    brca1Mutation: false,
    brca2Mutation: false,
    pdl1Cps: 3,
    ki67Percent: 45,
    ca153Baseline: 26,
    tumorSizeCm: 2.1,
    lymphNodePositive: false,
    priorTreatments: [],
    medications: [],
    comorbidities: ["Hypothyroidism"],
    lifestyleFactors: ["Sedentary"],
    condition: "Stage II TNBC",
  },
];

export const interventions: Intervention[] = [
  {
    id: "pembrolizumab_chemo",
    label: "Pembrolizumab + Chemo",
    category: "Medication",
    description: "Pembrolizumab (Keytruda) with neoadjuvant chemotherapy — KEYNOTE-522 regimen",
  },
  {
    id: "parp_inhibitor",
    label: "PARP Inhibitor (Olaparib)",
    category: "Medication",
    description: "Olaparib for BRCA1/2-mutated TNBC — OlympiAD regimen",
  },
  {
    id: "sacituzumab",
    label: "Sacituzumab Govitecan",
    category: "Medication",
    description: "Sacituzumab govitecan (Trodelvy) — ASCENT regimen for metastatic TNBC",
  },
  {
    id: "neoadjuvant_act",
    label: "Neoadjuvant AC-T",
    category: "Medication",
    description: "Adriamycin + Cyclophosphamide → Taxol neoadjuvant chemotherapy",
  },
  {
    id: "adjuvant_cape",
    label: "Adjuvant Capecitabine",
    category: "Medication",
    description: "Adjuvant capecitabine for residual TNBC after neoadjuvant — CREATE-X regimen",
  },
];

const stageToCA153: Record<string, number> = { I: 18, II: 30, III: 52, IV: 80 };
const stageToTumorBurden: Record<string, number> = { I: 20, II: 45, III: 65, IV: 85 };
const stageToDFS: Record<string, number> = { I: 0.92, II: 0.78, III: 0.62, IV: 0.28 };

const INTERVENTION_EFFECTS: Record<string, { ca153: number; tumorBurden: number; dfs: number }> = {
  pembrolizumab_chemo: { ca153: -0.38, tumorBurden: -0.42, dfs: 0.34 },
  parp_inhibitor:      { ca153: -0.30, tumorBurden: -0.35, dfs: 0.28 },
  sacituzumab:         { ca153: -0.25, tumorBurden: -0.30, dfs: 0.22 },
  neoadjuvant_act:     { ca153: -0.20, tumorBurden: -0.25, dfs: 0.18 },
  adjuvant_cape:       { ca153: -0.12, tumorBurden: -0.15, dfs: 0.10 },
};

const ease = (t: number) => 1 - Math.pow(1 - t, 2);

export function simulate(patient: PatientProfile, _id: string, months = 24): SimulationPoint[] {
  const startCA153 = patient.ca153Baseline ?? stageToCA153[patient.stage] ?? 30;
  const startTumorBurden = stageToTumorBurden[patient.stage] ?? 45;
  const startDFS = stageToDFS[patient.stage] ?? 0.78;
  return Array.from({ length: months + 1 }, (_, m) => {
    const t = ease(m / Math.max(months, 1));
    const noise = (Math.sin(m * 1.3) + Math.cos(m * 0.7)) * 0.015;
    return {
      month: m,
      ca153: +Math.max(5, startCA153 * (1 - 0.06 * t) + noise * 3).toFixed(1),
      tumorBurdenScore: +Math.max(5, startTumorBurden * (1 - 0.08 * t) + noise * 2).toFixed(1),
      dfsProbability: +Math.min(100, Math.max(5, startDFS * 100 * (1 + 0.04 * t) + noise * 2)).toFixed(1),
      treatmentResponse: "stable" as const,
    };
  });
}

export function simulateCombo(patient: PatientProfile, interventionIds: string[], months = 24): SimulationPoint[] {
  const ids = interventionIds.length ? interventionIds : [];
  const startCA153 = patient.ca153Baseline ?? stageToCA153[patient.stage] ?? 30;
  const startTumorBurden = stageToTumorBurden[patient.stage] ?? 45;
  const startDFS = stageToDFS[patient.stage] ?? 0.78;

  const stacked = ids.reduce(
    (acc, id) => {
      const e = INTERVENTION_EFFECTS[id] ?? { ca153: 0, tumorBurden: 0, dfs: 0 };
      acc.ca153 += e.ca153;
      acc.tumorBurden += e.tumorBurden;
      acc.dfs += e.dfs;
      return acc;
    },
    { ca153: 0, tumorBurden: 0, dfs: 0 }
  );
  const k = 1 / (1 + 0.18 * Math.max(0, ids.length - 1));
  const eff = { ca153: stacked.ca153 * k, tumorBurden: stacked.tumorBurden * k, dfs: stacked.dfs * k };

  return Array.from({ length: months + 1 }, (_, m) => {
    const t = ease(m / Math.max(months, 1));
    const noise = (Math.sin(m * 1.3) + Math.cos(m * 0.7)) * 0.015;
    const ca153 = +Math.max(5, startCA153 * (1 + eff.ca153 * t) + noise * 3).toFixed(1);
    const tumorBurdenScore = +Math.max(5, startTumorBurden * (1 + eff.tumorBurden * t) + noise * 2).toFixed(1);
    const dfsProbability = +Math.min(100, Math.max(5, (startDFS + eff.dfs * t) * 100 + noise * 2)).toFixed(1);
    const responding = eff.dfs > 0.15;
    return {
      month: m,
      ca153,
      tumorBurdenScore,
      dfsProbability,
      treatmentResponse: (responding ? "responding" : "stable") as "responding" | "stable" | "progressing",
    };
  });
}
