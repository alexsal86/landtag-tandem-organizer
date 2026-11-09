import { PlanningOverview, type PlanningOverviewCollaborator, type PlanningOverviewItem } from "./PlanningOverview";
import type { AppointmentPreparation } from "./types";
import type { useEventPlanningData } from "./useEventPlanningData";

type Props = ReturnType<typeof useEventPlanningData>;
interface PreparationRow extends PlanningOverviewItem {
  preparation: AppointmentPreparation;
}

export function AppointmentPreparationOverview(data: Props) {
  const asRow = (preparation: AppointmentPreparation): PreparationRow => {
    const appointment = preparation.appointment;
    const status = appointment?.briefing_status;
    const statuses: Record<string, string> = { assigned: "In Zuarbeit", in_review: "Zur Freigabe", approved: "Freigegeben", completed: "Abgeschlossen", none: "Kein Briefing beauftragt" };
    const notes = preparation.notes || preparation.preparation_data?.briefing_notes || preparation.preparation_data?.visit_reason_details;
    return {
      id: preparation.id,
      title: preparation.title,
      user_id: appointment?.briefing_assignee_id || preparation.created_by || appointment?.user_id || "",
      created_at: preparation.created_at,
      confirmed_date: appointment?.start_time,
      location: appointment?.location,
      description: typeof notes === "string" ? notes : null,
      is_completed: status && status !== "undecided" && status !== "none" ? status === "completed" : preparation.status === "completed",
      is_archived: preparation.is_archived,
      archived_at: preparation.archived_at,
      statusLabel: statuses[status ?? ""] ?? (preparation.status === "in_progress" ? "In Bearbeitung" : preparation.status === "completed" ? "Abgeschlossen" : "Entwurf"),
      canArchive: [preparation.created_by, appointment?.user_id, appointment?.briefing_assignee_id].some(id => !!id && id === data.user?.id),
      preparation,
    };
  };
  const active = data.appointmentPreparations.map(asRow);
  const archived = data.archivedPreparations.map(asRow);
  const collaborators: PlanningOverviewCollaborator[] = [...active, ...archived].flatMap(row => {
    const preparation = row.preparation;
    const ids = new Set([...(preparation.shared_with ?? []), ...(preparation.created_by ? [preparation.created_by] : []), ...(preparation.appointment?.user_id ? [preparation.appointment.user_id] : [])]);
    ids.delete(row.user_id);
    return [...ids].map(userId => ({ id: `${row.id}-${userId}`, itemId: row.id, user_id: userId, can_edit: userId === preparation.created_by || userId === preparation.appointment?.user_id }));
  });
  return <PlanningOverview
    title="Terminplanungen"
    singular="Terminplanung"
    plannings={active}
    archivedPlannings={archived}
    allProfiles={data.allProfiles}
    collaborators={collaborators}
    user={data.user}
    view={data.appointmentPreparationView}
    onViewChange={view => data.saveViewPreferences("appointment", view)}
    isItemNew={data.isItemNew}
    onOpen={row => data.handlePreparationClick(row.preparation)}
    archivePlanning={data.archivePreparation}
    restorePlanning={data.restorePreparation}
    fetchArchivedPlannings={data.fetchAppointmentPreparations}
    showPlanningArchive={data.showArchived}
    setShowPlanningArchive={data.setShowArchived}
    quickAccess={row => ({ id: `preparation-${row.id}`, icon: "Calendar", route: `/appointment-preparation/${row.id}?view=preparation` })}
  />;
}
