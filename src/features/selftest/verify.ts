import { supabase } from "@/integrations/supabase/client";
import type { StepResult } from "./types";

/** Vergleicht erwartete Felder gegen tatsächlich in der DB gespeicherte Werte. */
export async function expectFields(
  table: string,
  id: string,
  expected: Record<string, unknown>,
  label = "Felder",
): Promise<StepResult> {
  const columns = Object.keys(expected).join(",");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from(table as any) as any)
    .select(columns)
    .eq("id", id)
    .single();
  if (error || !data) {
    return { ok: false, message: `${label}: Re-Read fehlgeschlagen — ${error?.message ?? "leer"}` };
  }
  const mismatches: Array<{ field: string; expected: unknown; actual: unknown }> = [];
  for (const [k, v] of Object.entries(expected)) {
    const actual = (data as Record<string, unknown>)[k];
    if (!deepEqual(actual, v)) {
      mismatches.push({ field: k, expected: v, actual });
    }
  }
  if (mismatches.length > 0) {
    return {
      ok: false,
      message: `${label}: ${mismatches.length} Abweichung(en) — ${mismatches.map((m) => m.field).join(", ")}`,
      details: mismatches,
    };
  }
  return { ok: true, message: `${label}: ${Object.keys(expected).length} Felder verifiziert.` };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.join("|") !== bk.join("|")) return false;
    return ak.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

/** Klassifiziert Postgrest-/RLS-Fehler in eine verständliche Meldung. */
export function describeError(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return "Unbekannter Fehler";
  if (err.code === "42501" || /row-level security/i.test(err.message ?? "")) {
    return `RLS verweigert (${err.message}). Mögliche Ursachen: Session abgelaufen, fehlende aktive Tenant-Membership, oder user_id ≠ auth.uid().`;
  }
  return err.message ?? String(err);
}
