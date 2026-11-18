import { DeputyStateListPlaces } from '@/features/election-history/DeputyStateListPlaces';
import { DeputySeatDistribution } from './DeputySeatDistribution';
import { deputyTenureCoverage } from './deputyTenure';
import { DeputyElectionResult } from './DeputyElectionResult';
import { Link } from "react-router-dom";
import { districtProfileUrl } from "./navigation";
import { formatMandateType } from '@/features/election-history/mandateLabel';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LayoutGrid, List, MapPin, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { getPartyColor } from '@/features/election-districts/partyColors';
import { historyError, useElectionPeriods } from '@/features/election-history/useElectionHistory';
import { formatMandateDateRange } from '@/features/election-history/model';
import type { DeputyMandate } from '@/features/election-history/ElectionDeputyDirectory';
import { useAdministrationAccess } from '@/components/administration/useAdministrationAccess';
import { DeputyPortrait, useDeputyPortrait } from '@/features/election-history/DeputyPortrait';
import { portraitDirectory } from '@/features/election-history/portrait';
import './deputyDirectory.css';

type Deputy = {
  name_key: string; name: string; parties: string[]; periods: number;
  latest: { party: string; district: string | null; mandate_type: string; period_number: number };
};
function initials(name: string) { return name.split(/\s+/).filter(Boolean).map(part => part[0]).filter(Boolean).slice(0, 2).join(''); }
function DeputyName({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  return <span className="deputy-card-name">
    {parts.length > 1 && <span className="deputy-given-name">{parts[0]}</span>}
    <span className="deputy-family-name">{parts.length > 1 ? parts.slice(1).join(' ') : name}</span>
  </span>;
}
function Tenure({ count }: { count: number }) {
  return <span className="deputy-tenure" role="img" aria-label={`${count} Legislaturperioden`} title={`${count} Legislaturperioden in der freigegebenen Mandatshistorie`}>
    {Array.from({ length: count }, (_, index) => <i key={index} aria-hidden="true" />)}
  </span>;
}
function Portrait({ person }: { person: Deputy }) {
  const portrait = useDeputyPortrait(person.name_key);
  const [failed, setFailed] = useState(false);
  return <span className="deputy-portrait" aria-hidden="true">{portrait.data && !failed
    ? <img src={`${portraitDirectory(person.name_key)}${portrait.data.image}`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    : initials(person.name)}</span>;
}
function DirectMandateIcon() {
  const maskId = useId();
  return <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <defs><mask id={maskId}><rect width="24" height="24" fill="white" /><circle cx="12" cy="10" r="3" fill="black" /></mask></defs>
    <MapPin width={24} height={24} fill="currentColor" mask={`url(#${maskId})`} />
  </svg>;
}
function MandateIcon({ type }: { type: string }) {
  return type === 'direct' ? <DirectMandateIcon /> : <List size={14} aria-hidden="true" />;
}

export default function DeputyDirectory() {
  const { user, loading } = useAuth();
  const access = useAdministrationAccess(user?.id, undefined, loading);
  const periods = useElectionPeriods();
  const published = (periods.data || []).filter(period => period.is_published);
  const [search, setSearch] = useState('');
  const [faction, setFaction] = useState('');
  const [term, setTerm] = useState('');
  const [showFactions, setShowFactions] = useState(false);
  const [period, setPeriod] = useState('');
  const [mandate, setMandate] = useState('');
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [profileOpen, setProfileOpen] = useState(false);
  const [person, setPerson] = useState<Deputy | null>(null);
  const [activePeriod, setActivePeriod] = useState<number | null>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => { setTerm(search.trim()); setOffset(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const factions = useQuery({
    queryKey: ['election-history', user?.id, 'analysis-deputy-factions', period], enabled: !!user && showFactions,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('list_analysis_deputy_factions', { selected_period: period || undefined }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data) || !data.every(value => typeof value === 'string')) throw new Error('Ungültige Fraktionsliste.');
      return data as string[];
    }, retry: false, staleTime: 60_000,
  });
  const directory = useQuery({
    queryKey: ['election-history', user?.id, 'analysis-deputy-cards', term, faction, period, mandate, offset], enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('list_analysis_deputies', {
        search_text: term, page_offset: offset, selected_period: period || undefined,
        faction_text: faction, selected_mandate: mandate,
      }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Ungültiges Abgeordnetenregister.');
      return data as unknown as Deputy[];
    }, retry: false, staleTime: 30_000,
  });
  const detail = useQuery({
    queryKey: ['election-history', user?.id, 'analysis-deputy-profile', person?.name_key], enabled: !!user && !!person && profileOpen,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('get_analysis_deputy', { name_key: person!.name_key }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data) || data.length > 200) throw new Error('Die Mandatshistorie konnte nicht vollständig geladen werden.');
      return data as unknown as DeputyMandate[];
    }, retry: false, staleTime: 30_000,
  });
  const rows = detail.data || [];
  const birth = rows.find(row => row.birthday || row.birth_year);
  const served = [...new Set(rows.map(row => row.period_number))].sort((a, b) => a - b);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const tenurePeriods = published.filter(item => item.number >= served[0] && item.number <= served[served.length-1])
    .sort((a,b) => a.number-b.number).map(item => {
      const mandates = rows.filter(row => row.period_number === item.number);
      const coverage = deputyTenureCoverage(item, mandates, today);
      const label = !mandates.length ? 'Keine Mitgliedschaft' : coverage.unknown ? 'Mandatszeit nicht vollständig dokumentiert'
        : `${Math.round(coverage.segments.reduce((sum,segment) => sum+segment.width,0))} % dokumentierte Mandatszeit`;
      return { period:item, member:mandates.length>0, ...coverage, label };
    });
  const selectedPeriod = activePeriod ?? served[served.length - 1];
  const selectedRows = rows.filter(row => row.period_number === selectedPeriod);
  const current = selectedRows[selectedRows.length - 1];
  const reset = () => { setSearch(''); setFaction(''); setTerm(''); setShowFactions(false); setPeriod(''); setMandate(''); setOffset(0); };
  return <section className="deputy-directory space-y-6">
    <header className="space-y-3">
      <p className="deputy-caption">Landtag Baden-Württemberg · Mandatshistorien</p>
      <h3 className="deputy-heading">Abgeordnete</h3>
      <p className="max-w-2xl text-sm text-muted-foreground">Personen, Wahlkreise und ihr Weg durch den Landtag. Entdecke die Mandatshistorien aller freigegebenen Legislaturperioden.</p>
    </header>
    <div className="flex flex-wrap items-end gap-4 border-b pb-5">
      <div className="min-w-48 flex-1"><Label htmlFor="analysis-deputy-search">Name</Label><Input id="analysis-deputy-search" type="search" placeholder="Abgeordnete suchen …" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div className="min-w-48"><Label htmlFor="analysis-deputy-period">Legislaturperiode</Label><select id="analysis-deputy-period" className="deputy-select" value={period} onChange={event => { setPeriod(event.target.value); setOffset(0); }}><option value="">Alle freigegebenen Perioden</option>{published.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="deputy-filter-group" role="group" aria-label="Fraktion">
        <span className="deputy-caption">Fraktion</span>
        <button type="button" className="deputy-filter-chip" aria-pressed={!faction} onClick={() => { setFaction(''); setOffset(0); }}>Alle</button>
        {faction && !showFactions && <button type="button" className="deputy-filter-chip" aria-pressed="true" onClick={() => setShowFactions(true)}>{faction}</button>}
        <button type="button" className="deputy-filter-chip deputy-factions-toggle" aria-expanded={showFactions} aria-controls="analysis-deputy-factions" onClick={() => setShowFactions(value => !value)}>Weitere <ChevronDown size={14} aria-hidden="true" /></button>
      </div>
      <div className="deputy-filter-group" role="group" aria-label="Mandat">
        <span className="deputy-caption">Mandat</span>
        {[['', 'Alle'], ['direct', 'Direkt'], ['list', 'Liste']].map(([value, label]) => <button key={value} type="button" className="deputy-filter-chip" aria-pressed={mandate === value} onClick={() => { setMandate(value); setOffset(0); }}>{label}</button>)}
      </div>
      <div className="flex gap-1" role="group" aria-label="Ansicht"><Button variant={view === 'cards' ? 'default' : 'outline'} size="icon" aria-label="Kacheln" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid size={17} /></Button><Button variant={view === 'list' ? 'default' : 'outline'} size="icon" aria-label="Liste" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} /></Button></div>
      {(search || faction || period || mandate) && <Button variant="ghost" onClick={reset}>Zurücksetzen</Button>}
    </div>
    <div id="analysis-deputy-factions" className="deputy-faction-expansion" data-expanded={showFactions} inert={!showFactions}>
      <div><div className="deputy-filter-group" role="group" aria-label="Weitere Fraktionen">
        {factions.isLoading && <p role="status" className="text-sm text-muted-foreground">Lade Fraktionen …</p>}
        {factions.error && <div role="alert" className="text-sm">{historyError(factions.error)} <Button variant="outline" onClick={() => void factions.refetch()}>Erneut laden</Button></div>}
        {factions.data?.map(label => <button key={label} type="button" className="deputy-filter-chip" aria-pressed={faction === label} onClick={() => { setFaction(label); setOffset(0); }}><i className="deputy-faction-dot" style={{ backgroundColor: getPartyColor(label) }} />{label}</button>)}
        {factions.data?.length === 0 && <p className="text-sm text-muted-foreground">Keine Fraktionen für diese Auswahl vorhanden.</p>}
      </div></div>
    </div>
    {periods.error && <p role="alert">Legislaturperioden: {historyError(periods.error)} <Button variant="outline" onClick={() => void periods.refetch()}>Erneut laden</Button></p>}
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Tenure count={1} /> Ein Strich = eine Legislaturperiode</span><span className="flex items-center gap-2"><DirectMandateIcon /> Direktmandat</span><span className="flex items-center gap-2"><List size={14} /> Listenmandat</span></div>
    {directory.isLoading && <p role="status">Lade Abgeordnete …</p>}
    {directory.error && <div role="alert">{historyError(directory.error)} <Button variant="outline" onClick={() => void directory.refetch()}>Erneut laden</Button></div>}
    {directory.data?.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center"><p>Keine passenden Abgeordneten gefunden.</p><Button className="mt-3" variant="outline" onClick={reset}>Filter zurücksetzen</Button></div>}
    <div className={view === 'cards' ? 'deputy-grid' : 'deputy-list'} aria-busy={directory.isFetching}>
      {directory.data?.slice(0, 25).map(entry => <button type="button" key={entry.name_key} className={view === 'cards' ? 'deputy-card' : 'deputy-row'} style={{ '--deputy-party': getPartyColor(entry.latest?.party || entry.parties[0]) } as CSSProperties} onPointerMove={event => {
        if (view !== 'cards' || event.pointerType === 'touch') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--deputy-mx', `${(event.clientX - bounds.left) / bounds.width * 100}%`);
        event.currentTarget.style.setProperty('--deputy-my', `${(event.clientY - bounds.top) / bounds.height * 100}%`);
      }} onClick={event => { lastTrigger.current = event.currentTarget; setPerson(entry); setProfileOpen(true); setActivePeriod(period ? published.find(item => item.id === period)?.number ?? null : null); }} aria-label={`${entry.name}, ${entry.parties.join(', ')}. Mandatshistorie öffnen`}>
        <Portrait person={entry} />
        <span className="deputy-party"><i />{entry.latest?.party || entry.parties.join(', ')}</span>
        <span className="deputy-card-tenure"><Tenure count={entry.periods} /></span>
        <span className="deputy-card-info">
          <DeputyName name={entry.name} />
          <span className="deputy-card-district"><MandateIcon type={entry.latest?.mandate_type} />{entry.latest?.district || 'Wahlkreis nicht erfasst'}</span>
        </span>
        <span className="deputy-sheen" aria-hidden="true" />
      </button>)}
    </div>
    <nav aria-label="Abgeordnetenseiten" className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted-foreground">Seite {offset / 25 + 1} · alphabetisch nach Namen</p><div className="flex gap-2"><Button variant="outline" disabled={directory.isFetching || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 25))}>Zurück</Button><Button variant="outline" disabled={directory.isFetching || !directory.data || directory.data.length <= 25} onClick={() => setOffset(value => value + 25)}>Weitere 25</Button></div></nav>
    <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
      <SheetContent side="right" aria-describedby={undefined} className="deputy-drawer w-full p-0 sm:max-w-5xl" style={{ '--deputy-party': getPartyColor(current?.party || person?.latest?.party || person?.parties[0]) } as CSSProperties} overlayClassName="deputy-drawer-overlay" onCloseAutoFocus={event => { event.preventDefault(); lastTrigger.current?.focus(); }}>
        <SheetClose className="deputy-drawer-close" aria-label="Abgeordnetenprofil schließen"><X size={20} aria-hidden="true" /></SheetClose>
        <div className="deputy-profile">
        <div className="deputy-profile-side" style={{ '--deputy-party': getPartyColor(current?.party || person?.parties[0]) } as CSSProperties}>{person && <DeputyPortrait key={person.name_key} connectionId={person.name_key} name={person.name} editable={access.isSuperAdmin} variant="editorial" />}</div>
        <div className="deputy-profile-content" tabIndex={0} role="region" aria-label="Mandatshistorie und Profildetails">
          <div className="deputy-profile-faction-heading"><strong>{current?.party_label || current?.party || person?.latest?.party || person?.parties.join(' · ')}</strong><span aria-hidden="true" /></div>

          <SheetTitle className="deputy-heading deputy-profile-name mt-3"><DeputyName name={person?.name || ''} /></SheetTitle>
          {detail.isLoading && <p role="status" className="mt-6">Lade Mandatshistorie …</p>}
          {detail.error && <div role="alert" className="mt-6">{historyError(detail.error)} <Button variant="outline" onClick={() => void detail.refetch()}>Erneut laden</Button></div>}
          {!detail.isLoading && !detail.error && rows.length === 0 && <p className="mt-6">Keine freigegebenen Mandate vorhanden.</p>}
          {rows.length > 0 && <>
            <dl className="deputy-facts"><div><dt>{birth?.birthday ? 'Geburtstag' : 'Geburtsjahr'}</dt><dd>{birth?.birthday ? birth.birthday.split('-').reverse().join('.') : birth?.birth_year || 'Nicht erfasst'}</dd></div><div><dt>Wahlkreis</dt><dd>{current?.district_name || 'Nicht erfasst'}</dd></div><div><dt>Mandat</dt><dd>{current ? formatMandateType(current.mandate_type) : '–'}</dd></div><div><dt>Legislaturperioden</dt><dd>{served.length}</dd></div></dl>
            <section className="mt-8"><h4 className="deputy-caption deputy-section-heading mb-4"><span aria-hidden="true">01</span> Mandatshistorie</h4><div className="deputy-periods">{tenurePeriods.map(({ period:item, member, segments, label }) => <button type="button" key={item.id} disabled={!member} aria-pressed={selectedPeriod === item.number} aria-label={`${item.number}. Legislaturperiode: ${label}`} title={label} className="deputy-period" onClick={() => setActivePeriod(item.number)}><span className="deputy-period-track" aria-hidden="true">{segments.map((segment,index) => <i key={index} style={{left:`${segment.start}%`,width:`${segment.width}%`}} />)}</span><b>{item.number}.</b><small>{item.starts_on?.slice(0, 4) || '–'}</small></button>)}</div><p className="mt-3 text-xs text-muted-foreground">Gefüllt: dokumentierte Mandatszeit · schraffiert: übrige oder unbekannte Zeit.</p></section>
            {selectedRows.length>0 && <div className="deputy-tenure-dates" aria-live="polite">{selectedRows.map(row => {
              const profileUrl = districtProfileUrl(published.find(item => item.number === row.period_number)?.election_year ?? null, row.district_label);
              return <div key={row.id}><p>{formatMandateDateRange(row)}{row.end_is_expected ? ' (voraussichtliches Ende)' : ''}</p>{row.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{row.notes}</p>}{profileUrl && <Button variant="link" className="h-auto p-0 text-xs" asChild><Link to={profileUrl}>Wahlkreis-Steckbrief öffnen</Link></Button>}</div>;
            })}</div>}
            {person && profileOpen && <DeputyStateListPlaces key={person.name_key} connectionId={person.name_key} />}
            {current && profileOpen && <DeputyElectionResult key={current.id} mandateId={current.id}
              secondaryPanel={<DeputySeatDistribution period={published.find(item => item.number === current.period_number)} party={current.party} />}
            />}
          </>}
        </div>
      </div>
      </SheetContent>
    </Sheet>
  </section>;
}
