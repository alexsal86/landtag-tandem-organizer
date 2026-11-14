import Papa from "papaparse";
import type { LocalResult } from "./workspaceTypes";
export function parseLocalCsv(
  text: string,
  scope: {
    year: number;
    ballot: "single" | "first" | "second";
    district: number;
    type: "municipality" | "ward";
    release: string;
    source: string;
    boundary: string;
    preliminary: boolean;
    verified: boolean;
  },
): LocalResult[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (s) => s.replace(/^\uFEFF/, "").trim(),
    transform: (s) => s.trim(),
  });
  if (
    parsed.errors.length ||
    Object.keys(parsed.meta.renamedHeaders || {}).length
  )
    throw new Error("CSV hat Formatfehler oder doppelte Spalten.");
  const required = [
    "unit_key",
    "name",
    "party",
    "eligible",
    "voters",
    "valid_votes",
    "votes",
  ];
  if (required.some((k) => !parsed.meta.fields?.includes(k)))
    throw new Error(`Pflichtspalten: ${required.join(", ")}`);
  if (parsed.data.length < 1 || parsed.data.length > 5000)
    throw new Error("Ein bis 5.000 Zeilen je Übernahme.");
  if (
    !scope.release.trim() ||
    !scope.boundary.trim() ||
    !/^https:\/\//.test(scope.source) ||
    !scope.verified
  )
    throw new Error(
      "Datenstand, expliziter Gebietszuschnitt, HTTPS-Quelle und Quellenprüfung erforderlich.",
    );
  try {
    const url = new URL(scope.source);
    if (url.protocol !== "https:" || !url.hostname) throw new Error();
  } catch {
    throw new Error("Vollständige HTTPS-Quelle erforderlich.");
  }
  const number = (value: string | null | undefined, optional = false) => {
    if ((value == null || value === "") && optional) return null;
    if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
      throw new Error(
        "Stimmen und Bezugsgrößen als nichtnegative ganze Zahlen; unbekannte Berechtigte/Wählende leer lassen.",
      );
    return Number(value);
  };
  const keys = new Set<string>(),
    denominators = new Map<string, string>(),
    partySums = new Map<string, number>();
  const rows = parsed.data.map((r) => {
    if (
      !/^\d{8}(?::[A-Za-z0-9._-]+)?$/.test(r.unit_key || "") ||
      !r.name ||
      r.name.length > 160 ||
      !r.party ||
      r.party.length > 80
    )
      throw new Error(
        "Amtlicher achtstelliger Gemeindeschlüssel erforderlich; Wahlbezirke als AGS:Bezirksschlüssel. Namen/Partei fehlen oder sind zu lang.",
      );
    const key = `${r.unit_key}:${r.party}`;
    if (keys.has(key)) throw new Error("Gebiet/Partei doppelt.");
    keys.add(key);
    if (
      (scope.type === "municipality" && r.unit_key.includes(":")) ||
      (scope.type === "ward" && !r.unit_key.includes(":"))
    )
      throw new Error("Gebietsschlüssel passt nicht zum gewählten Typ.");
    const eligible = number(r.eligible, true),
      voters = number(r.voters, true),
      valid = number(r.valid_votes)!,
      votes = number(r.votes)!;
    if (
      votes > valid ||
      (voters != null && valid > voters) ||
      (voters != null && eligible != null && voters > eligible)
    )
      throw new Error("Stimmen/Bezugsgrößen widersprüchlich.");
    const denominator = JSON.stringify([eligible, voters, valid]);
    if (
      denominators.has(r.unit_key) &&
      denominators.get(r.unit_key) !== denominator
    )
      throw new Error(
        "Parteizeilen desselben Gebiets verwenden unterschiedliche Bezugsgrößen.",
      );
    denominators.set(r.unit_key, denominator);
    partySums.set(r.unit_key, (partySums.get(r.unit_key) || 0) + votes);
    return {
      year: scope.year,
      ballot: scope.ballot,
      district_number: scope.district,
      unit_type: scope.type,
      unit_key: r.unit_key,
      name: r.name,
      party: r.party,
      boundary_key: scope.boundary,
      eligible,
      voters,
      valid_votes: valid,
      votes,
      data_release: scope.release,
      source_url: scope.source,
      preliminary: scope.preliminary,
      is_verified: true,
    };
  });
  if (rows.some((r) => (partySums.get(r.unit_key) || 0) > r.valid_votes))
    throw new Error("Parteistimmensumme überschreitet gültige Stimmen.");
  return rows;
}
export function localMetrics(r: LocalResult) {
  return {
    share: r.valid_votes > 0 ? (r.votes / r.valid_votes) * 100 : null,
    turnout:
      r.eligible != null && r.eligible > 0 && r.voters != null
        ? (r.voters / r.eligible) * 100
        : null,
  };
}
