import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { notify } from "@/lib/notify";
import { attendanceLabels, type AttendanceStatus, type ProtocolParticipant } from "./types";

type Details = Tables<"meeting_protocol_details">;
type Action = "details" | "approve" | "addendum";
const dateTime = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function AttendanceFields({ details, participants, save, cancel, busy }: {
  details: Details | null;
  participants: ProtocolParticipant[];
  save: (data: Json) => Promise<boolean>;
  cancel: () => void;
  busy: boolean;
}) {
  const [recorder, setRecorder] = useState(details?.recorder_name ?? "");
  const [guests, setGuests] = useState(details?.guests ?? "");
  const [attendance, setAttendance] = useState<Record<string, string>>(() =>
    Object.fromEntries(participants.map((person) => [person.user_id, attendanceOf(details, person.user_id) ?? ""])),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    void save({
      recorder,
      guests,
      attendance: Object.fromEntries(Object.entries(attendance).filter(([, value]) => value)),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border p-3 print:hidden">
      <label className="block space-y-1 text-sm">
        <span>Protokollant:in</span>
        <Input required maxLength={200} value={recorder} onChange={(event) => setRecorder(event.target.value)} />
      </label>
      {participants.map((person) => (
        <label key={person.user_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>{person.display_name}</span>
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={attendance[person.user_id] ?? ""}
            onChange={(event) => setAttendance({ ...attendance, [person.user_id]: event.target.value })}
          >
            <option value="">Nicht erfasst</option>
            <option value="present">Anwesend</option>
            <option value="excused">Entschuldigt</option>
            <option value="guest">Gast</option>
          </select>
        </label>
      ))}
      <label className="block space-y-1 text-sm">
        <span>Weitere Gäste</span>
        <Textarea maxLength={4000} value={guests} onChange={(event) => setGuests(event.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !recorder.trim()}>Speichern</Button>
        <Button size="sm" type="button" variant="ghost" disabled={busy} onClick={cancel}>Abbrechen</Button>
      </div>
    </form>
  );
}

function attendanceOf(details: Details | null, userId: string): string | undefined {
  const attendance = details?.attendance;
  if (!attendance || typeof attendance !== "object" || Array.isArray(attendance)) return undefined;
  const value = attendance[userId];
  return typeof value === "string" ? value : undefined;
}

export function useProtocolRecord(meetingId: string, tenantId?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["meeting-protocol-record", meetingId, tenantId, user?.id],
    enabled: Boolean(tenantId && user),
    queryFn: async () => {
      const [details, addenda, lead] = await Promise.all([
        supabase.from("meeting_protocol_details").select("*").eq("meeting_id", meetingId).maybeSingle(),
        supabase.from("meeting_protocol_addenda").select("*").eq("meeting_id", meetingId).order("created_at").order("id"),
        supabase.rpc("has_active_tenant_role", {
          _tenant_id: tenantId!, _user_id: user!.id, _roles: ["bueroleitung", "abgeordneter"],
        }),
      ]);
      if (details.error) throw details.error;
      if (addenda.error) throw addenda.error;
      return { details: details.data, addenda: addenda.data, canApprove: lead.data === true };
    },
  });
}

export function ProtocolRecordHeader({ details, participants, canEdit, canApprove, busy, submit }: {
  details: Details | null;
  participants: ProtocolParticipant[];
  canEdit: boolean;
  canApprove: boolean;
  busy: boolean;
  submit: (action: Action, data?: Json) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const groups = (Object.keys(attendanceLabels) as AttendanceStatus[]).map((status) => ({
    label: attendanceLabels[status],
    names: participants.filter((person) => attendanceOf(details, person.user_id) === status).map((person) => person.display_name),
  }));
  const unrecorded = participants.filter((person) => !attendanceOf(details, person.user_id));
  if (details?.guests) groups[2].names.push(details.guests);

  return (
    <div className="mt-4 space-y-3 text-sm">
      <dl className="grid gap-1">
        {groups.filter(({ names }) => names.length).map(({ label, names }) => (
          <div key={label} className="flex flex-wrap gap-x-2">
            <dt className="font-medium">{label}</dt>
            <dd className="whitespace-pre-line">{names.join(", ")}</dd>
          </div>
        ))}
        {unrecorded.length > 0 && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium">Anwesenheit nicht erfasst</dt>
            <dd>{unrecorded.map((person) => person.display_name).join(", ")}</dd>
          </div>
        )}
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium">Protokollant:in</dt>
          <dd>{details?.recorder_name ?? "Nicht erfasst"}</dd>
        </div>
      </dl>
      {details?.approved_at && (
        <p>
          Gesehen und freigegeben durch {details.approver_name} ({details.approver_role}) am{" "}
          <time dateTime={details.approved_at}>{dateTime.format(new Date(details.approved_at))}</time>
        </p>
      )}
      {canEdit && !details?.approved_at && (
        editing ? (
          <AttendanceFields
            details={details} participants={participants} busy={busy} cancel={() => setEditing(false)}
            save={async (data) => {
              const saved = await submit("details", data);
              if (saved) setEditing(false);
              return saved;
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
              Anwesenheit und Protokollführung bearbeiten
            </Button>
            {canApprove && details && (
              <Button size="sm" disabled={busy} onClick={() => void submit("approve")}>Protokoll freigeben</Button>
            )}
          </div>
        )
      )}
    </div>
  );
}

export function ProtocolAddenda({ addenda, canEdit, busy, submit }: {
  addenda: Tables<"meeting_protocol_addenda">[];
  canEdit: boolean;
  busy: boolean;
  submit: (action: Action, data?: Json) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  if (!addenda.length && !canEdit) return null;

  return (
    <section id="protocol-addenda" className={`mt-8 scroll-mt-6 space-y-3 border-t pt-6 ${addenda.length ? "" : "print:hidden"}`}>
      <h2 className="text-lg font-semibold">Nachträge</h2>
      {addenda.map((entry) => (
        <article key={entry.id} className="break-inside-avoid border-b pb-3">
          <p className="text-sm text-muted-foreground">
            {entry.author_name} · <time dateTime={entry.created_at}>{dateTime.format(new Date(entry.created_at))}</time>
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{entry.body}</p>
        </article>
      ))}
      {canEdit && (editing ? (
        <form className="space-y-2 print:hidden" onSubmit={async (event) => {
          event.preventDefault();
          if (await submit("addendum", { body })) {
            setBody("");
            setEditing(false);
          }
        }}>
          <label className="block text-sm font-medium" htmlFor="protocol-addendum-body">Nachtrag</label>
          <Textarea id="protocol-addendum-body" required maxLength={8000} value={body} onChange={(event) => setBody(event.target.value)} />
          <Button size="sm" disabled={busy || !body.trim()}>Nachtrag speichern</Button>
          <Button size="sm" type="button" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Abbrechen</Button>
        </form>
      ) : (
        <Button size="sm" variant="outline" className="print:hidden" disabled={busy} onClick={() => setEditing(true)}>
          Nachtrag hinzufügen
        </Button>
      ))}
    </section>
  );
}

export async function saveProtocolRecord(meetingId: string, action: Action, data: Json = {}) {
  const { error } = await supabase.rpc("update_meeting_protocol", { _meeting_id: meetingId, _action: action, _data: data });
  if (error) {
    notify.error("Protokoll konnte nicht gespeichert werden", { description: error.message });
    return false;
  }
  return true;
}
