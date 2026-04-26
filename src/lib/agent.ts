import { interventions, simulate, simulateCombo, type PatientProfile, type SimulationPoint } from "./mockData";
import { fetchChatResponse } from "./api";

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  createdAt: number;
  text?: string;
  twin?: {
    summary: string;
    reasoning: string[];
    deltas: { ca153: string; tumorBurden: string; dfs: string };
    interventionIds: string[];
  };
  research?: {
    summary: string;
    papers: { id: string; title: string; authors: string; journal: string; year: number; relevance: number; url?: string }[];
    synthesis?: string;
  };
  suggestions?: { id: string; label: string; reason: string }[];
};

const KEYWORD_INTV: { kw: string[]; id: string }[] = [
  { kw: ["pembrolizumab", "keytruda", "keynote", "immunotherapy", "checkpoint"], id: "pembrolizumab_chemo" },
  { kw: ["parp", "olaparib", "niraparib", "brca", "lynparza"], id: "parp_inhibitor" },
  { kw: ["sacituzumab", "trodelvy", "trop-2", "trop2", "adc"], id: "sacituzumab" },
  { kw: ["ac-t", "act", "adriamycin", "cyclophosphamide", "taxol", "neoadjuvant chemo"], id: "neoadjuvant_act" },
  { kw: ["capecitabine", "xeloda", "create-x", "adjuvant cape"], id: "adjuvant_cape" },
];

export function parseInterventions(text: string): string[] {
  const lc = text.toLowerCase();
  const ids = KEYWORD_INTV.filter((k) => k.kw.some((w) => lc.includes(w))).map((k) => k.id);
  return Array.from(new Set(ids));
}

function computeDeltas(patient: PatientProfile, ids: string[], months: number) {
  const baseline = simulate(patient, "baseline", months);
  const combo = simulateCombo(patient, ids, months);
  const b = baseline.at(-1)!;
  const c = combo.at(-1)!;
  return {
    ca153: (c.ca153 - b.ca153).toFixed(1),
    tumorBurden: (c.tumorBurdenScore - b.tumorBurdenScore).toFixed(1),
    dfs: (c.dfsProbability - b.dfsProbability).toFixed(1),
  };
}

function buildLocalResponse(
  patient: PatientProfile,
  ids: string[],
  deltas: { ca153: string; tumorBurden: string; dfs: string },
  months: number
): { twin: ChatMsg["twin"]; research: ChatMsg["research"]; suggestions: ChatMsg["suggestions"] } {
  const labels = ids.map((id) => interventions.find((i) => i.id === id)?.label ?? id).join(" + ");

  const summary =
    ids.length > 1
      ? `Stacking ${labels} for ${patient.name} projects ΔCA 15-3 ${deltas.ca153} U/mL and ΔDFS ${deltas.dfs}% at ${months} months versus standard of care.`
      : ids.length === 1
      ? `${labels} projects ΔCA 15-3 ${deltas.ca153} U/mL and ΔDFS ${deltas.dfs}% at ${months} months for ${patient.name} versus standard of care.`
      : `Standard of care baseline trajectory for ${patient.name} over ${months} months.`;

  const reasoning = [
    `Twin model used patient priors: Stage ${patient.stage} TNBC, CA 15-3 baseline ${patient.ca153Baseline} U/mL, Ki-67 ${patient.ki67Percent}%.`,
    `${patient.brca1Mutation ? "BRCA1 mutation" : patient.brca2Mutation ? "BRCA2 mutation" : "BRCA wild-type"} status influences PARP inhibitor eligibility and response trajectories.`,
    `DFS probability shift of ${deltas.dfs}% reflects class-effect projections anchored in KEYNOTE-522, OlympiAD, and ASCENT trial data.`,
  ];

  const suggestions = interventions
    .filter((i) => !ids.includes(i.id))
    .slice(0, 3)
    .map((i) => ({
      id: i.id,
      label: i.label,
      reason: i.id === "parp_inhibitor" && (patient.brca1Mutation || patient.brca2Mutation)
        ? "BRCA mutation detected — eligible"
        : i.id === "pembrolizumab_chemo" && (patient.pdl1Cps ?? 0) >= 10
        ? `PD-L1 CPS ${patient.pdl1Cps} — immunotherapy signal`
        : "alternative or adjunct",
    }));

  return {
    twin: { summary, reasoning, deltas, interventionIds: ids },
    research: { summary: `Research Agent will retrieve TNBC evidence for ${labels || "standard of care"}.`, papers: [] },
    suggestions,
  };
}

export async function buildAssistantResponse(
  patient: PatientProfile,
  stack: string[],
  userText: string,
  months: number,
  modelId?: string
): Promise<{ twin: ChatMsg["twin"]; research: ChatMsg["research"]; suggestions: ChatMsg["suggestions"] }> {
  const ids = stack.length ? stack : [];
  const deltas = computeDeltas(patient, ids, months);

  try {
    const backendResult = await fetchChatResponse({ patient, stack: ids, userText, deltas, modelId });
    if (backendResult) return backendResult;
  } catch {
    // fall through to local response
  }

  return buildLocalResponse(patient, ids, deltas, months);
}

export function whyChanged(
  metric: "ca153" | "tumorBurdenScore" | "dfsProbability",
  base: SimulationPoint,
  comp: SimulationPoint,
  stack: string[]
): { biological: string; evidence: string[] } {
  const labels = stack.map((id) => interventions.find((i) => i.id === id)?.label ?? id).join(" + ") || "Standard of Care";
  const delta = (comp[metric] - base[metric]).toFixed(2);
  const bio: Record<typeof metric, string> = {
    ca153: `${labels} reduces tumor-secreted CA 15-3 through tumor shrinkage and reduced cancer cell activity. The Δ of ${delta} U/mL reflects the extent of tumor burden reduction at this timepoint.`,
    tumorBurdenScore: `${labels} induces cell death and suppresses tumor growth pathways. The Δ of ${delta} in tumor burden score reflects the cumulative cytotoxic and immunologic effect on tumor volume.`,
    dfsProbability: `Improved disease-free survival probability (Δ${delta}%) is driven by reduction in micrometastatic burden, enhanced immune surveillance, and reduced risk of recurrence under ${labels}.`,
  };
  return {
    biological: bio[metric],
    evidence: [
      `KEYNOTE-522 showed pCR improvement with pembrolizumab + chemo in stage II–III TNBC (Schmid et al., NEJM 2022).`,
      `OlympiAD demonstrated PFS benefit with olaparib in BRCA1/2-mutated HER2-negative breast cancer (Robson et al., NEJM 2017).`,
      `ASCENT trial: sacituzumab govitecan doubled median PFS vs chemotherapy in metastatic TNBC (Bardia et al., NEJM 2021).`,
    ].slice(0, stack.length > 0 ? 3 : 1),
  };
}
