"use client";

import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface Props {
  label: string;
  unit: string;
  baseline: number;
  intervention: number;
  betterDirection: "up" | "down";
  active: boolean;
  onClick: () => void;
}

export function MetricCard({ label, unit, baseline, intervention, betterDirection, active, onClick }: Props) {
  const delta = intervention - baseline;
  const pct = baseline === 0 ? 0 : (delta / baseline) * 100;
  const better = betterDirection === "down" ? delta < -0.01 : delta > 0.01;
  const worse = betterDirection === "down" ? delta > 0.01 : delta < -0.01;
  const Icon = Math.abs(delta) < 0.01 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group rounded-xl border p-4 text-left transition-smooth",
        active
          ? "border-primary/60 bg-card shadow-glow"
          : "border-border bg-card hover:border-primary/30 hover:shadow-soft"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div
          className={cn(
            "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
            better && "bg-success/15 text-success",
            worse && "bg-destructive/15 text-destructive",
            !better && !worse && "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-3 w-3" />
          {Math.abs(pct).toFixed(1)}%
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {intervention.toFixed(1)}
        </span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground tabular-nums">
        baseline {baseline.toFixed(1)} {unit}
      </div>
    </button>
  );
}
