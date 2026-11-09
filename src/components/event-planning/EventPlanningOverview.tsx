import { PlanningOverview } from "./PlanningOverview";
import type { useEventPlanningData } from "./useEventPlanningData";

type Props = ReturnType<typeof useEventPlanningData>;

export function EventPlanningOverview(data: Props) {
  return <PlanningOverview<Props["plannings"][number]>
    title="Veranstaltungen"
    singular="Veranstaltung"
    plannings={data.plannings}
    archivedPlannings={data.archivedPlannings}
    allProfiles={data.allProfiles}
    collaborators={data.collaborators.map(c => ({ ...c, itemId: c.event_planning_id }))}
    user={data.user}
    view={data.eventPlanningView}
    onViewChange={view => data.saveViewPreferences("event", view)}
    isItemNew={data.isItemNew}
    onOpen={data.setSelectedPlanning}
    togglePlanningCompleted={data.togglePlanningCompleted}
    archivePlanning={data.archivePlanning}
    restorePlanning={data.restorePlanning}
    fetchArchivedPlannings={data.fetchArchivedPlannings}
    showPlanningArchive={data.showPlanningArchive}
    setShowPlanningArchive={data.setShowPlanningArchive}
    quickAccess={p => ({ id: `planning-${p.id}`, icon: "Calendar", route: `/eventplanning?highlight=${p.id}` })}
  />;
}
