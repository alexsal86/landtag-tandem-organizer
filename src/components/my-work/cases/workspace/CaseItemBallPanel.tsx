import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { sendToDaySlip } from "@/lib/daySlipBridge";
import { openAppointmentRequestCreate } from "@/features/appointment-requests/events";
import { BALL_OWNERS, PARLIAMENTARY_TOOLS, ballMeta, daysUntilNextAction, type BallOwner, type ParliamentaryTool } from "@/features/cases/items/ball";
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
  onOpenMeetingSelector: () => void;
};

const NONE = "__none__";

export function CaseItemBallPanel({ item, tenantId, subject, teamUsers, onChange, onOpenMeetingSelector }: Props) {
  const [label, setLabel] = useState(item.next_action_label ?? "");
  useEffect(() => setLabel(item.next_action_label ?? ""), [item.id, item.next_action_label]);

  const lastHandover = useCaseHandoverLog(tenantId, item.id).data?.[0];
  const userName = (id: string | null) => teamUsers.find((u) => u.id === id)?.name ?? "Unbekannt";
  const meta = ballMeta(item.ball_owner);
  const days = daysUntilNextAction(item);
  const dueText = days === null ? null : days < 0 ? `${-days} T überfällig` : days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} T`;
  const dueValue = item.next_action_due_at ? item.next_action_due_at.slice(0, 10) : "";

  const commitLabel = () => {
    const next = label.trim() || null;
    if (next !== (item.next_action_label ?? null)) onChange({ next_action_label: next });
  };

  return (
    <div className="shrink-0 space-y-3 border-b bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="section-label">Am Zug</span>
        {BALL_OWNERS.map((b) => (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange({ ball_owner: b.value })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs transition-colors duration-fast",
              meta.value === b.value ? "border-foreground/30 bg-background font-medium text-foreground shadow-xs" : "border-transparent text-muted-foreground hover:bg-background",
            )}
            aria-pressed={meta.value === b.value}
          >
            <span className={cn("h-2 w-2 rounded-full", b.dotClass)} />
            {b.short}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_150px_170px]">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder={item.ball_owner === "office" || !item.ball_owner ? "Nächster Schritt, z. B. Erinnerung an RP senden" : "Worauf warten wir? z. B. Stellungnahme Ministerium"}
          className="h-8 text-sm"
          aria-label="Nächster Schritt"
        />
        <div className="relative">
          <Input
            type="date"
            value={dueValue}
            onChange={(e) => onChange({ next_action_due_at: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
            className={cn("h-8 text-sm", days !== null && days < 0 && "border-destructive text-destructive")}
            aria-label="Frist nächster Schritt"
          />
        </div>
        <Select
          value={item.next_action_assignee_id ?? NONE}
          onValueChange={(v) => onChange({ next_action_assignee_id: v === NONE ? null : v })}
        >
          <SelectTrigger className="h-8 text-sm" aria-label="Zuständig für nächsten Schritt"><SelectValue placeholder="Zuständig" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Wie Bearbeitung</SelectItem>
            {teamUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {dueText && (
          <span className={cn("text-xs", days !== null && days < 0 ? "text-destructive" : days !== null && days <= 3 ? "text-warning" : "text-muted-foreground")}>
            Frist {dueText}
          </span>
        )}
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
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            disabled={!label.trim()}
            onClick={() => sendToDaySlip({ text: `${label.trim()} [${subject}]`, source: { type: "case", id: item.id, nextActionLabel: label.trim() } })}
          >
            <Zap className="h-3.5 w-3.5" />Auf Tageszettel
          </Button>
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
    </div>
  );
}

export type { BallOwner };
