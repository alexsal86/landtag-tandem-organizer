import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import districtResults2021 from "@/data/ltw2021DistrictResults.json";

interface PartyInput {
  id: string;
  name: string;
  color: string;
  poll: number;
  directMandates: number;
  aggregated?: boolean;
}

interface DistrictResult2021 {
  districtNumber: number;
  districtName: string;
  winner2021: string;
  winnerParty2021: string;
}

interface SeatResult extends PartyInput {
  eligible: boolean;
  proportionalSeats: number;
  listSeats: number;
}

const MIN_SEATS = 120;
const THRESHOLD = 5;
const CANDIDATE_PARTIES = ["GRÜNE", "CDU", "SPD", "FDP", "AfD", "Linke"] as const;
type CandidateParty = (typeof CANDIDATE_PARTIES)[number];
type AssignmentMap = Record<string, Record<CandidateParty, string>>;

const STORAGE_KEY = "bw2026-candidate-assignments";

const initialParties: PartyInput[] = [
  { id: "cdu", name: "CDU", color: "#111827", poll: 29, directMandates: 12 },
  { id: "spd", name: "SPD", color: "#dc2626", poll: 10, directMandates: 0 },
  { id: "gruene", name: "Grüne", color: "#16a34a", poll: 21, directMandates: 58 },
  { id: "fdp", name: "FDP", color: "#f59e0b", poll: 5, directMandates: 0 },
  { id: "linke", name: "Linke", color: "#9333ea", poll: 7, directMandates: 0 },
  { id: "afd", name: "AfD", color: "#2563eb", poll: 20, directMandates: 0 },
  { id: "bsw", name: "BSW", color: "#7c3aed", poll: 3, directMandates: 0 },
  { id: "sonstige", name: "Sonstige (aggregiert)", color: "#6b7280", poll: 5, directMandates: 0, aggregated: true },
];

const allocateSainteLague = (parties: PartyInput[], seats: number): Record<string, number> => {
  const scores = parties.map((party) => ({ id: party.id, votes: party.poll, seats: 0 }));

  for (let i = 0; i < seats; i += 1) {
    let bestIndex = 0;
    let bestQuotient = -1;

    for (let index = 0; index < scores.length; index += 1) {
      const entry = scores[index];
      const quotient = entry.votes / (2 * entry.seats + 1);
      if (quotient > bestQuotient) {
        bestQuotient = quotient;
        bestIndex = index;
      }
    }

    scores[bestIndex].seats += 1;
  }

  return Object.fromEntries(scores.map((entry) => [entry.id, entry.seats]));
};

const buildDefaultAssignments = (districts: DistrictResult2021[]): AssignmentMap => {
  const assignments: AssignmentMap = {};

  districts.forEach((district) => {
    const row: Record<CandidateParty, string> = {
      "GRÜNE": "",
      CDU: "",
      SPD: "",
      FDP: "",
      AfD: "",
      Linke: "",
    };

    if (district.winnerParty2021 in row) {
      row[district.winnerParty2021 as CandidateParty] = district.winner2021;
    }

    assignments[String(district.districtNumber)] = row;
  });

  return assignments;
};

export function DataView() {
  const [parties, setParties] = useState<PartyInput[]>(initialParties);
  const districtData = useMemo(() => (districtResults2021 as DistrictResult2021[]).slice().sort((a, b) => a.districtNumber - b.districtNumber), []);

  const [assignments, setAssignments] = useState<AssignmentMap>(() => {
    const fallback = buildDefaultAssignments(districtResults2021 as DistrictResult2021[]);
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(saved) as AssignmentMap;
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  }, [assignments]);

  const winnerStats = useMemo(() => {
    const counts = districtData.reduce<Record<string, number>>((acc, item) => {
      acc[item.winnerParty2021] = (acc[item.winnerParty2021] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [districtData]);

  const result = useMemo(() => {
    const eligibleParties = parties.filter((party) => !party.aggregated && party.poll >= THRESHOLD);

    if (eligibleParties.length === 0) {
      return {
        parliamentSize: MIN_SEATS,
        rows: parties.map<SeatResult>((party) => ({ ...party, eligible: false, proportionalSeats: 0, listSeats: 0 })),
      };
    }

    let parliamentSize = MIN_SEATS;
    let seatsByParty = allocateSainteLague(eligibleParties, parliamentSize);

    while (eligibleParties.some((party) => party.directMandates > (seatsByParty[party.id] ?? 0))) {
      parliamentSize += 1;
      seatsByParty = allocateSainteLague(eligibleParties, parliamentSize);
    }

    const rows = parties.map<SeatResult>((party) => {
      const eligible = !party.aggregated && party.poll >= THRESHOLD;
      const proportionalSeats = eligible ? seatsByParty[party.id] ?? 0 : 0;

      return {
        ...party,
        eligible,
        proportionalSeats,
        listSeats: Math.max(0, proportionalSeats - party.directMandates),
      };
    });

    return { parliamentSize, rows };
  }, [parties]);

  const updateParty = (id: string, key: keyof PartyInput, value: number) => {
    setParties((current) => current.map((party) => (party.id === id ? { ...party, [key]: Number.isFinite(value) ? Math.max(0, value) : 0 } : party)));
  };

  const updateAssignment = (districtNumber: number, party: CandidateParty, value: string) => {
    const districtKey = String(districtNumber);
    setAssignments((current) => ({
      ...current,
      [districtKey]: {
        ...(current[districtKey] ?? { "GRÜNE": "", CDU: "", SPD: "", FDP: "", AfD: "", Linke: "" }),
        [party]: value,
      },
    }));
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daten: Mandaterechner Landtagswahl Baden-Württemberg 2026</CardTitle>
          <CardDescription>Modell mit 120 Mindestsitzen, 5%-Hürde und Ausgleich über Sainte-Laguë/Schepers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Startwerte Umfrage: CDU 29, SPD 10, Grüne 21, FDP 5, Linke 7, AfD 20, BSW 3, Sonstige 5.
            Die 5% „Sonstige" sind aggregiert und werden nicht als einzelne listefähige Partei verteilt.
          </p>
          <p>
            Startwerte Direktmandate basieren auf 2021 (Grüne 58, CDU 12), um einen realistisch vergrößerten Landtag zu simulieren.
          </p>
          <Badge variant="secondary">Aktuelle simulierte Parlamentsgröße: {result.parliamentSize} Sitze</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wahlkreisstatistik 2021 (70 Wahlkreise)</CardTitle>
          <CardDescription>
            Eingepflegt aus dem im Projekt verfügbaren 2021er Wahlkreis-Datensatz als Statistikgrundlage je Wahlkreis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {winnerStats.map(([party, count]) => (
              <Badge key={party} variant="outline">
                {party}: {count}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Hinweis: In dieser Ansicht werden die Direktmandat-Gewinner je Wahlkreis statistisch aggregiert.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eingaben Mandaterechner</CardTitle>
          <CardDescription>Umfragewerte (%) und Direktmandate je Partei anpassen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {parties.map((party) => (
            <div key={party.id} className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-3 items-end">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: party.color }} />
                <span className="font-medium">{party.name}</span>
              </div>
              <div>
                <Label htmlFor={`${party.id}-poll`}>Umfrage in %</Label>
                <Input id={`${party.id}-poll`} type="number" min={0} step={0.1} value={party.poll} onChange={(event) => updateParty(party.id, "poll", Number(event.target.value))} />
              </div>
              <div>
                <Label htmlFor={`${party.id}-direct`}>Direktmandate</Label>
                <Input id={`${party.id}-direct`} type="number" min={0} step={1} value={party.directMandates} onChange={(event) => updateParty(party.id, "directMandates", Number(event.target.value))} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulationsergebnis</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partei</TableHead>
                <TableHead className="text-right">Umfrage</TableHead>
                <TableHead className="text-right">Direkt</TableHead>
                <TableHead className="text-right">Proportional</TableHead>
                <TableHead className="text-right">Liste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">{row.poll.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{row.directMandates}</TableCell>
                  <TableCell className="text-right">{row.eligible ? row.proportionalSeats : "–"}</TableCell>
                  <TableCell className="text-right">{row.eligible ? row.listSeats : "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">
            Rechenlogik: Parteien unter 5% (und aggregierte „Sonstige") erhalten keine proportionalen Sitze. Die Gesamtgröße wird ab 120 so lange erhöht,
            bis keine Partei mehr Direktmandate über ihrem proportionalen Sitzanspruch hat.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wahlkreiskandidaten 2026 (Zuordnung je Wahlkreis)</CardTitle>
          <CardDescription>
            Hier kannst du für GRÜNE, CDU, SPD, FDP, AfD und Linke die Kandidat:innen pro Wahlkreis pflegen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Wahlkreis</TableHead>
                  {CANDIDATE_PARTIES.map((party) => (
                    <TableHead key={party} className="min-w-[170px]">{party}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {districtData.map((district) => (
                  <TableRow key={district.districtNumber}>
                    <TableCell>
                      {district.districtNumber} – {district.districtName}
                    </TableCell>
                    {CANDIDATE_PARTIES.map((party) => (
                      <TableCell key={party}>
                        <Input
                          placeholder="Kandidat:in 2026"
                          value={assignments[String(district.districtNumber)]?.[party] ?? ""}
                          onChange={(event) => updateAssignment(district.districtNumber, party, event.target.value)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Standardmäßig sind die Gewinnernamen 2021 in der jeweiligen Gewinnerpartei vorbelegt; alle Felder lassen sich überschreiben und werden lokal im Browser gespeichert.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
