"use client";

import { useMemo, useState } from "react";
import { Notebook, Plus, Sparkles, Tag, Trash2, X, Loader2, FileText, Wand2, User } from "lucide-react";
import { useAppStore, type Finding } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "all", label: "All" },
  { id: "auto", label: "Auto findings" },
  { id: "summary", label: "AI summaries" },
  { id: "note", label: "My notes" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function NotebookPage() {
  const { findings, removeFinding, addFinding, generateSummary, patient, scenarios } = useAppStore();
  const [tab, setTab] = useState<TabId>("all");
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    findings.forEach((f) => f.labels.forEach((l) => set.add(l)));
    return Array.from(set);
  }, [findings]);

  const filtered = findings
    .filter((f) => (tab === "all" ? true : f.kind === tab))
    .filter((f) => (labelFilter ? f.labels.includes(labelFilter) : true));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Notebook className="h-3.5 w-3.5" />
            Long-term memory
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Notebook</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Key findings auto-extracted from every simulation, plus your own notes and
            AI-generated summaries across past experiments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setGenerating(true);
              await generateSummary();
              setGenerating(false);
              setTab("summary");
            }}
            disabled={generating || scenarios.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-smooth hover:border-primary/40 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5 text-primary" />
            )}
            Analyze my experiments
          </button>
          <button
            onClick={() => setComposing(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft transition-smooth hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New note
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-soft">
        {TABS.map((t) => {
          const count =
            t.id === "all" ? findings.length : findings.filter((f) => f.kind === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-smooth",
                tab === t.id
                  ? "bg-accent/60 text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {allLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="h-3 w-3 text-muted-foreground" />
          <button
            onClick={() => setLabelFilter(null)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] transition-smooth",
              !labelFilter
                ? "border-primary/60 bg-accent/40 text-foreground"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            all labels
          </button>
          {allLabels.map((l) => (
            <button
              key={l}
              onClick={() => setLabelFilter(l === labelFilter ? null : l)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] transition-smooth",
                labelFilter === l
                  ? "border-primary/60 bg-accent/40 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto h-6 w-6 opacity-60" />
            <p className="mt-2">
              No entries yet. Run a simulation on the Dashboard or add a manual note.
            </p>
          </div>
        ) : (
          filtered.map((f) => <Entry key={f.id} f={f} onRemove={() => removeFinding(f.id)} />)
        )}
      </div>

      {composing && (
        <NoteComposer
          patientId={patient.id}
          patientName={patient.name}
          onClose={() => setComposing(false)}
          onSubmit={(title, body, labels) => {
            addFinding({
              patientId: patient.id,
              patientName: patient.name,
              title,
              body,
              labels,
              kind: "note",
            });
            setComposing(false);
          }}
        />
      )}
    </div>
  );
}

function Entry({ f, onRemove }: { f: Finding; onRemove: () => void }) {
  const kindStyle = {
    auto: { color: "bg-primary/15 text-primary", icon: <Sparkles className="h-3 w-3" />, label: "Auto" },
    summary: { color: "bg-warning/20 text-warning-foreground", icon: <Wand2 className="h-3 w-3" />, label: "Summary" },
    note: { color: "bg-success/15 text-success", icon: <FileText className="h-3 w-3" />, label: "Note" },
  }[f.kind];

  return (
    <article className="group rounded-2xl border border-border bg-card p-4 shadow-soft transition-smooth hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              kindStyle.color
            )}
          >
            {kindStyle.icon}
            {kindStyle.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
            <User className="h-2.5 w-2.5" />
            {f.patientName}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {new Date(f.createdAt).toLocaleString()}
          </span>
        </div>
        <button
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground opacity-0 transition-smooth hover:text-destructive group-hover:opacity-100"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground">{f.title}</h3>
      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
        {f.body}
      </p>
      {f.labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {f.labels.map((l) => (
            <span
              key={l}
              className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function NoteComposer({
  onClose,
  onSubmit,
  patientName,
}: {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSubmit: (title: string, body: string, labels: string[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [labels, setLabels] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">New clinician note · {patientName}</div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Pembrolizumab + chemo showed strongest DFS gain)"
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Write your observation or hypothesis…"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
        />
        <input
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
          placeholder="Comma-separated labels (e.g. hypothesis, pembrolizumab)"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/60"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            Cancel
          </button>
          <button
            disabled={!title || !body}
            onClick={() =>
              onSubmit(
                title,
                body,
                labels
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .concat(["note"])
              )
            }
            className="rounded-lg bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-soft disabled:opacity-50"
          >
            Save to notebook
          </button>
        </div>
      </div>
    </div>
  );
}
