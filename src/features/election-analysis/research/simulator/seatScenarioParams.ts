/** Eingaben, die von einer Partei kommen und bei Änderung Korrekturen verwerfen. */
const PARTY_INPUT_PREFIXES = [
  "seatFirst_",
  "seatSecond_",
  "seatDirect_",
  "seatDistrictLot_",
  "seatFlip_",
] as const;

/** Parameter, die beim Wechsel der Ausgangsbasis zurückgesetzt werden. */
const BASELINE_RESET_KEYS = [
  "seatPoll",
  "seatDistrictModel",
  "seatBalancing",
  "seatLotOrder",
  "seatCorrections",
  "seatSpecialFirst",
  "seatThresholdParty",
  "seatTab",
] as const;

const isPartyInputKey = (key: string) =>
  PARTY_INPUT_PREFIXES.some((prefix) => key.startsWith(prefix));

/** Setzt einen Sitzsimulator-Parameter und verwirft davon abhängige Korrekturen. */
export function applySeatParam(
  old: URLSearchParams,
  key: string,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(old);
  if (key.startsWith("seatFlip_") && !value) next.delete(key);
  else next.set(key, value);
  if (["seatBalancing", "seatDistrictModel"].includes(key) || isPartyInputKey(key)) {
    next.delete("seatCorrections");
    next.delete("seatSpecialFirst");
  }
  return next;
}

/** Wechselt die Ausgangsbasis (Amtliches Ergebnis oder Landestrend) und räumt alte Eingaben ab. */
export function resetSeatBaselineParams(
  old: URLSearchParams,
  { nextPoll = "", keepSaved = false }: { nextPoll?: string; keepSaved?: boolean } = {},
): URLSearchParams {
  const next = new URLSearchParams(old);
  const resetKeys: readonly string[] = keepSaved
    ? BASELINE_RESET_KEYS
    : ["savedScenario", ...BASELINE_RESET_KEYS];
  for (const key of new Set(next.keys())) {
    if (resetKeys.includes(key) || isPartyInputKey(key)) next.delete(key);
  }
  if (nextPoll && !keepSaved) next.set("seatPoll", nextPoll);
  return next;
}
