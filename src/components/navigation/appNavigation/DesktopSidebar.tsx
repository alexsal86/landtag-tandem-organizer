import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { useUserPreference } from "@/hooks/useUserPreference";
import { useNavWidth } from "@/hooks/useNavWidth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDaySlipLayout } from "@/components/dayslip/DaySlipLayout";
import { AppNavigation } from "../AppNavigation";
import { COMPACT_SIDEBAR_WIDTH, isSidebarToggleShortcut, sidebarMode, SIDEBAR_MODE_PREF_KEY, type SidebarMode } from "./sidebarMode";

export function DesktopSidebar({ activeSection }: { activeSection: string }) {
  const { width, isResizing, startResize, setWidth, minWidth, maxWidth } = useNavWidth();
  const [preference, setPreference] = useUserPreference<SidebarMode>(SIDEBAR_MODE_PREF_KEY, "normal");
  const mode = sidebarMode(preference);
  const compact = mode === "compact";
  const ghost = mode === "ghost";
  const [revealed, setRevealed] = useState(false);
  const isMobile = useIsMobile();
  const setDaySlipNavWidth = useDaySlipLayout()?.setNavWidth;
  const reserved = isMobile || ghost ? 0 : compact ? COMPACT_SIDEBAR_WIDTH : width;
  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const focusOnReveal = useRef(false);

  useEffect(() => { setDaySlipNavWidth?.(reserved); }, [reserved, setDaySlipNavWidth]);

  const hideGhost = useCallback((restoreFocus = false) => {
    setRevealed(false);
    if (restoreFocus) requestAnimationFrame(() => launcher.current?.focus());
  }, []);

  const toggle = useCallback(() => {
    if (ghost) {
      hideGhost(true);
    } else {
      setPreference(compact ? "normal" : "compact");
    }
  }, [compact, ghost, hideGhost, setPreference]);

  useEffect(() => {
    if (isMobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSidebarToggleShortcut(event)) return;
      event.preventDefault();
      if (ghost && !revealed) {
        focusOnReveal.current = true;
        setRevealed(true);
      } else toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, ghost, revealed, toggle]);

  useEffect(() => {
    if (!ghost || !revealed || isMobile) return;
    if (focusOnReveal.current) {
      focusOnReveal.current = false;
      panel.current?.querySelector<HTMLElement>(".mission-search")?.focus();
    }

    // Radix menus and dialogs are rendered in portals. Keep the sidebar while
    // their triggers are expanded or an overlay across the document has focus.
    const timer = window.setInterval(() => {
      const navigation = panel.current;
      const active = document.activeElement;
      if (navigation?.matches(":hover") || launcher.current?.matches(":hover") ||
        (active && navigation?.contains(active)) ||
        navigation?.querySelector('[aria-haspopup][aria-expanded="true"]') ||
        active?.closest('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')) return;
      hideGhost();
    }, 200);
    return () => window.clearInterval(timer);
  }, [ghost, revealed, isMobile, hideGhost]);

  if (isMobile) return null;
  return (
    <>
      {ghost && !revealed && (
        <>
          <div className="mission-ghost-edge hidden md:block" aria-hidden="true"
            onPointerEnter={event => { if (event.pointerType === "mouse") setRevealed(true); }} />
          <button ref={launcher} type="button" className="mission-ghost-launch hidden md:flex" aria-label="Sidebar öffnen"
            onPointerEnter={event => { if (event.pointerType === "mouse" && document.activeElement !== event.currentTarget) setRevealed(true); }}
            onClick={() => { focusOnReveal.current = true; setRevealed(true); }}>
            <PanelLeftOpen className="size-3.5" aria-hidden="true" />
          </button>
        </>
      )}
      <div
        ref={panel}
        className="mission-shell hidden md:flex"
        data-ghost={ghost || undefined}
        data-resizing={isResizing || undefined}
        style={{ width: ghost ? width : reserved }}
        hidden={ghost && !revealed}
        inert={ghost && !revealed}
      >
        <AppNavigation activeSection={activeSection} compact={compact} ghost={ghost} onToggle={toggle}
          onNavigate={ghost ? () => hideGhost() : undefined} />
        {!compact && !ghost && (
          <div className="mission-resizer" role="separator" aria-label="Breite der Sidebar" aria-orientation="vertical"
            aria-valuenow={width} aria-valuemin={minWidth} aria-valuemax={maxWidth} tabIndex={0} onMouseDown={startResize}
            onKeyDown={event => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              setWidth(width + (event.key === "ArrowLeft" ? -10 : 10));
            }} />
        )}
      </div>
    </>
  );
}
