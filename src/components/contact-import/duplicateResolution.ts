import type { TablesUpdate } from "@/integrations/supabase/types";

/**
 * Pure rules for resolving import duplicates.
 *
 * "merge" keeps the existing values and only fills gaps (plus appends notes and
 * unites tags), so nothing that already exists is lost. "overwrite" replaces
 * conflicting values with the imported row. Both never touch identity,
 * tenant or audit columns, and the import never deletes a contact.
 *
 * This module stays free of Supabase access so the selftest can verify the
 * rules directly (kind: "logic").
 */

export type DuplicateResolutionMode = "merge" | "overwrite";

export interface DuplicateResolution {
  /** Only the columns that actually change, ready for an update. */
  payload: TablesUpdate<"contacts">;
  filledFields: string[];
  overwrittenFields: string[];
  appendedNote: boolean;
}

/** Columns an import row may write to an existing contact. */
const WRITABLE_FIELDS = new Set([
  "name",
  "first_name",
  "last_name",
  "title",
  "position",
  "organization",
  "organization_id",
  "address",
  "birthday",
  "website",
  "linkedin",
  "twitter",
  "facebook",
  "instagram",
  "xing",
  "mobile_phone",
  "business_phone",
  "business_street",
  "business_house_number",
  "business_postal_code",
  "business_city",
  "business_country",
  "email",
  "phone",
  "notes",
  "category",
  "priority",
  "contact_type",
  "gender",
  "is_favorite",
]);

/**
 * Fields the manual merge dialog (DuplicateContactsSheet -> MergeContactsDialog)
 * compares field by field. The duplicate sheet loads exactly these columns
 * (plus tags), so the merge rules below can fill them from the secondary
 * contact just like an import would.
 */
export const MANUAL_MERGE_FIELDS = [
  "name",
  "email",
  "phone",
  "organization",
  "position",
  "business_city",
  "address",
  "birthday",
  "website",
  "notes",
] as const;

const NOTE_SEPARATOR = "\n\n";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(tags)];
}

export function resolveDuplicateContact(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  mode: DuplicateResolutionMode,
): DuplicateResolution {
  const payload: Record<string, string | string[] | null> = {};
  const filledFields: string[] = [];
  const overwrittenFields: string[] = [];
  let appendedNote = false;

  for (const [field, rawValue] of Object.entries(incoming)) {
    if (!WRITABLE_FIELDS.has(field) || field === "tags") continue;

    const value = asText(rawValue);
    if (!value) continue;

    const current = asText(existing[field]);
    if (!current) {
      payload[field] = value;
      filledFields.push(field);
      continue;
    }
    if (current === value) continue;

    if (field === "notes" && mode === "merge") {
      payload.notes = `${current}${NOTE_SEPARATOR}${value}`;
      filledFields.push(field);
      appendedNote = true;
      continue;
    }

    if (mode === "overwrite") {
      payload[field] = value;
      overwrittenFields.push(field);
    }
  }

  const existingTags = asTags(existing.tags);
  const unitedTags = [...new Set([...existingTags, ...asTags(incoming.tags)])];
  if (unitedTags.length !== existingTags.length) {
    payload.tags = unitedTags;
    filledFields.push("tags");
  }

  return {
    payload: payload as TablesUpdate<"contacts">,
    filledFields,
    overwrittenFields,
    appendedNote,
  };
}
