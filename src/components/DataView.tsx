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
}

interface SeatResult extends PartyInput {
  eligible: boolean;
  proportionalSeats: number;
  listSeats: number;
}

const MIN_SEATS = 120;
const THRESHOLD = 5;

const initialParties: PartyInput[] = [
  { id: "cdu", name: "CDU", color: "#111827", poll: 31, directMandates: 38 },
  { id: "gruene", name: "Grüne", color: "#16a34a", poll: 20, directMandates: 19 },
  { id: "afd", name: "AfD", color: "#2563eb", poll: 18, directMandates: 8 },
  { id: "spd", name: "SPD", color: "#dc2626", poll: 12, directMandates: 4 },
  { id: "fdp", name: "FDP", color: "#f59e0b", poll: 6, directMandates: 1 },
  { id: "linke", name: "Linke", color: "#9333ea", poll: 4, directMandates: 0 },
  { id: "fw", name: "Freie Wähler", color: "#f97316", poll: 3, directMandates: 0 },
  { id: "bsw", name: "BSW", color: "#7c3aed", poll: 3, directMandates: 0 },
  { id: "sonstige", name: "Sonstige", color: "#6b7280", poll: 3, directMandates: 0 },
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
    const eligibleParties = parties.filter((party) => party.poll >= THRESHOLD);

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
      const eligible = party.poll >= THRESHOLD;
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
            Modell für die Sitzverteilung mit regulär 120 Sitzen, 5%-Hürde und Ausgleich über Sainte-Laguë/Schepers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Regel-Grundlage: Wahlrecht ab 2026 mit personalisierter Verhältniswahl (Wahlkreis- und Listenmandate),
            regulärer Landtag mit 120 Sitzen sowie mögliche Vergrößerung bei Überhang-/Ausgleichseffekten.
          </p>
          <p>
            Umfrage-Grundlage (Startwerte im Rechner): angenäherte letzte veröffentlichte BW-Landesumfrage
            Anfang 2026 (CDU 31, Grüne 20, AfD 18, SPD 12, FDP 6, übrige darunter).
          </p>
          <p>
            Hinweis: Das Tool ist ein transparenter Simulationsrechner für politische Arbeit und ersetzt keine amtliche
            Sitzberechnung des Landeswahlleiters.
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
            Rechenlogik: Parteien unter 5% erhalten keine proportionalen Sitze. Die Gesamtgröße wird von 120 aus
            schrittweise erhöht, bis keine Partei mehr mehr Direktmandate hat als proportionale Sitze.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
