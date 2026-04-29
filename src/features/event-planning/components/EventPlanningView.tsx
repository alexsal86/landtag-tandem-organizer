import { useEventPlanningData } from "@/components/event-planning/useEventPlanningData";
import { EventPlanningListView } from "@/components/event-planning/EventPlanningListView";
import { EventPlanningDetailView } from "@/components/event-planning/EventPlanningDetailView";

export function EventPlanningView() {
  const data = useEventPlanningData();

  if (!data.selectedPlanning) {
    return <EventPlanningListView {...data} />;
  }

  return <EventPlanningDetailView {...data} />;
}
