import { isRecord } from "@/utils/typeSafety";
import type { StoredScenario } from "./workspaceTypes";
import type { ResearchDataset, ResearchDistrict } from "./lab/data";
export function scenarioParams(
  params: URLSearchParams,
): Record<string, string> {
  if (
    params.get("researchTool") === "scenario" &&
    Number(params.get("scenarioDistrict") || 0) !== 0
  )
    throw new Error(
      "Regionale Annahmen bitte ausschalten; dieser Ausbau speichert landesweite Szenarien.",
    );
  return Object.fromEntries(
    [...params.entries()].filter(
      ([key]) =>
        [
          "analysisYear",
          "analysisBallot",
          "analysisSection",
          "researchTool",
          "scenarioMapParty",
          "seatBalancing",
          "seatThresholdParty",
          "seatLotOrder",
          "seatCorrections",
          "seatSpecialFirst",
        ].includes(key) ||
        [
          "scenarioDelta_",
          "seatFirst_",
          "seatSecond_",
          "seatDirect_",
          "seatDistrictLot_",
        ].some((prefix) => key.startsWith(prefix)),
    ),
  );
}
export function savedScenarioUrl(row: StoredScenario) {
  if (!isRecord(row.params)) throw new Error("Ungültige gespeicherte Auswahl.");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(row.params))
    if (typeof value === "string") params.set(key, value);
  const allowed = scenarioParams(params);
  const clean = new URLSearchParams(allowed);
  clean.set("dataTool", "wahlanalyse");
  clean.set("analysisSection", "research");
  clean.set(
    "researchTool",
    row.model_version === "shares-v1" ? "scenario" : "seats",
  );
  clean.set("analysisYear", String(row.year));
  clean.set("analysisBallot", row.ballot);
  clean.set("savedScenario", row.id);
  return `/daten?${clean}`;
}
function researchRow(v: unknown): v is ResearchDistrict {
  return (
    isRecord(v) &&
    Number.isInteger(v.number) &&
    Number(v.number) >= 1 &&
    Number(v.number) <= 70 &&
    typeof v.name === "string" &&
    isRecord(v.shares) &&
    Object.values(v.shares).every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100,
    ) &&
    ["valid", "eligible", "voters", "turnout"].every(
      (k) => typeof v[k] === "number" && Number.isFinite(v[k]),
    ) &&
    Number(v.valid) > 0 &&
    Number(v.voters) >= Number(v.valid) &&
    Number(v.eligible) >= Number(v.voters) &&
    ["valid", "eligible", "voters"].every((k) => Number.isSafeInteger(v[k])) &&
    typeof v.preliminary === "boolean" &&
    typeof v.release === "string" &&
    (v.identity === null || typeof v.identity === "string")
  );
}
export function pinnedShares(
  row: StoredScenario,
  year: number,
  ballot: string,
): ResearchDataset {
  const snapshot: unknown = row.input_snapshot;
  if (
    row.model_version !== "shares-v1" ||
    row.year !== year ||
    row.ballot !== ballot ||
    !isRecord(snapshot) ||
    !Array.isArray(snapshot.rows) ||
    !snapshot.rows.every(researchRow) ||
    !Array.isArray(snapshot.parties) ||
    !snapshot.parties.every((p): p is string => typeof p === "string")
  )
    throw new Error(
      "Gespeicherte Grundlage passt nicht zu Modell, Wahljahr oder Stimmenart.",
    );
  return {
    rows: snapshot.rows,
    parties: snapshot.parties,
    excluded: [],
  };
}
export function comparisonRows(
  row: Pick<StoredScenario, "model_version" | "result_snapshot">,
) {
  if (!isRecord(row.result_snapshot))
    throw new Error("Ungültiges gespeichertes Ergebnis.");
  const result = row.result_snapshot;
  if (row.model_version === "shares-v1") {
    if (
      !isRecord(result.achieved) ||
      Object.values(result.achieved).some(
        (v) => typeof v !== "number" || !Number.isFinite(v),
      )
    )
      throw new Error("Landesanteile fehlen.");
    return Object.fromEntries(
      Object.entries(result.achieved).map(([k, v]) => [k, Number(v)]),
    );
  }
  if (!Array.isArray(result.rows)) throw new Error("Sitzübersicht fehlt.");
  return Object.fromEntries(
    result.rows.map((r) => {
      if (
        !isRecord(r) ||
        typeof r.id !== "string" ||
        typeof r.total !== "number" ||
        !Number.isInteger(r.total) ||
        r.total < 0
      )
        throw new Error("Ungültige Sitzzahl.");
      return [r.id, r.total];
    }),
  );
}
