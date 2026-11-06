import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Nur die generischen Prüf-/Cleanup-Helfer brauchen einen dynamischen Tabellennamen.
// Konkrete Szenario-Schreibzugriffe bleiben am vollständigen generierten Schema typisiert.
type DynamicTables = {
  public: {
    Tables: Record<string, {
      Row: { id: string } & Record<string, unknown>;
      Insert: Record<string, unknown>;
      Update: Record<string, unknown>;
      Relationships: [];
    }>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
export const selftestDatabase = supabase as unknown as SupabaseClient<DynamicTables>;
