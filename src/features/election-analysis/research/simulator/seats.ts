import type { SeatInput, SeatResult, SeatRow } from "./types";
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
export class LotRequired extends Error {
  constructor(public parties: string[]) {
    super(`Losannahme für letzten Sitz erforderlich: ${parties.join(", ")}.`);
  }
}
/** Odd-divisor highest averages, compared as exact integer cross-products, not floating quotients. */
export function sainteLague(
  votes: { id: string; votes: number }[],
  count: number,
  includeFinalTies = false,
  lots: string[] = [],
) {
  if (
    !integer(count) ||
    count > 10000 ||
    votes.some((p) => !integer(p.votes)) ||
    new Set(votes.map((p) => p.id)).size !== votes.length
  )
    throw new Error("Ungültige Sitzparameter.");
  const rows = votes
    .filter((p) => p.votes > 0)
    .map((p) => ({ ...p, seats: 0 }));
  if (count && !rows.length)
    throw new Error("Keine sitzwirksamen Zweitstimmen.");
  let assigned = 0,
    lotIndex = 0;
  while (assigned < count) {
    let tied: typeof rows = [];
    for (const row of rows) {
      if (!tied.length) {
        tied = [row];
        continue;
      }
      const a = BigInt(row.votes) * BigInt(2 * tied[0].seats + 1),
        b = BigInt(tied[0].votes) * BigInt(2 * row.seats + 1);
      if (a > b) tied = [row];
      else if (a === b) tied.push(row);
    }
    const remaining = count - assigned;
    if (tied.length <= remaining) {
      for (const row of tied) {
        row.seats++;
        assigned++;
      }
      continue;
    }
    if (includeFinalTies) {
      for (const row of tied) {
        row.seats++;
        assigned++;
      }
      break;
    }
    const winner = lots[lotIndex++];
    const selected = tied.find((p) => p.id === winner);
    if (!selected) throw new LotRequired(tied.map((p) => p.id));
    selected.seats++;
    assigned++;
  }
  return Object.fromEntries(
    votes.map((p) => [p.id, rows.find((r) => r.id === p.id)?.seats || 0]),
  );
}
export function allocateBw2026(input: SeatInput): SeatResult {
  const { parties, validSecond } = input,
    specialDirect = input.specialDirect ?? 0,
    specialFirstVotes = input.specialFirstVotes ?? 0;
  if (
    !integer(validSecond) ||
    validSecond <= 0 ||
    !parties.length ||
    parties.length > 60 ||
    !integer(specialDirect) ||
    !integer(specialFirstVotes) ||
    parties.some(
      (p) =>
        !p.id ||
        !integer(p.votes) ||
        !integer(p.direct) ||
        (!p.hasList && p.votes > 0),
    ) ||
    new Set(parties.map((p) => p.id)).size !== parties.length
  )
    throw new Error(
      "Vollständige gültige Parteien-, Stimmen- und Direktmandatsangaben erforderlich.",
    );
  if (parties.reduce((s, p) => s + p.votes, 0) !== validSecond)
    throw new Error(
      "Alle einzeln erfassten Parteistimmen müssen den gültigen Zweitstimmen entsprechen; keine aggregierte Restpartei.",
    );
  if (
    parties.some(
      (p) =>
        /^(rest|sonstige|weitere parteien)$/i.test(p.id) ||
        /^(rest|sonstige|weitere parteien)( \(aggregiert\))?$/i.test(p.name),
    )
  )
    throw new Error(
      "Aggregierte Restkategorien sind für die Sitzverteilung unzulässig.",
    );
  if (parties.reduce((s, p) => s + p.direct, 0) + specialDirect !== 70)
    throw new Error(
      "Genau 70 Direktmandate einschließlich Einzelbewerbern erforderlich.",
    );
  const eligible = parties.filter(
    (p) => p.hasList && BigInt(p.votes) * 20n >= BigInt(validSecond),
  );
  const excludedDirect =
    parties
      .filter((p) => !eligible.some((e) => e.id === p.id))
      .reduce((s, p) => s + p.direct, 0) + specialDirect;
  if (
    excludedDirect > 0 &&
    (!input.excludedSecondVotes || input.specialFirstVotes == null)
  )
    throw new Error(
      "Sonderdirektmandate erfordern die tatsächlich bereinigten Zweitstimmen und sitzwirksamen Erststimmen; aus Anteilen nicht ableitbar.",
    );
  const corrections = input.excludedSecondVotes || {};
  if (
    Object.entries(corrections).some(
      ([id, n]) =>
        !parties.some((p) => p.id === id) ||
        !integer(n) ||
        n > (parties.find((p) => p.id === id)?.votes || 0),
    ) ||
    (!excludedDirect && Object.values(corrections).some((n) => n !== 0))
  )
    throw new Error("Ungültige Zweitstimmenbereinigung.");
  if (
    excludedDirect > 0 &&
    (specialFirstVotes < excludedDirect ||
      eligible.some(
        (p) => !Object.prototype.hasOwnProperty.call(corrections, p.id),
      ) ||
      Object.values(corrections).reduce((a, b) => a + b, 0) > specialFirstVotes)
  )
    throw new Error(
      "Für jede teilnehmende Partei explizite Bereinigung (auch 0) und plausible Erststimmensumme der Sonderdirektgewinner erforderlich.",
    );
  const counted = eligible.map((p) => ({
    id: p.id,
    votes: p.votes - (corrections[p.id] || 0),
  }));
  const baseSize = 120 - excludedDirect;
  if (!counted.some((p) => p.votes > 0) && eligible.some((p) => p.direct > 0))
    throw new Error(
      "Keine verteilbaren Zweitstimmen bei Parteidirektmandaten; Spezialfall nicht automatisch berechenbar.",
    );
  if (!counted.some((p) => p.votes > 0))
    return {
      rows: parties.map((p) => ({
        id: p.id,
        name: p.name,
        votes: p.votes,
        eligible: eligible.some((e) => e.id === p.id),
        direct: p.direct,
        base: 0,
        total: p.direct,
        list: 0,
        overhang: 0,
        balance: 0,
        majorityBonus: 0,
      })),
      total: 70,
      base: 120,
      overhang: 0,
      balance: 0,
      majorityBonus: 0,
      specialDirect,
      unallocated: 50,
      warnings: [
        "Keine verteilbaren Zweitstimmen; nicht zugeteilte Sitze bleiben unbesetzt (§2 Absatz 9).",
      ],
    };
  if (
    eligible.some(
      (p) => p.direct > 0 && counted.find((c) => c.id === p.id)?.votes === 0,
    )
  )
    throw new Error(
      "Direktmandate bei null bereinigten Parteistimmen lassen sich nicht proportional ausgleichen.",
    );
  const base = sainteLague(counted, baseSize, false, input.baseSeatLots);
  let size = baseSize,
    distribution = base;
  const overhang = eligible.reduce(
    (s, p) => s + Math.max(0, p.direct - (base[p.id] || 0)),
    0,
  );
  // Continue until every participating party's direct seats fit; the balancing last-quotient tie grants all tied seats (§2(6)).
  const covers = (d: Record<string, number>) =>
    eligible.every((p) => (d[p.id] || 0) >= p.direct);
  if (!covers(distribution)) {
    let low = baseSize + 1,
      high = Math.max(low, baseSize * 2);
    high = Math.min(10000, high);
    while (!covers(sainteLague(counted, high, true)) && high < 10000)
      high = Math.min(10000, high * 2);
    if (!covers(sainteLague(counted, high, true)))
      throw new Error(
        "Ausgleich überschreitet 10.000 Sitze; keine gekappte Sitzverteilung ausgegeben.",
      );
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (covers(sainteLague(counted, mid, true))) high = mid;
      else low = mid + 1;
    }
    size = low;
    distribution = sainteLague(counted, size, true);
  }
  const compensatedTotal =
    Object.values(distribution).reduce((a, b) => a + b, 0) + excludedDirect;
  const effectiveVotes =
    counted.reduce((s, p) => s + p.votes, 0) + specialFirstVotes;
  if (!Number.isSafeInteger(effectiveVotes))
    throw new Error(
      "Sitzwirksame Stimmen überschreiten den sicheren Zahlenbereich.",
    );
  let bonus = 0;
  const majority = counted.find(
    (p) => BigInt(p.votes) * 2n > BigInt(effectiveVotes),
  );
  if (majority) {
    bonus = Math.max(
      0,
      compensatedTotal - 2 * (distribution[majority.id] || 0) + 1,
    );
    distribution = {
      ...distribution,
      [majority.id]: (distribution[majority.id] || 0) + bonus,
    };
  }
  const rows: SeatRow[] = parties.map((p) => {
    const participates = eligible.some((e) => e.id === p.id),
      total = participates ? distribution[p.id] || 0 : p.direct,
      baseline = participates ? base[p.id] || 0 : 0,
      extra = participates ? Math.max(0, p.direct - baseline) : 0,
      majorityBonus = majority?.id === p.id ? bonus : 0;
    return {
      id: p.id,
      name: p.name,
      votes: p.votes,
      eligible: participates,
      direct: p.direct,
      base: baseline,
      total,
      list: Math.max(0, total - p.direct),
      overhang: extra,
      balance: participates
        ? Math.max(0, total - baseline - extra - majorityBonus)
        : 0,
      majorityBonus,
    };
  });
  return {
    rows,
    total: rows.reduce((s, p) => s + p.total, 0) + specialDirect,
    base: 120,
    overhang,
    balance: compensatedTotal - 120 - overhang,
    majorityBonus: bonus,
    specialDirect,
    unallocated: 0,
    warnings: excludedDirect
      ? [
          "Sonderdirektmandate: Sperrklausel vor, Verteilung nach Zweitstimmenbereinigung berechnet.",
        ]
      : [],
  };
}
