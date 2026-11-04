import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const MIN_WIDTH = 320;
const clampWidth = (width: number) => Math.max(MIN_WIDTH, Math.min(640, window.innerWidth * 0.45, width));

function readPreference(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

const DaySlipLayoutContext = createContext<{
  docked: boolean;
  desktop: boolean;
  width: number;
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
  const desktop = screenWidth >= 1024;
  const width = Math.max(MIN_WIDTH, Math.min(640, screenWidth * 0.45, preferredWidth));
  const [visible, setVisible] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const docked = preferredDocked && desktop;

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
    <DaySlipLayoutContext.Provider value={{ docked, desktop, width, host, setDocked, setWidth: value => updateWidth(clampWidth(value)), setVisible }}>
      <div className="flex min-h-app w-full">
        <div className="min-w-0 flex-1">{children}</div>
        <div ref={setHost} style={{ width: docked && visible ? width : 0 }} className="sticky top-0 h-app shrink-0" />
      </div>
    </DaySlipLayoutContext.Provider>
  );
}
