import { useState, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const GlobalSearchCommand = lazyWithRetry(() =>
  import("@/components/search/GlobalSearchCommand").then((m) => ({
    default: m.GlobalSearchCommand,
  })),
);
const GlobalQuickNoteDialog = lazyWithRetry(() =>
  import("@/components/search/GlobalQuickNoteDialog").then((m) => ({
    default: m.GlobalQuickNoteDialog,
  })),
);
const GlobalDaySlipPanel = lazyWithRetry(() =>
  import("@/components/dayslip/GlobalDaySlipPanel").then((m) => ({
    default: m.GlobalDaySlipPanel,
  })),
);
const AppointmentRequestHost = lazyWithRetry(() =>
  import("@/features/appointment-requests/AppointmentRequestHost").then(
    (m) => ({ default: m.AppointmentRequestHost }),
  ),
);

const GlobalKnowledgeQuestionHost = lazyWithRetry(() =>
  import("@/features/knowledge/components/GlobalKnowledgeQuestionHost").then(
    (m) => ({ default: m.GlobalKnowledgeQuestionHost }),
  ),
);

export const GlobalOverlays = () => {
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

  useEffect(() => {
    const openNote = () => setQuickNoteOpen(true);
    window.addEventListener("openGlobalQuickNote", openNote);
    return () => window.removeEventListener("openGlobalQuickNote", openNote);
  }, []);

  // Global keyboard shortcut: Cmd/Ctrl + . (period). Cmd/Ctrl + Shift + . is handled by AppointmentRequestHost.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === "Period") {
        e.preventDefault();
        setQuickNoteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <GlobalSearchCommand />
      <GlobalKnowledgeQuestionHost />
      <GlobalQuickNoteDialog
        open={quickNoteOpen}
        onOpenChange={setQuickNoteOpen}
      />
      <GlobalDaySlipPanel />
      <AppointmentRequestHost />
    </>
  );
};
