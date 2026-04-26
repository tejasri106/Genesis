"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GitCompare,
  HelpCircle,
  Loader2,
  Mic,
  Notebook,
  Pause,
  Pill,
  Play,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  BookOpen,
  ExternalLink,
  TrendingUp,
  X,
  Square,
} from "lucide-react";
import {
  interventions,
  simulate,
  simulateCombo,
  type SimulationPoint,
} from "@/lib/mockData";
import { METRICS, useAppStore } from "@/lib/store";
import { SimulationChart, type ChartSeries } from "@/components/SimulationChart";
import { MetricCard } from "@/components/MetricCard";
import { parseInterventions, whyChanged } from "@/lib/agent";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ModelSelector } from "@/components/ModelSelector";
import { AgentSteps, TOOL_META, toolNameFromType } from "@/components/AgentSteps";
import { VoiceButton } from "@/components/VoiceButton";
import { VoicePlayer } from "@/components/VoicePlayer";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const DURATION_OPTIONS = [6, 12, 18, 24] as const;

function computeDeltas(
  patient: ReturnType<typeof useAppStore>["patient"],
  ids: string[],
  months: number
) {
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

export default function Dashboard() {
  const {
    patient,
    stack,
    setStack,
    toggleStack,
    activeMetric,
    setActiveMetric,
    runScenario,
    scenarios,
    addFinding,
    months,
    setMonths,
    selectedModel,
    setSelectedModel,
    clinician,
  } = useAppStore();

  const [input, setInput] = useState("");
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "transcribing">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatScroll = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<"sim" | "research" | "notebook">("sim");
  const [month, setMonth] = useState(months);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const seedText = `Digital twin loaded for ${patient.name} (Stage ${patient.stage} TNBC). Toggle interventions or describe a scenario in chat. I'll project biomarker trajectories using published TNBC trial data anchored to KEYNOTE-522, OlympiAD, ASCENT, and CREATE-X.`;

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agent/chat" }),
    messages: [
      {
        id: "seed",
        role: "assistant",
        parts: [{ type: "text", text: seedText }],
      } as UIMessage,
    ],
  });

  useEffect(() => {
    setMessages([
      {
        id: "seed",
        role: "assistant",
        parts: [{ type: "text", text: `Digital twin loaded for ${patient.name} (Stage ${patient.stage} TNBC). Toggle interventions or describe a scenario in chat. I'll project biomarker trajectories using published TNBC trial data.` }],
      } as UIMessage,
    ]);
    setMonth(months);
  }, [patient.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMonth(months);
  }, [months]);

  useEffect(() => {
    chatScroll.current?.scrollTo({
      top: chatScroll.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const clampedMonth = Math.min(month, months);

  const baseline = useMemo<SimulationPoint[]>(
    () => simulate(patient, "baseline", months),
    [patient, months]
  );
  const combo = useMemo<SimulationPoint[]>(
    () => simulateCombo(patient, stack, months),
    [patient, stack, months]
  );

  const stackLabel =
    stack
      .map((id) => interventions.find((i) => i.id === id)?.label ?? id)
      .join(" + ") || "Standard of Care";

  const series: ChartSeries[] = useMemo(() => {
    const arr: ChartSeries[] = [
      {
        id: "baseline",
        label: "Standard of Care",
        data: baseline,
        color: "var(--chart-baseline)",
        dashed: true,
      },
      {
        id: "combo",
        label: stackLabel,
        data: combo,
        color: "var(--chart-intervention)",
      },
    ];
    if (compareOpen) {
      const others = scenarios
        .filter((s) => s.patientId === patient.id)
        .slice(0, 3)
        .map((s, i) => ({
          id: s.id,
          label: s.interventionIds
            .map(
              (id) => interventions.find((iv) => iv.id === id)?.label ?? id
            )
            .join(" + "),
          data: s.data,
          color:
            i === 0
              ? "var(--chart-alternate)"
              : i === 1
              ? "oklch(0.6 0.15 320)"
              : "oklch(0.65 0.14 140)",
        }));
      arr.push(...others);
    }
    return arr;
  }, [baseline, combo, stackLabel, compareOpen, scenarios, patient.id]);

  const activeMetricDef = METRICS.find((m) => m.key === activeMetric) ?? METRICS[0];
  const currentB = baseline[clampedMonth];
  const currentC = combo[clampedMonth];

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last > 180) {
        last = now;
        setMonth((m) => {
          if (m >= months) {
            setPlaying(false);
            return months;
          }
          return m + 1;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, months]);

  const isStreaming = status === "streaming" || status === "submitted";
  const isReady = status === "ready";

  async function send() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const parsed = parseInterventions(text);
    const nextStack = parsed.length ? parsed : stack;
    if (parsed.length) setStack(parsed);

    const deltas = computeDeltas(patient, nextStack, months);

    try {
      await sendMessage(
        { text },
        {
          body: {
            patient,
            stack: nextStack,
            deltas,
            modelId: selectedModel,
            clinician,
          },
        }
      );
    } catch (err) {
      toast.error("Agent error", {
        description: err instanceof Error ? err.message : "The model failed to respond. Try a different model or retry.",
      });
    }
  }

  async function runAndSave() {
    const s = await runScenario(stack);
    setMessages((prev) => [
      ...prev,
      {
        id: `run_${s.id}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `Scenario saved to Notebook. Compare it on the chart using the Compare button. (Scenario ID ${s.id.slice(-6)} stored with ${months}-month TNBC trajectory.)`,
          },
        ],
      } as UIMessage,
    ]);
  }

  const suggestions = useMemo(
    () =>
      interventions
        .filter((i) => !stack.includes(i.id))
        .slice(0, 3)
        .map((i) => ({
          id: i.id,
          label: i.label,
          reason:
            i.id === "parp_inhibitor" &&
            (patient.brca1Mutation || patient.brca2Mutation)
              ? "BRCA mutation detected — eligible"
              : i.id === "pembrolizumab_chemo" &&
                (patient.pdl1Cps ?? 0) >= 10
              ? `PD-L1 CPS ${patient.pdl1Cps} — immunotherapy signal`
              : "alternative or adjunct",
        })),
    [stack, patient]
  );

  return (
    <div className="h-[calc(100vh-110px)]">
      <ResizablePanelGroup
        orientation="horizontal"
        className="rounded-2xl border border-border bg-card shadow-soft"
      >
        {/* LEFT — chat */}
        <ResizablePanel defaultSize={42} minSize={30}>
          <div className="flex h-full flex-col">
            {/* Patient header */}
            <div className="border-b border-border bg-gradient-hero px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-soft">
                  {patient.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {patient.name}, {patient.age}
                    <span className="text-muted-foreground">
                      {" "}
                      · {patient.condition}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {patient.brca1Mutation && (
                      <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                        BRCA1+
                      </span>
                    )}
                    {patient.brca2Mutation && (
                      <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                        BRCA2+
                      </span>
                    )}
                    {patient.pdl1Cps !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          patient.pdl1Cps >= 10
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        PD-L1 CPS {patient.pdl1Cps}
                      </span>
                    )}
                    <span className="rounded-full bg-card/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      Ki-67 {patient.ki67Percent}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active stack + all interventions */}
            <div className="border-b border-border px-4 py-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Activity className="h-3 w-3" />
                Active stack
              </div>
              {stack.length === 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  No intervention stacked. Toggle below to add.
                </p>
              )}
              {stack.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {stack.map((id) => {
                    const i = interventions.find((iv) => iv.id === id);
                    if (!i) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-accent/40 px-2 py-0.5 text-[11px] font-medium"
                      >
                        <Pill className="h-3 w-3 text-primary" />
                        {i.label}
                        <button
                          onClick={() => toggleStack(id)}
                          className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                  <button
                    onClick={runAndSave}
                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-gradient-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-soft transition-smooth hover:opacity-90"
                  >
                    <Plus className="h-3 w-3" /> Save run
                  </button>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {interventions.map((i) => {
                  const active = stack.includes(i.id);
                  return (
                    <button
                      key={i.id}
                      onClick={() => toggleStack(i.id)}
                      title={i.description}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-smooth",
                        active
                          ? "border-primary/60 bg-accent/50 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      )}
                    >
                      <Pill
                        className={cn(
                          "h-2.5 w-2.5",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      {i.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Messages */}
            <div
              ref={chatScroll}
              className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            >
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-primary px-3.5 py-2 text-sm text-primary-foreground shadow-soft">
                      {m.parts
                        .filter((p): p is { type: "text"; text: string } => p.type === "text")
                        .map((p) => p.text)
                        .join("")}
                    </div>
                  </div>
                ) : (
                  <StreamingBubble
                    key={m.id}
                    message={m}
                    isStreaming={isStreaming && m.id === messages.at(-1)?.id}
                    suggestions={m.id === messages.at(-1)?.id && isReady ? suggestions : []}
                    onSuggest={(id) => toggleStack(id)}
                  />
                )
              )}
              {/* Live voice indicator — shows in message list while mic is active */}
              {voiceState !== "idle" && (
                <div className="flex justify-end">
                  <div className="flex items-center gap-2.5 rounded-2xl rounded-br-sm bg-gradient-primary px-4 py-2.5 text-sm text-primary-foreground shadow-soft">
                    {voiceState === "recording" ? (
                      <>
                        {/* Animated sound wave bars */}
                        <span className="flex items-end gap-[3px] h-4">
                          {[1, 2, 3, 4, 3].map((h, i) => (
                            <span
                              key={i}
                              className="w-[3px] rounded-full bg-primary-foreground/80 animate-pulse"
                              style={{
                                height: `${h * 4}px`,
                                animationDelay: `${i * 100}ms`,
                                animationDuration: "600ms",
                              }}
                            />
                          ))}
                        </span>
                        <span className="font-medium">Listening…</span>
                        <Mic className="h-3.5 w-3.5 opacity-80" />
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin opacity-80" />
                        <span className="font-medium">Transcribing…</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {isStreaming && messages.at(-1)?.role !== "assistant" && (
                <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Supervisor routing…
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border bg-card p-3">
              {/* Model selector row */}
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  AI Model
                </span>
                <ModelSelector value={selectedModel} onChange={setSelectedModel} />
              </div>

              {/* Textarea composer */}
              <div className="rounded-2xl border border-border bg-background transition-smooth focus-within:border-primary/60 focus-within:shadow-glow">
                <div className="flex items-start gap-2 px-3 pt-3">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      const el = e.target;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 80) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Ask the Twin: e.g. 'What if we add pembrolizumab?' (Shift+Enter for newline)"
                    rows={1}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex items-center justify-between px-3 pb-2 pt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {isStreaming ? "Streaming…" : "Enter to send · Shift+Enter for newline"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {!isStreaming && (
                      <VoiceButton
                        onStateChange={setVoiceState}
                        onError={(msg) =>
                          toast.error("Voice transcription failed", {
                            description: msg,
                          })
                        }
                        onTranscript={async (t) => {
                          setVoiceState("idle");
                          const parsed = parseInterventions(t);
                          const nextStack = parsed.length ? parsed : stack;
                          if (parsed.length) setStack(parsed);
                          const deltas = computeDeltas(patient, nextStack, months);
                          await sendMessage(
                            { text: t },
                            { body: { patient, stack: nextStack, deltas, modelId: selectedModel, clinician } }
                          );
                        }}
                        disabled={isStreaming}
                      />
                    )}
                    {isStreaming ? (
                      <button
                        onClick={() => stop()}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs font-medium text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Square className="h-3 w-3" /> Stop
                      </button>
                    ) : (
                      <button
                        onClick={send}
                        disabled={!input.trim()}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground transition-smooth hover:opacity-90 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick prompts */}
              <div className="mt-2 flex flex-wrap gap-1">
                {[
                  "Add pembrolizumab + chemo",
                  "What if BRCA1+ and PARP inhibitor?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* RIGHT — tabs */}
        <ResizablePanel defaultSize={58} minSize={35}>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as typeof tab)}
            className="flex h-full flex-col"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <TabsList className="bg-transparent p-0">
                <TabsTrigger value="sim" className="gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Simulation
                </TabsTrigger>
                <TabsTrigger value="research" className="gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Research
                </TabsTrigger>
                <TabsTrigger value="notebook" className="gap-1.5">
                  <Notebook className="h-3.5 w-3.5" /> Notebook
                </TabsTrigger>
              </TabsList>
              {tab === "sim" && (
                <div className="flex items-center gap-1.5">
                  <div className="flex overflow-hidden rounded-lg border border-border">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setMonths(d)}
                        className={cn(
                          "px-2 py-1 text-[11px] font-medium transition-smooth",
                          months === d
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {d}mo
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCompareOpen((v) => !v)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-smooth",
                      compareOpen
                        ? "border-primary/60 bg-accent/40 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    <GitCompare className="h-3.5 w-3.5" /> Compare
                  </button>
                  <button
                    onClick={() => setMonth(0)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:border-primary/40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (clampedMonth >= months) setMonth(0);
                      setPlaying((p) => !p);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft hover:opacity-90"
                  >
                    {playing ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    {playing ? "Pause" : "Play"}
                  </button>
                </div>
              )}
            </div>

            <TabsContent value="sim" className="m-0 flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {METRICS.map((m) => (
                    <MetricCard
                      key={m.key}
                      label={m.label}
                      unit={m.unit}
                      baseline={(currentB?.[m.key] as number) ?? 0}
                      intervention={(currentC?.[m.key] as number) ?? 0}
                      betterDirection={m.betterDirection}
                      active={activeMetric === m.key}
                      onClick={() => setActiveMetric(m.key)}
                    />
                  ))}
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">
                        {activeMetricDef.label} trajectory
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {stackLabel} vs Standard of Care · month{" "}
                        {clampedMonth}/{months}
                      </div>
                    </div>
                    <button
                      onClick={() => setWhyOpen((v) => !v)}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-card px-2 text-[11px] font-medium text-foreground hover:border-primary/40"
                    >
                      <HelpCircle className="h-3 w-3 text-primary" />
                      Why did this change?
                    </button>
                  </div>

                  <SimulationChart
                    metric={activeMetricDef}
                    series={series}
                    currentMonth={clampedMonth}
                    height={260}
                  />

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Month 0</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {clampedMonth}/{months}
                      </span>
                      <span>Month {months}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={months}
                      value={clampedMonth}
                      onChange={(e) => setMonth(parseInt(e.target.value))}
                      className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)]"
                    />
                  </div>

                  {whyOpen && currentB && currentC && (
                    <WhyChangedPanel
                      metric={activeMetric}
                      base={currentB}
                      comp={currentC}
                      stack={stack}
                      onClose={() => setWhyOpen(false)}
                      onSave={(title, body) =>
                        addFinding({
                          patientId: patient.id,
                          patientName: patient.name,
                          title,
                          body,
                          labels: ["why", activeMetric, ...stack],
                          kind: "auto",
                        })
                      }
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="research" className="m-0 flex-1 overflow-y-auto p-4">
              <ResearchPanel stack={stack} patient={patient} />
            </TabsContent>

            <TabsContent value="notebook" className="m-0 flex-1 overflow-y-auto p-4">
              <NotebookTab />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-sm">{children}</li>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>,
  h1: ({ children }) => <h1 className="mb-1 text-sm font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1 text-sm font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>,
};

function StreamingBubble({
  message,
  isStreaming,
  suggestions,
  onSuggest,
}: {
  message: UIMessage;
  isStreaming: boolean;
  suggestions: { id: string; label: string; reason: string }[];
  onSuggest: (id: string) => void;
}) {
  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

  // Fallback: if supervisor produced no text (or only whitespace), surface the last
  // completed tool's output directly. AI SDK v6 may wrap output as { type, value }
  // or as a plain string — handle both.
  function extractOutput(raw: unknown): string {
    if (typeof raw === "string") return raw.trim();
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      const v = o.value ?? o.text ?? o.result ?? o.content ?? "";
      if (typeof v === "string") return v.trim();
    }
    return "";
  }

  const toolOutputText = !text.trim()
    ? (() => {
        const parts = (message.parts ?? []) as Array<{ type: string; state?: string; output?: unknown }>;
        const resultParts = parts
          .filter((p) => p.type.startsWith("tool-") && p.state === "output-available")
          .reverse();
        for (const part of resultParts) {
          const out = extractOutput(part.output);
          if (out) return out;
        }
        return "";
      })()
    : "";

  const displayText = text || toolOutputText;

  // Derive which agents were activated for the route label
  const activatedAgents = [...new Set(
    (message.parts ?? [])
      .filter((p) => typeof p.type === "string" && p.type.startsWith("tool-"))
      .map((p) => {
        const name = toolNameFromType((p as { type: string }).type);
        return TOOL_META[name]?.label ?? name;
      })
  )];
  const routeLabel = activatedAgents.length > 0
    ? activatedAgents.join(" → ")
    : "Genesis";

  // ── Security / policy warnings ──────────────────────────────────────────────
  if (displayText.startsWith("[GENESIS-SECURITY]")) {
    const body = displayText.replace("[GENESIS-SECURITY]", "").trim();
    return (
      <div className="flex gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-destructive/40 bg-destructive/8 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
            <ShieldAlert className="h-3 w-3" /> HIPAA / Privacy Policy
          </div>
          <div className="text-sm leading-relaxed text-destructive/90">
            <ReactMarkdown components={MD_COMPONENTS}>{body}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  if (displayText.startsWith("[GENESIS-OFF-TOPIC]")) {
    const body = displayText.replace("[GENESIS-OFF-TOPIC]", "").trim();
    return (
      <div className="flex gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-warning/30 bg-warning/8 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-warning-foreground">
            <AlertTriangle className="h-3 w-3" /> Out of scope
          </div>
          <p className="text-sm leading-relaxed text-foreground">{body}</p>
        </div>
      </div>
    );
  }

  // ── Normal assistant bubble ─────────────────────────────────────────────────
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-sm border border-border bg-background/80 p-3">
          {/* Route header: which agents fired + speak button */}
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Activity className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate">{routeLabel}</span>
            {displayText && !isStreaming && <VoicePlayer text={displayText} />}
          </div>

          {/* Inline agent step pills */}
          <AgentSteps message={message} isStreaming={isStreaming} />

          {/* Response text — green tint while streaming, normal when done */}
          {displayText && (
            <div
              className={cn(
                "text-sm leading-relaxed transition-colors",
                isStreaming ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
              )}
            >
              <ReactMarkdown components={MD_COMPONENTS}>{displayText}</ReactMarkdown>
            </div>
          )}

          {/* Waiting indicator while tool is running but no text yet */}
          {!displayText && isStreaming && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
              <span>Agent working…</span>
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSuggest(s.id)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-smooth hover:border-primary/40 hover:shadow-soft"
                title={s.reason}
              >
                <Pill className="h-3 w-3 text-primary" />+ {s.label}
                <span className="text-muted-foreground">· {s.reason}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </span>
  );
}

function WhyChangedPanel({
  metric,
  base,
  comp,
  stack,
  onClose,
  onSave,
}: {
  metric: "ca153" | "tumorBurdenScore" | "dfsProbability";
  base: SimulationPoint;
  comp: SimulationPoint;
  stack: string[];
  onClose: () => void;
  onSave: (title: string, body: string) => void;
}) {
  const why = whyChanged(metric, base, comp, stack);
  const metricLabel = METRICS.find((m) => m.key === metric)?.label ?? metric;
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-accent/20 p-3 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <HelpCircle className="h-3.5 w-3.5" /> Why {metricLabel} changed
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="mt-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Biological mechanism
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-foreground">
          {why.biological}
        </p>
      </div>
      {why.evidence.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Supporting evidence
          </div>
          <ul className="mt-1 space-y-1">
            {why.evidence.map((e, i) => (
              <li
                key={i}
                className="flex gap-1.5 text-[11px] text-muted-foreground"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <button
          onClick={() =>
            onSave(
              `Why ${metricLabel} changed under ${stack.join(" + ") || "baseline"}`,
              why.biological
            )
          }
          className="text-[11px] font-medium text-primary hover:underline"
        >
          Save to notebook →
        </button>
      </div>
    </div>
  );
}

function ResearchPanel({
  stack,
  patient,
}: {
  stack: string[];
  patient: ReturnType<typeof useAppStore>["patient"];
}) {
  const { selectedModel, setSelectedModel } = useAppStore();
  const [resMessages, setResMessages] = useState<
    {
      id: string;
      role: "user" | "assistant";
      text?: string;
      summary?: string;
      synthesis?: string;
      papers?: {
        id: string;
        title: string;
        authors: string;
        journal: string;
        year: number;
        relevance: number;
        url?: string;
      }[];
    }[]
  >(() => [
    {
      id: "m0",
      role: "assistant",
      summary: `Research agent ready. Ask about TNBC treatments, trial results, or biomarker evidence for ${patient.name}.`,
    },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [resMessages, loading]);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setResMessages((m) => [
      ...m,
      { id: `u_${Date.now()}`, role: "user", text: q },
    ]);
    setText("");
    setLoading(true);

    try {
      const { fetchResearchSearch } = await import("@/lib/api");
      const result = await fetchResearchSearch({ query: q, patient, modelId: selectedModel });
      if (result) {
        setResMessages((m) => [
          ...m,
          {
            id: `a_${Date.now()}`,
            role: "assistant",
            summary: result.summary,
            synthesis: result.synthesis,
            papers: result.papers.slice(0, 4).map((p) => ({
              id: p.id,
              title: p.title,
              authors: p.authors,
              journal: p.journal,
              year: p.year,
              relevance: p.relevance,
              url: p.url,
            })),
          },
        ]);
      } else {
        setResMessages((m) => [
          ...m,
          {
            id: `a_${Date.now()}`,
            role: "assistant",
            summary:
              "Research search unavailable. Please check your API connection.",
          },
        ]);
      }
    } catch {
      setResMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          summary: "Research search failed. Please try again.",
        },
      ]);
    }
    setLoading(false);
  }

  const suggestions = [
    "KEYNOTE-522 pembrolizumab neoadjuvant TNBC",
    `PARP inhibitor ${patient.brca1Mutation || patient.brca2Mutation ? "BRCA mutated" : "TNBC"} outcomes`,
    "Sacituzumab govitecan ASCENT metastatic",
    "CA 15-3 biomarker TNBC treatment response",
  ];

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Model selector row */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          Research · PubMed + EuropePMC + ClinicalTrials
        </div>
        <ModelSelector value={selectedModel} onChange={setSelectedModel} />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto">
        {resMessages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-primary px-3.5 py-2 text-sm text-primary-foreground shadow-soft">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {m.synthesis && (
                  <div className="rounded-xl border border-primary/20 bg-accent/20 p-3">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Evidence synthesis
                    </div>
                    <div className="text-xs leading-relaxed text-foreground">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          ul: ({ children }) => <ul className="mb-1.5 ml-3 list-disc space-y-0.5">{children}</ul>,
                          li: ({ children }) => <li>{children}</li>,
                        }}
                      >
                        {m.synthesis}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                {m.summary && (
                  <div className="rounded-2xl rounded-tl-sm border border-border bg-background/80 p-3 text-sm text-foreground">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        ul: ({ children }) => <ul className="mb-1.5 ml-3 list-disc space-y-0.5">{children}</ul>,
                        li: ({ children }) => <li>{children}</li>,
                      }}
                    >
                      {m.summary}
                    </ReactMarkdown>
                  </div>
                )}
                {m.papers && m.papers.length > 0 && (
                  <div className="space-y-2">
                    {m.papers.map((p) => (
                      <article
                        key={p.id}
                        className="rounded-xl border border-border bg-card p-3"
                      >
                        <h4 className="text-sm font-semibold leading-snug">
                          {p.title}
                        </h4>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {p.authors} · {p.journal} · {p.year}
                        </div>
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                          >
                            Open paper <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {loading && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Research agent
            retrieving…
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
        className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 transition-smooth focus-within:border-primary/60"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search TNBC literature…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-3 w-3" />
        </button>
      </form>
    </div>
  );
}

function NotebookTab() {
  const { findings, removeFinding, generateSummary, scenarios } = useAppStore();
  const [generating, setGenerating] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {findings.length} entries · {scenarios.length} runs
        </div>
        <button
          onClick={async () => {
            setGenerating(true);
            await generateSummary();
            setGenerating(false);
          }}
          disabled={generating || scenarios.length === 0}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-card px-2 text-[11px] font-medium hover:border-primary/40 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 text-primary" />
          )}
          Analyze experiments
        </button>
      </div>
      {findings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 opacity-40" />
          No findings yet. Save runs from chat to populate the notebook.
        </div>
      ) : (
        findings.slice(0, 8).map((f) => (
          <article
            key={f.id}
            className="group rounded-xl border border-border bg-card p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {f.kind} · {new Date(f.createdAt).toLocaleTimeString()}
              </div>
              <button
                onClick={() => removeFinding(f.id)}
                className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-1 text-sm font-semibold">{f.title}</div>
            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">
              {f.body}
            </p>
          </article>
        ))
      )}
    </div>
  );
}
