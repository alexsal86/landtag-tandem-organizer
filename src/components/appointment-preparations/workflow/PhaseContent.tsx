import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentPreparationDataTab } from "../AppointmentPreparationDataTab";
import { AppointmentPreparationChecklistTab } from "../AppointmentPreparationChecklistTab";
import { AppointmentPreparationDetailsTab } from "../AppointmentPreparationDetailsTab";
import { AppointmentPreparationFileUpload } from "@/components/appointments/AppointmentPreparationFileUpload";
import { PreparationMemoryPanel } from "./PreparationMemoryPanel";
import type { PhaseId } from "./usePhaseStatus";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import type { AppointmentPreparationAppointmentDetails } from "@/pages/AppointmentPreparationDetail";

interface PhaseContentProps {
  phase: PhaseId;
  preparation: AppointmentPreparation;
  appointmentDetails: AppointmentPreparationAppointmentDetails | null;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
  onOpenAppointmentDetails: () => void;
}

const PHASE_TITLES: Record<PhaseId, { idx: number; title: string; lead: string }> = {
  anlass: { idx: 1, title: "Anlass & Annahme", lead: "Worum geht es bei diesem Termin? Anlass, Hintergrund und Annahme festlegen." },
  team: { idx: 2, title: "Team & Logistik", lead: "Wer ist im Raum, wer begleitet, wie kommen wir hin." },
  fakten: { idx: 3, title: "Fakten & Positionen", lead: "Was wir wissen müssen — Datenlage und unsere Position." },
  themen: { idx: 4, title: "Themen, Talking Points & Q&A", lead: "Was wollen wir aus dem Gespräch mitnehmen — und worauf müssen wir vorbereitet antworten?" },
  "qa-run": { idx: 5, title: "Q&A-Durchgang", lead: "Letzter Check: Sind alle Punkte für das Briefing abgehakt?" },
  freigabe: { idx: 6, title: "Briefing-Freigabe", lead: "Status, Notizen und Freigabe für das fertige Briefing." },
  nachbereitung: { idx: 7, title: "Nachbereitung", lead: "Dokumente, Gesprächsnotiz und Folgetermine." },
};

export function PhaseContent({ phase, preparation, appointmentDetails, onUpdate, onOpenAppointmentDetails }: PhaseContentProps) {
  const meta = PHASE_TITLES[phase];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="section-label text-muted-foreground">
          Phase {meta.idx} · {phase === "freigabe" || phase === "nachbereitung" ? "Offen" : "In Arbeit"}
        </p>
        <h2 className="text-title font-semibold">{meta.title}</h2>
        <p className="text-sm text-muted-foreground">{meta.lead}</p>
      </div>

      {(phase === "anlass" || phase === "team" || phase === "fakten" || phase === "themen") && (
        <>
          {(phase === "themen" || phase === "fakten") && (
            <PreparationMemoryPanel preparation={preparation} onUpdate={onUpdate} />
          )}
          <AppointmentPreparationDataTab
            preparation={preparation}
            appointmentDetails={appointmentDetails}
            onUpdate={onUpdate}
            onOpenAppointmentDetails={onOpenAppointmentDetails}
          />
        </>
      )}

      {phase === "qa-run" && (
        <AppointmentPreparationChecklistTab preparation={preparation} onUpdate={onUpdate} />
      )}

      {phase === "freigabe" && (
        <AppointmentPreparationDetailsTab preparation={preparation} onUpdate={onUpdate} />
      )}

      {phase === "nachbereitung" && (
        <Card className="bg-card shadow-card border-border">
          <CardHeader>
            <CardTitle>Dokumente & Nachbereitung</CardTitle>
          </CardHeader>
          <CardContent>
            <AppointmentPreparationFileUpload
              preparationId={preparation.id}
              tenantId={preparation.tenant_id}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
