import { useEffect } from "react";

interface ShortcutHandlers {
  onNextPhase?: () => void;
  onPrevPhase?: () => void;
  onToggleFocus?: () => void;
  onOpenBriefing?: () => void;
  onShowHelp?: () => void;
}

export function useAppointmentPreparationShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || target?.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      if (!isEditable && e.key === "?" && !mod) {
        e.preventDefault();
        handlers.onShowHelp?.();
        return;
      }
      if (!mod) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          handlers.onNextPhase?.();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlers.onPrevPhase?.();
          break;
        case "f":
        case "F":
          e.preventDefault();
          handlers.onToggleFocus?.();
          break;
        case "b":
        case "B":
          e.preventDefault();
          handlers.onOpenBriefing?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlers]);
}
