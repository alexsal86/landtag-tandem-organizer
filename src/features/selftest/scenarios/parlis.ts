import { parlisDeputyUrl } from "@/features/parlis/navigation";
import { documentParties, keywords } from "@/features/parlis/documents";
import { authorSegments, hasMultipleAuthors } from "@/features/parlis/authors";
import { groupsFor } from "@/features/parlis/grouping";
import { parseDocumentDetails, signerSummary, textSegments } from "@/features/parlis/details";
import { legislativePeriods, ministers, ministryPhases, periodsForPhase, phasesForLine, ressortLines } from "@/features/ministries-history/data";
import { currentLegislature, knownLegislatures, ministriesForLegislature } from "@/features/parlis/ministryAdminModel";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";

export const parlisScenario: TestScenario = {
  id: "parlis",
  title: "Parlamentarische Vorgänge",
  description: "Prüft die Gruppierung und den Lesezugriff auf die Parlamentsdokumentation.",
  features: ["parlis.proceedings", "parlis.ministry-topics", "parlis.initiative-rankings", "parlis.ministry-history"],
  touches: [],
  checks: ["Geprüfte Namensvarianten auf die richtigen Abgeordnetenprofile verlinken", "Gespeicherte Initiativenbilanz mit begrenzten Ranglisten", "Ressortvorschläge für mehrere Wahlperioden", "Laufende Wahlperiode und ihre Ministerien in der Administration", "Vorgangstypen der 17. Wahlperiode im Profil zusammenfassen", "Fünf persönlich zugeordnete Anträge mit gefiltertem Link im Profil", "Schlagwortvorschläge bei Eingabe begrenzen", "Serverseitige Suche und begrenzte Dokumentenseiten", "Schlagwörter, Fraktionsfilter und mehrere Urheber", "Urhebertext mit Titeln und Namensbestandteilen bleibt vollständig", "Monatsgruppierung, eindeutige Schlagwörter und leere Ressorts", "Unterzeichner, Texte und Tabellenzeilen kommen aus dem Detail-JSON", "Importierte Vorgänge sind lesbar", "Verknüpfte Urheber führen zu einem Mandat derselben Wahlperiode"],
  steps: [{
    id: "parlis-ministry-current-period",
    label: "Administration führt nur die Ministerien der laufenden Wahlperiode",
    kind: "logic",
    run: async () => {
      const periods = [
        { number: 17, starts_on: "2021-05-01", ends_on: "2026-04-30", is_current: false },
        { number: 18, starts_on: "2026-05-01", ends_on: "2031-04-30", is_current: true },
      ];
      const sources = [
        { legislature: 17, ressort: "Ministerium für Kultus, Jugend und Sport", requests: 40, suggested_line: "education" },
        { legislature: 18, ressort: "Ministerium für Kultus", requests: 12, suggested_line: "education" },
      ];
      const suggestions = [
        { legislature: 18, ressort: "Ministerium für Kultus", line_id: "education" },
        { legislature: 18, ressort: "Staatsministerium", line_id: "state" },
      ];
      const current = currentLegislature(periods, sources, "2026-11-27");
      const rows = ministriesForLegislature(18, sources, suggestions);
      const dateOnly = currentLegislature(periods.map(period => ({ ...period, is_current: false })), sources, "2026-11-27");
      const fallback = currentLegislature([], [{ legislature: 12 }, { legislature: 18 }], "2026-11-27");
      const kultus = rows.find(row => row.ressort === "Ministerium für Kultus");
      const state = rows.find(row => row.ressort === "Staatsministerium");
      return {
        ok: current === 18 && dateOnly === 18 && fallback === 18
          && rows.length === 2
          && kultus?.requests === 12 && kultus.suggestedLine === "education"
          && state?.requests === 0 && state.suggestedLine === "state"
          && !rows.some(row => row.ressort.includes("Jugend und Sport"))
          && knownLegislatures(sources, suggestions).join() === "17,18",
        message: "Die Administration zeigt die markierte laufende Wahlperiode samt Vorschlägen ohne Anfragen und blendet frühere Ministerien aus der Hauptliste aus.",
      };
    },
  }, {
    id: "parlis-ministry-history",
    label: "Namensgeschichte der Ministerien belegt und den Ressortlinien zugeordnet",
    kind: "logic",
    run: async () => {
      const lineIds = new Set(ressortLines.map(line => line.id));
      const sourced = ministryPhases.every(phase => phase.source.citation.length > 0 && lineIds.has(phase.lineId));
      const kultus = phasesForLine("education").find(phase => phase.from === "1954-08-06");
      const sozial = ministryPhases.find(phase => phase.id === "social-1996");
      const periodDates = legislativePeriods[0]?.from === "1952-03-25"
        && legislativePeriods.length === 18
        && legislativePeriods[17]?.to === "2031-04-30";
      const ministerLines = new Set(ministers.map(term => term.lineId));
      const alleBelegt = ministryPhases.every(phase => phase.verified);
      const laendlicherRaum = ministryPhases.find(phase => phase.id === "rural-1987");
      const forsten = ministryPhases.find(phase => phase.id === "rural-1980");
      const umwelt2010 = ministryPhases.find(phase => phase.id === "environment-2010");
      return {
        ok: sourced
          && ministryPhases.length >= 40
          && kultus?.source.citation === "GBl. 1954 S. 109"
          && sozial?.name === "Sozialministerium (SM)"
          && sozial !== undefined && periodsForPhase(sozial).includes(12)
          && periodDates
          && alleBelegt
          && laendlicherRaum?.name.includes("ländlichen Raum") === true
          && laendlicherRaum.name.includes("Ernährung") === false
          && forsten?.source.citation === "GBl. 1980 S. 361"
          && umwelt2010?.source.citation === "GBl. 2010 S. 321"
          && ressortLines.every(line => ministerLines.has(line.id)),
        message: "Jede Phase ist im Gesetzblatt belegt und nennt ihre Ressortlinie; die Wahlperioden nutzen die Systemzeiträume, und jede Ressortlinie hat mindestens eine belegte Amtszeit.",
      };
    },
  }, {
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
    id: "parlis-document-details",
    label: "Detail-JSON liefert Unterzeichner und Texte, unbrauchbare Daten werden verworfen",
    kind: "logic",
    run: async () => {
      const details = parseDocumentDetails({
        vorgangsId: "V-246384",
        drucksache: "18/6",
        signers: ["Sascha Binder", "Dorothea Kliche-Behnke", "Boris Weirauch"],
        signerParty: "SPD",
        wholeFaction: true,
        answer: { signatory: "Hoffmeister-Kraut", role: "Ministerin für Wirtschaft" },
        questionText: "Der Landtag wolle beschließen,",
        answerText: "Mit Schreiben vom 26. Mai 2026",
      });
      const broken = parseDocumentDetails({ drucksache: "18/6" });
      const withTable = parseDocumentDetails({
        vorgangsId: "V-246382",
        questionText: "Vorbemerkung\n<<TABELLE 1>>\nNachbemerkung",
        tables: [{ page: 6, rows: [["", "2015", "2016"], ["Rems-Murr-Kreis"], ["Beschäftigte", "139.311", "143.353"]] }],
      });
      const segments = textSegments(withTable!.questionText, withTable!.tables);
      const table = segments.find(segment => segment.kind === "table");
      return {
        ok: signerSummary(details!) === "Sascha Binder, Dorothea Kliche-Behnke, Boris Weirauch (SPD, gesamte Fraktion)"
          && details?.answer.signatory === "Hoffmeister-Kraut"
          && details?.questionText === "Der Landtag wolle beschließen,"
          && broken === null
          && segments.length === 3
          && segments[0].kind === "text" && segments[2].kind === "text"
          && table?.kind === "table"
          && table.table.rows.length === 3
          && table.table.rows[2][1] === "139.311"
          && table.table.page === 6,
        message: "Unterzeichner, Antwort und Texte werden gelesen; Tabellenmarker werden zur Tabelle mit Zeilen und Seitenzahl; ein JSON ohne Vorgangs-ID gilt als unbrauchbar.",
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
    id: "parlis-deputy-motions",
    label: "Profilvorschau auf fünf persönlich zugeordnete Anträge begrenzen",
    kind: "db",
    run: async () => {
      const { data: link, error } = await supabase.from("parlis_deputy_profiles")
        .select("profile_key").eq("legislature", 18).eq("vorgangs_id", "V-248711").limit(1).maybeSingle();
      if (error) throw error;
      if (!link?.profile_key) return { ok: false, message: "Abgeordnetenprofil für den Vergleich fehlt." };
      const profileKey = link.profile_key;
      const [preview, all] = await Promise.all([
        supabase.rpc("get_parlis_deputy_motions", { period: 18, deputy_key: profileKey }),
        supabase.rpc("parlis_page", { period: 18, deputy_key: profileKey, document_kind: "Antrag" }),
      ]);
      if (preview.error) throw preview.error;
      if (all.error) throw all.error;
      const rows = all.data && typeof all.data === "object" && !Array.isArray(all.data) && Array.isArray(all.data.rows)
        ? all.data.rows : [];
      const ids = rows.slice(0, 5).flatMap(row => row && typeof row === "object" && !Array.isArray(row) ? [row.vorgangs_id] : []);
      const params = new URL(parlisDeputyUrl(profileKey, 18, "Antrag"), "https://example.invalid").searchParams;
      return {
        ok: !!ids.length && preview.data.map(row => row.vorgangs_id).join() === ids.join()
          && params.get("urheber") === profileKey && params.get("vorgangstyp") === "Antrag",
        message: "Profilvorschau und vorausgewählte PARLIS-Liste zeigen dieselben Anträge.",
      };
    },
  }, {
    id: "parlis-wp17-activity",
    label: "Gespeicherte Typzahlen der 17. Wahlperiode entsprechen der PARLIS-Liste",
    kind: "db",
    run: async () => {
      const { data: link, error } = await supabase.from("parlis_deputy_profiles")
        .select("profile_key").eq("legislature", 17).not("profile_key", "is", null).limit(1).maybeSingle();
      if (error) throw error;
      if (!link?.profile_key) return { ok: false, message: "Für den Bilanzvergleich fehlt ein verknüpftes Profil." };
      const profileKey = link.profile_key;
      const [activity, proceedings] = await Promise.all([
        supabase.rpc("get_parlis_wp17_deputy_activity", { deputy_key: profileKey }),
        supabase.rpc("parlis_page", { period: 17, deputy_key: profileKey }),
      ]);
      if (activity.error) throw activity.error;
      if (proceedings.error) throw proceedings.error;
      const page = proceedings.data;
      const total = activity.data.reduce((sum, row) => sum + row.document_count, 0);
      return {
        ok: total > 0 && !!page && typeof page === "object" && !Array.isArray(page) && page.count === total,
        message: "Bilanz und gefilterte PARLIS-Liste zählen dieselben persönlich zugeordneten Vorgänge.",
      };
    },
  }, {
    id: "parlis-ministry-suggestions",
    label: "Ressortvorschläge verbinden ministerielle Quellen über Wahlperioden",
    kind: "db",
    run: async () => {
      const { data, error } = await supabase.rpc("get_parlis_ministry_sources");
      if (error) throw error;
      const transport = data.filter(row => row.ressort === "Ministerium für Verkehr" && row.requests > 0
        && row.suggested_line === "transport");
      const interior = data.filter(row => row.ressort.startsWith("Ministerium des Inneren")
        && row.suggested_line === "interior");
      return {
        ok: [17, 18].every(period => transport.some(row => row.legislature === period)
          && interior.some(row => row.legislature === period))
          && !data.some(row => row.ressort.startsWith("Ausschuss")),
        message: "Identische und geänderte Ressortnamen bleiben je Wahlperiode sichtbar.",
      };
    },
  }, {
    id: "parlis-initiative-rankings",
    label: "Initiativenbilanz der 17. Wahlperiode vollständig und begrenzt abrufen",
    kind: "db",
    run: async () => {
      const { data, error } = await supabase.rpc("get_parlis_initiative_rankings", { period: 17 });
      if (error) throw error;
      const snapshot = data && typeof data === "object" && !Array.isArray(data) ? data : null;
      const kinds = snapshot?.kinds;
      return {
        ok: typeof snapshot?.total === "number" && snapshot.total >= 7352
          && !!kinds && typeof kinds === "object" && !Array.isArray(kinds)
          && Object.values(kinds).reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0) === snapshot.total
          && Array.isArray(snapshot.deputiesMost) && snapshot.deputiesMost.length === 10
          && Array.isArray(snapshot.deputiesLeast) && snapshot.deputiesLeast.length === 10,
        message: "Gespeicherte Typzahlen ergeben die Gesamtzahl; beide Personenranglisten sind auf zehn Plätze begrenzt.",
      };
    },
  }, {
    id: "parlis-reviewed-author-aliases",
    label: "Geprüfte Urhebernamen aus der 17. Wahlperiode verlinken",
    kind: "db",
    run: async () => {
      const assignments = [
        { proceeding: "V-245681", source: "Gabriele Rolland", display: ["Gabi Rolland", "Gabriele Rolland"] },
        { proceeding: "V-216519", source: "Josef Frey", display: ["Josha Frey", "Josef Frey"] },
      ];
      const checks = await Promise.all(assignments.map(async ({ proceeding, source, display }) => {
        const { data, error } = await supabase.from("parlis_deputy_profiles").select("profile_key,deputy_name")
          .eq("legislature", 17).eq("vorgangs_id", proceeding).in("deputy_name", display);
        if (error) throw error;
        const candidate = data.length === 1 ? data[0] : undefined;
        if (!candidate?.profile_key || !candidate.deputy_name) return false;
        const text = `${source} (${source === "Josef Frey" ? "GRÜNE" : "SPD"})`;
        return authorSegments(text, new Map([[candidate.profile_key, candidate.deputy_name]]))
          .some(segment => segment.profileKey === candidate.profile_key && segment.text === source);
      }));
      return {
        ok: checks.every(Boolean),
        message: "Die ursprünglichen PARLIS-Namen verlinken auf genau ein Profil.",
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
