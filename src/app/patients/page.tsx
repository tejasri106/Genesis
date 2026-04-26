"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Activity,
  Check,
  Dna,
  Loader2,
  Plus,
  Stethoscope,
  Users,
} from "lucide-react";
import { useState } from "react";
import { fetchGeneratePatient } from "@/lib/api";

export default function PatientsPage() {
  const { patient, setPatient, patients, addPatient } = useAppStore();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [hintStage, setHintStage] = useState("");
  const [hintEthnicity, setHintEthnicity] = useState("");

  async function generatePatient() {
    setGenerating(true);
    setGenError(null);
    const result = await fetchGeneratePatient({
      stage: hintStage || undefined,
      ethnicity: hintEthnicity || undefined,
    });
    if (result?.patient) {
      addPatient(result.patient);
    } else {
      setGenError("Generation failed — check API connection.");
    }
    setGenerating(false);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Cohort
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">TNBC Patient Profiles</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Select a patient to load their digital twin into the simulation workspace.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              <select
                value={hintStage}
                onChange={(e) => setHintStage(e.target.value)}
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
              >
                <option value="">Any stage</option>
                <option value="I">Stage I</option>
                <option value="II">Stage II</option>
                <option value="III">Stage III</option>
                <option value="IV">Stage IV</option>
              </select>
              <select
                value={hintEthnicity}
                onChange={(e) => setHintEthnicity(e.target.value)}
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/60"
              >
                <option value="">Any ethnicity</option>
                <option value="Black">Black</option>
                <option value="White">White</option>
                <option value="Asian">Asian</option>
                <option value="Hispanic">Hispanic</option>
              </select>
              <button
                onClick={generatePatient}
                disabled={generating}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground shadow-soft transition-smooth hover:opacity-90 disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Generate Patient
              </button>
            </div>
            {genError && <p className="text-[11px] text-destructive">{genError}</p>}
          </div>
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground"
          >
            Open dashboard
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {patients.map((p) => {
          const active = p.id === patient.id;
          return (
            <div
              key={p.id}
              className={cn(
                "rounded-2xl border bg-card p-5 shadow-soft transition-smooth",
                active ? "border-primary/60 shadow-glow" : "border-border hover:border-primary/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    active ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {p.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-base font-semibold">{p.name}</h2>
                    {active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.age}y · {p.ethnicity} · {p.condition}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {p.brca1Mutation && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    <Dna className="h-2.5 w-2.5" /> BRCA1+
                  </span>
                )}
                {p.brca2Mutation && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                    <Dna className="h-2.5 w-2.5" /> BRCA2+
                  </span>
                )}
                {!p.brca1Mutation && !p.brca2Mutation && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">BRCA wild-type</span>
                )}
                {p.lymphNodePositive ? (
                  <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">Node+</span>
                ) : (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">Node−</span>
                )}
                {(p.pdl1Cps ?? 0) >= 10 && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">PD-L1 CPS≥10</span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="CA 15-3" value={`${p.ca153Baseline}`} unit="U/mL" />
                <Stat label="Ki-67" value={`${p.ki67Percent}%`} unit="" />
                <Stat label="PD-L1 CPS" value={p.pdl1Cps !== undefined ? `${p.pdl1Cps}` : "N/A"} unit="" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Stat label="Tumor size" value={`${p.tumorSizeCm} cm`} unit="" />
                <Stat label="Stage" value={p.stage} unit="" />
              </div>

              {p.comorbidities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.comorbidities.map((c) => (
                    <span key={c} className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => setPatient(p)}
                  disabled={active}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-smooth",
                    active ? "cursor-default bg-muted text-muted-foreground" : "bg-gradient-primary text-primary-foreground hover:opacity-90"
                  )}
                >
                  {active ? "Currently selected" : "Load patient"}
                </button>
                <Link
                  href="/"
                  onClick={() => setPatient(p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-smooth hover:border-primary/40"
                >
                  <Stethoscope className="h-3.5 w-3.5" /> Simulate
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {patients.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <Activity className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-3 text-sm text-muted-foreground">No patients yet. Generate a synthetic patient above.</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}{unit && <span className="text-[10px] text-muted-foreground"> {unit}</span>}</div>
    </div>
  );
}
