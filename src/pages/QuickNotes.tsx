import { useEffect } from "react";
import { WorkspaceToolbar } from "@/components/layout/WorkspaceToolbar";
import { OnboardingChecklistCard } from "@/components/onboarding/OnboardingChecklistCard";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { QuickNotesWorkspace } from "@/features/quick-notes/components/QuickNotesWorkspace";
import { trackPageVisit } from "@/hooks/useRecentlyVisited";

/**
 * Eigene Notizseite. Alle Notiz-Deep-Links (Benachrichtigungen, Tageszettel,
 * Suche) landen hier; ?highlight=<noteId> hebt die Zielnotiz hervor.
 */
export default function QuickNotes() {
  useEffect(() => {
    trackPageVisit("notes", "Notizen", "StickyNote", "/notes");
  }, []);

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full">
      <WorkspaceToolbar className="mx-auto w-full max-w-6xl pb-0">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">Notizen</h1>
          <p className="text-sm text-muted-foreground">
            Schnell erfassen, wiederfinden und mit Aufgabe, Vorgang oder Jour fixe verknüpfen.
          </p>
        </div>
      </WorkspaceToolbar>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8">
        <OnboardingChecklistCard className="mb-4" />
        <ErrorBoundary fallbackMessage="Notizen konnten nicht geladen werden. Bitte die Seite neu laden.">
          <QuickNotesWorkspace />
        </ErrorBoundary>
      </div>
    </div>
  );
}
