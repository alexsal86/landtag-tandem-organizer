import { useState, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { OPEN_GLOBAL_QUICK_NOTE } from "@/features/quick-notes/globalCapture";

import { GlobalSearchCommand } from "@/components/search/GlobalSearchCommand";

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

  // Global keyboard shortcut: Cmd/Ctrl + . (period) on every page, also while
  // typing in an editor. Cmd/Ctrl + Shift + . is handled by AppointmentRequestHost.
  useEffect(() => {
    const openNote = () => setQuickNoteOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.repeat ||
        e.isComposing ||
        e.shiftKey ||
        e.altKey ||
        !(e.metaKey || e.ctrlKey) ||
        e.code !== "Period"
      )
        return;
      e.preventDefault();
      openNote();
    };
    window.addEventListener(OPEN_GLOBAL_QUICK_NOTE, openNote);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(OPEN_GLOBAL_QUICK_NOTE, openNote);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <GlobalSearchCommand />
      <GlobalKnowledgeQuestionHost />
      {quickNoteOpen && <GlobalQuickNoteDialog open onOpenChange={setQuickNoteOpen} />}
      <GlobalDaySlipPanel />
      <AppointmentRequestHost />
    </>
  );
};
