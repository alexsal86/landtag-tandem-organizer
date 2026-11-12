export const LEGISLATURE_END = "2031-03-31";
export const CITIZEN_REVIEW_MONTHS = 24;

export const LEGAL_BASIS_OPTIONS = [
  { value: "mandate_public_interest", label: "Mandatsaufgabe / Bürgeranliegen (Art. 6 Abs. 1 lit. e)" },
  { value: "legitimate_interest", label: "Berechtigtes Interesse / Vernetzung (Art. 6 Abs. 1 lit. f)" },
  { value: "consent", label: "Einwilligung (Art. 6 Abs. 1 lit. a)" },
  { value: "contract", label: "Vertrag / Dienstleister (Art. 6 Abs. 1 lit. b)" },
] as const;

export const SOURCE_ORIGIN_OPTIONS = [
  { value: "citizen_inquiry", label: "Bürgeranfrage" },
  { value: "office_hour", label: "Bürgersprechstunde" },
  { value: "event", label: "Termin / Visitenkarte" },
  { value: "public_register", label: "Öffentliches Verzeichnis" },
  { value: "recommendation", label: "Empfehlung" },
  { value: "import", label: "Import" },
  { value: "other", label: "Sonstiges" },
] as const;

export function defaultLegalBasis(category: string | null | undefined): string {
  return category === "citizen" ? "mandate_public_interest" : "legitimate_interest";
}

/** Bürger: 24 Monate ab Stichtag; alle anderen: Ende der Legislaturperiode. */
export function defaultReviewDate(category: string | null | undefined, from: Date = new Date()): string {
  if (category !== "citizen") return LEGISLATURE_END;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + CITIZEN_REVIEW_MONTHS, from.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

export function retentionRuleText(category: string | null | undefined): string {
  return category === "citizen"
    ? "Bürger/innen: Prüfung 24 Monate nach Erfassung bzw. letzter Bestätigung."
    : "Alle anderen Kontakte: Prüfung zum Ende der Legislaturperiode (31.03.2031).";
}

export function isReviewDue(reviewDate: string | null | undefined, today: Date = new Date()): boolean {
  if (!reviewDate) return true;
  return reviewDate <= today.toISOString().slice(0, 10);
}

export function labelFor(options: ReadonlyArray<{ value: string; label: string }>, v?: string | null) {
  return options.find((o) => o.value === v)?.label ?? "—";
}
