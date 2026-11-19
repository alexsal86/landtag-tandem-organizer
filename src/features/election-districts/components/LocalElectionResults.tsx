import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPartyColor } from '../partyColors';

const localResultParties = ['GRÜNE', 'CDU', 'SPD', 'FDP', 'AfD'] as const;
const counts = new Intl.NumberFormat('de-DE');
const shares = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type BallotCounts = [valid: number, greens: number, cdu: number, spd: number, fdp: number, afd: number];

export type LocalBallot = 'first' | 'second';

export interface LocalArea {
  key: string;
  name: string;
  level?: 'Stadtbezirk' | 'Stadtteil';
  first: BallotCounts | null;
  second: BallotCounts | null;
  noLocalPostal?: boolean;
  noGeometry?: boolean;
  partial?: boolean;
  winners?: Partial<Record<LocalBallot, typeof localResultParties[number]>>;
}

export function useLocalElectionResults(districtNumber: number | undefined) {
  return useQuery({
    enabled: districtNumber !== undefined,
    queryKey: ['local-election-results-2026', districtNumber],
    queryFn: async ({ signal }): Promise<LocalArea[]> => {
      const response = await fetch(`/data/local-results-2026/${districtNumber}.json`, { signal });
      if (!response.ok) throw new Error('Gebietsergebnisse konnten nicht geladen werden.');
      const areas: LocalArea[] = await response.json();
      return areas.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function LocalElectionResults({
  query, area, ballot, onAreaChange, onBallotChange,
}: {
  query: ReturnType<typeof useLocalElectionResults>;
  area?: LocalArea;
  ballot: LocalBallot;
  onAreaChange: (key: string) => void;
  onBallotChange: (ballot: LocalBallot) => void;
}) {
  const areas = query.data ?? [];
  const result = area?.[ballot];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Gebietsergebnisse 2026</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {query.isPending && <p role="status">Gebietsergebnisse werden geladen …</p>}
        {query.isError && <p role="alert">Gebietsergebnisse konnten nicht geladen werden.</p>}
        {area && (
          <>
            <label className="block">
              {area.level ?? 'Gemeinde / Gemeindeanteil'}
              <select className="mt-1 block w-full rounded-md border bg-background p-2"
                value={area.key} onChange={event => onAreaChange(event.target.value)}>
                {areas.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
              </select>
            </label>
            <label className="block">
              Stimmenart
              <select className="mt-1 block w-full rounded-md border bg-background p-2"
                value={ballot} onChange={event => onBallotChange(event.target.value === 'first' ? 'first' : 'second')}>
                <option value="first">Erststimmen</option>
                <option value="second">Zweitstimmen</option>
              </select>
            </label>
            <p className="text-xs text-muted-foreground">Die Kartenfarbe zeigt die stärkste Partei. Grau steht für Gleichstand, eine stärkste Partei außerhalb der Auswahl oder fehlende Ergebnisse.</p>
            {area.partial && <p className="text-muted-foreground">Teil des Stadtbezirks im ausgewählten Wahlkreis</p>}
            {area.noGeometry && <p className="text-muted-foreground">Für dieses Gebiet ist keine Kartenfläche hinterlegt.</p>}
            {area.noLocalPostal && <p className="text-muted-foreground">Kein eigener Briefwahlbezirk mit ausgewiesenen Stimmen. Gemeinsame Briefwahl kann außerhalb dieses Gemeindeergebnisses erfasst sein.</p>}
            {result ? (
              <>
                <table className="w-full tabular-nums">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th scope="col" className="text-left">Partei</th>
                      <th scope="col" className="text-right">Stimmen</th>
                      <th scope="col" className="text-right">Anteil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localResultParties.map((party, index) => {
                      const votes = result[index + 1];
                      return <tr key={party} className="border-t">
                        <th scope="row" className="py-1 text-left font-normal">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden className="size-2.5 rounded-full border border-black/20" style={{ backgroundColor: getPartyColor(party) }} />
                            {party}
                          </span>
                        </th>
                        <td className="text-right">{counts.format(votes)}</td>
                        <td className="text-right">{result[0] > 0 ? shares.format(votes / result[0]) : '–'}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-muted-foreground">{counts.format(result[0])} gültige Stimmen insgesamt. Die Anteile beziehen sich auf alle gültigen Stimmen.</p>
              </>
            ) : <p className="text-muted-foreground">Für dieses Gebiet enthält die CSV kein eigenes Ergebnis.</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
