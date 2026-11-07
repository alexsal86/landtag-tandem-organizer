import { supabase } from "@/integrations/supabase/client";

// Nur die generischen Prüf-/Cleanup-Helfer brauchen einen dynamischen Tabellennamen.
// Konkrete Szenario-Schreibzugriffe bleiben am vollständigen generierten Schema typisiert.
type DynResult<T> = PromiseLike<{ data: T; error: { message: string } | null }>;
interface DynFilter<T> extends DynResult<T> {
  eq(column: string, value: unknown): DynFilter<T>;
  like(column: string, pattern: string): DynFilter<T>;
  single(): DynResult<Record<string, unknown> | null>;
  maybeSingle(): DynResult<Record<string, unknown> | null>;
}
interface DynTable {
  select(columns: string): DynFilter<Array<Record<string, unknown>> | null>;
  delete(): DynFilter<null>;
}
interface DynamicDatabase {
  from(table: string): DynTable;
}

export const selftestDatabase = supabase as unknown as DynamicDatabase;
