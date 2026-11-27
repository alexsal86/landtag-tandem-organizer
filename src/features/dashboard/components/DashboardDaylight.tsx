import { useEffect, useRef } from "react";
import { berlinDateTimeValue } from "@/utils/berlinDate";

function toneFor(hour: number) {
  if (hour < 6 || hour >= 21) return "rgba(30,41,100,.22)";
  if (hour < 10) return "rgba(96,165,250,.22)";
  if (hour < 15) return "rgba(87,171,39,.10)";
  if (hour < 18) return "rgba(251,191,36,.20)";
  return "rgba(139,92,246,.18)";
}

function applyDaylight(element: HTMLDivElement) {
  const [hours, minutes] = berlinDateTimeValue(new Date()).slice(-5).split(":").map(Number);
  const hour = hours + minutes / 60;
  // From left to right between 06:00 and 21:00, then back overnight.
  const progress = hour >= 6 && hour < 21
    ? (hour - 6) / 15
    : (hour < 6 ? 6 - hour : 30 - hour) / 9;

  element.style.setProperty("--dashboard-daylight-tone", toneFor(hour));
  element.style.setProperty("--dashboard-daylight-position", `${24 + progress * 52}%`);
}

export function DashboardDaylight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => applyDaylight(element);
    update();
    const timer = window.setInterval(update, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <div ref={ref} aria-hidden="true" className="dashboard-daylight" />;
}
