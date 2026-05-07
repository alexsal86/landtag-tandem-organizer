import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhaseDescriptor, PhaseId } from "./usePhaseStatus";

interface PhaseStepperProps {
  phases: PhaseDescriptor[];
  activePhase: PhaseId;
  onSelect: (id: PhaseId) => void;
}

export function PhaseStepper({ phases, activePhase, onSelect }: PhaseStepperProps) {
  return (
    <div className="w-full overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {phases.map((phase, idx) => {
          const isActive = phase.id === activePhase;
          const isDone = phase.status === "done";
          return (
            <li key={phase.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onSelect(phase.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "text-palette-green hover:bg-palette-green/10"
                      : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                    isActive
                      ? "bg-primary-foreground/20"
                      : isDone
                        ? "bg-palette-green/15"
                        : "bg-muted",
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className="whitespace-nowrap">{phase.label}</span>
              </button>
              {idx < phases.length - 1 && (
                <div className="h-px w-4 bg-border mx-0.5" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
