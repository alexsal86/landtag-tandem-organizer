import { candidacyOutcomeLabels } from '@/features/election-history/admin/candidateCareerModel';
import type { ElectionPeriod } from '@/features/election-history/types';
import { DeputySeatDistribution } from './DeputySeatDistribution';
import { number, percent } from './model';
import type { DeputyCandidacy } from './deputyParticipation';

export function DeputyCandidacyResult({ candidates, period }: { candidates: readonly DeputyCandidacy[]; period?: ElectionPeriod }) {
  return <section className="deputy-election-result" aria-label="Wahlteilnahme ohne erfasstes Mandat">
    <div className="deputy-election-layout">
      <div className="deputy-election-chart">
        <h4 className="deputy-caption deputy-section-heading deputy-result-heading"><span aria-hidden="true">02</span> Wahlteilnahme & Ergebnis</h4>
        <p className="mb-4 text-sm text-muted-foreground">Kein Mandat in dieser Legislaturperiode erfasst.</p>
        <div className="space-y-5">{candidates.map(candidate => <article key={candidate.id} className="space-y-2">
          <p className="font-semibold">{candidacyOutcomeLabels[candidate.outcome]} · {candidate.party}</p>
          <p className="text-sm">{candidate.district_name ? `Wahlkreis ${candidate.district_label ? `${candidate.district_label}: ` : ''}${candidate.district_name}` : 'Wahlkreis nicht erfasst'}{candidate.list_position != null ? ` · Listenplatz ${candidate.list_position}` : ''}</p>
          <p className="text-sm">{candidate.ballot_type === 'first_vote' ? 'Erststimmen' : 'Einzelstimmen'} · {candidate.votes == null ? 'Stimmenzahl nicht erfasst' : `${number(candidate.votes)} Stimmen`} · {percent(candidate.vote_share)}</p>
          {candidate.result_preliminary && <p className="text-xs text-muted-foreground">Vorläufiges Ergebnis</p>}
          {[...new Set([candidate.notes, candidate.result_notes].filter(Boolean))].map(note => <p key={note} className="text-xs text-muted-foreground">{note}</p>)}
          {candidate.source_url && <a className="text-xs underline" href={candidate.source_url} target="_blank" rel="noreferrer">Quelle der Kandidatur</a>}
        </article>)}</div>
      </div>
      <aside className="deputy-election-period" aria-label="Zusammensetzung des ausgewählten Landtags"><DeputySeatDistribution period={period} party={candidates[0]?.party || ''} /></aside>
    </div>
  </section>;
}
