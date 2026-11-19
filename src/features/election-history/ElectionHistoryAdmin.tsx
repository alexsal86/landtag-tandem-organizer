import { BwPollsAdmin } from './admin/BwPollsAdmin';
import { ElectionDataChecks } from './admin/ElectionDataChecks';
import { FactionsAdmin } from './admin/FactionsAdmin';
import { PersonCareerDirectory } from './PersonCareer';
import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState, LoadingState } from '@/components/ui-patterns';
import { useAuth } from '@/hooks/useAuth';
import { useAdministrationAccess } from '@/components/administration/useAdministrationAccess';
import { CandidacyAssemblyStatus } from './CandidacyAssemblyStatus';
import { CandidateCoverageReview } from '@/features/election-analysis/research/CandidateCoverageReview';
import { HistoryLinkReview } from '@/features/election-analysis/research/HistoryLinkReview';
import { ElectionDeputyDirectory } from './ElectionDeputyDirectory';
import { historyError, useElectionHistory, useElectionPeriodOverview, useElectionPeriods } from './useElectionHistory';
import { HistoryDataGrid } from './admin/HistoryDataGrid';
import { CandidacyImportDialog } from './admin/CandidacyImportDialog';
import { HistoryIssueOverview, type HistoryIssue } from './admin/HistoryIssueOverview';
import { StateLists } from './admin/StateLists';
import { historyWorkspaceTab, historyWorkspaceTabs, isHistoryWorkspaceSection, type HistoryWorkspaceSection } from './admin/workspaceNavigation';

export default function ElectionHistoryAdmin() {
  const { user, loading } = useAuth();
  const access = useAdministrationAccess(user?.id, undefined, loading);
  if (access.checkingAdmin) return <LoadingState label="Berechtigung wird geprüft" />;
  if (!access.isSuperAdmin) return <p>Nur Super-Admins können zentrale Wahldaten verwalten.</p>;
  return <ElectionHistoryWorkspace key={user?.id} />;
}

function ElectionHistoryWorkspace() {
  const periodQuery = useElectionPeriods();
  const overviewQuery = useElectionPeriodOverview();
  const [section, setSection] = useState<HistoryWorkspaceSection>('periods');
  const [periodFilter, setPeriodFilter] = useState('');
  const [targetDistrictId, setTargetDistrictId] = useState('');
  const [registerView, setRegisterView] = useState<'mandates' | 'people'>('mandates');
  const availablePeriods = periodQuery.data;
  const selectedPeriod = availablePeriods?.find(period => period.id === periodFilter)?.id || availablePeriods?.find(period => period.is_current)?.id || availablePeriods?.[0]?.id || '';
  const needsHistory = ['districts', 'mandates', 'candidacies'].includes(section);
  const query = useElectionHistory(needsHistory ? selectedPeriod : undefined);
  const [targetRecordId, setTargetRecordId] = useState('');
  const [targetListId, setTargetListId] = useState('');
  const [deputyTarget, setDeputyTarget] = useState<{ id: string; name: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const data = periodQuery.data ? { ...(query.data || { periods: [], districts: [], people: [], mandates: [], candidacies: [] }), periods: periodQuery.data } : undefined;
  const period = data?.periods.find(item => item.id === selectedPeriod);
  const periodOverview = overviewQuery.data?.find(item => item.period_id === selectedPeriod);

  if (periodQuery.isLoading) return <LoadingState label="Zentrale Wahldaten werden geladen" />;
  if (periodQuery.error || !data) return <ErrorState title="Wahldatenbank konnte nicht geladen werden" description={historyError(periodQuery.error)} onRetry={() => void Promise.all([periodQuery.refetch(), query.refetch()])} />;

  const openIssue = (issue: HistoryIssue) => {
    setPeriodFilter(issue.period_id); setTargetRecordId(issue.record_id || ''); setTargetListId(issue.list_id || ''); setTargetDistrictId(''); setSection(issue.entity); setImportOpen(false);
  };
  return <div className="min-w-0 w-full max-w-full space-y-5">
    <header className="space-y-1"><h2 className="text-h2">Wahldaten & Mandatshistorie</h2><p className="max-w-4xl text-body text-muted-foreground">Zentrale Pflege- und Importwerkbank für alle Tenants. Auswertungen und Visualisierungen bleiben unter „Daten“; hier werden Stammdaten, Mandate, Kandidaturen und Quellen vollständig gepflegt.</p></header>
    <Tabs value={historyWorkspaceTab(section)} onValueChange={value => { if (!isHistoryWorkspaceSection(value)) return; setSection(value); setImportOpen(false); setTargetRecordId(''); setTargetListId(''); setTargetDistrictId(''); setDeputyTarget(null); }}>
      <TabsList className="h-auto flex flex-wrap justify-start gap-1">
        {historyWorkspaceTabs.map(tab => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}
      </TabsList>
    </Tabs>

    {(section === 'candidacies' || section === 'state_lists') && <nav aria-label="Kandidaturen und Landeslisten auswählen" className="flex flex-wrap gap-2">
      <Button variant={section === 'candidacies' ? 'default' : 'outline'} aria-pressed={section === 'candidacies'} onClick={() => { setSection('candidacies'); setImportOpen(false); setTargetRecordId(''); setTargetListId(''); setTargetDistrictId(''); }}>Kandidaturen & Ergebnisse</Button>
      <Button variant={section === 'state_lists' ? 'default' : 'outline'} aria-pressed={section === 'state_lists'} onClick={() => { setSection('state_lists'); setImportOpen(false); setTargetRecordId(''); setTargetListId(''); setTargetDistrictId(''); }}>Landeslisten</Button>
    </nav>}

    {section !== 'periods' && section !== 'deputies' && section !== 'issues' && section !== 'factions' && section !== 'quality' && section !== 'sources' && section !== 'polls' && <section className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3" aria-label="Legislaturauswahl">
      <div className="min-w-0 w-full flex-1"><Label htmlFor="history-period-filter">Legislaturperiode</Label><select id="history-period-filter" className="flex h-10 min-w-0 w-full max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedPeriod} onChange={event => { setPeriodFilter(event.target.value); setImportOpen(false); setTargetRecordId(''); setTargetListId(''); setTargetDistrictId(''); }}>{availablePeriods?.map(item => <option key={item.id} value={item.id}>{item.is_published ? '✓' : '✎'} {item.name}</option>)}</select></div>
      {periodOverview && <p className="pb-2 text-body tabular-nums text-muted-foreground [overflow-wrap:anywhere]">{periodOverview.district_count} Wahlkreise · {periodOverview.mandate_count} Mandate · {periodOverview.candidacy_count} Kandidaturen</p>}
      {section === 'candidacies' && <Button onClick={() => setImportOpen(true)}><FileUp className="mr-2 h-4 w-4" aria-hidden="true" />Excel / CSV importieren</Button>}
    </section>}

    {needsHistory && query.isLoading && <LoadingState label="Daten der Legislaturperiode werden geladen" />}
    {needsHistory && query.error && <ErrorState title="Periodendaten konnten nicht geladen werden" description={historyError(query.error)} onRetry={() => void query.refetch()} />}
    {section === 'periods' && <>
      {overviewQuery.error && <p role="alert" className="text-sm text-destructive">Die Datenzähler konnten nicht geladen werden. <Button variant="link" className="h-auto p-0" onClick={() => void overviewQuery.refetch()}>Erneut laden</Button></p>}
      <HistoryDataGrid key={`periods-${targetRecordId}`} initialEditId={targetRecordId} entity="periods" data={data} selectedPeriodId={selectedPeriod} overview={overviewQuery.data || []} onOpenPeriod={periodId => { setPeriodFilter(periodId); setTargetRecordId(''); setSection('districts'); }} />
    </>}
    {section === 'districts' && !query.isLoading && !query.error && period && <div className="space-y-3">
      <HistoryLinkReview key={selectedPeriod} period={period} districts={data.districts} />
      <HistoryDataGrid key={`districts-${selectedPeriod}-${targetRecordId}`} initialEditId={targetRecordId} entity="districts" onOpenCandidacies={districtId => { setTargetDistrictId(districtId); setTargetRecordId(''); setSection('candidacies'); }} data={data} selectedPeriodId={selectedPeriod} overview={overviewQuery.data || []} />
    </div>}
    {section === 'mandates' && !query.isLoading && !query.error && <HistoryDataGrid key={`mandates-${selectedPeriod}-${targetRecordId}`} initialEditId={targetRecordId} entity="mandates" data={data} selectedPeriodId={selectedPeriod} overview={overviewQuery.data || []} />}
    {section === 'candidacies' && !query.isLoading && !query.error && period && <div className="space-y-3">
      <CandidacyAssemblyStatus key={`assembly-${selectedPeriod}`} periodId={selectedPeriod} />
      <HistoryDataGrid key={`candidacies-${selectedPeriod}-${targetRecordId}-${targetDistrictId}`} initialEditId={targetRecordId} initialDistrictId={targetDistrictId} onOpenStateList={(listId, entryId) => { setTargetListId(listId); setTargetRecordId(entryId); setTargetDistrictId(''); setImportOpen(false); setSection('state_lists'); }} entity="candidacies" data={data} selectedPeriodId={selectedPeriod} overview={overviewQuery.data || []} />
      <CandidateCoverageReview key={selectedPeriod} periodId={selectedPeriod} disabled={false} />
      <CandidacyImportDialog open={importOpen} onOpenChange={setImportOpen} data={data} periodId={selectedPeriod} onImported={async () => { await Promise.all([query.refetch(), overviewQuery.refetch()]); }} />
    </div>}
    {(section === 'quality' || section === 'sources') && <ElectionDataChecks section={section} />}
    {section === 'polls' && <BwPollsAdmin />}
    {section === 'factions' && <FactionsAdmin />}
    {section === 'deputies' && <div className="min-w-0 space-y-4"><div className="flex flex-wrap gap-2" role="group" aria-label="Personenregister auswählen"><Button variant={registerView === 'mandates' ? 'default' : 'outline'} aria-pressed={registerView === 'mandates'} onClick={() => setRegisterView('mandates')}>Abgeordnetenregister</Button><Button variant={registerView === 'people' ? 'default' : 'outline'} aria-pressed={registerView === 'people'} onClick={() => setRegisterView('people')}>Alle Personen & Kandidaturen</Button></div>{registerView === 'mandates' ? <ElectionDeputyDirectory key={deputyTarget?.id || 'directory'} initialConnection={deputyTarget || undefined} /> : <PersonCareerDirectory />}</div>}
    {section === 'state_lists' && (period ? <StateLists key={`${period.id}-${targetListId}-${targetRecordId}`} periodId={period.id} periodNumber={period.number} initialListId={targetListId} initialEntryId={targetRecordId} onOpenDeputy={(id, name) => { setDeputyTarget({ id, name }); setRegisterView('mandates'); setSection('deputies'); }} /> : <p>Landeslisten können ab der 18. Legislaturperiode erfasst werden. Bitte zunächst die entsprechende Legislaturperiode anlegen.</p>)}
    <div hidden={section !== 'issues'}><HistoryIssueOverview active={section === 'issues'} periods={data.periods} onOpen={openIssue} /></div>
  </div>;
}
