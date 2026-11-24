import { useState } from "react";
import { Check, HelpCircle, Plane, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

export type MeetingResponseStatus = "pending" | "confirmed" | "declined" | "vacation";

const OPTIONS: { status: Exclude<MeetingResponseStatus, "pending">; label: string; icon: typeof Check }[] = [
  { status: "confirmed", label: "Nehme teil", icon: Check },
  { status: "vacation", label: "Urlaub", icon: Plane },
  { status: "declined", label: "Kann nicht", icon: X },
];

const MEETING_RESPONSE_LABEL: Record<MeetingResponseStatus, string> = {
  pending: "Offen",
  confirmed: "Zugesagt",
  vacation: "Urlaub",
  declined: "Abgesagt",
};

/**
 * Rückmeldung der eingeladenen Person – ohne E-Mail, direkt im System.
 * Die Rückmeldung landet über die RPC in der eigenen Teilnahmezeile.
 */
export function MeetingResponseBar({
  meetingId,
  status,
  onChanged,
  className,
}: {
  meetingId: string;
  status?: MeetingResponseStatus | null;
  onChanged?: (status: MeetingResponseStatus) => void;
  className?: string;
}) {
  const current = status ?? "pending";
  const [saving, setSaving] = useState<MeetingResponseStatus | null>(null);

  const respond = async (next: Exclude<MeetingResponseStatus, "pending">) => {
    if (saving) return;
    setSaving(next);
    try {
      const { error } = await supabase.rpc("respond_to_meeting_invitation", {
        _meeting_id: meetingId,
        _status: next,
      });
      if (error) throw error;
      onChanged?.(next);
      notify.success(MEETING_RESPONSE_LABEL[next], {
        description: next === "vacation" ? "Urlaub ist für diese Besprechung gemeldet." : "Deine Rückmeldung ist gespeichert.",
      });
    } catch {
      notify.error("Rückmeldung fehlgeschlagen", { description: "Die Rückmeldung konnte nicht gespeichert werden." });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
        <HelpCircle className="size-3" />
        Deine Rückmeldung:
      </span>
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = current === option.status;
        return (
          <Button
            key={option.status}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            disabled={saving !== null}
            aria-pressed={active}
            onClick={() => void respond(option.status)}
          >
            <Icon className="mr-1 size-3.5" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
