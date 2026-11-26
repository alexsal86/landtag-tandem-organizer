import type { Database } from "@/integrations/supabase/types";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { authorSegments } from "./authors";

export type Proceeding = Pick<Database["public"]["Tables"]["parlis_proceedings"]["Row"],
  "vorgangs_id" | "drucksache" | "vorgangstyp" | "datum" | "urheber" | "ressort" | "titel" | "deskriptoren" | "pdf_url" | "dokument_url">;

export const number = new Intl.NumberFormat("de-DE");

export function documentCount(count: number) {
  return `${number.format(count)} ${count === 1 ? "Dokument" : "Dokumente"}`;
}

export function keywords(value: string) {
  return [...new Set(value.split(";").map(keyword => keyword.trim()).filter(Boolean))];
}

export function documentParties(authors: string) {
  return authorSegments(authors).flatMap(({ party }) =>
    party && getPartyColor(party) !== getPartyColor() ? [party] : []);
}

export function dateGroups(sorted: Proceeding[], limit: number) {
  const days = new Map<string, { count: number; rows: Proceeding[] }>();
  sorted.forEach((row, index) => {
    const day = days.get(row.datum) ?? { count: 0, rows: [] };
    day.count++;
    if (index < limit) day.rows.push(row);
    days.set(row.datum, day);
  });
  return [...days].filter(([, day]) => day.rows.length);
}
