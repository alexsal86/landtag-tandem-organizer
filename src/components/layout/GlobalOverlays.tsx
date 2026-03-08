import { useState, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const GlobalSearchCommand = lazyWithRetry(() =>
  import("@/components/GlobalSearchCommand").then(m => ({ default: m.GlobalSearchCommand }))
);
const GlobalQuickNoteDialog = lazyWithRetry(() =>
  import("@/components/GlobalQuickNoteDialog").then(m => ({ default: m.GlobalQuickNoteDialog }))
);
const GlobalDaySlipPanel = lazyWithRetry(() =>
  import("@/components/GlobalDaySlipPanel").then(m => ({ default: m.GlobalDaySlipPanel }))
);

export const GlobalOverlays = () => {
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

  // Global keyboard shortcut: Cmd/Ctrl + . (period)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setQuickNoteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <GlobalSearchCommand />
      <GlobalQuickNoteDialog open={quickNoteOpen} onOpenChange={setQuickNoteOpen} />
      <GlobalDaySlipPanel />
    </>
  );
};
