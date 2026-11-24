import { supabase } from "@/integrations/supabase/client";

/**
 * Moves every reference of a merged-away contact to the surviving contact.
 *
 * The list mirrors the foreign keys that point at `contacts` in the generated
 * database types. Tables with a unique pair constraint (for example
 * `case_file_contacts(case_file_id, contact_id)`) would reject the move when the
 * surviving contact already holds the same row, so those duplicates are dropped
 * first.
 */
export interface ContactLinkTarget {
  table: string;
  /** Column that stays unique together with `contact_id`. */
  dedupeColumn?: string;
}

export const CONTACT_LINK_TARGETS: readonly ContactLinkTarget[] = [
  { table: "appointment_contacts", dedupeColumn: "appointment_id" },
  { table: "appointments" },
  { table: "call_logs" },
  { table: "case_file_contacts", dedupeColumn: "case_file_id" },
  { table: "case_items" },
  { table: "contact_activities" },
  { table: "contact_briefing_memory" },
  { table: "contact_topics", dedupeColumn: "topic_id" },
  { table: "contact_usage_stats", dedupeColumn: "user_id" },
  { table: "distribution_list_members", dedupeColumn: "distribution_list_id" },
  { table: "document_contacts", dedupeColumn: "document_id" },
  { table: "facts" },
  { table: "funding_participants", dedupeColumn: "funding_id" },
];

type LinkRow = { id: string } & Record<string, unknown>;

/**
 * Ids of secondary rows whose unique partner column is already taken by the
 * surviving contact; only those rows are dropped, all others keep their data.
 */
export function duplicateLinkIds(
  target: ContactLinkTarget,
  survivingRows: LinkRow[],
  mergedAwayRows: LinkRow[],
): string[] {
  const { dedupeColumn } = target;
  if (!dedupeColumn) return [];

  const taken = new Set(
    survivingRows
      .map((row) => row[dedupeColumn])
      .filter((value): value is string => typeof value === "string"),
  );

  return mergedAwayRows
    .filter((row) => typeof row[dedupeColumn] === "string" && taken.has(row[dedupeColumn] as string))
    .map((row) => row.id);
}

interface RowsResult {
  data: LinkRow[] | null;
  error: { message: string } | null;
}

interface MutationResult {
  error: { message: string } | null;
}

type Filtered<T> = PromiseLike<T> & {
  eq: (column: string, value: string) => Filtered<T>;
};

interface ContactTableApi {
  select: (columns: string) => {
    eq: (column: string, value: string) => Filtered<RowsResult>;
  };
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => Filtered<MutationResult>;
  };
  delete: () => {
    in: (column: string, values: string[]) => PromiseLike<MutationResult>;
  };
}

// Table and column names are data, so only the builder surface used here is typed.
const contactTable = supabase as unknown as { from: (table: string) => ContactTableApi };

export interface ContactLinkFailure {
  table: string;
  message: string;
}

/**
 * Re-points all contact references and returns the tables that could not be
 * moved. Callers must keep the merged-away contact when a failure is reported,
 * otherwise its cascading deletes would remove the remaining links.
 */
export async function moveContactLinks(
  survivingContactId: string,
  mergedAwayContactId: string,
  tenantId: string,
): Promise<ContactLinkFailure[]> {
  const failures: ContactLinkFailure[] = [];

  for (const target of CONTACT_LINK_TARGETS) {
    try {
      const { dedupeColumn } = target;
      let duplicateIds: string[] = [];

      if (dedupeColumn) {
        const [survivingRows, mergedAwayRows] = await Promise.all([
          contactTable.from(target.table).select(`id, ${dedupeColumn}`).eq("contact_id", survivingContactId),
          contactTable.from(target.table).select(`id, ${dedupeColumn}`).eq("contact_id", mergedAwayContactId),
        ]);
        if (survivingRows.error) throw new Error(survivingRows.error.message);
        if (mergedAwayRows.error) throw new Error(mergedAwayRows.error.message);
        duplicateIds = duplicateLinkIds(target, survivingRows.data ?? [], mergedAwayRows.data ?? []);
      }

      if (duplicateIds.length > 0) {
        const { error } = await contactTable.from(target.table).delete().in("id", duplicateIds);
        if (error) throw new Error(error.message);
      }

      const { error } = await contactTable
        .from(target.table)
        .update({ contact_id: survivingContactId })
        .eq("contact_id", mergedAwayContactId);
      if (error) throw new Error(error.message);
    } catch (error) {
      failures.push({
        table: target.table,
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  }

  // People filed under a merged-away organization follow the surviving contact.
  try {
    const { error } = await contactTable
      .from("contacts")
      .update({ organization_id: survivingContactId })
      .eq("organization_id", mergedAwayContactId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
  } catch (error) {
    failures.push({
      table: "contacts.organization_id",
      message: error instanceof Error ? error.message : "Unbekannter Fehler",
    });
  }

  return failures;
}
