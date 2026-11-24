/**
 * Ist-Zeiten einer Besprechung.
 *
 * Die Agenda kennt bisher nur geplante Dauern (`duration_minutes`). Für die
 * Nachbereitung zählt die tatsächlich verbrauchte Zeit: je Punkt in
 * `actual_minutes`, für die laufende Sitzung ab `started_at`/`timer_started_at`.
 * Alle Funktionen sind rein und werden von Banner, Zusammenfassung und
 * Selbsttest gemeinsam genutzt.
 */

/** Verstrichene Sekunden seit einem Zeitpunkt; nie negativ, bei fehlendem Start 0. */
export function elapsedSeconds(startedAt: string | null | undefined, now: number = Date.now()): number {
  if (!startedAt) return 0;
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
}

/** Laufzeit als `mm:ss`, ab einer Stunde als `h:mm:ss`. */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/** Minuten aus Sekunden; kaufmännisch gerundet. */
export function toMinutes(seconds: number): number {
  return Math.max(0, Math.round(Math.max(0, seconds) / 60));
}

export interface ActualTimingItem {
  duration_minutes?: number | null;
  actual_minutes?: number | null;
  parent_id?: string | null;
  parentLocalKey?: string | null;
}

/** Summe der erfassten Ist-Minuten aller Hauptpunkte. */
export function actualTotalMinutes(items: ActualTimingItem[]): number {
  return items
    .filter((item) => !item.parent_id && !item.parentLocalKey)
    .reduce((sum, item) => sum + Math.max(0, item.actual_minutes ?? 0), 0);
}

/** Abweichung Ist minus Plan in Minuten; null, solange nichts geplant oder erfasst ist. */
export function timingDeviation(actualMinutes: number, plannedMinutes: number): number | null {
  if (actualMinutes <= 0 || plannedMinutes <= 0) return null;
  return actualMinutes - plannedMinutes;
}

/** Abweichung als Text, z. B. `+8 Min.` oder `−3 Min.`; im Rahmen bleibt es null. */
export function formatDeviation(actualMinutes: number, plannedMinutes: number): string | null {
  const deviation = timingDeviation(actualMinutes, plannedMinutes);
  if (deviation === null || deviation === 0) return null;
  const sign = deviation > 0 ? "+" : "−";
  return `${sign}${Math.abs(deviation)} Min.`;
}
