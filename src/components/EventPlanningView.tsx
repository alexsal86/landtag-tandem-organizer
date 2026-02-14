import { useEventPlanningData } from "./event-planning/useEventPlanningData";
import { EventPlanningListView } from "./event-planning/EventPlanningListView";
import { EventPlanningDetailView } from "./event-planning/EventPlanningDetailView";

export function EventPlanningView() {
  const data = useEventPlanningData();

  if (!data.selectedPlanning) {
    return <EventPlanningListView {...data} />;
  }

  return <EventPlanningDetailView {...data} />;
}
