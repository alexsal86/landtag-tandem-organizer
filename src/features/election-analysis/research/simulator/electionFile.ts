import { isRecord } from "@/utils/typeSafety";
import { projectShares } from "../lab/scenarios";
import {
  BW_RULES_VERSION,
  type ElectionFile,
  type SeatCandidate,
  type SeatPerson,
} from "./types";
import { allocateBw2026 } from "./seats";
const n = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= 200;
function person(v: unknown): SeatPerson {
  if (
    !isRecord(v) ||
    !text(v.id) ||
    v.id.length > 80 ||
    /[\u0000-\u001f,]/.test(v.id) ||
    !text(v.name)
  )
    throw new Error("Kandidaten benötigen eine explizite ID und einen Namen.");
  return { id: v.id, name: v.name };
}
export function parseElectionFile(value: unknown): ElectionFile {
  if (
    !isRecord(value) ||
    value.version !== BW_RULES_VERSION ||
    value.year !== 2026 ||
    typeof value.source_url !== "string" ||
    !/^https:\/\//.test(value.source_url) ||
    !text(value.data_release) ||
    !n(value.validSecond) ||
    value.validSecond <= 0 ||
    !Array.isArray(value.parties) ||
    !value.parties.length ||
    value.parties.length > 60 ||
    !Array.isArray(value.districts) ||
    value.districts.length !== 70 ||
    !isRecord(value.lists) ||
    typeof value.listsComplete !== "boolean"
  )
    throw new Error(
      "BW-2026-Datei benötigt 70 Wahlkreise, alle Parteien, Bezugsgrößen, Quelle und explizite Listen-Vollständigkeit.",
    );
  try {
    const url = new URL(value.source_url);
    if (url.protocol !== "https:" || !url.hostname) throw new Error();
  } catch {
    throw new Error("Vollständige HTTPS-Quellenadresse erforderlich.");
  }
  const parties = value.parties.map((p) => {
    if (
      !isRecord(p) ||
      !text(p.id) ||
      p.id.length > 80 ||
      /[\u0000-\u001f,]/.test(p.id) ||
      ["__proto__", "constructor", "prototype"].includes(p.id) ||
      !text(p.name) ||
      !n(p.votes) ||
      !n(p.direct) ||
      typeof p.hasList !== "boolean"
    )
      throw new Error("Ungültige Partei.");
    return {
      id: p.id,
      name: p.name,
      votes: p.votes,
      direct: p.direct,
      hasList: p.hasList,
    };
  });
  if (
    new Set(parties.map((p) => p.id)).size !== parties.length ||
    parties.reduce((s, p) => s + p.votes, 0) !== value.validSecond ||
    parties.some((p) => !p.hasList && p.votes)
  )
    throw new Error(
      "Vollständige einzeln erfasste Landeslisten erforderlich; Zweitstimmensumme stimmt nicht.",
    );
  const ids = new Set<string>();
  const districts = value.districts.map((d) => {
    if (
      !isRecord(d) ||
      !n(d.number) ||
      d.number < 1 ||
      d.number > 70 ||
      !n(d.validFirst) ||
      !Array.isArray(d.candidates) ||
      !d.candidates.length ||
      d.candidates.length > 100
    )
      throw new Error("Ungültiger Wahlkreis.");
    const candidates: SeatCandidate[] = d.candidates.map((c) => {
      const p = person(c);
      if (
        !isRecord(c) ||
        !n(c.votes) ||
        (c.partyId !== null &&
          (!text(c.partyId) || !parties.some((p) => p.id === c.partyId)))
      )
        throw new Error("Kandidatur oder Partei fehlt.");
      if (ids.has(p.id))
        throw new Error(
          "Eine Personen-ID darf nicht in mehreren Wahlkreisen kandidieren.",
        );
      ids.add(p.id);
      return { ...p, partyId: c.partyId, votes: c.votes };
    });
    if (
      candidates.reduce((s, c) => s + c.votes, 0) !== d.validFirst ||
      d.validFirst <= 0
    )
      throw new Error(
        "Alle Erststimmenkandidaturen müssen die gültigen Erststimmen ergeben.",
      );
    return { number: d.number, validFirst: d.validFirst, candidates };
  });
  if (new Set(districts.map((d) => d.number)).size !== 70)
    throw new Error("Wahlkreisnummern sind nicht eindeutig.");
  const lists: Record<string, SeatPerson[]> = Object.fromEntries(
    Object.entries(value.lists).map(([key, v]) => {
      if (
        !parties.some((p) => p.id === key && p.hasList) ||
        !Array.isArray(v) ||
        v.length > 500
      )
        throw new Error("Ungültige Landesliste.");
      const list = v.map(person);
      if (new Set(list.map((p) => p.id)).size !== list.length)
        throw new Error("Doppelte Personen-ID in Landesliste.");
      return [key, list];
    }),
  );
  const ownership = new Map<string, string>();
  for (const p of parties) {
    for (const c of [
      ...districts.flatMap((d) =>
        d.candidates.filter((c) => c.partyId === p.id),
      ),
      ...(lists[p.id] || []),
    ]) {
      const old = ownership.get(c.id);
      if (old && old !== p.id)
        throw new Error("Eine Person ist verschiedenen Parteien zugeordnet.");
      ownership.set(c.id, p.id);
    }
  }
  if (
    value.listsComplete &&
    parties.some(
      (p) => p.hasList && !Object.prototype.hasOwnProperty.call(lists, p.id),
    )
  )
    throw new Error(
      "Für jede zugelassene Landesliste muss ihre vollständige Reihenfolge vorliegen (ggf. leere erschöpfte Liste).",
    );
  const corrections = value.excludedSecondVotes;
  if (
    corrections !== undefined &&
    (!isRecord(corrections) || Object.values(corrections).some((v) => !n(v)))
  )
    throw new Error("Ungültige Bereinigung.");
  const lots = value.districtLots;
  if (
    lots !== undefined &&
    (!isRecord(lots) || Object.values(lots).some((v) => !text(v)))
  )
    throw new Error("Ungültige Losannahmen.");
  const baseLots = value.baseSeatLots;
  if (
    baseLots !== undefined &&
    (!Array.isArray(baseLots) || !baseLots.every(text))
  )
    throw new Error("Ungültige Sitz-Losannahmen.");
  return {
    version: BW_RULES_VERSION,
    year: 2026,
    source_url: value.source_url,
    data_release: value.data_release,
    validSecond: value.validSecond,
    parties,
    districts,
    lists,
    listsComplete: value.listsComplete,
    excludedSecondVotes: corrections
      ? Object.fromEntries(
          Object.entries(corrections).map(([k, v]) => [k, Number(v)]),
        )
      : undefined,
    districtLots: lots
      ? Object.fromEntries(Object.entries(lots).map(([k, v]) => [k, String(v)]))
      : undefined,
    baseSeatLots: baseLots,
  };
}
/** Numerical share-to-count rounding, not an electoral lot decision. Sum of valid ballots remains fixed. */
function counts(weights: number[], total: number) {
  const raw = weights.map((w) => (w / 100) * total),
    out = raw.map(Math.floor);
  let remainder = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  if (remainder < 0 || remainder > weights.length)
    throw new Error("Anteile lassen sich nicht stabil in Stimmen umrechnen.");
  for (let i = 0; i < remainder; i++) out[order[i].i]++;
  return out;
}
export function shiftElection(
  file: ElectionFile,
  first: Record<string, number>,
  second: Record<string, number>,
  balancingParty: string,
) {
  const keys = file.parties.filter((p) => p.hasList).map((p) => p.id);
  if (
    !keys.includes(balancingParty) ||
    [...Object.entries(first), ...Object.entries(second)].some(
      ([k, v]) =>
        !file.parties.some((p) => p.id === k) ||
        !Number.isFinite(v) ||
        Math.abs(v) > 100,
    )
  )
    throw new Error("Ungültige Stimmenszenarien.");
  const secondDeltas = {
    ...second,
    [balancingParty]: -keys
      .filter((k) => k !== balancingParty)
      .reduce((s, k) => s + (second[k] || 0), 0),
  };
  const target = keys.map(
    (k) =>
      (file.parties.find((p) => p.id === k)!.votes / file.validSecond) * 100 +
      (secondDeltas[k] || 0),
  );
  if (target.some((v) => v < 0 || v > 100))
    throw new Error(
      "Zweitstimmenziel außerhalb 0–100 %. Ausgleichspartei oder Annahmen ändern.",
    );
  const changedSecond = Object.values(secondDeltas).some((v) => v !== 0),
    secondCounts = changedSecond
      ? counts(target, file.validSecond)
      : keys.map((k) => file.parties.find((p) => p.id === k)!.votes);
  let adjusted = 0;
  const districts = file.districts.map((d) => {
    if (!d.candidates.some((c) => c.partyId && first[c.partyId])) return d;
    const desired = d.candidates.map(
        (c) =>
          (c.votes / d.validFirst) * 100 +
          (c.partyId ? first[c.partyId] || 0 : 0),
      ),
      projected = projectShares(desired);
    if (projected.some((v, i) => Math.abs(v - desired[i]) > 1e-8)) adjusted++;
    const votes = counts(projected, d.validFirst);
    return {
      ...d,
      candidates: d.candidates.map((c, i) => ({ ...c, votes: votes[i] })),
    };
  });
  return {
    file: {
      ...file,
      parties: file.parties.map((p) => ({
        ...p,
        votes: p.hasList ? secondCounts[keys.indexOf(p.id)] : 0,
      })),
      districts,
      excludedSecondVotes:
        changedSecond || Object.values(first).some((v) => v !== 0)
          ? undefined
          : file.excludedSecondVotes,
    },
    adjusted,
    secondDeltas,
  };
}
export function electionMandates(file: ElectionFile) {
  const winners = file.districts.map((d) => {
    const maximum = Math.max(...d.candidates.map((c) => c.votes)),
      tied = d.candidates.filter((c) => c.votes === maximum);
    const winner =
      tied.length === 1
        ? tied[0]
        : tied.find((c) => c.id === file.districtLots?.[String(d.number)]);
    if (!winner)
      throw new Error(
        `Wahlkreis ${d.number}: hypothetische oder amtliche Losentscheidung fehlt (${tied.map((c) => c.name).join(", ")}).`,
      );
    return { ...winner, district: d.number };
  });
  const parties = file.parties.map((p) => ({
    ...p,
    direct: winners.filter((w) => w.partyId === p.id).length,
  }));
  const specials = winners.filter(
    (w) =>
      w.partyId === null ||
      !parties.some(
        (p) =>
          p.id === w.partyId &&
          p.hasList &&
          BigInt(p.votes) * 20n >= BigInt(file.validSecond),
      ),
  );
  const seats = allocateBw2026({
    parties,
    validSecond: file.validSecond,
    specialDirect: winners.filter((w) => w.partyId === null).length,
    specialFirstVotes: specials.reduce((s, w) => s + w.votes, 0),
    excludedSecondVotes: file.excludedSecondVotes,
    baseSeatLots: file.baseSeatLots,
  });
  const directIds = new Set(winners.map((w) => w.id));
  let vacancies = 0;
  const people = winners.map((w) => ({
    id: w.id,
    name: w.name,
    partyId: w.partyId,
    route: "Wahlkreis",
    district: w.district,
    listRank: null as number | null,
  }));
  if (file.listsComplete) {
    for (const row of seats.rows) {
      const list = (file.lists[row.id] || [])
        .map((p, i) => ({ ...p, rank: i + 1 }))
        .filter((p) => !directIds.has(p.id));
      const elected = list.slice(0, row.list);
      vacancies += Math.max(0, row.list - elected.length);
      people.push(
        ...elected.map((p) => ({
          id: p.id,
          name: p.name,
          partyId: row.id,
          route: "Landesliste",
          district: 0,
          listRank: p.rank,
        })),
      );
    }
  }
  return {
    seats,
    people,
    unfilled: file.listsComplete ? vacancies + seats.unallocated : null,
    winners,
    parties,
  };
}
