"use client";

import { useState, useEffect, useRef } from "react";
import { Volume2, Play, Square, Loader2, Mic, Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TTS_VOICE_KEY = "genesis-tts-voice";

interface Voice {
  voiceId: string;
  name: string;
  category: string;
  gender: string;
  accent: string;
  isBrowser?: boolean;
}

const PREVIEW_TEXT =
  "Genesis is an AI clinical decision support agent for triple-negative breast cancer oncology. I assist reviewing clinicians with simulation analysis and evidence synthesis.";

function useBrowserVoices(): Voice[] {
  const [voices, setVoices] = useState<Voice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () =>
      setVoices(
        window.speechSynthesis.getVoices().map((v) => ({
          voiceId: `browser:${v.name}`,
          name: v.name,
          category: "browser",
          gender: "",
          accent: v.lang,
          isBrowser: true,
        }))
      );
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

function speakBrowserPreview(voiceName: string, onEnd: () => void): () => void {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(PREVIEW_TEXT);
  const match = window.speechSynthesis.getVoices().find((v) => v.name === voiceName);
  if (match) utt.voice = match;
  utt.onend = onEnd;
  utt.onerror = onEnd;
  window.speechSynthesis.speak(utt);
  return () => window.speechSynthesis.cancel();
}

export default function SettingsPage() {
  const [remoteVoices, setRemoteVoices] = useState<Voice[]>([]);
  const browserVoices = useBrowserVoices();
  const allVoices = [...remoteVoices, ...browserVoices];

  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing">("idle");
  const [search, setSearch] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const cancelBrowserRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(TTS_VOICE_KEY) ?? "";
    async function loadRemote() {
      try {
        const res = await fetch("/api/voice/voices");
        const data = await res.json();
        if (data.error) toast.error("ElevenLabs API error", { description: data.error });
        const list: Voice[] = data.voices ?? [];
        setRemoteVoices(list);
        if (saved && list.some((v) => v.voiceId === saved)) {
          setSelectedId(saved);
        } else if (saved.startsWith("browser:")) {
          setSelectedId(saved); // browser voice — will resolve once browserVoices load
        } else if (list.length > 0) {
          setSelectedId(list[0].voiceId);
        }
      } catch (err) {
        toast.error("Could not load ElevenLabs voices", {
          description: err instanceof Error ? err.message : "Check ELEVENLABS_API_KEY in .env.local",
        });
      } finally {
        setLoading(false);
      }
    }
    loadRemote();
  }, []);

  // Once browser voices load, pick the saved browser voice if nothing selected yet
  useEffect(() => {
    if (selectedId || browserVoices.length === 0) return;
    const saved = localStorage.getItem(TTS_VOICE_KEY) ?? "";
    if (saved && browserVoices.some((v) => v.voiceId === saved)) {
      setSelectedId(saved);
    } else if (remoteVoices.length === 0) {
      setSelectedId(browserVoices[0].voiceId);
    }
  }, [browserVoices.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopPreview() {
    audioRef.current?.pause();
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    cancelBrowserRef.current?.();
    cancelBrowserRef.current = null;
    setPreviewState("idle");
    setPreviewingId(null);
  }

  async function playPreview(voice: Voice) {
    if (previewState !== "idle") { stopPreview(); return; }
    setPreviewingId(voice.voiceId);
    setPreviewState("loading");

    if (voice.isBrowser) {
      const name = voice.voiceId.replace("browser:", "");
      setPreviewState("playing");
      cancelBrowserRef.current = speakBrowserPreview(name, () => {
        setPreviewState("idle");
        setPreviewingId(null);
      });
      return;
    }

    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: PREVIEW_TEXT, voiceId: voice.voiceId }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        toast.error("Preview failed", { description: msg || `Server error ${res.status}` });
        setPreviewState("idle");
        setPreviewingId(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = stopPreview;
      audio.onerror = stopPreview;
      await audio.play();
      setPreviewState("playing");
    } catch (err) {
      toast.error("Preview failed", {
        description: err instanceof Error ? err.message : "Could not reach speak API",
      });
      setPreviewState("idle");
      setPreviewingId(null);
    }
  }

  function selectVoice(voice: Voice) {
    setSelectedId(voice.voiceId);
    localStorage.setItem(TTS_VOICE_KEY, voice.voiceId);
    toast.success("Default speaker saved", { description: voice.name });
  }

  const selectedVoice = allVoices.find((v) => v.voiceId === selectedId);

  // Remote voices grouped by category
  const filteredRemote = remoteVoices.filter((v) =>
    search.trim()
      ? v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.gender.toLowerCase().includes(search.toLowerCase()) ||
        v.accent.toLowerCase().includes(search.toLowerCase()) ||
        v.category.toLowerCase().includes(search.toLowerCase())
      : true
  );
  const grouped = filteredRemote.reduce<Record<string, Voice[]>>((acc, v) => {
    const key = v.category || "other";
    (acc[key] ??= []).push(v);
    return acc;
  }, {});
  const categoryOrder = ["premade", "cloned", "generated", "professional", "other"];
  const categoryLabels: Record<string, string> = {
    premade: "Premade voices",
    cloned: "Cloned voices",
    generated: "Generated voices",
    professional: "Professional voices",
    other: "Other",
  };

  // Browser voices filtered by search
  const filteredBrowser = browserVoices.filter((v) =>
    search.trim()
      ? v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.accent.toLowerCase().includes(search.toLowerCase())
      : true
  );

  const hasAnyVoices = remoteVoices.length > 0 || browserVoices.length > 0;
  const hasFilteredVoices = filteredRemote.length > 0 || filteredBrowser.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure Genesis preferences. Changes are saved to your browser.
        </p>
      </div>

      {/* TTS section */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Volume2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">Text-to-Speech Voice</div>
            <div className="text-[11px] text-muted-foreground">
              Default speaker used when reading agent responses aloud
            </div>
          </div>
        </div>

        {/* Current selection */}
        {selectedVoice && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
              {selectedVoice.isBrowser ? <Globe className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{selectedVoice.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {selectedVoice.isBrowser
                  ? `Browser voice · ${selectedVoice.accent}`
                  : [selectedVoice.category, selectedVoice.gender, selectedVoice.accent].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => playPreview(selectedVoice)}
              disabled={previewState === "loading"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-smooth",
                previewState === "playing" && previewingId === selectedVoice.voiceId
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-card text-foreground hover:border-primary/40"
              )}
            >
              {previewState === "loading" && previewingId === selectedVoice.voiceId ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : previewState === "playing" && previewingId === selectedVoice.voiceId ? (
                <Square className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              {previewState === "playing" && previewingId === selectedVoice.voiceId
                ? "Stop"
                : previewState === "loading" && previewingId === selectedVoice.voiceId
                ? "Loading…"
                : "Preview"}
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voices by name, language, accent…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
        </div>

        {/* Voice list */}
        {loading && remoteVoices.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading voices…
          </div>
        ) : !hasAnyVoices ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <Volume2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No voices available</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Add{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">ELEVENLABS_API_KEY</code> to{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">.env.local</code> for premium voices.
              Browser voices load automatically once speech synthesis is ready.
            </p>
          </div>
        ) : !hasFilteredVoices ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No voices match &quot;{search}&quot;</p>
        ) : (
          <div className="max-h-[480px] overflow-y-auto space-y-4 pr-1">
            {/* ElevenLabs voices grouped by category */}
            {categoryOrder.map((cat) => {
              const group = grouped[cat];
              if (!group?.length) return null;
              return (
                <div key={cat}>
                  <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {categoryLabels[cat] ?? cat}
                  </div>
                  <div className="space-y-1">
                    {group.map((v) => (
                      <VoiceRow
                        key={v.voiceId}
                        voice={v}
                        isSelected={v.voiceId === selectedId}
                        previewState={previewState}
                        previewingId={previewingId}
                        onPreview={() => playPreview(v)}
                        onSelect={() => selectVoice(v)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Browser voices */}
            {filteredBrowser.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 px-1">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Browser voices (free, no API key)
                  </span>
                </div>
                <div className="space-y-1">
                  {filteredBrowser.map((v) => (
                    <VoiceRow
                      key={v.voiceId}
                      voice={v}
                      isSelected={v.voiceId === selectedId}
                      previewState={previewState}
                      previewingId={previewingId}
                      onPreview={() => playPreview(v)}
                      onSelect={() => selectVoice(v)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Info note */}
      <p className="text-center text-[11px] text-muted-foreground">
        Voice selection is stored in your browser. The selected voice is used by the speaker button on every agent response.
      </p>
    </div>
  );
}

interface VoiceRowProps {
  voice: Voice;
  isSelected: boolean;
  previewState: "idle" | "loading" | "playing";
  previewingId: string | null;
  onPreview: () => void;
  onSelect: () => void;
}

function VoiceRow({ voice, isSelected, previewState, previewingId, onPreview, onSelect }: VoiceRowProps) {
  const isThisPreviewing = previewingId === voice.voiceId && previewState !== "idle";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-smooth",
        isSelected
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-primary/20 hover:bg-accent/30"
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        {voice.isBrowser ? (
          <Globe className="h-3 w-3 text-muted-foreground" />
        ) : (
          <Mic className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium">{voice.name}</span>
          {isSelected && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Default
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {voice.isBrowser
            ? voice.accent || "Browser"
            : [voice.gender, voice.accent].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onPreview}
          disabled={previewState === "loading" && !isThisPreviewing}
          title="Preview this voice"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-smooth hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          {isThisPreviewing ? (
            previewState === "loading" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Square className="h-3 w-3" />
            )
          ) : (
            <Play className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          onClick={onSelect}
          title={isSelected ? "Current default" : "Set as default"}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border transition-smooth",
            isSelected
              ? "border-primary/40 bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
          )}
        >
          <Check className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
