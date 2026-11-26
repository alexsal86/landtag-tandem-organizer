import { groupsFor } from "@/features/parlis/grouping";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";

export const parlisScenario: TestScenario = {
  id: "parlis",
  title: "Parlamentarische Vorgänge",
  description: "Prüft die Gruppierung und den Lesezugriff auf die Parlamentsdokumentation.",
  features: ["parlis.proceedings"],
  touches: [],
  checks: ["Monatsgruppierung, eindeutige Schlagwörter und leere Ressorts", "Importierte Vorgänge sind lesbar"],
  steps: [{
    id: "parlis-groups",
    label: "Monate, Schlagwörter und fehlende Ressorts korrekt zuordnen",
    kind: "logic",
    run: async () => {
      const row = { datum: "2026-11-26", deskriptoren: " Verkehr; Verkehr ; Nahverkehr; ", vorgangstyp: "Antrag", ressort: "", urheber: "Landesregierung" };
      return {
        ok: groupsFor(row, "datum").join() === "2026-11"
          && groupsFor(row, "deskriptoren").join() === "Verkehr,Nahverkehr"
          && groupsFor(row, "ressort").join() === "Ohne Angabe",
        message: "Jeder Vorgang zählt pro Schlagwort einmal und bleibt bei fehlendem Ressort sichtbar.",
      };
    },
  }, {
    id: "parlis-import-readable",
    label: "Import der 18. Wahlperiode ist lesbar",
    kind: "db",
    run: async () => {
      const { count, error } = await supabase.from("parlis_proceedings")
        .select("vorgangs_id", { count: "exact", head: true })
        .eq("legislature", 18);
      if (error) throw error;
      return {
        ok: (count ?? 0) >= 1036,
        message: `${count ?? 0} lesbare Vorgänge der 18. Wahlperiode (mindestens 1.036 erwartet).`,
      };
    },
  }],
};
