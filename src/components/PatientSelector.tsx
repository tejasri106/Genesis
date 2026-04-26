"use client";

import { useAppStore } from "@/lib/store";
import type { PatientProfile } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { User2 } from "lucide-react";

interface Props {
  selectedId: string;
  onSelect: (p: PatientProfile) => void;
}

export function PatientSelector({ selectedId, onSelect }: Props) {
  const { patients } = useAppStore();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <User2 className="h-3.5 w-3.5" />
        Patient Cohort
      </div>
      <div className="space-y-2">
        {patients.map((p) => {
          const active = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-smooth",
                "hover:border-primary/40 hover:shadow-soft",
                active ? "border-primary/60 bg-accent/40 shadow-soft" : "border-border bg-card"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-smooth",
                    active ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {p.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.age}y · {p.ethnicity} · {p.condition}
                  </div>
                </div>
              </div>
              {active && (
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center animate-fade-in">
                  <Stat label="CA 15-3" value={`${p.ca153Baseline}`} unit="U/mL" />
                  <Stat label="Ki-67" value={`${p.ki67Percent}%`} unit="" />
                  <Stat label="PD-L1 CPS" value={p.pdl1Cps !== undefined ? `${p.pdl1Cps}` : "N/A"} unit="" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
