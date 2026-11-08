import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { ProtocolMeeting, ProtocolParticipant } from "./types";
export function ProtocolHeader({
  meeting,
  participants,
  roleLabelMap,
}: {
  meeting: ProtocolMeeting;
  participants: ProtocolParticipant[];
  roleLabelMap: Record<string, string>;
}) {
  return (
    <header>
      <p className="mb-1 text-xs font-semibold text-primary">
        Besprechungsprotokoll
      </p>
      <h1 className="text-3xl font-bold tracking-tight">{meeting.title}</h1>
      {meeting.description && (
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
          {meeting.description}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span>
          {format(new Date(meeting.meeting_date), "PPP", { locale: de })}
          {meeting.meeting_time && `, ${meeting.meeting_time.slice(0, 5)} Uhr`}
        </span>
        {meeting.location && <span>{meeting.location}</span>}
      </div>
      {participants.length > 0 && (
        <div aria-label="Teilnehmer" className="mt-4 flex flex-wrap gap-2">
          {participants.map((p) => (
            <span
              key={p.user_id}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 py-1 pl-1 pr-3 text-sm"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold"
              >
                {(p.display_name || "?").slice(0, 1).toUpperCase()}
              </span>
              {p.display_name}
              <span className="text-xs text-muted-foreground">
                {roleLabelMap[p.role] || p.role}
              </span>
            </span>
          ))}
        </div>
      )}
    </header>
  );
}
