import { Link } from "react-router-dom";
import { TaskDecisionDetails } from "@/components/task-decisions/TaskDecisionDetails";
import type { useCaseWorkflow } from "@/components/my-work/hooks/useCaseWorkflow";
import { decisionOutcome, meetingOutcome } from "@/features/cases/items/workflow";
import { formatDateSafe } from "./utils/dateFormatting";
import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Gavel, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { sendToDaySlip, formatCaseDaySlipText } from "@/lib/daySlipBridge";
import { openAppointmentRequestCreate, openAppointmentRequestDetail } from "@/features/appointment-requests/events";
import { BALL_OWNERS, ballMeta, daysUntilNextAction, withAutoDeadline, resubmissionHint, stepState, type BallOwner } from "@/features/cases/items/ball";
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

type QuickProps = Pick<Props, "item" | "subject" | "onOpenMeetingSelector" | "onCreateLetter" | "onRequestDecision"> & { workflow: ReturnType<typeof useCaseWorkflow> };

export function CaseItemQuickActions({ item, subject, onOpenMeetingSelector, onCreateLetter, onRequestDecision, workflow }: QuickProps) {
  const [creatingLetter, setCreatingLetter] = useState(false);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const data = workflow.data;
  const pendingRequests = data?.requests.filter((request) => request.status === "open") ?? [];
  const lastRequest = data?.requests[0];
  const pendingDecisions = data?.decisions.filter((decision) => !decisionOutcome(decision).completed) ?? [];
  const lastDecision = data?.decisions[0];
  const meeting = data?.meetings.find((meeting) => meeting.id === data.meetingId)
    ?? data?.meetings.find((meeting) => ["archived", "completed"].includes(meeting.status) || data.agenda.some((row) => row.meeting_id === meeting.id && meetingOutcome(row.result_text, item.id).completed));
  const discussed = !!meeting && !!data?.agenda.some((row) => row.meeting_id === meeting.id && meetingOutcome(row.result_text, item.id).completed);
  const meetingFinished = discussed || !!meeting && ["archived", "completed"].includes(meeting.status);
  const unavailable = workflow.isPending || workflow.isError;
  const label = item.next_action_label?.trim() ?? "";
  const cls = "h-auto min-h-8 w-full justify-start gap-2 whitespace-normal px-2 py-1.5 text-left text-sm font-normal text-foreground";
  return (
    <div className="space-y-0.5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h2>
      <Button type="button" variant="ghost" size="sm" className={cls} disabled={creatingLetter}
        onClick={async () => { setCreatingLetter(true); try { await onCreateLetter(); } finally { setCreatingLetter(false); } }}>
        <Mail className="h-4 w-4 text-muted-foreground" />{creatingLetter ? "Lege an…" : "Brief aufsetzen"}
      </Button>
      <Button type="button" variant="ghost" size="sm" className={cls}
        onClick={() => sendToDaySlip({ text: formatCaseDaySlipText(subject, label), source: { type: "case", id: item.id, nextActionLabel: label || undefined } })}>
        <Zap className="h-4 w-4 text-muted-foreground" />Auf Tageszettel
      </Button>
      {workflow.isError && <p className="px-2 text-xs text-destructive">Verknüpfungen konnten nicht geladen werden. <button type="button" className="underline" onClick={() => void workflow.refetch()}>Erneut laden</button></p>}
      {pendingDecisions.map((decision) => (
        <Button key={decision.id} type="button" variant="ghost" size="sm" className={cls} onClick={() => setDecisionId(decision.id)}>
          <Gavel className="h-4 w-4 shrink-0 text-muted-foreground" />Entscheidung angefordert – {formatDateSafe(decision.created_at, "dd.MM.yyyy")} · {decisionOutcome(decision).answered}/{decisionOutcome(decision).total} Rückmeldungen
        </Button>
      ))}
      {!pendingDecisions.length && lastDecision && <Button type="button" variant="ghost" size="sm" className={cls} onClick={() => setDecisionId(lastDecision.id)}>
        <Gavel className="h-4 w-4 shrink-0 text-success" />Entscheidung abgeschlossen – {formatDateSafe(lastDecision.updated_at, "dd.MM.yyyy")}
      </Button>}
      {onRequestDecision && !pendingDecisions.length && (
        <Button type="button" variant="ghost" size="sm" className={cls} disabled={unavailable} onClick={onRequestDecision}>
          <Gavel className="h-4 w-4 shrink-0 text-muted-foreground" />Entscheidung anfordern
        </Button>
      )}
      {meeting && <Link className="flex items-start gap-2 px-2 py-1.5 text-sm text-primary hover:underline" to={`/meetings?id=${meeting.id}`}>
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{discussed ? "Im Jour fixe besprochen" : meetingFinished ? "Jour fixe abgeschlossen" : "Auf Jour fixe"} – {formatDateSafe(meeting.meeting_date, "dd.MM.yyyy")} · {meeting.title}</span>
      </Link>}
      {data?.pendingMeeting && <Button type="button" variant="ghost" size="sm" className={cls} onClick={onOpenMeetingSelector}>
        <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />Für nächsten Jour fixe vorgemerkt
      </Button>}
      {!data?.pendingMeeting && (!meeting || meetingFinished) && <Button type="button" variant="ghost" size="sm" className={cls} disabled={unavailable} onClick={onOpenMeetingSelector}>
        <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />Auf Jour fixe
      </Button>}
      {meeting && !meetingFinished && !data?.pendingMeeting && <button type="button" className="ml-8 text-xs text-muted-foreground hover:underline" onClick={onOpenMeetingSelector}>Zuordnung ändern</button>}
      {(pendingRequests.length ? pendingRequests : lastRequest ? [lastRequest] : []).map((request) => (
        <div key={request.id}>
          {request.status === "open" ? <Button type="button" variant="ghost" size="sm" className={cls} onClick={() => openAppointmentRequestDetail(request.id)}>
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />Ortstermin angefragt – {formatDateSafe(request.requested_date, "dd.MM.yyyy")}
          </Button> : <p className="px-2 pt-1.5 text-sm">Ortstermin {request.status === "accepted" ? "bestätigt" : "abgelehnt"} – {formatDateSafe(request.requested_date, "dd.MM.yyyy")}</p>}
          <Link className="ml-8 text-xs text-primary hover:underline" to={`/calendar?date=${request.requested_date}${request.appointment_id ? `&highlight=${request.appointment_id}` : ""}`}>Im Kalender öffnen →</Link>
        </div>
      ))}
      {!pendingRequests.length && <Button type="button" variant="ghost" size="sm" className={cls} disabled={unavailable}
        onClick={() => openAppointmentRequestCreate({ caseItemId: item.id, title: `Ortstermin: ${subject}`, notes: label || undefined, channel: "case" })}>
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />Ortstermin anfragen
      </Button>}
      {data?.tasks.filter((task) => !["completed", "cancelled"].includes(task.status)).map((task) => <Link key={task.id} to={`/tasks?highlight=${task.id}`} className="flex items-center gap-2 px-2 py-1.5 text-sm text-primary hover:underline">
        <ClipboardList className="h-4 w-4 shrink-0" /><span>Aufgabe: {task.title}</span>
      </Link>)}
      <TaskDecisionDetails decisionId={decisionId} isOpen={!!decisionId} onClose={() => { setDecisionId(null); void workflow.refetch(); }} />

    </div>
  );
}

export function CaseItemBallPanel({ item, tenantId, teamUsers, onChange, onCompleteStep, variant = "bar" }: Props) {
  const [completingStep, setCompletingStep] = useState(false);
  // Alle Eingaben sind Entwürfe; gespeichert (und ggf. auf Wiedervorlage gelegt) wird erst mit „Schritt festlegen“.
  const [label, setLabel] = useState(item.next_action_label ?? "");
  const [draftOwner, setDraftOwner] = useState<BallOwner>(ballMeta(item.ball_owner).value);
  const [draftDue, setDraftDue] = useState<string | null>(null);
  const [draftAssignee, setDraftAssignee] = useState<string | null>(null);
  useEffect(() => {
    setLabel(item.next_action_label ?? "");
    setDraftOwner(ballMeta(item.ball_owner).value);
    setDraftDue(item.next_action_due_at ?? null);
    setDraftAssignee(item.next_action_assignee_id ?? null);
  }, [item.id, item.next_action_label, item.ball_owner, item.next_action_due_at, item.next_action_assignee_id]);
  const hasStep = stepState(item) === "set";
  const dayKey = (iso: string | null | undefined) => (iso ? format(new Date(iso), "yyyy-MM-dd") : "");
  const dirty =
    label.trim() !== (item.next_action_label ?? "").trim() ||
    draftOwner !== ballMeta(item.ball_owner).value ||
    dayKey(draftDue) !== dayKey(item.next_action_due_at) ||
    (draftAssignee ?? null) !== (item.next_action_assignee_id ?? null);
  const hint = resubmissionHint(item);

  const lastHandover = useCaseHandoverLog(tenantId, item.id).data?.[0];
  const userName = (id: string | null) => teamUsers.find((u) => u.id === id)?.name ?? "Unbekannt";
  const days = daysUntilNextAction(item);
  const dueText = days === null ? null : days < 0 ? `${-days} T überfällig` : days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} T`;
  const dueValue = dayKey(draftDue);

  const setStep = () => {
    if (!label.trim()) return;
    const patch: BallPatch = {};
    if (draftOwner !== ballMeta(item.ball_owner).value) patch.ball_owner = draftOwner;
    if (label.trim() !== (item.next_action_label ?? "").trim()) patch.next_action_label = label.trim();
    if (dayKey(draftDue) !== dayKey(item.next_action_due_at)) patch.next_action_due_at = draftDue;
    if ((draftAssignee ?? null) !== (item.next_action_assignee_id ?? null)) patch.next_action_assignee_id = draftAssignee;
    onChange(patch);
  };

  return (
    <div className={cn("shrink-0 space-y-3", variant === "bar" ? "mx-6 mb-4 rounded-2xl border bg-card p-5 shadow-sm" : "p-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 pb-1">
          <span className="section-label">Wer ist am Zug?</span>
          {dueText && <span className={cn("text-sm", days !== null && days < 0 ? "text-destructive" : "text-muted-foreground")}>Frist <strong className="text-foreground">{format(new Date(item.next_action_due_at!), "dd.MM.yyyy", { locale: de })}</strong> · {dueText}</span>}
        </div>
        {BALL_OWNERS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => {
              setDraftOwner(b.value);
              if (!draftDue) {
                const suggestion = withAutoDeadline<BallPatch>({}, { ball_owner: b.value });
                setDraftDue(suggestion.next_action_due_at ?? null);
              }
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm transition-colors duration-fast",
              draftOwner === b.value ? "border-success bg-success/5 font-semibold text-foreground shadow-xs" : "border-border text-foreground hover:bg-muted/30",
            )}
            aria-pressed={draftOwner === b.value}
          >
            <span className={cn("h-2 w-2 rounded-full", b.dotClass)} />
            {b.short}
          </button>
        ))}
      </div>

      {hint && <p className="rounded-md bg-success/10 px-4 py-2 text-sm text-success">{hint}</p>}

      <div className={cn("grid grid-cols-1 gap-4", variant === "bar" && "md:grid-cols-[minmax(0,1fr)_minmax(160px,208px)]")}>
        <label className="min-w-0 space-y-1 text-sm text-muted-foreground">
          <span>Nächster Schritt</span>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setStep(); }}
            placeholder="z. B. Antwort an den Absender schicken"
            className="h-14 min-w-0 rounded-xl bg-background px-4 text-base text-foreground md:text-base"
          />
        </label>
        <label className="min-w-0 space-y-1 text-sm text-muted-foreground">
          <span>Frist</span>
          <Input
            type="date"
            lang="de"
            value={dueValue}
            onChange={(e) => setDraftDue(e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null)}
            className={cn("h-14 min-w-0 rounded-xl bg-background px-4 text-base text-foreground md:text-base", days !== null && days < 0 && "border-destructive text-destructive")}
            aria-label="Frist nächster Schritt"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Zuständig:</span>
        <Select value={draftAssignee ?? NONE} onValueChange={(v) => setDraftAssignee(v === NONE ? null : v)}>
          <SelectTrigger className="h-8 w-auto max-w-full gap-2 text-sm text-foreground" aria-label="Zuständig für nächsten Schritt"><SelectValue placeholder="Zuständig" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Wie Bearbeitung</SelectItem>
            {teamUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {lastHandover && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground" title="Letzte Übergabe an Vertretung">
            Übergeben von {userName(lastHandover.handed_over_by)} an {userName(lastHandover.to_user_id)} · {format(new Date(lastHandover.handed_over_at), "dd.MM. HH:mm", { locale: de })}
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {hasStep && !dirty ? "Schritt abgehakt? Dann Ball weitergeben oder neuen Schritt eintragen." : hasStep ? "Änderungen werden erst mit „Schritt festlegen“ übernommen." : "Noch kein Schritt festgelegt. Was passiert als Nächstes?"}
        </p>
        {hasStep && !dirty ? (
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
