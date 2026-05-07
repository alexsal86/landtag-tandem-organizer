import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentPreparationDataTab } from "../AppointmentPreparationDataTab";
import { AppointmentPreparationChecklistTab } from "../AppointmentPreparationChecklistTab";
import { AppointmentPreparationDetailsTab } from "../AppointmentPreparationDetailsTab";
import { AppointmentPreparationFileUpload } from "@/components/appointments/AppointmentPreparationFileUpload";
import { PreparationMemoryPanel } from "./PreparationMemoryPanel";
import { AiSuggestionsPanel } from "./AiSuggestionsPanel";
import { DebriefPanel } from "./DebriefPanel";
import { TemplatesPanel } from "./TemplatesPanel";
import { SharingPanel } from "./SharingPanel";
import { LinkedItemsPanel } from "./LinkedItemsPanel";
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
  anlass: { idx: 1, title: "Anlass & Annahme", lead: "Worum geht es bei diesem Termin? Anlass und Hintergrund festlegen." },
  team: { idx: 2, title: "Team, Logistik & Ablauf", lead: "Wer ist im Raum, wer begleitet, wie kommen wir hin, wie läuft es ab." },
  fakten: { idx: 3, title: "Fakten & Positionen", lead: "Was wir wissen müssen — Datenlage und unsere Position." },
  themen: { idx: 4, title: "Talking Points & Q&A", lead: "Was wollen wir mitnehmen — und worauf müssen wir antworten können?" },
  "qa-run": { idx: 5, title: "Q&A-Durchgang", lead: "Letzter Check: Sind alle Punkte für das Briefing abgehakt?" },
  freigabe: { idx: 6, title: "Briefing-Freigabe", lead: "Status, Öffentlichkeitsarbeit und Freigabe für das fertige Briefing." },
  nachbereitung: { idx: 7, title: "Nachbereitung", lead: "Was wurde besprochen? Ergebnisse, offene Punkte und Folgeaufgaben." },
};

import type { PreparationVisibleSections } from "../appointment-preparation-data/types";

const PHASE_VISIBILITY: Partial<Record<PhaseId, PreparationVisibleSections>> = {
  anlass: { sections: ["anlass"] },
  team: { sections: ["gespraechspartner", "begleitpersonen", "logistik", "programm"] },
  fakten: {
    sections: ["inhalte"],
    showFacts: true,
    showTalkingPoints: false,
    showQa: false,
    showInhalteHeaderCards: false,
    showInhalteRahmen: false,
  },
  themen: {
    sections: ["inhalte"],
    showFacts: false,
    showTalkingPoints: true,
    showQa: true,
    showInhalteHeaderCards: false,
    showInhalteRahmen: false,
  },
  freigabe: { sections: ["oeffentlichkeit"] },
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
          {phase === "anlass" && (
            <TemplatesPanel preparation={preparation} onApply={onUpdate} />
          )}
          {phase === "team" && (
            <SharingPanel preparation={preparation} onUpdate={onUpdate} />
          )}
          {(phase === "fakten" || phase === "themen") && (
            <LinkedItemsPanel preparation={preparation} />
          )}
          {(phase === "themen" || phase === "fakten") && (
            <PreparationMemoryPanel preparation={preparation} onUpdate={onUpdate} />
          )}
          {(phase === "fakten" || phase === "themen") && (
            <AiSuggestionsPanel
              preparation={preparation}
              appointmentTitle={appointmentDetails?.title}
              phase={phase}
              onUpdate={onUpdate}
            />
          )}
          <AppointmentPreparationDataTab
            preparation={preparation}
            appointmentDetails={appointmentDetails}
            onUpdate={onUpdate}
            onOpenAppointmentDetails={onOpenAppointmentDetails}
            visibleSections={PHASE_VISIBILITY[phase]}
          />
        </>
      )}

      {phase === "qa-run" && (
        <AppointmentPreparationChecklistTab preparation={preparation} onUpdate={onUpdate} />
      )}

      {phase === "freigabe" && (
        <>
          <AppointmentPreparationDataTab
            preparation={preparation}
            appointmentDetails={appointmentDetails}
            onUpdate={onUpdate}
            onOpenAppointmentDetails={onOpenAppointmentDetails}
            visibleSections={PHASE_VISIBILITY.freigabe}
          />
          <AppointmentPreparationDetailsTab preparation={preparation} onUpdate={onUpdate} />
        </>
      )}

      {phase === "nachbereitung" && (
        <>
          <DebriefPanel
            preparation={preparation}
            appointmentId={preparation.appointment_id}
            onUpdate={onUpdate}
          />
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle>Dokumente</CardTitle>
            </CardHeader>
            <CardContent>
              <AppointmentPreparationFileUpload
                preparationId={preparation.id}
                tenantId={preparation.tenant_id}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
