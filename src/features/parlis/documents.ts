import type { Database } from "@/integrations/supabase/types";
import { getPartyColor } from "@/features/election-districts/partyColors";
import { authorSegments } from "./authors";

export type Proceeding = Pick<Database["public"]["Tables"]["parlis_proceedings"]["Row"],
  "vorgangs_id" | "drucksache" | "vorgangstyp" | "datum" | "urheber" | "ressort" | "titel" | "deskriptoren"> & { url: string | null; deputies: [string, string][] };

export const parlisDateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

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
