/**
 * Zähler dafür, wie der Zusagen-Vorschlag ankommt – ohne Gesprächsinhalt.
 *
 * Ablage: Nutzer-Einstellung in `user_preferences` unter
 * `office-feedback-promise-hints:<tenant>:<user>`. Es werden ausschließlich Anzahlen
 * gespeichert, kein Text.
 *
 * `shown` zählt, wie oft ein Vorschlag erschien – auch wenn danach niemand eine
 * Rückmeldung sendet. Die drei Ausgänge zählen nur tatsächlich gesendete Rückmeldungen.
 * Trefferquote daher immer gegen `shown` rechnen, nicht gegen die Summe der Ausgänge.
 */

export type PromiseHintOutcome = "unchanged" | "edited" | "discarded";

export interface PromiseHintStats {
  /** Vorschlag erschien, unabhängig vom weiteren Verlauf. */
  shown: number;
  /** Vorschlag unverändert übernommen und gesendet. */
  unchanged: number;
  /** Vorschlag vor dem Senden bearbeitet. */
  edited: number;
  /** Vorschlag verworfen und ohne Zusage gesendet. */
  discarded: number;
}

export const emptyPromiseHintStats: PromiseHintStats = { shown: 0, unchanged: 0, edited: 0, discarded: 0 };

/**
 * Ordnet eine gesendete Rückmeldung einem Ausgang zu. Ohne erkannten Vorschlag passiert
 * nichts (`null`), damit von Hand getippte Zusagen die Messung nicht verfälschen.
 */
export function promiseHintOutcome(
  suggestion: string | undefined,
  sentPromise: string | undefined,
): PromiseHintOutcome | null {
  const detected = suggestion?.trim();
  if (!detected) return null;
  const sent = sentPromise?.trim() ?? "";
  if (!sent) return "discarded";
  return sent === detected ? "unchanged" : "edited";
}

/**
 * Macht gespeicherte Zähler unschädlich: fehlende, alte oder kaputte Werte (undefined,
 * Text, `{ shown: 3 }`, negative Zahlen, NaN) werden zu 0. Die Messung darf nie werfen.
 *
 * `shown` ist mindestens die Summe der Ausgänge: Jeder gezählte Ausgang setzt einen
 * erschienenen Vorschlag voraus, sonst entstünde bei Altbeständen ohne `shown` eine
 * negative Zahl wirkungsloser Hinweise.
 */
export function normalizePromiseHintStats(value: unknown): PromiseHintStats {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const count = (candidate: unknown) =>
    typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0 ? Math.floor(candidate) : 0;
  const unchanged = count(source.unchanged);
  const edited = count(source.edited);
  const discarded = count(source.discarded);
  return {
    shown: Math.max(count(source.shown), unchanged + edited + discarded),
    unchanged,
    edited,
    discarded,
  };
}

/** Zählt einen erschienenen Vorschlag – auch ohne späteres Senden. */
export function countPromiseHintShown(stats: unknown): PromiseHintStats {
  const base = normalizePromiseHintStats(stats);
  return { ...base, shown: base.shown + 1 };
}

/** Erhöht genau einen Ausgang; unbekannte Ausgänge lassen die Zahlen unverändert. */
export function countPromiseHint(stats: unknown, outcome: PromiseHintOutcome | null): PromiseHintStats {
  const base = normalizePromiseHintStats(stats);
  if (!outcome) return base;
  // Erneut normalisieren, damit `shown` auch dann mindestens die Summe bleibt, wenn nur der Ausgang erhöht wurde.
  return normalizePromiseHintStats({ ...base, [outcome]: base[outcome] + 1 });
}

/** Vorschläge, die erschienen, aber in keiner gesendeten Rückmeldung endeten. */
export function promiseHintsWithoutFeedback(stats: unknown): number {
  const base = normalizePromiseHintStats(stats);
  return base.shown - (base.unchanged + base.edited + base.discarded);
}
