import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { NAV_MIN_WIDTH } from "@/hooks/useNavWidth";

const MIN_WIDTH = 320;
/** Mindestbreite, die dem Seiteninhalt neben dem angedockten Tageszettel bleibt. */
const MIN_CONTENT_WIDTH = 720;
const clampWidth = (width: number) => Math.max(MIN_WIDTH, Math.min(640, window.innerWidth * 0.45, width));

function readPreference(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

const DaySlipLayoutContext = createContext<{
  docked: boolean;
  /** Ob genug Platz für das Andocken bleibt (sonst bleibt der Zettel schwebend). */
  canDock: boolean;
  /** Fensterbreite, ab der Andocken möglich ist. */
  minDockWidth: number;
  desktop: boolean;
  /** Gemeldete Breite der Navigation; sie zählt zum festen Anteil neben dem Zettel. */
  setNavWidth: (width: number) => void;
  width: number;
  /** Platz, den der angedockte Tageszettel dem Inhalt rechts wegnimmt. */
  reservedWidth: number;
  host: HTMLDivElement | null;
  setDocked: (docked: boolean) => void;
  setWidth: (width: number) => void;
  setVisible: (visible: boolean) => void;
} | null>(null);

export const useDaySlipLayout = () => useContext(DaySlipLayoutContext);

export function DaySlipLayout({ children }: { children: ReactNode }) {
  const [preferredDocked, setDocked] = useState(() => readPreference("day-slip-docked") === "true");
  const [preferredWidth, updateWidth] = useState(() => {
    const saved = Number(readPreference("day-slip-dock-width"));
    return Math.min(640, Number.isFinite(saved) && saved >= MIN_WIDTH ? saved : 400);
  });
  const [screenWidth, setScreenWidth] = useState(() => window.innerWidth);
  // Bis die Navigation ihre Breite meldet, gilt ihr Mindestwert.
  const [navWidth, setNavWidth] = useState(NAV_MIN_WIDTH);
  const desktop = screenWidth >= 1024;
  const preferredWidthClamped = Math.max(MIN_WIDTH, Math.min(640, screenWidth * 0.45, preferredWidth));
  const [visible, setVisible] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  // Angedockt wird nur, wenn dem Inhalt neben Navigation und Zettel noch seine
  // Mindestbreite bleibt; sonst bliebe vom Inhalt zu wenig übrig.
  const minDockWidth = navWidth + MIN_CONTENT_WIDTH + MIN_WIDTH;
  const availableForDaySlip = Math.max(0, screenWidth - navWidth - MIN_CONTENT_WIDTH);
  const canDock = desktop && availableForDaySlip >= MIN_WIDTH;
  const docked = preferredDocked && canDock;
  const dockWidth = Math.min(preferredWidthClamped, availableForDaySlip);
  const width = docked ? dockWidth : preferredWidthClamped;
  const reservedWidth = docked && visible ? dockWidth : 0;

  useEffect(() => {
    const resize = () => {
      setScreenWidth(window.innerWidth);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("day-slip-docked", String(preferredDocked)); } catch { /* Optional preference. */ }
  }, [preferredDocked]);
  useEffect(() => {
    try { localStorage.setItem("day-slip-dock-width", String(preferredWidth)); } catch { /* Optional preference. */ }
  }, [preferredWidth]);

  return (
    <DaySlipLayoutContext.Provider value={{ docked, canDock, minDockWidth, desktop, setNavWidth, width, reservedWidth, host, setDocked, setWidth: value => updateWidth(clampWidth(value)), setVisible }}>
      <div className="flex min-h-app w-full">
        <div className="min-w-0 flex-1">{children}</div>
        <div ref={setHost} style={{ width: reservedWidth }} className="sticky top-0 h-app shrink-0" />
      </div>
    </DaySlipLayoutContext.Provider>
  );
}
