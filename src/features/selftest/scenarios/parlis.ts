import { authorSegments } from "@/features/parlis/authors";
import { groupsFor } from "@/features/parlis/grouping";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";

export const parlisScenario: TestScenario = {
  id: "parlis",
  title: "Parlamentarische Vorgänge",
  description: "Prüft die Gruppierung und den Lesezugriff auf die Parlamentsdokumentation.",
  features: ["parlis.proceedings"],
  touches: [],
  checks: ["Urhebertext mit Titeln und Namensbestandteilen bleibt vollständig", "Monatsgruppierung, eindeutige Schlagwörter und leere Ressorts", "Importierte Vorgänge sind lesbar", "Verknüpfte Urheber führen zu einem Mandat derselben Wahlperiode"],
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
    id: "parlis-inline-authors",
    label: "Urhebernamen mit Titeln und Namensbestandteilen im Originaltext verlinken",
    kind: "logic",
    run: async () => {
      const text = "Prof. Dr. Boris Weirauch (SPD), Uwe Freiherr von Wangenheim (AfD) u. a.";
      const deputies = new Map([["weirauch", "Boris Weirauch"], ["wangenheim", "Uwe von Wangenheim"]]);
      const segments = authorSegments(text, deputies);
      return {
        ok: segments.map(segment => segment.text).join("") === text
          && segments.find(segment => segment.profileKey === "weirauch")?.text === "Prof. Dr. Boris Weirauch"
          && segments.find(segment => segment.profileKey === "wangenheim")?.text === "Uwe Freiherr von Wangenheim"
          && segments.flatMap(segment => segment.party ?? []).join() === "SPD,AfD",
        message: "Originalnamen und Parteiklammern bleiben erhalten und werden passend ausgezeichnet.",
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
  }, {
    id: "parlis-deputy-profile",
    label: "Weirauchs Anfrage aus Drucksache 18/763 führt zum Abgeordnetenprofil",
    kind: "db",
    run: async () => {
      const { data: links, error } = await supabase.from("parlis_deputy_profiles")
        .select("profile_key, mandate_id").eq("legislature", 18).eq("vorgangs_id", "V-248711");
      if (error) throw error;
      const link = links.length === 1 ? links[0] : undefined;
      if (!link?.profile_key) return { ok: false, message: "Für die Anfrage fehlt ein eindeutiger Profillink." };
      const { data: history, error: profileError } = await supabase.rpc("get_analysis_deputy", { name_key: link.profile_key });
      if (profileError) throw profileError;
      const ok = Array.isArray(history) && history.some(row => row && typeof row === "object" && !Array.isArray(row)
        && row.id === link.mandate_id && row.period_number === 18);
      return { ok, message: ok ? "Profil und Parlis sind über dasselbe Mandat verbunden." : "Mandat im Profil nicht gefunden." };
    },
  }],
};
