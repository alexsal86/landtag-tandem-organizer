import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { HistoryEntry, HistoryLine, HistoryLink } from "./historyModel";

export const historyQueryKey = ["ministry-history"];

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>) {
  const size = 500;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

export async function loadMinistryHistory(signal: AbortSignal) {
  const [lines, entries, links] = await Promise.all([
    readAll<HistoryLine>((from, to) => supabase.from("ministry_history_lines").select("*").order("id").range(from, to).abortSignal(signal)),
    readAll<HistoryEntry>((from, to) => supabase.from("ministry_history_entries").select("*").order("id").range(from, to).abortSignal(signal)),
    readAll<HistoryLink>((from, to) => supabase.from("ministry_history_links").select("*")
      .order("effective_on").order("predecessor_id").order("successor_id").range(from, to).abortSignal(signal)),
  ]);
  return {
    lines: lines.sort((a, b) => a.label.localeCompare(b.label, "de")),
    entries: entries.sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.name.localeCompare(b.name, "de")),
    links,
  };
}

export async function saveHistoryEntry(values: Omit<TablesInsert<"ministry_history_entries">, "id" | "revision">, existing?: HistoryEntry) {
  if (!existing) {
    const { error } = await supabase.from("ministry_history_entries").insert(values);
    if (error) throw new Error(error.message);
    return;
  }
  const { kind: _kind, ...changes } = values;
  const { data, error } = await supabase.from("ministry_history_entries").update(changes)
    .eq("id", existing.id).eq("revision", existing.revision).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Der Eintrag wurde inzwischen geändert. Bitte schließe den Dialog und öffne den Eintrag erneut.");
}

export async function confirmHistoryEntries(entries: HistoryEntry[]) {
  const { error } = await supabase.rpc("confirm_ministry_history_assignments", {
    expected_entries: entries.map(({ id, revision }) => ({ id, revision })),
  });
  if (error) throw new Error(error.message);
}
