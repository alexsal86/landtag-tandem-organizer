import type { ElectionPeriod } from '@/features/election-history/types';
import { seatBasisLabels } from '@/features/election-history/periodSeats';
import { StateSeatDistribution } from './StateSeatDistribution';
import { parliamentPartyKey } from './seatDistributionModel';
import type { StateResult } from './types';

export function DeputySeatDistribution({ period, party }: { period?: ElectionPeriod; party: string }) {
  const title = <span className="deputy-seat-heading"><span>03</span> Zusammensetzung des Landtags</span>;
  if (!period) return <section className="deputy-seat-status"><h4>{title}</h4><p>Keine freigegebene Legislaturperiode ausgewählt.</p></section>;
  const rows: StateResult[] = (period.seat_distribution || []).map(row => ({ party:row.faction,seats:row.seats,
    year:period.election_year || 0,ballot:period.election_year && period.election_year>=2026 ? 'second' : 'single',votes:null,share:null,valid_votes:null,notes:null }));
  const represented = rows.reduce((sum,row) => sum+(row.seats || 0),0);
  const highlight = rows.find(row => parliamentPartyKey(row.party)===parliamentPartyKey(party))?.party;
  const totalNote = period.seat_total==null ? 'Gesamtsitzzahl nicht hinterlegt.'
    : represented!==period.seat_total ? `${represented} von ${period.seat_total} Sitzen sind Parteien zugeordnet.` : `${period.seat_total} Sitze insgesamt.`;
  const basis = seatBasisLabels[period.seat_basis || 'unknown'];
  return <div className="space-y-2">
    <StateSeatDistribution rows={rows} year={period.election_year || 0} ballot={period.election_year && period.election_year>=2026 ? 'second' : 'single'} compact title={title} highlightParty={highlight}
      sourceNote={`${period.number}. Wahlperiode · ${basis}${period.seat_reference_date ? ` (${period.seat_reference_date.split('-').reverse().join('.')})` : ''}. ${totalNote}`} />
    {highlight && <p className="text-xs text-muted-foreground">Markierte Partei: {highlight}. Keine persönliche Sitzposition.</p>}
    {(period.seat_source_url || period.seat_notes) && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Quelle der Sitzverteilung</summary>
      {period.seat_source_url && <a className="mt-2 block underline" href={period.seat_source_url} target="_blank" rel="noreferrer">Quelle öffnen</a>}
      {period.seat_notes && <p className="mt-2">{period.seat_notes}</p>}
    </details>}
  </div>;
}
