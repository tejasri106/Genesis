"use client";

import { useState } from "react";
import { ChevronDown, LogOut, Moon, Sun, Shield, ShieldCheck, Mail, Pencil, Check, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Clinician } from "@/lib/mockData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("helix-theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList[next ? "add" : "remove"]("dark");
    localStorage.setItem("helix-theme", next ? "dark" : "light");
  };

  return [dark, toggle] as const;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { clinician, setClinician } = useAppStore();
  const [dark, toggleDark] = useDarkMode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Clinician>(clinician);

  const openEdit = () => {
    setDraft({ ...clinician });
    setEditing(true);
  };

  const save = () => {
    const updated = { ...draft, initials: initials(draft.name) };
    setClinician(updated);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const c = clinician;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-smooth hover:border-primary/40">
          <span className="hidden sm:inline">{c.name}</span>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
            {c.initials}
          </div>
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        {editing ? (
          /* ── Edit form ── */
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">Edit Profile</span>
              <button onClick={cancel} className="rounded p-1 hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
            </div>

            {(
              [
                { key: "name", label: "Full name" },
                { key: "title", label: "Title / Role" },
                { key: "affiliation", label: "Affiliation" },
                { key: "email", label: "Email" },
                { key: "npi", label: "NPI number" },
              ] as { key: keyof Clinician; label: string }[]
            ).map(({ key, label }) => (
              <div key={key}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
                <input
                  value={draft[key] as string}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
                />
              </div>
            ))}

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Credentials (comma-separated)</label>
              <input
                value={draft.credentials.join(", ")}
                onChange={(e) => setDraft((d) => ({ ...d, credentials: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
                className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Specialties (comma-separated)</label>
              <input
                value={draft.specialties.join(", ")}
                onChange={(e) => setDraft((d) => ({ ...d, specialties: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
                className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
              />
            </div>

            <button
              onClick={save}
              disabled={!draft.name.trim()}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Save profile
            </button>
          </div>
        ) : (
          /* ── Profile view ── */
          <>
            <div className="bg-gradient-hero p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-base font-semibold text-primary-foreground shadow-soft">
                  {c.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-foreground">{c.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{c.title}</div>
                </div>
                <button
                  onClick={openEdit}
                  className="ml-auto shrink-0 rounded-lg border border-border bg-card p-1.5 hover:border-primary/40"
                  title="Edit profile"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {c.credentials.map((cr) => (
                  <span key={cr} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    <ShieldCheck className="h-2.5 w-2.5 text-primary" />
                    {cr}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 px-4 py-3 text-xs">
              <Row icon={<Shield className="h-3 w-3" />} label="NPI" value={c.npi} />
              <Row icon={<Mail className="h-3 w-3" />} label="Email" value={c.email} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Affiliation</div>
                <div className="text-foreground">{c.affiliation}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Specialties</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.specialties.map((s) => (
                    <span key={s} className="rounded-full bg-accent/40 px-2 py-0.5 text-[10px] text-accent-foreground">{s}</span>
                  ))}
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleDark(); }} className="cursor-pointer text-xs">
              {dark ? <Sun className="mr-2 h-3.5 w-3.5" /> : <Moon className="mr-2 h-3.5 w-3.5" />}
              {dark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-muted-foreground">
              <LogOut className="mr-2 h-3 w-3" /> Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
      <span className="truncate font-mono text-foreground">{value}</span>
    </div>
  );
}
