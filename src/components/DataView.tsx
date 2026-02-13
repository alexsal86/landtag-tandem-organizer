import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface PartyInput {
  id: string;
  name: string;
  color: string;
  poll: number;
  directMandates: number;
  aggregated?: boolean;
}

interface SeatResult extends PartyInput {
  eligible: boolean;
  proportionalSeats: number;
  listSeats: number;
}

const MIN_SEATS = 120;
const THRESHOLD = 5;

// Startwerte laut beigefügter letzter Umfrage + 2021er Direktmandate als Basisszenario
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
  const scores = parties.map((party) => ({
    id: party.id,
    votes: party.poll,
    seats: 0,
  }));

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

export function DataView() {
  const [parties, setParties] = useState<PartyInput[]>(initialParties);

  const result = useMemo(() => {
    const eligibleParties = parties.filter((party) => !party.aggregated && party.poll >= THRESHOLD);

    if (eligibleParties.length === 0) {
      return {
        parliamentSize: MIN_SEATS,
        rows: parties.map<SeatResult>((party) => ({
          ...party,
          eligible: false,
          proportionalSeats: 0,
          listSeats: 0,
        })),
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
    setParties((current) =>
      current.map((party) => (party.id === id ? { ...party, [key]: Number.isFinite(value) ? Math.max(0, value) : 0 } : party)),
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daten: Mandaterechner Landtagswahl Baden-Württemberg 2026</CardTitle>
          <CardDescription>
            Modell mit 120 Mindestsitzen, 5%-Hürde und Ausgleich über Sainte-Laguë/Schepers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Startwerte Umfrage: CDU 29, SPD 10, Grüne 21, FDP 5, Linke 7, AfD 20, BSW 3, Sonstige 5.
            Die 5% "Sonstige" sind aggregiert und werden daher nicht als einzelne listefähige Partei verteilt.
          </p>
          <p>
            Startwerte Direktmandate basieren auf der letzten Landtagswahl (2021): Grüne 58, CDU 12, übrige 0.
            Dadurch entsteht in der Standardsimulation ein vergrößerter Landtag über 120 Sitze.
          </p>
          <p>
            Das ist ein transparenter Simulationsrechner und keine amtliche Sitzberechnung des Landeswahlleiters.
          </p>
          <Badge variant="secondary">Aktuelle simulierte Parlamentsgröße: {result.parliamentSize} Sitze</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eingaben</CardTitle>
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
                <Input
                  id={`${party.id}-poll`}
                  type="number"
                  min={0}
                  step={0.1}
                  value={party.poll}
                  onChange={(event) => updateParty(party.id, "poll", Number(event.target.value))}
                />
              </div>
              <div>
                <Label htmlFor={`${party.id}-direct`}>Direktmandate</Label>
                <Input
                  id={`${party.id}-direct`}
                  type="number"
                  min={0}
                  step={1}
                  value={party.directMandates}
                  onChange={(event) => updateParty(party.id, "directMandates", Number(event.target.value))}
                />
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
            Rechenlogik: Parteien unter 5% (und aggregierte "Sonstige") erhalten keine proportionalen Sitze. Die
            Gesamtgröße wird ab 120 so lange erhöht, bis keine Partei mehr Direktmandate über ihrem proportionalen
            Sitzanspruch hat.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
