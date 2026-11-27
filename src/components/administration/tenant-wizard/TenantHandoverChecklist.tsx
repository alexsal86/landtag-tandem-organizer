import { CheckCircle2, CircleDashed } from "lucide-react";
import { TENANT_STEPS, type TenantStepKey, type TenantStepState } from "./steps";

interface Props {
  steps: Record<TenantStepKey, TenantStepState>;
  /** Kompakt = nur offene Punkte, für die Mandantenzeile. */
  compact?: boolean;
}

export function TenantHandoverChecklist({ steps, compact = false }: Props): React.JSX.Element {
  const visible = TENANT_STEPS.filter((step) => !compact || steps[step.key].open);
  const open = TENANT_STEPS.filter((step) => steps[step.key].open).length;

  if (visible.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-palette-green">
        <CheckCircle2 className="h-3.5 w-3.5" /> Übergabe vollständig
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      {!compact && (
        <div className="text-xs text-muted-foreground">
          {open === 0 ? "Alle Übergabeschritte erledigt." : `${open} offen · Empfehlung, kein Blocker`}
        </div>
      )}
      <ul className="space-y-1">
        {visible.map((step) => {
          const state = steps[step.key];
          return (
            <li key={step.key} className="flex items-start gap-2 text-xs">
              {/* Nur offene Punkte tragen ein Symbol in der kompakten Zeile. */}
              <CircleDashed className="h-3.5 w-3.5 mt-0.5 text-palette-amber shrink-0" />
              <div className="min-w-0">
                <span className="text-foreground">{step.label}</span>
                {state.detail && <span className="text-muted-foreground"> · {state.detail}</span>}
                {!compact && <span className="block text-muted-foreground">{step.hint}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
