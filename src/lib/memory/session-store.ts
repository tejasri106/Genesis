import type { PatientProfile } from '@/lib/schemas/patient';
import type { SimulationOutput } from '@/lib/schemas/simulation';
import type { ResearchEvidence } from '@/lib/schemas/research-evidence';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type SessionState = {
  profile: PatientProfile | null;
  messages: ChatMessage[];
  lastSimulation: SimulationOutput | null;
  lastResearch: ResearchEvidence | null;
};

const store = new Map<string, SessionState>();

export function getSession(sessionId: string): SessionState {
  if (!store.has(sessionId)) {
    store.set(sessionId, {
      profile: null,
      messages: [],
      lastSimulation: null,
      lastResearch: null,
    });
  }

  return store.get(sessionId)!;
}

export function setProfile(sessionId: string, profile: PatientProfile) {
  const session = getSession(sessionId);
  session.profile = profile;
}

export function appendMessage(
  sessionId: string,
  message: ChatMessage
) {
  const session = getSession(sessionId);
  session.messages.push(message);
}

export function setLastSimulation(
  sessionId: string,
  simulation: SimulationOutput | null
) {
  const session = getSession(sessionId);
  session.lastSimulation = simulation;
}

export function setLastResearch(
  sessionId: string,
  research: ResearchEvidence | null
) {
  const session = getSession(sessionId);
  session.lastResearch = research;
}