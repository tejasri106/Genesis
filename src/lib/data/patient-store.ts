import fs from 'fs';
import path from 'path';
import { demoPatients } from '@/data/demo-patients';
import type { PatientProfile } from '@/lib/schemas/patient';
import type { ResearchEvidence } from '@/lib/schemas/research-evidence';
import type { SimulationOutput } from '@/lib/schemas/simulation';
import { syntheaPatients } from '../../data/synthea-patients';

export type PatientExperiment = {
  experimentId: string;
  patientId: string;
  scenario: string;
  createdAt: string;
  evidence: ResearchEvidence | null;
  simulation: SimulationOutput | null;
  message: string;
};

export type PatientRecord = {
  patientId: string;
  profile: PatientProfile;
  experiments: PatientExperiment[];
};

const STORE_PATH = path.join(process.cwd(), 'data', 'experiment-store.json');

const patientStore = new Map<string, PatientRecord>();

function ensureStoreFileExists() {
  const dir = path.dirname(STORE_PATH);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({}, null, 2));
  }
}

function readExperimentStore(): Record<string, PatientExperiment[]> {
  ensureStoreFileExists();

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');

    if (!raw.trim()) {
      return {};
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read experiment store:', error);
    return {};
  }
}

function writeExperimentStore(store: Record<string, PatientExperiment[]>) {
  ensureStoreFileExists();

  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error('Failed to write experiment store:', error);
  }
}

function initializePatients() {
  if (patientStore.size > 0) return;

  const persistedExperiments = readExperimentStore();

  const allPatients = [...demoPatients, ...syntheaPatients];
  for (const profile of allPatients) {
    patientStore.set(profile.patientId, {
      patientId: profile.patientId,
      profile,
      experiments: persistedExperiments[profile.patientId] ?? [],
    });
  }
}

function persistCurrentExperiments() {
  initializePatients();

  const store: Record<string, PatientExperiment[]> = {};

  for (const patient of patientStore.values()) {
    store[patient.patientId] = patient.experiments;
  }

  writeExperimentStore(store);
}

export function getAllPatients(): PatientRecord[] {
  initializePatients();
  return Array.from(patientStore.values());
}

export function getPatient(patientId: string): PatientRecord | null {
  initializePatients();
  return patientStore.get(patientId) ?? null;
}

export function getPatientExperiments(patientId: string): PatientExperiment[] {
  initializePatients();
  return patientStore.get(patientId)?.experiments ?? [];
}

export function addPatientExperiment(
  patientId: string,
  experiment: Omit<PatientExperiment, 'experimentId' | 'createdAt'>
): PatientExperiment | null {
  initializePatients();

  const patient = patientStore.get(patientId);

  if (!patient) {
    return null;
  }

  const savedExperiment: PatientExperiment = {
    ...experiment,
    experimentId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  patient.experiments.unshift(savedExperiment);

  persistCurrentExperiments();

  return savedExperiment;
}