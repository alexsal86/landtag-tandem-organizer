import { AppointmentFeedbackWidget } from "@/components/dashboard/AppointmentFeedbackWidget";

export function MyWorkAppointmentFeedbackTab() {
  return (
    <div className="w-full">
      <AppointmentFeedbackWidget widgetSize="full" isEditMode={false} />
    </div>
  );
}
