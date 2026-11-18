import { lazy, Suspense, useState } from 'react';
import { useAnalysisYears } from '@/features/election-analysis/useElectionAnalysis';
import { DataState, Selection } from '@/features/election-analysis/shared';
const QualityPanel = lazy(() => import('./ElectionQualityPanel'));
const SourcesPanel = lazy(() => import('./ElectionSourcesPanel'));
export function ElectionDataChecks({ section }: { section: 'quality' | 'sources' }) {
  const years = useAnalysisYears();
  const [requestedYear, setRequestedYear] = useState(0);
  const year = years.data?.find(item => item.year === requestedYear)?.year || years.data?.[0]?.year || 0;
  return <section className="min-w-0 space-y-4">
    <h3 className="text-xl font-semibold">{section === 'quality' ? 'Datenqualität' : 'Quellenabgleich'}</h3>
    <DataState loading={years.isLoading} error={years.error} empty={!years.data?.length} retry={() => void years.refetch()}>
      <Selection id="admin-election-check-year" label="Wahl für Datenprüfung" value={String(year)} onChange={value => setRequestedYear(Number(value))}>{years.data?.map(item => <option key={item.year} value={item.year}>{item.year} · {item.period_number}. Legislaturperiode</option>)}</Selection>
      {year > 0 && <Suspense fallback={<p role="status">Datenprüfung lädt …</p>}>{section === 'quality' ? <QualityPanel key={year} year={year} /> : <SourcesPanel key={year} year={year} />}</Suspense>}
    </DataState>
  </section>;
}
