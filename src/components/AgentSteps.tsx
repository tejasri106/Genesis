'use client';

import { BookOpen, Database, FlaskConical, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import type { UIMessage } from 'ai';

// AI SDK v6 actual states: input-streaming → input-available → output-available | output-error | output-denied
interface ToolPart {
  type: string;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | 'output-denied';
  input?: unknown;
  output?: unknown;
}

export const TOOL_META: Record<string, { label: string; icon: React.ReactNode; color: string; pill: string }> = {
  searchLiterature: {
    label: 'Research Agent',
    icon: <BookOpen className="h-3 w-3" />,
    color: 'text-blue-500',
    pill: 'border-blue-500/30 bg-blue-500/8 text-blue-500',
  },
  searchKnowledgeBase: {
    label: 'RAG Agent',
    icon: <Database className="h-3 w-3" />,
    color: 'text-violet-500',
    pill: 'border-violet-500/30 bg-violet-500/8 text-violet-500',
  },
  analyzeSimulation: {
    label: 'Twin Agent',
    icon: <FlaskConical className="h-3 w-3" />,
    color: 'text-emerald-500',
    pill: 'border-emerald-500/30 bg-emerald-500/8 text-emerald-500',
  },
  validateClinicalClaim: {
    label: 'Review Agent',
    icon: <ShieldCheck className="h-3 w-3" />,
    color: 'text-amber-500',
    pill: 'border-amber-500/30 bg-amber-500/8 text-amber-500',
  },
};

export function toolNameFromType(type: string): string {
  return type.startsWith('tool-') ? type.slice(5) : type;
}

function getQueryPreview(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  const q = String(obj.query ?? obj.question ?? obj.claim ?? '');
  return q.length > 55 ? q.slice(0, 55) + '…' : q;
}

interface AgentStepsProps {
  message: UIMessage;
  isStreaming: boolean;
}

export function AgentSteps({ message, isStreaming }: AgentStepsProps) {
  const steps: ToolPart[] = (message.parts ?? [])
    .filter((part) => typeof part.type === 'string' && part.type.startsWith('tool-'))
    .map((part) => part as unknown as ToolPart);

  if (steps.length === 0) return null;

  return (
    <div className="mb-2.5 flex flex-col gap-1">
      {steps.map((step, idx) => {
        const toolName = toolNameFromType(step.type);
        const meta = TOOL_META[toolName] ?? {
          label: toolName,
          icon: <Loader2 className="h-3 w-3" />,
          color: 'text-muted-foreground',
          pill: 'border-border/40 bg-muted/20 text-muted-foreground',
        };
        const done = step.state === 'output-available' || step.state === 'output-error';
        const active = !done && isStreaming;
        const preview = getQueryPreview(step.input);

        return (
          <div
            key={step.toolCallId ?? idx}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium ${meta.pill} ${active ? 'shadow-sm' : ''}`}
          >
            <span className="shrink-0">{meta.icon}</span>
            <span className="font-semibold">{meta.label}</span>
            {!done && active && (
              <span className="text-[10px] uppercase tracking-wider opacity-60">calling…</span>
            )}
            {done && preview && (
              <span className="min-w-0 truncate text-[11px] opacity-60">→ {preview}</span>
            )}
            <span className="ml-auto shrink-0">
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin opacity-80" />
              ) : (
                <Loader2 className="h-4 w-4 opacity-30" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
