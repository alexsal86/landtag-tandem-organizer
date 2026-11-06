import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Gavel, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { sendToDaySlip } from "@/lib/daySlipBridge";
import { openAppointmentRequestCreate } from "@/features/appointment-requests/events";
import { BALL_OWNERS, PARLIAMENTARY_TOOLS, ballMeta, daysUntilNextAction, resubmissionHint, stepState, type BallOwner, type ParliamentaryTool } from "@/features/cases/items/ball";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useCaseHandoverLog } from "@/components/my-work/hooks/useCaseHandoverLog";
import type { CaseItem, TeamUser } from "@/components/my-work/hooks/useCaseWorkspaceData";

export type BallPatch = Partial<Pick<CaseItem, "ball_owner" | "next_action_label" | "next_action_due_at" | "next_action_assignee_id" | "parliamentary_tool">>;

type Props = {
  item: CaseItem;
  tenantId?: string;
  subject: string;
  teamUsers: TeamUser[];
  onChange: (patch: BallPatch) => void;
  onCompleteStep: (label: string) => Promise<boolean>;
  onOpenMeetingSelector: () => void;
  onCreateLetter: () => Promise<void>;
  onRequestDecision?: () => void;
  /** "dock" = vertical layout for the right-hand third zone. */
  variant?: "bar" | "dock";
};

const NONE = "__none__";

export function CaseItemBallPanel({ item, tenantId, subject, teamUsers, onChange, onCompleteStep, onOpenMeetingSelector, onCreateLetter, onRequestDecision, variant = "bar" }: Props) {
  const [completingStep, setCompletingStep] = useState(false);
  const [creatingLetter, setCreatingLetter] = useState(false);
  const [label, setLabel] = useState(item.next_action_label ?? "");
  useEffect(() => setLabel(item.next_action_label ?? ""), [item.id, item.next_action_label]);
  const hasStep = stepState(item) === "set";
  // Ohne festgelegten Schritt werden Frist und Zuständigkeit erst mit „Schritt festlegen“ gespeichert.
  const [draftDue, setDraftDue] = useState<string | null>(null);
  const [draftAssignee, setDraftAssignee] = useState<string | null>(null);
  useEffect(() => { setDraftDue(item.next_action_due_at ?? null); setDraftAssignee(item.next_action_assignee_id ?? null); }, [item.id, item.next_action_due_at, item.next_action_assignee_id]);
  const hint = resubmissionHint(item);

  const lastHandover = useCaseHandoverLog(tenantId, item.id).data?.[0];
  const userName = (id: string | null) => teamUsers.find((u) => u.id === id)?.name ?? "Unbekannt";
  const meta = ballMeta(item.ball_owner);
  const days = daysUntilNextAction(item);
  const dueText = days === null ? null : days < 0 ? `${-days} T überfällig` : days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} T`;
  const dueSource = hasStep ? item.next_action_due_at : draftDue;
  const dueValue = dueSource ? format(new Date(dueSource), "yyyy-MM-dd") : "";
  const assigneeValue = hasStep ? item.next_action_assignee_id : draftAssignee;

  const commitLabel = () => {
    if (!hasStep) return;
    const next = label.trim() || null;
    if (next && next !== (item.next_action_label ?? null)) onChange({ next_action_label: next });
  };
  const setStep = () => {
    if (!label.trim()) return;
    onChange({ next_action_label: label.trim(), next_action_due_at: draftDue, next_action_assignee_id: draftAssignee });
  };

  return (
    <div className={cn("shrink-0 space-y-3", variant === "bar" ? "mx-6 mb-4 rounded-2xl border bg-card p-5 shadow-sm" : "p-4 [&_.case-actions]:ml-0 [&_.case-actions]:w-full [&_.case-actions]:flex-col [&_.case-actions]:items-stretch [&_.case-actions_button]:justify-start")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 pb-1">
          <span className="section-label">Wer ist am Zug?</span>
          {dueText && <span className={cn("text-sm", days !== null && days < 0 ? "text-destructive" : "text-muted-foreground")}>Frist <strong className="text-foreground">{format(new Date(item.next_action_due_at!), "dd.MM.yyyy", { locale: de })}</strong> · {dueText}</span>}
        </div>
        {BALL_OWNERS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange({ ball_owner: b.value })}
            className={cn(
              "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm transition-colors duration-fast",
              meta.value === b.value ? "border-success bg-success/5 font-semibold text-foreground shadow-xs" : "border-border text-foreground hover:bg-muted/30",
            )}
            aria-pressed={meta.value === b.value}
          >
            <span className={cn("h-2 w-2 rounded-full", b.dotClass)} />
            {b.short}
          </button>
        ))}
      </div>

      {hint && <p className="rounded-md bg-success/10 px-4 py-2 text-sm text-success">{hint}</p>}

      <div className={cn("grid grid-cols-1 gap-2", variant === "bar" && "md:grid-cols-[1fr_150px_170px]")}>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === "Enter") { if (hasStep) (e.target as HTMLInputElement).blur(); else setStep(); } }}
          placeholder={item.ball_owner === "office" || !item.ball_owner ? "Nächster Schritt, z. B. Erinnerung an RP senden" : "Worauf warten wir? z. B. Stellungnahme Ministerium"}
          className="h-8 text-sm"
          aria-label="Nächster Schritt"
        />
        <div className="relative">
          <Input
            type="date"
            value={dueValue}
            onChange={(e) => {
              const iso = e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null;
              if (hasStep) onChange({ next_action_due_at: iso }); else setDraftDue(iso);
            }}
            className={cn("h-8 text-sm", days !== null && days < 0 && "border-destructive text-destructive")}
            aria-label="Frist nächster Schritt"
          />
        </div>
        <Select
          value={assigneeValue ?? NONE}
          onValueChange={(v) => { const id = v === NONE ? null : v; if (hasStep) onChange({ next_action_assignee_id: id }); else setDraftAssignee(id); }}
        >
          <SelectTrigger className="h-8 text-sm" aria-label="Zuständig für nächsten Schritt"><SelectValue placeholder="Zuständig" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Wie Bearbeitung</SelectItem>
            {teamUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={item.parliamentary_tool ?? "none"} onValueChange={(v) => onChange({ parliamentary_tool: v as ParliamentaryTool })}>
          <SelectTrigger className="h-7 w-auto gap-1 border-none bg-transparent px-2 text-xs text-muted-foreground shadow-none" aria-label="Parlamentarisches Instrument">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARLIAMENTARY_TOOLS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {lastHandover && (
          <span className="text-xs text-muted-foreground" title="Letzte Übergabe an Vertretung">
            Übergeben von {userName(lastHandover.handed_over_by)} an {userName(lastHandover.to_user_id)} · {format(new Date(lastHandover.handed_over_at), "dd.MM. HH:mm", { locale: de })}
          </span>
        )}
        <div className="case-actions ml-auto flex items-center gap-1">
          <Button
            type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" disabled={creatingLetter}
            onClick={async () => { setCreatingLetter(true); try { await onCreateLetter(); } finally { setCreatingLetter(false); } }}
          >
            <Mail className="h-3.5 w-3.5" />{creatingLetter ? "Lege an…" : "Brief aufsetzen"}
          </Button>
          <Button
            type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            disabled={!label.trim()}
            onClick={() => sendToDaySlip({ text: `${label.trim()} [${subject}]`, source: { type: "case", id: item.id, nextActionLabel: label.trim() } })}
          >
            <Zap className="h-3.5 w-3.5" />Auf Tageszettel
          </Button>
          {onRequestDecision && (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={onRequestDecision}>
              <Gavel className="h-3.5 w-3.5" />Entscheidung anfordern
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={onOpenMeetingSelector}>
            <ClipboardList className="h-3.5 w-3.5" />Auf Jour fixe
          </Button>
          <Button
            type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => openAppointmentRequestCreate({ title: `Ortstermin: ${subject}`, notes: label.trim() || undefined })}
          >
            <CalendarDays className="h-3.5 w-3.5" />Ortstermin anfragen
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {hasStep ? "Schritt abgehakt? Dann Ball weitergeben oder neuen Schritt eintragen." : "Noch kein Schritt festgelegt. Was passiert als Nächstes?"}
        </p>
        {hasStep ? (
          <Button type="button" disabled={completingStep} className="ml-auto h-11 rounded-lg bg-success px-5 font-semibold text-success-foreground hover:bg-success/90"
            onClick={async () => {
              setCompletingStep(true);
              try { if (await onCompleteStep(item.next_action_label!.trim())) setLabel(""); } finally { setCompletingStep(false); }
            }}>
            {completingStep ? "Wird erledigt…" : "Schritt erledigt"}
          </Button>
        ) : (
          <Button type="button" disabled={!label.trim()} className="ml-auto h-11 rounded-lg bg-success px-5 font-semibold text-success-foreground hover:bg-success/90" onClick={setStep}>
            Schritt festlegen
          </Button>
        )}
      </div>
    </div>
  );
}

export type { BallOwner };
