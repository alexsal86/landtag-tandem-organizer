import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState, LoadingState } from '@/components/ui-patterns';
import { useAuth } from '@/hooks/useAuth';
import { useAdministrationAccess } from '@/components/administration/useAdministrationAccess';
import { CandidateIdentityReview } from '@/features/election-analysis/research/CandidateIdentityReview';
import { CandidateCoverageReview } from '@/features/election-analysis/research/CandidateCoverageReview';
import { HistoryLinkReview } from '@/features/election-analysis/research/HistoryLinkReview';
import { ElectionDeputyDirectory } from './ElectionDeputyDirectory';
import { historyError, useElectionHistory, useElectionPeriodOverview, useElectionPeriods } from './useElectionHistory';
import { HistoryDataGrid } from './admin/HistoryDataGrid';
import { CandidacyImportDialog } from './admin/CandidacyImportDialog';
import type { GridEntity } from './admin/historyFields';

type WorkspaceSection = GridEntity | 'deputies';

export default function ElectionHistoryAdmin() {
  const { user, loading } = useAuth();
  const access = useAdministrationAccess(user?.id, undefined, loading);
  if (access.checkingAdmin) return <LoadingState title="Berechtigung wird geprüft" />;
  if (!access.isSuperAdmin) return <p>Nur Super-Admins können zentrale Wahldaten verwalten.</p>;
  return <ElectionHistoryWorkspace key={user?.id} />;
}

function ElectionHistoryWorkspace() {
  const periodQuery = useElectionPeriods();
  const overviewQuery = useElectionPeriodOverview();
  const [section, setSection] = useState<WorkspaceSection>('periods');
  const [periodFilter, setPeriodFilter] = useState('');
  const selectedPeriod = periodFilter || periodQuery.data?.find(period => period.is_current)?.id || periodQuery.data?.[0]?.id || '';
  const query = useElectionHistory(selectedPeriod);
  const [importOpen, setImportOpen] = useState(false);
  const data = periodQuery.data && query.data ? { ...query.data, periods: periodQuery.data } : undefined;
  const period = data?.periods.find(item => item.id === selectedPeriod);
  const periodOverview = overviewQuery.data?.find(item => item.period_id === selectedPeriod);

  if (periodQuery.isLoading || (query.isLoading && section !== 'deputies')) return <LoadingState title="Zentrale Wahldaten werden geladen" />;
  if (periodQuery.error || query.error || !data) return <ErrorState title="Wahldatenbank konnte nicht geladen werden" description={historyError(periodQuery.error || query.error)} onRetry={() => void Promise.all([periodQuery.refetch(), query.refetch()])} />;

  return <div className="space-y-5">
    <header className="space-y-1"><h2 className="text-h2">Wahldaten & Mandatshistorie</h2><p className="max-w-4xl text-body text-muted-foreground">Zentrale Pflege- und Importwerkbank für alle Tenants. Auswertungen und Visualisierungen bleiben unter „Daten“; hier werden Stammdaten, Mandate, Kandidaturen und Quellen vollständig gepflegt.</p></header>
    <Tabs value={section} onValueChange={value => { setSection(value as WorkspaceSection); setImportOpen(false); }}>
      <TabsList className="h-auto flex flex-wrap justify-start gap-1">
        <TabsTrigger value="periods">1 · Legislaturperioden</TabsTrigger>
        <TabsTrigger value="districts">2 · Wahlkreise</TabsTrigger>
        <TabsTrigger value="mandates">3 · Abgeordnete der Periode</TabsTrigger>
        <TabsTrigger value="candidacies">4 · Kandidaturen & Ergebnisse</TabsTrigger>
        <TabsTrigger value="deputies">5 · Gesamtregister</TabsTrigger>
      </TabsList>
    </Tabs>

    {section !== 'periods' && section !== 'deputies' && <section className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3" aria-label="Legislaturauswahl">
      <div className="min-w-64 flex-1"><Label htmlFor="history-period-filter">Legislaturperiode</Label><select id="history-period-filter" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedPeriod} onChange={event => { setPeriodFilter(event.target.value); setImportOpen(false); }}>{data.periods.map(item => <option key={item.id} value={item.id}>{item.is_published ? '✓' : '✎'} {item.name}</option>)}</select></div>
      {periodOverview && <p className="pb-2 text-body tabular-nums text-muted-foreground">{periodOverview.district_count} Wahlkreise · {periodOverview.mandate_count} Mandate · {periodOverview.candidacy_count} Kandidaturen</p>}
      {section === 'candidacies' && <Button onClick={() => setImportOpen(true)}><FileUp className="mr-2 h-4 w-4" aria-hidden="true" />Excel / CSV importieren</Button>}
    </section>}

    {section === 'periods' && <>
      {overviewQuery.error && <p role="alert" className="text-sm text-destructive">Die Datenzähler konnten nicht geladen werden. <Button variant="link" className="h-auto p-0" onClick={() => void overviewQuery.refetch()}>Erneut laden</Button></p>}
      <HistoryDataGrid key="periods" entity="periods" data={data} selectedPeriodId={selectedPeriod} overview={overviewQuery.data || []} onOpenPeriod={periodId => { setPeriodFilter(periodId); setSection('districts'); }} />
    </>}
    {section === 'districts' && period && <div className="space-y-3">
      <HistoryLinkReview key={selectedPeriod} period={period} districts={data.districts} />
      <HistoryDataGrid key={`districts-${selectedPeriod}`} entity="districts" data={data} selectedPeriodId={selectedPeriod} overview={overviewQuery.data || []} />
    </div>}
    {section === 'mandates' && <HistoryDataGrid key={`mandates-${selectedPeriod}`} entity="mandates" data={data} selectedPeriodId={selectedPeriod} overview={overviewQuery.data || []} />}
    {section === 'candidacies' && period && <div className="space-y-3">
      <HistoryDataGrid key={`candidacies-${selectedPeriod}`} entity="candidacies" data={data} selectedPeriodId={selectedPeriod} overview={overviewQuery.data || []} />
      <div className="grid items-start gap-3 xl:grid-cols-2"><CandidateIdentityReview key={`identity-${selectedPeriod}`} data={{ ...data, periods: [period] }} disabled={false} /><CandidateCoverageReview key={selectedPeriod} periodId={selectedPeriod} disabled={false} /></div>
      <CandidacyImportDialog open={importOpen} onOpenChange={setImportOpen} data={data} periodId={selectedPeriod} onImported={async () => { await Promise.all([query.refetch(), overviewQuery.refetch()]); }} />
    </div>}
    {section === 'deputies' && <ElectionDeputyDirectory />}
  </div>;
}
