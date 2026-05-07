import { format } from "date-fns";
import { Ban, CheckCircle2, Circle } from "lucide-react";
import { Label } from "@/components/ui/label";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { cn } from "@/lib/utils";

export const ACTION_ITEM_MIN_LENGTH = 3;

export function extractPlainTextFromHtml(html: string | undefined | null): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').trim();
}

// ─── Rating Scale Component ──────────────────────────────
export function RatingScale({
  value,
  onChange,
  disabled,
  labels,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  disabled: boolean;
  labels: [string, string];
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 text-right">{labels[0]}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-all",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              disabled && "cursor-not-allowed opacity-50",
              !disabled && "cursor-pointer hover:scale-110",
              value && n <= value
                ? "bg-primary border-primary text-primary-foreground"
                : "border-muted-foreground/30 bg-background",
            )}
          >
            <span className="text-xs font-medium">{n}</span>
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground w-24">{labels[1]}</span>
    </div>
  );
}

// ─── Status Progress Component ──────────────────────────
export function StatusProgress({ status }: { status: string }) {
  const isCancelled = status === "cancelled" || status === "cancelled_by_employee" || status === "rescheduled";

  if (isCancelled) {
    const label = status === "cancelled" ? "Abgesagt" : status === "cancelled_by_employee" ? "Vom Mitarbeiter abgesagt" : "Umterminiert";
    return (
      <div className="flex items-center gap-2">
        <Ban className="h-5 w-5 text-destructive" />
        <span className="text-sm font-medium text-destructive">{label}</span>
      </div>
    );
  }

  const steps = [
    { key: "scheduled", label: "Geplant" },
    { key: "in_progress", label: "In Durchführung" },
    { key: "completed", label: "Abgeschlossen" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          {i <= currentIndex ? (
            <CheckCircle2 className={cn("h-5 w-5", i < currentIndex ? "text-primary" : "text-primary animate-pulse")} />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground/40" />
          )}
          <span className={cn("text-sm", i <= currentIndex ? "font-medium text-foreground" : "text-muted-foreground")}>
            {step.label}
          </span>
          {i < steps.length - 1 && <div className={cn("w-8 h-0.5 mx-1", i < currentIndex ? "bg-primary" : "bg-muted-foreground/20")} />}
        </div>
      ))}
    </div>
  );
}

// ─── Auto-Save Indicator ────────────────────────────────
export function SaveIndicator({ state, lastSaved }: { state: "saved" | "saving" | "unsaved"; lastSaved: Date | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className={cn(
        "h-2 w-2 rounded-full",
        state === "saved" && "bg-primary",
        state === "saving" && "bg-accent-foreground/50 animate-pulse",
        state === "unsaved" && "bg-destructive/60",
      )} />
      <span className="text-muted-foreground">
        {state === "saving" && "Speichere..."}
        {state === "unsaved" && "Ungespeichert"}
        {state === "saved" && lastSaved && `Gespeichert ${format(lastSaved, "HH:mm")}`}
        {state === "saved" && !lastSaved && "Gespeichert"}
      </span>
    </div>
  );
}

// ─── Rich Text Field (edit or display) ──────────────────
export function ProtocolField({
  label, value, onChange, canEdit, placeholder, minHeight = "80px",
}: {
  label: string; value: string | undefined; onChange: (v: string) => void; canEdit: boolean; placeholder: string; minHeight?: string;
}) {
  if (!canEdit) {
    return (
      <div>
        <Label>{label}</Label>
        {value ? <RichTextDisplay content={value} /> : <p className="text-sm text-muted-foreground italic">Keine Angabe</p>}
      </div>
    );
  }
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <SimpleRichTextEditor
        initialContent={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={!canEdit}
        minHeight={minHeight}
      />
    </div>
  );
}
