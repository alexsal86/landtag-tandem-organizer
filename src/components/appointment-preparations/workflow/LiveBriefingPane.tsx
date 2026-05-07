import { AppointmentBriefingView } from "../AppointmentBriefingView";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

interface LiveBriefingPaneProps {
  preparation: AppointmentPreparation;
  appointmentInfo?: {
    title: string;
    start_time: string;
    end_time: string;
    location?: string | null;
  } | null;
  saving?: boolean;
}

export function LiveBriefingPane({ preparation, appointmentInfo, saving }: LiveBriefingPaneProps) {
  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-label text-muted-foreground">Live · Briefing-Vorschau</p>
        {saving && <span className="text-xs text-muted-foreground">autosave…</span>}
      </div>
      <AppointmentBriefingView
        preparation={preparation}
        appointmentInfo={appointmentInfo ?? null}
        compact
      />
    </aside>
  );
}
