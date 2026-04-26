"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Database, ExternalLink, Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { fetchResearchSearch, type ResearchPaper, type ActiveTrial } from "@/lib/api";
import { useAppStore } from "@/lib/store";

type RMsg = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  summary?: string;
  synthesis?: string;
  papers?: ResearchPaper[];
  trials?: ActiveTrial[];
  citationNote?: string;
};

const SUGGESTIONS = [
  "KEYNOTE-522 pembrolizumab neoadjuvant TNBC",
  "PARP inhibitor BRCA mutated breast cancer outcomes",
  "Sacituzumab govitecan ASCENT metastatic TNBC",
  "CA 15-3 biomarker treatment response breast cancer",
  "Adjuvant capecitabine CREATE-X residual TNBC",
];

export default function ResearchPage() {
  const { patient } = useAppStore();
  const [messages, setMessages] = useState<RMsg[]>([
    {
      id: "m0",
      role: "assistant",
      summary: "Hi — I'm the Research Agent. I'm linked to PubMed, EuropePMC, and ClinicalTrials.gov. Ask me about TNBC treatments, trial results, or biomarker evidence. I'll retrieve literature and synthesize findings in the context of your active patient.",
      citationNote: "Sources: PubMed · EuropePMC · ClinicalTrials.gov",
    },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setMessages((m) => [...m, { id: `u_${Date.now()}`, role: "user", text: q }]);
    setText("");
    setLoading(true);

    const result = await fetchResearchSearch({ query: q, patient });

    if (result) {
      setMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          summary: result.summary,
          synthesis: result.synthesis,
          papers: result.papers,
          trials: result.trials,
          citationNote: `${result.papers.length} paper${result.papers.length !== 1 ? "s" : ""} · ${result.trials?.length ?? 0} trial${(result.trials?.length ?? 0) !== 1 ? "s" : ""} retrieved`,
        },
      ]);
    } else {
      setMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          summary: "Research search unavailable. Check API connection or try again.",
        },
      ]);
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-110px)] max-w-3xl flex-col">
      <header className="mb-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          Research chat · Active patient: {patient.name}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Ask the Research Agent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live literature retrieval + AI synthesis from PubMed, EuropePMC, and ClinicalTrials.gov.
        </p>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-soft"
      >
        {messages.map((m) =>
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
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      <MessageSquare className="h-3 w-3" /> Evidence synthesis
                    </div>
                    <p className="text-xs leading-relaxed text-foreground">{m.synthesis}</p>
                  </div>
                )}
                {m.summary && (
                  <div className="rounded-2xl rounded-tl-sm border border-border bg-background/80 p-3 text-sm text-foreground">
                    {m.summary}
                  </div>
                )}
                {m.papers && m.papers.length > 0 && (
                  <div className="space-y-2">
                    {m.papers.slice(0, 5).map((p) => (
                      <PaperRow key={p.id} p={p} />
                    ))}
                  </div>
                )}
                {m.trials && m.trials.length > 0 && (
                  <div className="space-y-1.5">
                    {m.trials.map((t) => (
                      <div key={t.nctId} className="rounded-xl border border-border bg-card p-2.5 text-[11px]">
                        <div className="font-semibold text-foreground">{t.title}</div>
                        <div className="mt-0.5 text-muted-foreground">
                          {t.nctId} · {t.status} · Phase {t.phase.join("/")}
                          <a
                            href={`https://clinicaltrials.gov/study/${t.nctId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 inline-flex items-center gap-0.5 text-primary hover:underline"
                          >
                            View trial <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {m.citationNote && (
                  <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                    <Database className="h-3 w-3" /> {m.citationNote}
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {loading && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Research Agent retrieving and synthesizing…
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(text); }}
        className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft transition-smooth focus-within:border-primary/60"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about TNBC treatments, trials, biomarkers…"
          className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground transition-smooth hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

function PaperRow({ p }: { p: ResearchPaper }) {
  return (
    <article className="rounded-xl border border-border bg-card p-3 transition-smooth hover:border-primary/30">
      <h4 className="text-sm font-semibold leading-snug">{p.title}</h4>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {p.authors} · <span className="italic">{p.journal}</span> · {p.year}
      </div>
      {p.summary && p.summary !== "See full text." && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.summary}</p>
      )}
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
  );
}
