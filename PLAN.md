# Helix TNBC Digital Twin — Agent + Voice Architecture Plan

**Status:** Planning  
**Last updated:** 2026-04-25  
**Scope:** Security layer (HIPAA/PII), pure agent layer, RAG via LanceDB, ElevenLabs STT/TTS, Twilio phone integration  
**Constraint:** All existing routes and UI remain untouched until each phase is complete and verified

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Target Architecture](#2-target-architecture)
3. [Phase 0 — Security Layer (HIPAA/PII)](#3-phase-0--security-layer-hipaapii)
4. [Phase 1 — RAG Agent (LanceDB + mcp-local-rag)](#4-phase-1--rag-agent)
5. [Phase 2 — Pure Agent Layer](#5-phase-2--pure-agent-layer)
6. [Phase 3 — ElevenLabs Voice (Browser)](#6-phase-3--elevenlabs-voice-browser)
7. [Phase 4 — Twilio Phone Integration](#7-phase-4--twilio-phone-integration)
8. [File Map](#8-file-map)
9. [Environment Variables](#9-environment-variables)
10. [Dependency List](#10-dependency-list)

---

## 1. Current State

### What exists (working)
| Route | Type | Description |
|-------|------|-------------|
| `POST /api/chat` | Streaming | Primary chat — `streamText` → `toUIMessageStreamResponse()` |
| `POST /api/health-navigator/chat` | JSON | Structured twin response with `generateObject` |
| `POST /api/health-navigator/research-search` | JSON | PubMed + EuropePMC keyword search |
| `POST /api/health-navigator/simulate` | JSON | Full grounded simulation pipeline |
| `POST /api/health-navigator/analyze-experiments` | JSON | Experiment analysis |

### What the agents currently are (not true agents)
- `src/lib/ai/research.ts` — calls `generateObject` once, no tools, no multi-step
- `src/lib/ai/twin.ts` — calls `generateObject` once, no tools, no memory
- No supervisor, no routing, no tool use, no RAG, no handoffs

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chat Interfaces                       │
│  Dashboard Chat │ Research Panel │ Twilio Phone Call    │
│    (useChat)    │   (useChat)    │  (WebSocket/TwiML)   │
└────────────┬────────────────┬────────────────────────────┘
             │                │
    STT ─────┤                │───── STT (ElevenLabs)
    TTS ─────┤                │───── TTS (ElevenLabs)
             │                │
             ▼                ▼
┌─────────────────────────────────────────────────────────┐
│              POST /api/agent/chat  (new)                │
│                   Supervisor Agent                       │
│  tools: routeToTwin | routeToResearch | routeToRAG      │
│         routeToReview | respondDirect                   │
│  maxSteps: 8                                             │
└──────┬──────────┬──────────┬──────────┬─────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
  Twin Agent  Research   RAG Agent  Review Agent
  (simulate)   Agent    (LanceDB)  (validates)
       │          │          │          │
       ▼          ▼          ▼          ▼
  mockData   PubMed /    LanceDB    Cross-check
  + twin.ts  EuropePMC   Vector     evidence vs
             + ClinTr.   Store      AI output
```

---

## 3. Phase 0 — Security Layer (HIPAA/PII)

Security is a **cross-cutting, foundational concern** — not a phase. Every route, every agent, and every outbound API call must pass through the security layer. Phase 0 documents what is already implemented and what must be enforced as new phases land.

---

### 3.1 Threat Model

| Threat | Risk | Mitigation |
|--------|------|------------|
| User pastes SSN, DOB, address into chat | PHI exposure to external AI model | Pre-flight PII detection — block before model call |
| User asks for insurance ID or MRN | HIPAA Direct Identifier leakage | Pattern-matched block + HIPAA warning message |
| Agent constructs PubMed query with patient name | PHI in outbound API call | Clinical terms only in external search queries |
| User asks non-oncology questions | Scope creep / misinformation risk | Off-topic deflection with `[HELIX-OFF-TOPIC]` marker |
| Bulk patient data extraction via API | Privacy breach | No bulk export endpoints; session-scoped data only |
| API keys or secrets in chat | Credential leakage | Pattern match for API key formats → block |

---

### 3.2 Central Security Module (`src/lib/security.ts`) — IMPLEMENTED

All detection and message-building lives in a single module so it can be reused across every route and agent.

```typescript
// src/lib/security.ts

export const SECURITY_PREFIX = '[HELIX-SECURITY]';
export const OFF_TOPIC_PREFIX = '[HELIX-OFF-TOPIC]';

// PII trigger patterns — tested against last user message before any AI call
const PII_TRIGGERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(ssn|social\s?security(\s?number)?|tax\s?id)\b/i,            label: 'SSN or Tax ID' },
  { pattern: /\b(home\s?address|mailing\s?address|street\s?address|zip\s?code)\b/i, label: 'Home Address' },
  { pattern: /\b(phone\s?number|cell\s?number|mobile\s?number|home\s?phone)\b/i,    label: 'Phone Number' },
  { pattern: /\b(personal\s?email|gmail|yahoo\s?mail|hotmail)\b/i,           label: 'Personal Email' },
  { pattern: /\b(insurance\s?(id|number|plan|member)|member\s?id|policy\s?number)\b/i, label: 'Insurance ID' },
  { pattern: /\b(date\s?of\s?birth|dob|born\s?on|birth\s?date)\b/i,         label: 'Date of Birth' },
  { pattern: /\b(password|passphrase|secret\s?key|api\s?key|access\s?token)\b/i, label: 'Credentials' },
  { pattern: /\b(credit\s?card|debit\s?card|bank\s?account|routing\s?number)\b/i, label: 'Financial Information' },
  { pattern: /\b(export\s?(all\s?)?patient|full\s?(medical\s?)?record|entire\s?ehr)\b/i, label: 'Bulk PHI Export' },
  { pattern: /\b(all\s?patients?|patient\s?list|patient\s?database)\b/i,     label: 'Bulk Patient Data' },
  { pattern: /\b(medical\s?record\s?number|mrn)\b/i,                         label: 'Medical Record Number (MRN)' },
];

export function detectPII(text: string): string | null {
  for (const { pattern, label } of PII_TRIGGERS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

export function buildSecurityWarning(piiLabel: string): string {
  return `${SECURITY_PREFIX}
## Security Block — HIPAA/PHI Policy

**This query has been blocked.** It appears to reference personally identifiable health information: **${piiLabel}**.

Under Helix's HIPAA data security policy, AI agents are not authorized to process or respond to queries containing direct patient identifiers including:
- Social Security Numbers, Tax IDs
- Home addresses, phone numbers, personal email
- Insurance IDs, member numbers, policy numbers
- Dates of birth, medical record numbers (MRN)
- Financial or credential information

**Helix agents are authorized to process only:**
- Oncology staging data (stage, grade, histology)
- Biomarker values (BRCA status, PD-L1 CPS, Ki-67%, CA 15-3)
- Treatment history (drug names, regimens)
- Simulation outputs and published trial data

If you believe this block is incorrect, please contact your institution's compliance officer.`;
}

export function buildOffTopicWarning(patientName: string): string {
  return `${OFF_TOPIC_PREFIX}
## Off-Topic Query

Helix is a specialist TNBC oncology decision support system for **${patientName}**.

I can only respond to questions about:
- Triple-negative breast cancer treatment options
- Biomarker interpretation (BRCA, PD-L1, Ki-67, CA 15-3)
- Clinical trial evidence (KEYNOTE-522, OlympiAD, ASCENT, CREATE-X)
- Digital twin simulation outcomes and projections

Please rephrase your question in the context of TNBC oncology.`;
}
```

---

### 3.3 Server-Side Pre-Flight Pattern — IMPLEMENTED

Every route that accepts user input **must** run pre-flight detection before calling any AI model or external API:

```typescript
// Pattern used in src/app/api/chat/route.ts (and required in all future routes)

function staticStream(text: string): Response {
  const stream = createUIMessageStream({
    execute(writer) {
      writer.write({ type: 'text-delta', textDelta: text });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  const { messages, patient, modelId } = await req.json();

  // 1. Extract last user message text
  const lastUserMsg = [...(messages ?? [])].reverse().find((m: any) => m.role === 'user');
  const userText: string =
    lastUserMsg?.parts?.find((p: any) => p.type === 'text')?.text ??
    lastUserMsg?.content ?? '';

  // 2. PII / HIPAA pre-flight — BLOCK before any model call
  const piiLabel = detectPII(userText);
  if (piiLabel) {
    return staticStream(buildSecurityWarning(piiLabel));   // no AI call made
  }

  // 3. Scope check — off-topic deflection
  // (Implemented in system prompt; can be promoted to pre-flight if needed)

  // 4. Proceed to AI model only if clean
  const result = streamText({ ... });
  return result.toUIMessageStreamResponse();
}
```

**Key invariant:** No PHI-containing text ever reaches `streamText`, `generateText`, or any external API call.

---

### 3.4 Client-Side Warning Rendering — IMPLEMENTED

The `StreamingBubble` component in `src/app/page.tsx` detects security prefix markers and renders styled warning UI — no structured tool call responses needed.

```tsx
function StreamingBubble({ content }: { content: string }) {
  // HIPAA/PII block — red destructive bubble
  if (content.startsWith(SECURITY_PREFIX)) {
    const body = content.slice(SECURITY_PREFIX.length).trim();
    return (
      <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <ReactMarkdown components={MD_COMPONENTS}>{body}</ReactMarkdown>
      </div>
    );
  }

  // Off-topic deflection — amber warning bubble
  if (content.startsWith(OFF_TOPIC_PREFIX)) {
    const body = content.slice(OFF_TOPIC_PREFIX.length).trim();
    return (
      <div className="flex gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <ReactMarkdown components={MD_COMPONENTS}>{body}</ReactMarkdown>
      </div>
    );
  }

  // Normal assistant message
  return <ReactMarkdown components={MD_COMPONENTS}>{content}</ReactMarkdown>;
}
```

---

### 3.5 External API PHI Rules — REQUIRED

All tool calls to external APIs (PubMed, EuropePMC, ClinicalTrials, ElevenLabs) must follow these rules enforced in `src/lib/agents/tools.ts`:

| External API | Allowed query content | Never include |
|---|---|---|
| PubMed | Disease name, drug name, biomarker term | Patient name, DOB, MRN |
| EuropePMC | Clinical/molecular terms only | Any identifier |
| ClinicalTrials.gov | Condition, intervention, sponsor | Patient identifiers |
| ElevenLabs STT | Audio bytes only | No PHI in the API call body |
| ElevenLabs TTS | Agent response text (de-identified) | No patient names or identifiers in TTS text |

```typescript
// Enforced in agent tool wrappers — query sanitization before external call
function sanitizeExternalQuery(query: string): string {
  // Strip any content that matches PII patterns before sending to external APIs
  // If PII detected in a tool's constructed query → throw error, do not call API
  const label = detectPII(query);
  if (label) throw new Error(`PHI detected in outbound query: ${label}. Query blocked.`);
  return query;
}
```

---

### 3.6 Agent Security Requirements (Phase 2+)

When the Supervisor Agent and sub-agents are introduced, security checks must be applied at each layer:

```
User Message
    │
    ▼
[PRE-FLIGHT: detectPII]  ← server route level (already implemented)
    │
    ▼ (clean)
Supervisor Agent
    │
    ├── [SCOPE CHECK] Is query oncology-relevant?
    │       No → respondDirect with OFF_TOPIC_PREFIX message
    │
    ▼ (in-scope)
Sub-Agent tool call
    │
    ├── External API call
    │       └── [OUTBOUND PHI CHECK] sanitizeExternalQuery() before fetch
    │
    └── RAG retrieval
            └── Query uses clinical terms only — no patient identifiers
```

**Rule: security checks are additive, never bypassed.** Adding a new agent or tool does not remove the pre-flight check at the route level.

---

### 3.7 Audit Logging Requirements

Every request must be logged. Logs are **non-PHI** — the actual user query text is never stored.

```typescript
// Audit log entry structure (write to structured log or monitoring system)
interface AuditLogEntry {
  sessionId: string;         // UUID, not patient name
  timestamp: string;         // ISO 8601
  queryType: 'oncology' | 'off-topic' | 'security-blocked' | 'simulation' | 'research';
  modelId: string;           // which model was called (if any)
  securityBlocked: boolean;  // true if PII pre-flight triggered
  blockReason?: string;      // PII label (e.g. "SSN or Tax ID") — NOT the query text
  agentPath?: string[];      // which agents were invoked (e.g. ["supervisor", "research", "rag"])
  durationMs?: number;       // total response time
}
```

Log storage: stdout → application monitoring (Azure Monitor / Datadog). **Do not log `userText` or `messages` content.**

---

### 3.8 Data Retention Rules

| Data type | Retention | Storage |
|-----------|-----------|---------|
| Chat messages | Session-scoped only | In-memory (`useChat` messages array) — cleared on tab close |
| Simulation results | Only with explicit user save action | `data/experiment-store.json` |
| RAG documents | De-identified / publicly available only | `data/rag-lancedb/` |
| Audit logs | 90 days (institutional policy) | Application monitoring |
| ElevenLabs audio | Not stored — stream-only | Transient WebM blob in browser |
| Twilio call audio | Not stored by Helix — Twilio handles | Twilio account (BAA required) |

---

### 3.9 BAA (Business Associate Agreement) Checklist

Before production deployment with real PHI, the following BAAs must be in place:

| Vendor | Required if | BAA status |
|--------|-------------|------------|
| Cloud provider (Azure/AWS/GCP) | Any PHI stored | Must be signed |
| Anthropic (Claude) | PHI sent to Claude API | Must be signed |
| Mistral AI | PHI sent to Mistral API | Must be signed |
| Google (Gemini) | PHI sent to Gemini API | Must be signed |
| ElevenLabs | Voice data contains PHI | Must be signed |
| Twilio | Call transcripts contain PHI | Must be signed |

**Current posture:** Helix agents are designed to avoid sending PHI to any external API. The pre-flight block ensures PHI-containing queries never reach model APIs. BAAs are still required at the institutional level before any clinical deployment.

---

### 3.10 Security Layer File Map

```
src/lib/
  security.ts              ← IMPLEMENTED: PII detection, warning builders, prefix constants

src/app/api/
  chat/route.ts            ← IMPLEMENTED: pre-flight check before streamText
  agent/chat/route.ts      ← REQUIRED (Phase 2): same pre-flight before supervisor agent
  rag/ingest/route.ts      ← REQUIRED (Phase 1): check uploaded documents for PHI before ingestion
  rag/search/route.ts      ← REQUIRED (Phase 1): sanitize search query before LanceDB lookup
  voice/transcribe/route.ts← REQUIRED (Phase 3): do not log audio content; transcript → pre-flight
  voice/speak/route.ts     ← REQUIRED (Phase 3): check TTS text for PHI before ElevenLabs call
  voice/twilio/stream/route.ts ← REQUIRED (Phase 4): STT transcript → pre-flight before agent

data/rag-docs/
  hipaa-security-policy.md ← RAG-ingested: Helix HIPAA policy document for agent context
```

---

## 4. Phase 1 — RAG Agent

### 3.1 What mcp-local-rag provides (reuse directly)

From `E:\gitai\mcp-local-rag\src`:
- **`vectordb/index.ts`** → `VectorStore` class — LanceDB connect/insert/search/delete
- **`embedder/index.ts`** → `Embedder` class — `all-MiniLM-L6-v2` via Transformers.js (384-dim)
- **`chunker/index.ts`** → Text chunking logic
- **`parser/index.ts`** → PDF, DOCX, TXT, MD, JSON parsing

Copy (not import) these four modules into `src/lib/rag/` to keep the Next.js build isolated from the MCP server's tsconfig.

### 3.2 New files for RAG

```
src/lib/rag/
  vectordb.ts        ← copy of mcp-local-rag/src/vectordb/index.ts
  embedder.ts        ← copy of mcp-local-rag/src/embedder/index.ts
  chunker.ts         ← copy of mcp-local-rag/src/chunker/index.ts
  parser.ts          ← copy of mcp-local-rag/src/parser/index.ts
  store.ts           ← singleton: one VectorStore + Embedder instance
  ingest.ts          ← ingest a file/URL into LanceDB
  retrieve.ts        ← query LanceDB → top-k chunks → format for agent

src/app/api/rag/
  ingest/route.ts    ← POST: accept PDF/text, run ingest pipeline
  search/route.ts    ← POST: semantic search, returns ranked chunks
  status/route.ts    ← GET: document count, chunk count
```

### 3.3 RAG singleton (`src/lib/rag/store.ts`)

```typescript
// Singleton — one LanceDB connection per Next.js process
import { VectorStore } from './vectordb';
import { Embedder } from './embedder';

const DB_PATH = process.env.RAG_DB_PATH ?? './data/rag-lancedb';
const MODEL_PATH = 'Xenova/all-MiniLM-L6-v2';
const CACHE_DIR = process.env.RAG_MODEL_CACHE ?? './data/rag-model-cache';

let _store: VectorStore | null = null;
let _embedder: Embedder | null = null;

export async function getRagStore() {
  if (!_store) {
    _store = new VectorStore({ dbPath: DB_PATH, tableName: 'tnbc_documents' });
    await _store.initialize();
  }
  return _store;
}

export async function getRagEmbedder() {
  if (!_embedder) {
    _embedder = new Embedder({ modelPath: MODEL_PATH, batchSize: 8, cacheDir: CACHE_DIR });
  }
  return _embedder;
}
```

### 3.4 Retrieve function (`src/lib/rag/retrieve.ts`)

```typescript
export async function retrieveContext(query: string, limit = 5): Promise<string> {
  const embedder = await getRagEmbedder();
  const store = await getRagStore();
  const vector = await embedder.embed(query);
  const results = await store.search(vector, limit);
  
  if (results.length === 0) return 'No relevant documents found in local knowledge base.';
  
  return results
    .map((r, i) => `[${i + 1}] ${r.metadata.fileName} (score: ${(1 - r.score).toFixed(3)})\n${r.text}`)
    .join('\n\n---\n\n');
}
```

### 3.5 Pre-ingest TNBC literature

Create a script `scripts/ingest-tnbc-literature.ts`:
- Ingest key trial PDFs: KEYNOTE-522, OlympiAD, ASCENT, CREATE-X full text
- Ingest TNBC treatment guidelines (NCCN, ESMO)
- Run once: `npx tsx scripts/ingest-tnbc-literature.ts`
- LanceDB persists to `./data/rag-lancedb/`

### 3.6 RAG Ingest API (`src/app/api/rag/ingest/route.ts`)

```
POST /api/rag/ingest
Body: multipart/form-data
  file: File (PDF, DOCX, TXT, MD)
  OR
  url: string (fetch from URL)

Response: { ok: true, chunks: number, fileName: string }
```

### 3.7 Environment variables for Phase 1

```
RAG_DB_PATH=./data/rag-lancedb
RAG_MODEL_CACHE=./data/rag-model-cache
```

---

## 5. Phase 2 — Pure Agent Layer

### 4.1 Agent framework: AI SDK v6 tool use

All agents use `streamText` or `generateText` with:
- **`tools`** — typed tool definitions with Zod schemas
- **`maxSteps`** — allows multi-round tool calling
- **`onStepFinish`** — step-level logging/streaming

### 4.2 Tool definitions (`src/lib/agents/tools.ts`)

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const searchPubMedTool = tool({
  description: 'Search PubMed for peer-reviewed oncology literature',
  parameters: z.object({ query: z.string(), limit: z.number().default(5) }),
  execute: async ({ query, limit }) => searchPubMed(query, limit),
});

export const searchClinicalTrialsTool = tool({
  description: 'Search ClinicalTrials.gov for active/completed TNBC trials',
  parameters: z.object({ condition: z.string(), intervention: z.string(), limit: z.number().default(3) }),
  execute: async ({ condition, intervention, limit }) => searchClinicalTrials(condition, intervention, limit),
});

export const searchEuropePMCTool = tool({
  description: 'Search EuropePMC for TNBC research',
  parameters: z.object({ query: z.string(), limit: z.number().default(5) }),
  execute: async ({ query, limit }) => searchEuropePMC(query, limit),
});

export const ragSearchTool = tool({
  description: 'Search local TNBC knowledge base (full-text trial papers, guidelines)',
  parameters: z.object({ query: z.string(), limit: z.number().default(5) }),
  execute: async ({ query, limit }) => retrieveContext(query, limit),
});

export const runSimulationTool = tool({
  description: 'Run digital twin simulation for a patient + intervention stack',
  parameters: z.object({
    patientId: z.string(),
    interventionIds: z.array(z.string()),
    months: z.number().default(12),
  }),
  execute: async ({ patientId, interventionIds, months }) => {
    // call existing twin simulation logic
  },
});

export const validateClinicalClaimTool = tool({
  description: 'Validate a clinical claim against retrieved evidence. Returns: supported | contradicted | uncertain',
  parameters: z.object({ claim: z.string(), evidence: z.string() }),
  execute: async ({ claim, evidence }) => {
    // call Review Agent logic
  },
});
```

### 4.3 Supervisor Agent (`src/lib/agents/supervisor.ts`)

Decides which agents to invoke based on the user query. Uses AI SDK tool calls to route.

```typescript
export async function supervisorAgent({
  messages, patient, stack, deltas, modelId
}: SupervisorInput): Promise<SupervisorOutput> {
  
  const result = await generateText({
    model: getModel(modelId),
    system: SUPERVISOR_SYSTEM_PROMPT,
    messages,
    tools: {
      callTwinAgent: tool({ ... execute: () => twinAgent(...) }),
      callResearchAgent: tool({ ... execute: () => researchAgent(...) }),
      callRAGAgent: tool({ ... execute: () => ragAgent(...) }),
      callReviewAgent: tool({ ... execute: () => reviewAgent(...) }),
      respondDirect: tool({ ... }), // for simple clarifications
    },
    maxSteps: 6,
    onStepFinish({ stepType, toolCalls, toolResults }) {
      // emit step events for streaming UI
    },
  });

  return { text: result.text, steps: result.steps };
}

const SUPERVISOR_SYSTEM_PROMPT = `
You are the Helix Supervisor Agent for TNBC oncology.

Your job is to understand the user's query and route it to the right specialist agent:
- callTwinAgent: simulation questions, "what if" intervention scenarios, biomarker projections
- callResearchAgent: literature search, trial results, evidence queries (live search)
- callRAGAgent: detailed trial data, guideline references, questions needing full-text context
- callReviewAgent: when another agent's output needs validation or the user asks "is this supported?"
- respondDirect: simple clarifications, off-topic deflections, greetings

For complex queries (e.g. "Add pembrolizumab — what does the evidence say and what does the twin project?"):
  call BOTH callTwinAgent AND callResearchAgent, then callReviewAgent to validate.

Off-topic queries: respond directly with the deflection message.
`;
```

### 4.4 Research Agent (`src/lib/agents/research.ts`)

Pure research agent — searches multiple sources, synthesizes findings.

```typescript
export async function researchAgent({ query, patient, modelId }: ResearchInput) {
  return streamText({
    model: getModel(modelId),
    system: RESEARCH_AGENT_SYSTEM,
    messages: [{ role: 'user', content: query }],
    tools: {
      searchPubMed: searchPubMedTool,
      searchClinicalTrials: searchClinicalTrialsTool,
      searchEuropePMC: searchEuropePMCTool,
      searchRAG: ragSearchTool,        // ← also checks local knowledge base
    },
    maxSteps: 8,  // can search, read results, search again with refined query
  });
}

const RESEARCH_AGENT_SYSTEM = `
You are the Helix Research Agent — a specialist in TNBC oncology literature.

PROCESS:
1. Analyze the query for key terms (drug names, biomarkers, trial names)
2. Search PubMed with specific MeSH-optimized queries
3. Search ClinicalTrials for relevant trials
4. Search local RAG knowledge base for full-text context
5. If results are thin, refine and search again (up to 3 search rounds)
6. Synthesize: cite specific trials, note evidence levels, flag contradictions

PATIENT CONTEXT: ${patientContext}

Always cite: author, journal, year. Note if evidence is low-quality or conflicting.
`;
```

### 4.5 RAG Agent (`src/lib/agents/rag.ts`)

Retrieves from local LanceDB vector store, augments with AI synthesis.

```typescript
export async function ragAgent({ query, patient, modelId }: RAGInput) {
  // Step 1: Retrieve relevant chunks from LanceDB
  const context = await retrieveContext(query, 8);
  
  // Step 2: Generate response grounded in retrieved context
  return streamText({
    model: getModel(modelId),
    system: `You are the Helix RAG Agent. Answer ONLY using the provided document context.
If the context does not contain the answer, say so explicitly — do not fabricate.

RETRIEVED CONTEXT:
${context}

PATIENT: ${patient.name}, Stage ${patient.stage} TNBC`,
    messages: [{ role: 'user', content: query }],
    maxOutputTokens: 600,
  });
}
```

### 4.6 Twin Agent (`src/lib/agents/twin.ts`)

Wraps existing simulation logic with tool-calling capabilities.

```typescript
export async function twinAgent({ patient, stack, deltas, query, modelId }: TwinInput) {
  return streamText({
    model: getModel(modelId),
    system: TWIN_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: query }],
    tools: {
      runSimulation: runSimulationTool,
      compareScenarios: tool({ ... }), // compare multiple stacks
      explainDelta: tool({ ... }),      // explain biomarker change
    },
    maxSteps: 4,
  });
}
```

### 4.7 Review Agent (`src/lib/agents/review.ts`)

Validates other agents' outputs against evidence. Prevents hallucinations.

```typescript
export async function reviewAgent({ claim, evidence, modelId }: ReviewInput) {
  return generateText({
    model: getModel(modelId),
    system: `You are the Helix Review Agent — a clinical fact-checker.
    
Given a claim and supporting evidence, determine:
- SUPPORTED: claim is directly backed by evidence with specific citations
- CONTRADICTED: evidence contradicts the claim — explain why
- UNCERTAIN: evidence is insufficient or conflicting — note gaps

Be strict. If numbers don't match, flag it. If trial population differs from patient, note it.
Return JSON: { verdict: "supported"|"contradicted"|"uncertain", explanation: string, citations: string[] }`,
    messages: [
      { role: 'user', content: `CLAIM: ${claim}\n\nEVIDENCE:\n${evidence}` }
    ],
  });
}
```

### 4.8 New agentic API route (`src/app/api/agent/chat/route.ts`)

This REPLACES `src/app/api/chat/route.ts` but the old route stays untouched for fallback.

```typescript
// POST /api/agent/chat
// Switch useChat transport to this route when Phase 2 is complete

export async function POST(req: Request) {
  const { messages, patient, stack, deltas, modelId } = await req.json();

  const result = supervisorAgent({ messages, patient, stack, deltas, modelId });
  
  // Stream supervisor + sub-agent steps back to UI
  return result.toUIMessageStreamResponse();
}
```

### 4.9 UI changes for agentic step display

Add an **Agent Steps** panel that shows real-time tool calls:

```
[Twin Agent] → runSimulation(pembrolizumab_chemo, 12mo) ✓
[Research Agent] → searchPubMed("pembrolizumab KEYNOTE-522 TNBC") → 8 results ✓
[RAG Agent] → ragSearch("pembrolizumab pCR benefit") → 5 chunks ✓
[Review Agent] → validateClaim(...) → SUPPORTED ✓
```

New component: `src/components/AgentSteps.tsx`

---

## 6. Phase 3 — ElevenLabs Voice (Browser)

### 5.1 New files

```
src/components/VoiceButton.tsx          ← mic capture + STT trigger
src/components/VoicePlayer.tsx          ← audio playback for TTS
src/hooks/useVoice.ts                   ← shared voice state hook

src/app/api/voice/
  transcribe/route.ts                   ← ElevenLabs STT endpoint
  speak/route.ts                        ← ElevenLabs TTS endpoint (streaming audio)
```

### 5.2 STT flow (all chat interfaces)

```
User taps 🎤 in VoiceButton
  → MediaRecorder captures mic audio (WebM/Opus)
  → POST /api/voice/transcribe (binary audio blob)
    → ElevenLabs /v1/speech-to-text (xi-api-key header)
    → Returns: { text: "add pembrolizumab at month 3" }
  → VoiceButton fires onTranscript(text)
  → textarea.value = text (both Dashboard and Research panels)
  → user reviews + hits Enter to send
```

### 5.3 STT API route (`src/app/api/voice/transcribe/route.ts`)

```typescript
export async function POST(req: Request) {
  const formData = await req.formData();
  const audio = formData.get('audio') as File;

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! },
    body: (() => {
      const fd = new FormData();
      fd.append('file', audio, 'audio.webm');
      fd.append('model_id', 'scribe_v1');
      return fd;
    })(),
  });

  const data = await response.json();
  return NextResponse.json({ text: data.text });
}
```

### 5.4 TTS flow (after each assistant message)

```
Assistant message streaming completes (status: streaming → ready)
  → last assistant message text extracted
  → POST /api/voice/speak { text, voiceId }
    → ElevenLabs /v1/text-to-speech/{voiceId}/stream
    → Returns: audio/mpeg stream
  → VoicePlayer receives ReadableStream → Web Audio API plays
  → User can click 🔇 to stop playback
```

### 5.5 TTS API route (`src/app/api/voice/speak/route.ts`)

```typescript
export async function POST(req: Request) {
  const { text, voiceId = '21m00Tcm4TlvDq8ikWAM' } = await req.json(); // Rachel voice

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',   // low-latency model
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    }
  );

  return new Response(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
    },
  });
}
```

### 5.6 VoiceButton component (`src/components/VoiceButton.tsx`)

```tsx
export function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function toggle() {
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'audio.webm');
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
        const { text } = await res.json();
        onTranscript(text);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
    }
  }

  return (
    <button onClick={toggle} className={cn('voice-btn', recording && 'recording')}>
      {recording ? <MicOff /> : <Mic />}
    </button>
  );
}
```

### 5.7 Where VoiceButton appears

- **Dashboard chat composer** — beside the Send button
- **Research panel composer** — beside the Search button
- Both wired to the same `/api/voice/transcribe` route

### 5.8 Auto-TTS toggle

- Gear icon in composer header: "🔊 Auto-speak responses"
- Stored in localStorage `helix-voice-autoplay`
- When enabled: after every assistant message → POST `/api/voice/speak`
- Stop button `⏹` stops current audio immediately

### 5.9 Voice ID choices (ElevenLabs)

| Voice | ID | Use case |
|-------|----|----------|
| Rachel | `21m00Tcm4TlvDq8ikWAM` | Default — calm, professional female |
| Adam   | `pNInz6obpgDQGcFmaJgB` | Professional male |
| Clyde  | `2EiwWnXFnvU5JabPnv8n` | Medical narrator tone |

Selectable in Settings panel.

---

## 7. Phase 4 — Twilio Phone Integration

### 6.1 Architecture

```
Incoming phone call
  → Twilio receives → webhook POST /api/voice/twilio/inbound
  → TwiML: <Stream url="wss://your-domain/api/voice/twilio/stream" />
  → WebSocket at /api/voice/twilio/stream
    → receives 8kHz μ-law audio from caller
    → converts to 16kHz PCM → POST ElevenLabs STT
    → STT transcript → Supervisor Agent (generateText, non-streaming)
    → Agent response text → ElevenLabs TTS (streaming audio)
    → stream TTS audio back through WebSocket to Twilio
    → Twilio plays audio to caller
```

### 6.2 New files for Phase 4

```
src/app/api/voice/twilio/
  inbound/route.ts          ← TwiML webhook for incoming calls
  outbound/route.ts         ← REST endpoint to initiate outbound calls
  stream/route.ts           ← WebSocket handler (μ-law ↔ PCM ↔ ElevenLabs)
  status/route.ts           ← Twilio status callback

src/lib/voice/
  twilio.ts                 ← Twilio client singleton
  audio-convert.ts          ← μ-law ↔ PCM conversion utilities
  conversation-store.ts     ← per-call conversation state (patient context)
```

### 6.3 TwiML Inbound (`src/app/api/voice/twilio/inbound/route.ts`)

```typescript
export async function POST(req: Request) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Welcome to Helix Digital Twin. Please describe the patient scenario or ask about TNBC treatment options.</Say>
  <Connect>
    <Stream url="wss://${process.env.NEXT_PUBLIC_HOST}/api/voice/twilio/stream">
      <Parameter name="patientId" value="default" />
    </Stream>
  </Connect>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
```

### 6.4 WebSocket Stream Handler

Next.js 16 supports WebSocket via `NEXT_RUNTIME=edge` or a standalone Node server.

```typescript
// Pseudo-code for stream handler
export function GET(req: Request) {
  const { socket, response } = upgradeToWebSocket(req);
  
  socket.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    
    if (msg.event === 'media') {
      // Accumulate μ-law audio
      audioBuffer.push(Buffer.from(msg.media.payload, 'base64'));
    }
    
    if (msg.event === 'stop' || silenceDetected) {
      const pcm = muLawToPCM(Buffer.concat(audioBuffer));
      const transcript = await elevenLabsSTT(pcm);
      
      const agentResponse = await supervisorAgent({
        messages: conversationHistory,
        patient: currentPatient,
        // ...
      });
      
      conversationHistory.push(
        { role: 'user', content: transcript },
        { role: 'assistant', content: agentResponse.text }
      );
      
      const audioStream = await elevenLabsTTS(agentResponse.text);
      const muLaw = await pcmToMuLaw(audioStream);
      
      // Send back via Twilio media stream protocol
      socket.send(JSON.stringify({ event: 'media', media: { payload: muLaw.toString('base64') } }));
    }
  };
  
  return response;
}
```

### 6.5 Outbound Call API (`src/app/api/voice/twilio/outbound/route.ts`)

```typescript
// POST /api/voice/twilio/outbound
// Body: { to: "+15551234567", patientId: "xxx" }

export async function POST(req: Request) {
  const { to, patientId } = await req.json();
  
  const call = await twilioClient.calls.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    url: `https://${process.env.NEXT_PUBLIC_HOST}/api/voice/twilio/inbound?patientId=${patientId}`,
    statusCallback: `https://${process.env.NEXT_PUBLIC_HOST}/api/voice/twilio/status`,
  });
  
  return NextResponse.json({ callSid: call.sid, status: call.status });
}
```

### 6.6 UI for Twilio

- Add **Call** button in patient header (phone icon)
- Opens a modal: enter phone number → POST `/api/voice/twilio/outbound`
- Shows call status (ringing → in-progress → completed)
- New route: `/call` — real-time call monitor with transcript display

### 6.7 Twilio requirements

- Twilio account with a phone number
- Public HTTPS endpoint (deploy to Vercel/Railway or use ngrok for dev)
- Twilio webhook must reach `/api/voice/twilio/inbound`

---

## 8. File Map

```
d:\Diya's Stuff\tuff-twin\
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts              ← EXISTING (keep)
│   │   │   ├── agent/
│   │   │   │   └── chat/route.ts          ← NEW Phase 2 (agentic)
│   │   │   ├── rag/
│   │   │   │   ├── ingest/route.ts        ← NEW Phase 1
│   │   │   │   ├── search/route.ts        ← NEW Phase 1
│   │   │   │   └── status/route.ts        ← NEW Phase 1
│   │   │   └── voice/
│   │   │       ├── transcribe/route.ts    ← NEW Phase 3 (STT)
│   │   │       ├── speak/route.ts         ← NEW Phase 3 (TTS)
│   │   │       └── twilio/
│   │   │           ├── inbound/route.ts   ← NEW Phase 4
│   │   │           ├── outbound/route.ts  ← NEW Phase 4
│   │   │           ├── stream/route.ts    ← NEW Phase 4
│   │   │           └── status/route.ts    ← NEW Phase 4
│   │   └── call/
│   │       └── page.tsx                   ← NEW Phase 4 (call monitor UI)
│   ├── components/
│   │   ├── VoiceButton.tsx                ← NEW Phase 3
│   │   ├── VoicePlayer.tsx                ← NEW Phase 3
│   │   ├── AgentSteps.tsx                 ← NEW Phase 2
│   │   └── [all existing] ← UNTOUCHED
│   ├── hooks/
│   │   └── useVoice.ts                    ← NEW Phase 3
│   └── lib/
│       ├── rag/
│       │   ├── vectordb.ts                ← NEW Phase 1 (from mcp-local-rag)
│       │   ├── embedder.ts                ← NEW Phase 1 (from mcp-local-rag)
│       │   ├── chunker.ts                 ← NEW Phase 1 (from mcp-local-rag)
│       │   ├── parser.ts                  ← NEW Phase 1 (from mcp-local-rag)
│       │   ├── store.ts                   ← NEW Phase 1 (singleton)
│       │   ├── ingest.ts                  ← NEW Phase 1
│       │   └── retrieve.ts                ← NEW Phase 1
│       ├── agents/
│       │   ├── tools.ts                   ← NEW Phase 2
│       │   ├── supervisor.ts              ← NEW Phase 2
│       │   ├── research.ts                ← NEW Phase 2 (replaces lib/ai/research.ts)
│       │   ├── rag.ts                     ← NEW Phase 2
│       │   ├── twin.ts                    ← NEW Phase 2 (wraps lib/ai/twin.ts)
│       │   └── review.ts                  ← NEW Phase 2
│       ├── voice/
│       │   ├── twilio.ts                  ← NEW Phase 4
│       │   ├── audio-convert.ts           ← NEW Phase 4
│       │   └── conversation-store.ts      ← NEW Phase 4
│       └── [all existing] ← UNTOUCHED
├── scripts/
│   └── ingest-tnbc-literature.ts          ← NEW Phase 1
└── data/
    ├── rag-lancedb/                        ← NEW Phase 1 (gitignore)
    └── rag-model-cache/                    ← NEW Phase 1 (gitignore)
```

---

## 9. Environment Variables

```bash
# Existing (already in .env.local)
ANTHROPIC_API_KEY=...
MISTRAL_API_KEY=...           # primary Mistral key
MISTRAL_API_KEY_2=...         # fallback key 2 (auto-rotated on auth/quota error)
MISTRAL_API_KEY_3=...         # fallback key 3
GROQ_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
NCBI_API_KEY=...
SEMANTIC_SCHOLAR_API_KEY=...
JWT_SECRET_KEY=...

# Phase 0 — Security (no extra env vars — logic in src/lib/security.ts)

# Phase 1 — RAG
RAG_DB_PATH=./data/rag-lancedb
RAG_MODEL_CACHE=./data/rag-model-cache

# Phase 3 — ElevenLabs (key added to .env.local)
ELEVENLABS_API_KEY=...        # ✓ configured
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Phase 4 — Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
NEXT_PUBLIC_HOST=your-deployed-domain.com   # or ngrok URL for dev
```

---

## 10. Dependency List

### Phase 1 (RAG)
```bash
# Already in mcp-local-rag — install in helix project:
npm install @lancedb/lancedb @huggingface/transformers @langchain/textsplitters
npm install pdf-parse mammoth                     # document parsing
```

### Phase 2 (Agents)
```bash
# Already installed via ai@6.x — no new deps
# tool() and maxSteps are built into ai@6.x
```

### Phase 3 (ElevenLabs)
```bash
# No SDK needed — use native fetch to ElevenLabs REST API
# Browser: MediaRecorder API (built-in, no install)
```

### Phase 4 (Twilio)
```bash
npm install twilio
npm install @types/twilio --save-dev
```

---

## Implementation Order

| Phase | Est. effort | Blocker |
|-------|-------------|---------|
| 1a — RAG store + retrieve | 1 day | `RAG_DB_PATH` set, papers PDF available |
| 1b — Ingest API + script | 0.5 day | Phase 1a done |
| 2a — Tool definitions | 0.5 day | None |
| 2b — Research + RAG agents | 1 day | Phase 1 done |
| 2c — Supervisor + Review agents | 1 day | Phase 2b done |
| 2d — `/api/agent/chat` route | 0.5 day | Phase 2c done |
| 3a — STT button + transcribe API | 0.5 day | `ELEVENLABS_API_KEY` |
| 3b — TTS player + speak API | 0.5 day | `ELEVENLABS_API_KEY` |
| 4a — Twilio inbound + TwiML | 1 day | `TWILIO_*` keys + public URL |
| 4b — WebSocket stream handler | 2 days | Phase 3 done, Phase 4a done |
| 4c — Outbound call UI | 0.5 day | Phase 4b done |

**Total: ~8.5 days**

Each phase is additive — existing functionality untouched until the new route is tested and switched over.
