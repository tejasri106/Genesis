"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODEL_IDS, MODEL_DETAILS, DEFAULT_MODEL, type ModelID } from "@/lib/ai/providers";

function MistralIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 176 162" fill="none">
      <rect x="15" y="1" width="32" height="32" fill="#FFCD00" />
      <rect x="143" y="1" width="32" height="32" fill="#FFCD00" />
      <rect x="15" y="33" width="32" height="32" fill="#FFA400" />
      <rect x="47" y="33" width="32" height="32" fill="#FFA400" />
      <rect x="111" y="33" width="32" height="32" fill="#FFA400" />
      <rect x="143" y="33" width="32" height="32" fill="#FFA400" />
      <rect x="15" y="65" width="32" height="32" fill="#FF7100" />
      <rect x="47" y="65" width="32" height="32" fill="#FF7100" />
      <rect x="79" y="65" width="32" height="32" fill="#FF7100" />
      <rect x="111" y="65" width="32" height="32" fill="#FF7100" />
      <rect x="143" y="65" width="32" height="32" fill="#FF7100" />
      <rect x="15" y="97" width="32" height="32" fill="#FF4902" />
      <rect x="79" y="97" width="32" height="32" fill="#FF4902" />
      <rect x="143" y="97" width="32" height="32" fill="#FF4902" />
      <rect x="15" y="129" width="32" height="32" fill="#FF0006" />
      <rect x="143" y="129" width="32" height="32" fill="#FF0006" />
      <rect y="1" width="16" height="160" fill="black" />
      <rect x="63" y="97" width="16" height="32" fill="black" />
      <rect x="95" y="33" width="16" height="32" fill="black" />
      <rect x="127" y="1" width="16" height="32" fill="black" />
      <rect x="127" y="97" width="16" height="64" fill="black" />
    </svg>
  );
}

function AnthropicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 46 32" fill="currentColor">
      <path d="M32.73 0h-6.945L38.45 32h6.945L32.73 0ZM12.665 0 0 32h7.082l2.59-6.72h13.25l2.59 6.72h7.082L19.929 0h-7.264Zm-.702 19.337 4.334-11.246 4.334 11.246h-8.668Z" />
    </svg>
  );
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GroqIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Groq-style stylized G mark */}
      <path
        d="M12 2.5C6.753 2.5 2.5 6.753 2.5 12S6.753 21.5 12 21.5c2.9 0 5.5-1.24 7.32-3.22V11.5H12v2.5h4.82v2.94A7.44 7.44 0 0 1 12 19c-3.866 0-7-3.134-7-7s3.134-7 7-7c1.93 0 3.68.782 4.95 2.05l1.77-1.77A9.46 9.46 0 0 0 12 2.5Z"
        fill="#F55036"
      />
    </svg>
  );
}

export function ProviderIcon({ provider, size = 16 }: { provider: string; size?: number }) {
  switch (provider) {
    case "mistral": return <MistralIcon size={size} />;
    case "anthropic": return <AnthropicIcon size={size} />;
    case "google": return <GoogleIcon size={size} />;
    case "groq": return <GroqIcon size={size} />;
    default: return null;
  }
}

const STORAGE_KEY = "helix-selected-model";

export function ModelSelector({
  value,
  onChange,
}: {
  value: ModelID;
  onChange: (id: ModelID) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = MODEL_DETAILS[value] ?? MODEL_DETAILS[DEFAULT_MODEL];

  const byProvider = MODEL_IDS.reduce(
    (acc, id) => {
      const m = MODEL_DETAILS[id];
      (acc[m.provider] ??= []).push(m);
      return acc;
    },
    {} as Record<string, typeof MODEL_DETAILS[ModelID][]>
  );

  const providerOrder = ["mistral", "anthropic", "google", "groq"] as const;
  const providerLabels: Record<string, string> = {
    mistral: "Mistral",
    anthropic: "Anthropic",
    google: "Google",
    groq: "Groq",
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-w-[170px] items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-smooth hover:border-primary/40 hover:shadow-soft"
        title={selected.description}
      >
        <ProviderIcon provider={selected.provider} size={13} />
        <span className="flex-1 text-left">{selected.label}</span>
        <span className="text-[10px] text-muted-foreground/70">{providerLabels[selected.provider]}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-1.5 z-50 w-64 rounded-xl border border-border bg-popover p-1.5 shadow-lg animate-fade-in">
          {providerOrder.map((provider) => {
            const models = byProvider[provider];
            if (!models?.length) return null;
            return (
              <div key={provider}>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ProviderIcon provider={provider} size={11} />
                  {providerLabels[provider]}
                </div>
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { onChange(m.id); setOpen(false); }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-smooth hover:bg-accent",
                      value === m.id && "bg-accent/60 font-semibold"
                    )}
                  >
                    <span className="flex-1">{m.label}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{m.description}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { STORAGE_KEY };
