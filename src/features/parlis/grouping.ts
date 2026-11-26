import type { Database } from "@/integrations/supabase/types";

export const dimensions = {
  datum: "Monat",
  vorgangstyp: "Vorgangstyp",
  ressort: "Ressort",
  urheber: "Urheber",
  deskriptoren: "Schlagwort",
} as const;

export type Dimension = keyof typeof dimensions;

export function groupsFor(row: Pick<Database["public"]["Tables"]["parlis_proceedings"]["Row"], Dimension>, dimension: Dimension) {
  if (dimension === "datum") return [row.datum.slice(0, 7)];
  if (dimension === "deskriptoren") {
    const tags = [...new Set(row.deskriptoren.split(";").map(tag => tag.trim()).filter(Boolean))];
    return tags.length ? tags : ["Ohne Angabe"];
  }
  return [row[dimension].trim() || "Ohne Angabe"];
}

