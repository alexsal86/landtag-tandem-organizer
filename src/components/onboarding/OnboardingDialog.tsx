import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronRight, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OnboardingSlide } from "@/hooks/useOnboardingGate";

interface OnboardingDialogProps {
  open: boolean;
  slides: OnboardingSlide[];
  onComplete: () => void;
  onSkip: () => void;
}

function resolveIcon(name: string): LucideIcon {
  const lib = LucideIcons as unknown as Record<string, LucideIcon>;
  return lib[name] ?? LucideIcons.Sparkles;
}

export function OnboardingDialog({ open, slides, onComplete, onSkip }: OnboardingDialogProps): React.JSX.Element | null {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const current = slides[index];
  const isLast = index === slides.length - 1;
  const Icon = useMemo(() => (current ? resolveIcon(current.icon) : LucideIcons.Sparkles), [current]);

  if (!current) return null;

  const next = (): void => {
    if (isLast) {
      onComplete();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onSkip(); }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-0 gap-0">
        <div className="grid md:grid-cols-[40%_60%]">
          {/* Hero */}
          <div
            className="relative p-8 md:p-10 min-h-[360px] flex flex-col justify-between"
            style={{ background: `linear-gradient(160deg, ${current.accent}, #155EEF)` }}
          >
            <div className="flex gap-1.5">
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= index ? "bg-white" : "bg-white/30"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-center flex-1 py-8">
              <div
                className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl animate-scale-in"
                key={current.id}
              >
                <Icon className="w-12 h-12 text-white" strokeWidth={2} />
              </div>
            </div>
            <div className="text-white/80 text-xs">
              Schritt {index + 1} von {slides.length}
            </div>
          </div>

          {/* Content */}
          <div className="p-8 md:p-10 flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-6">
              {current.source === "tenant" ? (
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-1">
                  {current.tenantName || "Aus deinem Büro"}
                </span>
              ) : (
                <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  Einführung
                </span>
              )}
              <button
                type="button"
                onClick={onSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                aria-label="Onboarding überspringen"
              >
                Überspringen
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 animate-fade-in" key={`text-${current.id}`}>
              <h2 className="text-2xl font-semibold tracking-tight mb-3">{current.title}</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{current.body}</p>
            </div>
            <div className="flex justify-end mt-8">
              <Button onClick={next} size="lg" className="gap-1">
                {isLast ? "Loslegen" : "Weiter"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
