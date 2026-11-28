/**
 * Reine Regeln für die Kontaktsuche der Liste.
 *
 * Die Suche wird als PostgREST-`or`-Ausdruck an `read_secured_contacts`
 * geschickt. Werte werden doppelt zitiert, weil Kommas, Klammern und
 * Anführungszeichen sonst die Filtersyntax zerlegen (z. B. bei
 * "Müller, Hans" oder "Caritas (KV)"). Telefonfelder gehören dazu, damit
 * eine aus einem Briefkopf abgetippte Nummer gefunden wird.
 *
 * Reine Funktionen ohne Datenbankbezug: Die Liste und der Selbsttest nutzen
 * dieselbe Regel.
 */
export const CONTACT_SEARCH_FIELDS = [
  "name",
  "organization",
  "position",
  "email",
  "phone",
  "mobile_phone",
  "business_phone",
  "address",
] as const;

export type ContactSearchField = (typeof CONTACT_SEARCH_FIELDS)[number];

export const CONTACT_SEARCH_MAX_LENGTH = 120;

/** Entfernt Steuerzeichen, faltet Whitespace und begrenzt die Eingabelänge. */
export function normalizeContactSearchTerm(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CONTACT_SEARCH_MAX_LENGTH)
    .trim();
}

/** Zitiert einen LIKE-Wert so, dass PostgREST ihn als ein Literal liest. */
export function quotePostgrestPattern(term: string): string {
  const escaped = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

/**
 * Baut den `or`-Ausdruck für die Suche oder null, wenn nichts zu suchen ist.
 * Mehrere Felder werden mit ODER verknüpft.
 */
export function buildContactSearchFilter(
  raw: string,
  fields: readonly ContactSearchField[] = CONTACT_SEARCH_FIELDS,
): string | null {
  const term = normalizeContactSearchTerm(raw);
  if (!term) return null;

  const pattern = quotePostgrestPattern(term);
  return fields.map((field) => `${field}.ilike.${pattern}`).join(",");
}
