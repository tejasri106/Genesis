"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  interventions,
  defaultPatients,
  simulate,
  simulateCombo,
  CURRENT_CLINICIAN,
  type PatientProfile,
  type SimulationPoint,
  type Clinician,
} from "./mockData";
import { fetchAnalyzeExperiments } from "./api";
import { DEFAULT_MODEL, type ModelID } from "./ai/providers";

const MODEL_STORAGE_KEY = "helix-selected-model";

export type Scenario = {
  id: string;
  name: string;
  patientId: string;
  interventionIds: string[];
  createdAt: number;
  data: SimulationPoint[];
  confidence?: { score: number; level: "low" | "moderate" | "high"; reasons: string[] };
};

export type Finding = {
  id: string;
  createdAt: number;
  patientId: string;
  patientName: string;
  scenarioId?: string;
  title: string;
  body: string;
  labels: string[];
  kind: "auto" | "note" | "summary";
};

export type MetricKey = "ca153" | "tumorBurdenScore" | "dfsProbability";

export const METRICS: {
  key: MetricKey;
  label: string;
  unit: string;
  betterDirection: "down" | "up";
}[] = [
  { key: "ca153", label: "CA 15-3", unit: "U/mL", betterDirection: "down" },
  { key: "tumorBurdenScore", label: "Tumor Burden", unit: "", betterDirection: "down" },
  { key: "dfsProbability", label: "DFS Prob.", unit: "%", betterDirection: "up" },
];

type Ctx = {
  patient: PatientProfile;
  setPatient: (p: PatientProfile) => void;
  patients: PatientProfile[];
  addPatient: (p: PatientProfile) => void;
  stack: string[];
  setStack: (ids: string[]) => void;
  toggleStack: (id: string) => void;
  months: number;
  setMonths: (m: number) => void;
  scenarios: Scenario[];
  runScenario: (interventionIds: string[], name?: string) => Promise<Scenario>;
  removeScenario: (id: string) => void;
  isRunning: boolean;
  activeMetric: MetricKey;
  setActiveMetric: (m: MetricKey) => void;
  findings: Finding[];
  addFinding: (f: Omit<Finding, "id" | "createdAt">) => void;
  removeFinding: (id: string) => void;
  generateSummary: () => Promise<Finding | null>;
  selectedModel: ModelID;
  setSelectedModel: (id: ModelID) => void;
  clinician: Clinician;
  setClinician: (c: Clinician) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<PatientProfile[]>(defaultPatients);
  const [patient, setPatient] = useState<PatientProfile>(defaultPatients[0]);
  const [stack, setStack] = useState<string[]>(["pembrolizumab_chemo"]);
  const [months, setMonths] = useState<number>(24);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("ca153");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedModel, setSelectedModelState] = useState<ModelID>(DEFAULT_MODEL);
  const [clinician, setClinicianState] = useState<Clinician>(CURRENT_CLINICIAN);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(MODEL_STORAGE_KEY) : null;
    if (saved) setSelectedModelState(saved as ModelID);
    const savedClinician = typeof window !== "undefined" ? localStorage.getItem("helix-clinician") : null;
    if (savedClinician) {
      try { setClinicianState(JSON.parse(savedClinician)); } catch { /* keep default */ }
    }
  }, []);

  const setSelectedModel = useCallback((id: ModelID) => {
    setSelectedModelState(id);
    localStorage.setItem(MODEL_STORAGE_KEY, id);
  }, []);

  const setClinician = useCallback((c: Clinician) => {
    setClinicianState(c);
    localStorage.setItem("helix-clinician", JSON.stringify(c));
  }, []);

  const addPatient = useCallback((p: PatientProfile) => {
    setPatients((prev) => [...prev, p]);
  }, []);

  const toggleStack = useCallback((id: string) => {
    setStack((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const addFinding = useCallback((f: Omit<Finding, "id" | "createdAt">) => {
    setFindings((prev) => [
      { ...f, id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() },
      ...prev,
    ]);
  }, []);

  const removeFinding = useCallback((id: string) => {
    setFindings((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const runScenario = useCallback(
    async (interventionIds: string[], name?: string): Promise<Scenario> => {
      setIsRunning(true);
      await new Promise((r) => setTimeout(r, 400));
      const ids = interventionIds.length ? interventionIds : ["pembrolizumab_chemo"];
      const labels = ids
        .map((id) => interventions.find((i) => i.id === id)?.label ?? id)
        .join(" + ");
      const data = simulateCombo(patient, ids, months);
      const scenario: Scenario = {
        id: `s_${Date.now()}`,
        name: name ?? `${patient.name} · ${labels}`,
        patientId: patient.id,
        interventionIds: ids,
        createdAt: Date.now(),
        data,
      };
      setScenarios((prev) => [scenario, ...prev].slice(0, 12));
      setIsRunning(false);

      const baseLast = simulate(patient, "baseline", months).at(-1)!;
      const last = data.at(-1)!;
      const dCA = (last.ca153 - baseLast.ca153).toFixed(1);
      const dTB = (last.tumorBurdenScore - baseLast.tumorBurdenScore).toFixed(1);
      const dDFS = (last.dfsProbability - baseLast.dfsProbability).toFixed(1);
      setFindings((prev) => [
        {
          id: `f_${Date.now()}_auto`,
          createdAt: Date.now(),
          patientId: patient.id,
          patientName: patient.name,
          scenarioId: scenario.id,
          title: `${labels} → ΔCA 15-3 ${dCA} U/mL, ΔDFS ${dDFS}%`,
          body: `Over a ${months}-month horizon for ${patient.name}, ${labels} produced ΔCA 15-3 ${dCA} U/mL, ΔTumor Burden ${dTB}, ΔDFS Probability ${dDFS}% versus standard of care.`,
          labels: ["auto", patient.condition, ...ids],
          kind: "auto",
        },
        ...prev,
      ]);

      return scenario;
    },
    [patient, months]
  );

  const removeScenario = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const generateSummary = useCallback(async (): Promise<Finding | null> => {
    if (scenarios.length === 0) return null;

    const experiments = scenarios.map((s) => ({
      interventionIds: s.interventionIds,
      interventionLabels: s.interventionIds.map((id) => interventions.find((i) => i.id === id)?.label ?? id),
      finalCA153: s.data.at(-1)?.ca153,
      finalTumorBurden: s.data.at(-1)?.tumorBurdenScore,
      finalDFS: s.data.at(-1)?.dfsProbability,
      months,
    }));

    const result = await fetchAnalyzeExperiments({
      patientName: patient.name,
      patientCondition: patient.condition,
      experiments,
      modelId: selectedModel,
    });

    const body = result?.analysis ?? `Pattern analysis across ${scenarios.length} runs for ${patient.name}. Multiple TNBC intervention stacks compared over ${months} months.`;

    const finding: Finding = {
      id: `f_${Date.now()}_sum`,
      createdAt: Date.now(),
      patientId: patient.id,
      patientName: patient.name,
      title: `Cross-experiment summary (${scenarios.length} runs)`,
      body,
      labels: ["summary", "cross-experiment"],
      kind: "summary",
    };
    setFindings((prev) => [finding, ...prev]);
    return finding;
  }, [scenarios, patient, months, selectedModel]);

  const value = useMemo<Ctx>(
    () => ({
      patient,
      setPatient,
      patients,
      addPatient,
      stack,
      setStack,
      toggleStack,
      months,
      setMonths,
      scenarios,
      runScenario,
      removeScenario,
      isRunning,
      activeMetric,
      setActiveMetric,
      findings,
      addFinding,
      removeFinding,
      generateSummary,
      selectedModel,
      setSelectedModel,
      clinician,
      setClinician,
    }),
    [
      patient,
      patients,
      addPatient,
      stack,
      toggleStack,
      months,
      scenarios,
      runScenario,
      removeScenario,
      isRunning,
      activeMetric,
      findings,
      addFinding,
      removeFinding,
      generateSummary,
      selectedModel,
      setSelectedModel,
      clinician,
      setClinician,
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
