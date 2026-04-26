"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, LayoutDashboard, Users, BookOpen, Notebook, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { UserMenu } from "@/components/UserMenu";
import type { ReactNode } from "react";
import { useState } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/research", label: "Research", icon: BookOpen },
  { to: "/notebook", label: "Notebook", icon: Notebook },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { patient, findings } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="mx-auto flex max-w-[1600px]">
        {/* Sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-md transition-all duration-300 md:flex",
            collapsed ? "w-[60px]" : "w-[230px]"
          )}
        >
          <div className={cn("flex items-center gap-2 px-3 py-4", collapsed && "justify-center px-0")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-soft">
              <Brain className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight">Genesis</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">TNBC Digital Twin</div>
              </div>
            )}
          </div>

          <nav className="mt-2 flex-1 space-y-0.5 px-2">
            {NAV.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  href={n.to}
                  title={collapsed ? n.label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-smooth",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-accent/60 text-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      {n.label}
                      {n.to === "/notebook" && findings.length > 0 && (
                        <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {findings.length}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {!collapsed && (
            <div className="border-t border-border px-3 py-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active patient</div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                    {patient.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{patient.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{patient.age}y · {patient.condition}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-10 w-full items-center justify-center border-t border-border text-muted-foreground transition-smooth hover:bg-muted/60 hover:text-foreground"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="flex h-14 items-center justify-between px-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-success" />
                Twin engine online · Research index synced
              </div>
              <UserMenu />
            </div>
            {/* Mobile nav */}
            <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
              {NAV.map((n) => {
                const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    href={n.to}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium",
                      active ? "bg-accent text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
