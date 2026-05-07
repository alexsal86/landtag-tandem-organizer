import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, X, Sparkles } from "lucide-react";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";

function resolveIcon(name: string): LucideIcon {
  const lib = LucideIcons as unknown as Record<string, LucideIcon>;
  return lib[name] ?? LucideIcons.Circle;
}

interface OnboardingChecklistCardProps {
  /** Wenn true, ignoriert dismissed-State (z.B. in Settings). */
  forceShow?: boolean;
  className?: string;
}

export function OnboardingChecklistCard({ forceShow = false, className = "" }: OnboardingChecklistCardProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const {
    loading,
    items,
    progress,
    completedCount,
    totalCount,
    dismissed,
    setItemDone,
    dismiss,
    detectAndSync,
  } = useOnboardingChecklist();

  useEffect(() => {
    if (!loading) void detectAndSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading || totalCount === 0) return null;
  if (!forceShow && (dismissed || completedCount === totalCount)) return null;

  const percent = Math.round((completedCount / totalCount) * 100);

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-label font-medium">Erste Schritte</div>
            <div className="text-caption text-muted-foreground">
              {completedCount} von {totalCount} erledigt
            </div>
          </div>
        </div>
        {!forceShow && (
          <button
            type="button"
            onClick={() => void dismiss()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Checkliste ausblenden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <Progress value={percent} className="h-1.5 mb-4" />

      <ul className="space-y-1.5">
        {items.map((item) => {
          const done = !!progress[item.key];
          const Icon = resolveIcon(item.icon);
          return (
            <li key={item.key}>
              <div
                className={`group flex items-center gap-2 rounded-md px-2 py-2 transition-colors ${
                  done ? "opacity-60" : "hover:bg-accent/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void setItemDone(item.key, !done)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    done ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 hover:border-primary"
                  }`}
                  aria-label={done ? "Als offen markieren" : "Als erledigt markieren"}
                >
                  {done && <Check className="w-3 h-3" strokeWidth={3} />}
                </button>
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className={`text-label ${done ? "line-through" : ""}`}>{item.label}</div>
                  {!done && item.description && (
                    <div className="text-caption text-muted-foreground truncate">{item.description}</div>
                  )}
                </div>
                {!done && item.cta_route && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => navigate(item.cta_route!)}
                  >
                    Öffnen
                    <ChevronRight className="w-3 h-3 ml-0.5" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
