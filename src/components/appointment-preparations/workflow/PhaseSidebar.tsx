import { Check, Circle, Dot, AlertCircle } from "lucide-react";
import type { PhaseDescriptor, PhaseId } from "./usePhaseStatus";
import { cn } from "@/lib/utils";

interface PhaseSidebarProps {
  phases: PhaseDescriptor[];
  activePhase: PhaseId;
  onSelect: (id: PhaseId) => void;
  blockers: string[];
}

export function PhaseSidebar({ phases, activePhase, onSelect, blockers }: PhaseSidebarProps) {
  return (
    <aside className="space-y-6">
      <div>
        <p className="section-label mb-3 text-muted-foreground">Vorbereitungs-Phasen</p>
        <ul className="space-y-1">
          {phases.map((phase, idx) => {
            const isActive = phase.id === activePhase;
            return (
              <li key={phase.id}>
                <button
                  type="button"
                  onClick={() => onSelect(phase.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                    isActive
                      ? "bg-primary/5 ring-1 ring-primary/20"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {phase.status === "done" ? (
                      <div className="h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    ) : phase.status === "active" ? (
                      <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                        <Dot className="h-5 w-5" />
                      </div>
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm font-medium leading-tight", isActive && "text-foreground")}>
                      {idx + 1}. {phase.label}
                    </div>
                    {phase.countLabel ? (
                      <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {phase.countLabel}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground mt-0.5">{phase.hint}</div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {blockers.length > 0 && (
        <div>
          <p className="section-label mb-2 text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Aktuelle Blocker
          </p>
          <ul className="space-y-1.5">
            {blockers.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
