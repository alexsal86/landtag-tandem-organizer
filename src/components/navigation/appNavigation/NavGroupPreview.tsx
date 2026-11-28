import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { asBriefingStatus, BRIEFING_STATUS_LABELS } from "@/features/appointments/briefing";
import { ballAssigneeLabel } from "@/features/tasks/stafette";
import { useMatrixUnread } from "@/contexts/MatrixUnreadContext";
import { useAuth } from "@/hooks/useAuth";
import { appointmentHref, appointmentLabel } from "./sidebarAppointments";
import type { NavPreviewGroup } from "./types";
import type { useNavPanelData } from "./useNavPanelData";

export function NavGroupPreview({ group, data, onNavigate }: {
  group: NavPreviewGroup;
  data: ReturnType<typeof useNavPanelData>;
  onNavigate: () => void;
}) {
  const { user } = useAuth();
  const matrix = useMatrixUnread();
  const entry = (to: string, title: string, detail: string) => (
    <Link to={to} className="mission-preview-link block" onClick={onNavigate}>
      <span className="block break-words text-sm font-medium">{title}</span>
      {detail && <span className="block break-words text-xs text-muted-foreground">{detail}</span>}
    </Link>
  );

  let message: string;
  switch (group) {
    case "calendar": {
      const { nextAppointment, upcomingAppointments, briefing, pendingFeedbacks } = data;
      const status = asBriefingStatus(nextAppointment?.briefingStatus);
      return (
        <>
          {data.appointmentsLoading ? <p className="p-2 text-xs" role="status">Termine werden geladen …</p>
            : data.appointmentsError ? <p className="p-2 text-xs" role="status">Termine konnten nicht geladen werden.</p>
            : !upcomingAppointments.length ? <p className="p-2 text-xs">Keine anstehenden Termine in den nächsten fünf Tagen.</p> : null}
          <div className="max-h-[min(18rem,45dvh)] overflow-y-auto">
            {upcomingAppointments.map(item => (
              <div key={appointmentHref(item)}>
                {entry(appointmentHref(item), item.title, [appointmentLabel(item), item.location].filter(Boolean).join(" · "))}
                {item === nextAppointment && status !== "none" && (
                  briefing ? entry(`/appointment-preparation/${briefing.id}?view=briefing`, "Briefing öffnen", BRIEFING_STATUS_LABELS[status])
                    : <p className="px-2 text-xs text-muted-foreground">{BRIEFING_STATUS_LABELS[status]}</p>
                )}
              </div>
            ))}
          </div>
          {pendingFeedbacks.length > 0 && entry("/mywork", `${pendingFeedbacks.length} offene Termin-Rückmeldungen`, "Zur Übersicht")}
        </>
      );
    }
    case "tasks": {
      const task = data.previewTask;
      if (task) {
        const due = task.next_action_due ?? task.due_date;
        const assignee = task.ball_assignee_id === user?.id ? "Bei dir" : ballAssigneeLabel(task).label;
        return entry(`/tasks?task=${task.id}`, task.title, [assignee, due && `Fällig ${format(parseISO(due), "dd.MM.")}`, task.next_action].filter(Boolean).join(" · "));
      }
      message = data.taskLoading ? "Aufgaben werden geladen …" : data.taskError ? "Aufgaben konnten nicht geladen werden." : "Keine offenen Aufgaben.";
      break;
    }
    case "communication": {
      const unread = [...matrix.unreadRooms].sort((a, b) =>
        Number(b.highlightCount > 0) - Number(a.highlightCount > 0) || (b.activity ?? 0) - (a.activity ?? 0),
      )[0];
      const room = unread ?? matrix.recentRoom;
      if (room) return entry(`/chat?${new URLSearchParams({ room: room.roomId })}`, room.name === room.roomId ? "Chatraum" : room.name,
        unread ? "Ungelesene Nachrichten" : "Zuletzt geöffneter Chat");
      message = matrix.hasCredentials ? "Keine ungelesenen Chats." : "Chat öffnen, um die Verbindung einzurichten.";
      break;
    }
    case "people": {
      const preview = data.previewContact;
      if (preview) return entry(`/contacts/${preview.contact.id}`, preview.contact.name, [preview.context, preview.role || preview.contact.position, preview.contact.organization].filter(Boolean).join(" · "));
      message = data.contactLoading ? "Kontakt wird geladen …" : data.contactError ? "Kontakt konnte nicht geladen werden." : "Kein Kontakt zum nächsten Termin oder zur letzten Fallakte.";
      break;
    }
    case "files": {
      const file = data.caseFiles[0];
      if (file) return entry(`/casefiles?caseFileId=${file.id}`, file.title, file.reference_number || "Zuletzt aktualisierte Fallakte");
      message = data.caseFilesLoading ? "Fallakten werden geladen …" : data.caseFilesError ? "Fallakten konnten nicht geladen werden." : "Keine eigenen Fallakten gefunden.";
      break;
    }
  }
  return <p role="status" className="px-2 py-1.5 text-xs text-muted-foreground">{message}</p>;
}
