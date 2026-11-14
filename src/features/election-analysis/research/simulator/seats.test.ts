import { describe, expect, it } from "vitest";
import { allocateBw2026, LotRequired, sainteLague } from "./seats";
import {
  directTransferThreshold,
  referenceComparison,
  secondVoteScenario,
} from "./model";
import {
  electionMandates,
  parseElectionFile,
  shiftElection,
} from "./electionFile";
import { BW_RULES_VERSION, type ElectionFile, type SeatParty } from "./types";
const party = (id: string, votes: number, direct: number): SeatParty => ({
  id,
  name: id,
  votes,
  direct,
  hasList: true,
});
const official = [
  party("GRÜNE", 1623208, 13),
  party("CDU", 1595929, 56),
  party("SPD", 298297, 0),
  party("FDP", 235598, 0),
  party("AfD", 1010574, 1),
  party("Die Linke", 236975, 0),
  party("FREIE WÄHLER", 102716, 0),
  party("Die PARTEI", 22765, 0),
  party("dieBasis", 15126, 0),
  party("KlimalisteBW", 2764, 0),
  party("ÖDP", 9339, 0),
  party("Volt", 45842, 0),
  party("Bündnis C", 12533, 0),
  party("PdH", 2347, 0),
  party("Verjüngungsforschung", 3526, 0),
  party("BSW", 76439, 0),
  party("Die Gerechtigkeitspartei", 7315, 0),
  party("PDR", 9017, 0),
  party("PdF", 3649, 0),
  party("Tierschutzpartei", 49827, 0),
  party("WerteUnion", 11323, 0),
];
const file = (): ElectionFile => ({
  version: BW_RULES_VERSION,
  year: 2026,
  source_url: "https://example.org/synthetic",
  data_release: "synthetic",
  validSecond: 1000,
  parties: [party("A", 600, 70), party("B", 400, 0)],
  districts: Array.from({ length: 70 }, (_, i) => ({
    number: i + 1,
    validFirst: 100,
    candidates: [
      { id: `A${i}`, name: `Synthetic A ${i}`, partyId: "A", votes: 60 },
      { id: `B${i}`, name: `Synthetic B ${i}`, partyId: "B", votes: 40 },
    ],
  })),
  lists: { A: [], B: [] },
  listsComplete: true,
});
describe("BW-2026 / § 2 LWG", () => {
  it("reproduziert die amtliche Endfeststellung 157/56/56/35/10", () => {
    const r = referenceComparison(official);
    expect(r.matches).toBe(true);
    expect(r.result.total).toBe(157);
    expect(r.result.overhang).toBe(14);
    expect(r.result.balance).toBe(23);
  });
  it("zieht eine echte Losannahme einem willkürlichen Reihenfolgeentscheid vor", () => {
    expect(() =>
      sainteLague(
        [
          { id: "A", votes: 1 },
          { id: "B", votes: 1 },
        ],
        1,
      ),
    ).toThrow(LotRequired);
    expect(
      sainteLague(
        [
          { id: "A", votes: 1 },
          { id: "B", votes: 1 },
        ],
        1,
        false,
        ["B"],
      ),
    ).toEqual({ A: 0, B: 1 });
    expect(
      sainteLague(
        [
          { id: "A", votes: 1 },
          { id: "B", votes: 1 },
        ],
        1,
        true,
      ),
    ).toEqual({ A: 1, B: 1 });
  });
  it("wendet mindestens fünf Prozent und vollständig getrennte Restparteien an", () => {
    const exact = allocateBw2026({
      parties: [party("A", 950, 70), party("B", 50, 0)],
      validSecond: 1000,
    });
    expect(exact.rows[1].eligible).toBe(true);
    expect(
      allocateBw2026({
        parties: [party("A", 951, 70), party("B", 49, 0)],
        validSecond: 1000,
      }).rows[1].total,
    ).toBe(0);
    expect(() =>
      allocateBw2026({
        parties: [party("A", 900, 70), party("REST", 100, 0)],
        validSecond: 1000,
      }),
    ).toThrow("Restkategorien");
  });
  it("gleicht Überhang vollständig aus und erhält alle Direktmandate", () => {
    const r = allocateBw2026({
      parties: [party("A", 400, 70), party("B", 600, 0)],
      validSecond: 1000,
    });
    expect(r.rows[0].total).toBeGreaterThanOrEqual(70);
    expect(r.total).toBe(174);
    expect(r.rows.reduce((s, p) => s + p.total, 0)).toBe(r.total);
    expect(r.overhang + r.balance).toBe(r.total - 120);
  });
  it("beachtet die Mehrheitsklausel bei mehr als der Hälfte der sitzwirksamen Stimmen", () => {
    const r = allocateBw2026({
      parties: [party("A", 501, 35), party("B", 499, 35)],
      validSecond: 1000,
    });
    expect(r.majorityBonus).toBe(1);
    expect(r.total).toBe(121);
    expect(r.rows[0].total).toBe(61);
  });
  it("verlangt Sonderdirektmandats-Kreuzinformationen und explizite Nullkorrekturen", () => {
    const p = [party("A", 600, 35), party("B", 400, 34)];
    expect(() =>
      allocateBw2026({ parties: p, validSecond: 1000, specialDirect: 1 }),
    ).toThrow("bereinigten");
    expect(() =>
      allocateBw2026({
        parties: p,
        validSecond: 1000,
        specialDirect: 1,
        specialFirstVotes: 20,
        excludedSecondVotes: { A: 10 },
      }),
    ).toThrow("explizite");
    expect(
      allocateBw2026({
        parties: p,
        validSecond: 1000,
        specialDirect: 1,
        specialFirstVotes: 20,
        excludedSecondVotes: { A: 10, B: 0 },
      }).total,
    ).toBe(120);
  });
  it("lässt bei völlig fehlenden verteilbaren Stimmen die restlichen Basissitze unbesetzt", () => {
    const p = Array.from({ length: 21 }, (_, i) =>
      party(`P${i}`, 1, i === 0 ? 70 : 0),
    );
    const r = allocateBw2026({
      parties: p,
      validSecond: 21,
      specialFirstVotes: 100,
      excludedSecondVotes: {},
    });
    expect(r.total).toBe(70);
    expect(r.unallocated).toBe(50);
  });
  it("verwechselt fehlende Zweitstimmen nicht mit einer vollständigen Wahl", () => {
    expect(() =>
      allocateBw2026({ parties: [party("A", 500, 70)], validSecond: 1000 }),
    ).toThrow("Zweitstimmen");
  });
});
describe("Erst-/Zweitstimmen und Personen", () => {
  it("erhält alle Stimmen bei Nulländerungen und erkennt Listenerschöpfung", () => {
    const f = parseElectionFile(file()),
      r = electionMandates(f);
    expect(r.winners).toHaveLength(70);
    expect(r.people).toHaveLength(70);
    expect(r.unfilled).toBeGreaterThan(0);
    expect(
      shiftElection(f, {}, {}, "A").file.districts[0].candidates[0].votes,
    ).toBe(60);
  });
  it("weist unvollständige Nominierungen und Namen als Identitätsersatz zurück", () => {
    const f = file();
    f.districts[1].candidates[0].id = f.districts[0].candidates[0].id;
    expect(() => parseElectionFile(f)).toThrow("Personen-ID");
    const incomplete = file();
    incomplete.districts.pop();
    expect(() => parseElectionFile(incomplete)).toThrow("70 Wahlkreise");
  });
  it("überspringt direkt gewählte IDs in der Landesliste und meldet weitere Listenpersonen", () => {
    const f = file();
    f.lists.B = [
      { id: "B0", name: "Synthetic B 0" },
      { id: "other", name: "Synthetic Other" },
    ];
    const r = electionMandates(f);
    expect(
      r.people.filter((p) => p.route === "Landesliste").map((p) => p.id),
    ).toEqual(["B0", "other"]);
    expect(new Set(r.people.map((p) => p.id)).size).toBe(r.people.length);
  });
  it("lässt einen Wahlkreisgleichstand erst nach expliziter Losannahme entscheiden", () => {
    const f = file();
    f.districts[0].candidates[0].votes = 50;
    f.districts[0].candidates[1].votes = 50;
    expect(() => electionMandates(f)).toThrow("Losentscheidung");
    f.districtLots = { "1": "B0" };
    expect(electionMandates(f).winners[0].id).toBe("B0");
  });
  it("trennt Zweitstimmenänderungen und Direktmandatsannahmen", () => {
    const p = [party("A", 600, 70), party("B", 400, 0)];
    const shifted = secondVoteScenario(p, 1000, { B: 5 }, "A");
    expect(shifted.parties.map((p) => p.votes)).toEqual([550, 450]);
    expect(shifted.parties.map((p) => p.direct)).toEqual([70, 0]);
  });
  it("berechnet eine explizite direkte Stimmenübertragung gegen alle Gegenbewerber", () => {
    expect(
      directTransferThreshold(
        [
          { id: "A", votes: 60 },
          { id: "B", votes: 40 },
        ],
        "B",
      ),
    ).toBe(11);
    expect(
      directTransferThreshold(
        [
          { id: "A", votes: 60 },
          { id: "B", votes: 0 },
          { id: "C", votes: 59 },
        ],
        "B",
      ),
    ).toBe(60);
    expect(
      directTransferThreshold(
        [
          { id: "A", votes: 60 },
          { id: "B", votes: 40 },
        ],
        "A",
      ),
    ).toBe(0);
  });
});
