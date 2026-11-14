import { coherentDataset, weightedShares, type ResearchDistrict } from "./data";
/** Euclidean projection onto the nonnegative simplex; adjustments are reported, not hidden. */
export function projectShares(values: number[]): number[] {
  if (!values.length || values.some((v) => !Number.isFinite(v)))
    throw new Error("Ungültige Szenarioanteile.");
  const sorted = values.slice().sort((a, b) => b - a);
  let sum = 0,
    theta = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i];
    const t = (sum - 100) / (i + 1);
    if (sorted[i] > t) theta = t;
  }
  const result = values.map((v) => Math.max(0, v - theta));
  if (
    result.some((v) => !Number.isFinite(v)) ||
    Math.abs(result.reduce((a, b) => a + b, 0) - 100) > 1e-6
  )
    throw new Error("Szenario liegt außerhalb des stabilen Zahlenbereichs.");
  return result;
}
export function simulateShares(
  rows: ResearchDistrict[],
  keys: string[],
  deltas: Record<string, number>,
  local?: { district: number; party: string; delta: number },
) {
  if (!coherentDataset(rows))
    throw new Error(
      "70 vollständige Wahlkreise mit gemeinsamem Datenstand erforderlich.",
    );
  if (
    !keys.length ||
    new Set(keys).size !== keys.length ||
    keys.includes("REST") ||
    rows.some(
      (r) =>
        [...keys, "REST"].some(
          (k) =>
            !Number.isFinite(r.shares[k]) ||
            r.shares[k] < 0 ||
            r.shares[k] > 100,
        ) ||
        Math.abs([...keys, "REST"].reduce((s, k) => s + r.shares[k], 0) - 100) >
          1e-6,
    )
  )
    throw new Error(
      "Vollständige, konsistente Kategorien einschließlich Rest erforderlich.",
    );
  const categories = [...keys, "REST"];
  const baseline = weightedShares(rows, categories)!;
  if (
    keys.some((k) => !Number.isFinite(deltas[k] ?? 0)) ||
    Object.keys(deltas).some((k) => !keys.includes(k))
  )
    throw new Error("Unzulässige Parteiveränderung.");
  if (
    local &&
    (!rows.some((r) => r.number === local.district) ||
      !keys.includes(local.party) ||
      !Number.isFinite(local.delta) ||
      Math.abs(local.delta) > 100)
  )
    throw new Error("Ungültige regionale Annahme.");
  const totalDelta = keys.reduce((s, k) => s + (deltas[k] || 0), 0);
  const target = Object.fromEntries(
    categories.map((k) => [
      k,
      baseline[k] + (k === "REST" ? -totalDelta : deltas[k] || 0),
    ]),
  );
  if (Object.values(target).some((v) => v < 0 || v > 100))
    throw new Error(
      "Die Landesannahme überschreitet 0–100 % oder die verfügbare Restkategorie.",
    );
  const result = rows.map((r) => {
    const desired = categories.map(
      (k) =>
        r.shares[k] +
        (k === "REST" ? -totalDelta : deltas[k] || 0) +
        (local?.district === r.number
          ? k === local.party
            ? local.delta
            : k === "REST"
              ? -local.delta
              : 0
          : 0),
    );
    const projected = projectShares(desired);
    const shares = Object.fromEntries(
      categories.map((k, j) => [k, projected[j]]),
    );
    return {
      ...r,
      shares,
      adjusted: projected.some((v, j) => Math.abs(v - desired[j]) > 1e-8),
    };
  });
  return {
    baseline,
    target,
    achieved: weightedShares(result, categories)!,
    rows: result,
    adjusted: result.filter((r) => r.adjusted).length,
  };
}
/** Feasible assumed gross flows for a modeled balance; these are not confidence intervals. */
export function flowSensitivity(
  balance: number | null,
  counterLow: number,
  counterHigh: number,
  tolerance: number,
) {
  if (
    balance == null ||
    ![balance, counterLow, counterHigh, tolerance].every(
      Number.isSafeInteger,
    ) ||
    counterLow < 0 ||
    counterHigh < counterLow ||
    tolerance < 0
  )
    return null;
  const lower = balance - tolerance,
    upper = balance + tolerance,
    counter = counterLow + Math.floor((counterHigh - counterLow) / 2);
  const result = {
    inLow: Math.max(lower, 0) + counterLow,
    inHigh: Math.max(upper, 0) + counterHigh,
    outLow: Math.max(-upper, 0) + counterLow,
    outHigh: Math.max(-lower, 0) + counterHigh,
    assumedIn: Math.max(balance, 0) + counter,
    assumedOut: Math.max(-balance, 0) + counter,
    balanceLow: lower,
    balanceHigh: upper,
  };
  return Object.values(result).every(Number.isSafeInteger) ? result : null;
}
