import { documentParties, keywords } from "@/features/parlis/documents";
import { authorSegments, hasMultipleAuthors } from "@/features/parlis/authors";
import { groupsFor } from "@/features/parlis/grouping";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";

export const parlisScenario: TestScenario = {
  id: "parlis",
  title: "Parlamentarische Vorgänge",
  description: "Prüft die Gruppierung und den Lesezugriff auf die Parlamentsdokumentation.",
  features: ["parlis.proceedings"],
  touches: [],
  checks: ["Schlagwortvorschläge bei Eingabe begrenzen", "Serverseitige Suche und begrenzte Dokumentenseiten", "Schlagwörter, Fraktionsfilter und mehrere Urheber", "Urhebertext mit Titeln und Namensbestandteilen bleibt vollständig", "Monatsgruppierung, eindeutige Schlagwörter und leere Ressorts", "Importierte Vorgänge sind lesbar", "Verknüpfte Urheber führen zu einem Mandat derselben Wahlperiode"],
  steps: [{
    id: "parlis-groups",
    label: "Monate, Schlagwörter und fehlende Ressorts korrekt zuordnen",
    kind: "logic",
    run: async () => {
      const row = { datum: "2026-11-26", deskriptoren: " Verkehr; Verkehr ; Nahverkehr; ", vorgangstyp: "Antrag", ressort: "", urheber: "Landesregierung" };
      return {
        ok: groupsFor(row, "datum").join() === "2026-11"
          && groupsFor({ ...row, datum: null }, "datum").join() === "Ohne Angabe"
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
    id: "parlis-author-presentation",
    label: "Parteien ohne Klammern und mehrere Urheber erkennen",
    kind: "logic",
    run: async () => {
      const text = "Dr. Boris Weirauch (SPD) u. a.";
      const authors = authorSegments(text, new Map([["weirauch", "Boris Weirauch"]]), true);
      const role = "Cem Özdemir (Ministerpräsident)";
      return {
        ok: authors.map(segment => segment.text).join("") === "Dr. Boris Weirauch SPD u. a."
          && authors.find(segment => segment.profileKey === "weirauch")?.text === "Dr. Boris Weirauch"
          && hasMultipleAuthors(text, authors)
          && authorSegments(role, undefined, true).map(segment => segment.text).join("") === role
          && keywords(" Bildung ; ; Schule; Bildung").join() === "Bildung,Schule"
          && documentParties("Fraktion GRÜNE, Fraktion der CDU").join() === "GRÜNE,CDU",
        message: "Parteiklammern entfallen; Rollen, Profillinks und Miturheber bleiben erkennbar.",
      };
    },
  }, {
    id: "parlis-import-readable",
    label: "Importe der 17. und 18. Wahlperiode sind lesbar",
    kind: "db",
    run: async () => {
      const imports = await Promise.all([17, 18].map(async legislature => {
        const { count, error } = await supabase.from("parlis_proceedings")
          .select("vorgangs_id", { count: "exact", head: true })
          .eq("legislature", legislature);
        if (error) throw error;
        return count ?? 0;
      }));
      return {
        ok: imports[0] >= 9855 && imports[1] >= 1036,
        message: `17. Wahlperiode: ${imports[0]} Vorgänge. 18. Wahlperiode: ${imports[1]} Vorgänge.`,
      };
    },
  }, {
    id: "parlis-pages",
    label: "Dokumente in getrennten Seiten von höchstens 20 Vorgängen abrufen",
    kind: "db",
    run: async () => {
      const [first, second, search] = await Promise.all([
        supabase.rpc("parlis_page", { period: 17 }),
        supabase.rpc("parlis_page", { period: 17, page_offset: 20 }),
        supabase.rpc("parlis_page", { period: 18, search_text: "V-248711" }),
      ]);
      for (const page of [first, second, search]) if (page.error) throw page.error;
      const ids = (value: typeof first.data) =>
        value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.rows)
          ? value.rows.flatMap(row => row && typeof row === "object" && !Array.isArray(row) && typeof row.vorgangs_id === "string" ? [row.vorgangs_id] : [])
          : [];
      const firstIds = ids(first.data);
      const secondIds = ids(second.data);
      return {
        ok: firstIds.length === 20 && secondIds.length === 20
          && secondIds.every(id => !firstIds.includes(id))
          && ids(search.data).join() === "V-248711",
        message: "Seiten bleiben begrenzt und die Suche findet Vorgänge außerhalb der geladenen Seite.",
      };
    },
  }, {
    id: "parlis-topic-suggestions",
    label: "Schlagwörter erst auf Suche und höchstens 20 Vorschläge abrufen",
    kind: "db",
    run: async () => {
      const [options, short, results] = await Promise.all([
        supabase.rpc("parlis_filter_options", { period: 17 }),
        supabase.rpc("parlis_topic_suggestions", { period: 17, term: "s" }),
        supabase.rpc("parlis_topic_suggestions", { period: 17, term: "sch" }),
      ]);
      for (const response of [options, short, results]) if (response.error) throw response.error;
      return {
        ok: !!options.data && typeof options.data === "object" && !("topics" in options.data)
          && short.data?.length === 0 && !!results.data?.length && results.data.length <= 20,
        message: "Die Startoptionen enthalten nur Typen und Fraktionen; Vorschläge sind begrenzt.",
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
