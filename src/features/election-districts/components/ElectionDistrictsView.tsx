import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { reconstructedGeometryAttribution } from '@/utils/electoralGeometryCatalog';
import { HistoricalGeometryNotice } from '@/features/election-history/HistoricalGeometryNotice';
import { usePeriodGeometry } from '@/features/election-history/usePeriodGeometry';
import { PeriodMembersOverview } from '@/features/election-history/PeriodMembersOverview';
import { useElectionHistory, useElectionPeriods, historyError } from '@/features/election-history/useElectionHistory';
import { confirmedPeriodGeometryYear } from '@/features/election-history/periodGeometry';
import { projectHistoricalDistricts } from '@/features/election-history/mapProjection';
import { DistrictElectionHistory } from '@/features/election-history/DistrictElectionHistory';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { boundaryAreaKm2, directMandateParty, partyColors, hasRenderableBoundary, searchElectionDistricts, electionDistrictNumberLabel } from "../mapModel";
import { Button } from "@/components/ui/button";
import { Users, BarChart3, ChevronDown, Download, Play, Printer, Share2, Square } from "lucide-react";
import { useElectionDistricts } from "@/hooks/useElectionDistricts";
import { DistrictNotes } from "./DistrictNotes";
import { LocalElectionResults, useLocalElectionResults, type LocalBallot } from "./LocalElectionResults";
import { getPartyColor, getPartyTextColor } from "../partyColors";
import SimpleLeafletMap from "@/features/election-districts/components/SimpleLeafletMap";
import LeafletMapFallback from "@/features/election-districts/components/LeafletMapFallback";
import { debugConsole } from '@/utils/debugConsole';
import { ElectionDistrict } from "@/hooks/useElectionDistricts";
import { useSearchParams } from 'react-router-dom';
import { decodeMapViewState, encodeMapViewState, type MapViewState, type MapViewport } from '../mapViewState';
import { DistrictDataTable } from './DistrictDataTable';
import { DistrictCartogram } from './DistrictCartogram';
import { exportDistrictMapPng } from '../mapExportPng';
import { csvCell } from '@/lib/csvSafe';
import { notify } from '@/lib/notify';
import '@/styles/map-print.css';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    debugConsole.error('Leaflet map error:', error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Karte konnte nicht geladen werden</p>
            <p className="text-sm text-muted-foreground">Verwende Listenansicht...</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ElectionDistrictsView = ({ sidebarHeader }: { sidebarHeader?: React.ReactNode }) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // The first render takes the whole map view from the URL; later edits write back.
  const [initialUrlState] = useState(() => decodeMapViewState(searchParams));
  const urlParties = useRef(initialUrlState.parties);
  const previousDistrictParam = useRef<string | null>(searchParams.get('wk'));
  const embed = searchParams.get('embed') === '1' || searchParams.get('embed') === 'true';
  const updateUrl = useCallback((mutate: (state: MapViewState) => MapViewState, replace = true) => {
    setSearchParams(previous => {
      const next = encodeMapViewState(previous, mutate(decodeMapViewState(previous)));
      return next.toString() === previous.toString() ? previous : next;
    }, { replace });
  }, [setSearchParams]);
  const [viewMode, setViewMode] = useState<'karte' | 'kartogramm'>(initialUrlState.mode);
  const periodIndex = useElectionPeriods();
  const [historyPeriodId, setHistoryPeriodId] = useState(initialUrlState.periodId ?? '');
  const [selectedHistoricalDistrict, setSelectedHistoricalDistrict] = useState('');
  const publishedPeriods = periodIndex.data?.filter(p => p.is_published) || [];
  const historyPeriod = publishedPeriods.find(p => p.id === historyPeriodId) || publishedPeriods.find(p => p.is_current) || publishedPeriods[0];
  const [showAdministrativeBoundaries, setShowAdministrativeBoundaries] = useState(initialUrlState.layers.administrative);
  const { districts: baseDistricts, loading } = useElectionDistricts({ enabled: !periodIndex.isLoading && (!historyPeriod || showAdministrativeBoundaries) });
  const history = useElectionHistory(historyPeriod?.id);
  const periodGeometry = usePeriodGeometry(history.data, historyPeriod?.id);
  const mapHistory = periodGeometry.data;
  const districts = useMemo(() => historyPeriod ? (mapHistory ? projectHistoricalDistricts(baseDistricts, mapHistory, historyPeriod.id) : baseDistricts.filter(d => d.district_type === 'verwaltungsgrenze')) : baseDistricts, [baseDistricts, mapHistory, historyPeriod?.id]);
  const [selectedDistrictRecord, setSelectedDistrict] = useState<ElectionDistrict | null>(null);
  const selectedDistrict = districts.find(d => d.id === selectedDistrictRecord?.id) || null;
  const localDistrict = historyPeriod?.election_year === 2026 && selectedDistrict?.district_type === 'wahlkreis' &&
    selectedDistrict.district_number >= 1 && selectedDistrict.district_number <= 70 ? selectedDistrict : undefined;
  const localResults = useLocalElectionResults(localDistrict?.district_number);
  const [localBallot, setLocalBallot] = useState<LocalBallot>('second');
  const [localSelection, setLocalSelection] = useState<{ districtId: string; key: string }>();
  const localArea = (localSelection?.districtId === localDistrict?.id
    ? localResults.data?.find(area => area.key === localSelection?.key) : undefined) ?? localResults.data?.[0];
  const selectLocalArea = React.useCallback((key: string) => {
    if (localDistrict) setLocalSelection({ districtId: localDistrict.id, key });
  }, [localDistrict]);
  const [useMapFallback, setUseMapFallback] = useState(false);
  const [showElectionDistricts, setShowElectionDistricts] = useState(initialUrlState.layers.districts);
  const [showDistrictPolygons, setShowDistrictPolygons] = useState(initialUrlState.layers.polygons);
  const [showDistrictMarkers, setShowDistrictMarkers] = useState(initialUrlState.layers.markers);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const [selectedParties, setSelectedParties] = useState<Set<string>>(() => new Set(initialUrlState.parties ?? ['CDU', 'GRÜNE', 'SPD', 'FDP', 'AFD']));
  useEffect(() => {
    if (history.data) {
      const parties = new Set(history.data.mandates.map(m => directMandateParty({ representatives: [{ mandate_type: 'direct', party: m.party }] })));
      if (historyPeriod?.election_year === 1952) parties.add('Ohne Direktmandat');
      setSelectedParties(urlParties.current ? new Set(urlParties.current) : parties);
      urlParties.current = null;
    }
  }, [history.data, historyPeriod?.election_year]);
  const [showBaseMap, setShowBaseMap] = useState(initialUrlState.layers.baseMap);
  const [focusedDistrict, setFocusedDistrict] = useState<ElectionDistrict>();
  const [showPartyAssociations, setShowPartyAssociations] = useState(initialUrlState.layers.partyAssociations);

  // Every toggle is part of the shareable view.
  useEffect(() => {
    updateUrl(state => ({
      ...state,
      layers: {
        districts: showElectionDistricts,
        polygons: showDistrictPolygons,
        markers: showDistrictMarkers,
        administrative: showAdministrativeBoundaries,
        partyAssociations: showPartyAssociations,
        baseMap: showBaseMap,
      },
    }));
  }, [showElectionDistricts, showDistrictPolygons, showDistrictMarkers, showAdministrativeBoundaries, showPartyAssociations, showBaseMap, updateUrl]);

  const handleDistrictClick = (district: ElectionDistrict) => {
    setSelectedDistrict(district);
    if (historyPeriod) setSelectedHistoricalDistrict(district.id);
    setFocusedDistrict({ ...district });
    sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    updateUrl(state => ({ ...state, districtId: district.id, periodId: historyPeriod?.id ?? state.periodId }), false);
  };

  const handleMapError = () => {
    debugConsole.error('Leaflet map failed to load, switching to fallback');
    setUseMapFallback(true);
  };

  // Separate district types
  const electionDistricts = districts.filter(d => d.district_type !== 'verwaltungsgrenze');
  const administrativeBoundaries = districts.filter(d => d.district_type === 'verwaltungsgrenze');
  const unresolved1952 = historyPeriod?.election_year === 1952
    ? history.data?.districts.filter(d => !d.geometry_source_key).length ?? 0 : 0;
  const electionDistrictCount = historyPeriod?.election_year === 1952
    ? history.data?.districts.filter(d => d.geometry_source_key?.startsWith('1952:')).length ?? 0
    : history.data?.districts.length ?? electionDistricts.length;
  const hasElectionData = electionDistrictCount > 0;
  const partyChoices = Array.from(new Set(['CDU', 'GRÜNE', 'SPD', 'FDP', 'AFD', ...(historyPeriod?.election_year === 1952 ? ['Ohne Direktmandat'] : []), ...(history.data?.mandates.map(m => directMandateParty({ representatives: [{ mandate_type: 'direct', party: m.party }] })) || [])]));
  const partyCount = (party: string) => historyPeriod?.election_year === 1952 && party === 'Ohne Direktmandat'
    ? electionDistricts.filter(d => directMandateParty(d) === party).length
    : history.data ? history.data.mandates.filter(m => m.entry_type === 'election' && m.mandate_type === 'direct' && directMandateParty({ representatives: [{ mandate_type: 'direct', party: m.party }] }) === party).length : electionDistricts.filter(d => directMandateParty(d) === party).length;
  const hasAdministrativeData = administrativeBoundaries.length > 0;
  const partyLabel = (party: string) => party === 'Ohne Direktmandat' && historyPeriod?.election_year === 1952
    ? 'Zuordnung offen' : party === 'AFD' ? 'AfD' : party;

  // Filter displayed districts based on toggles
  const displayedDistricts = useMemo(() => districts.filter(d => {
    if (d.district_type === 'verwaltungsgrenze') return showAdministrativeBoundaries;
    return showElectionDistricts;
  }), [districts, showAdministrativeBoundaries, showElectionDistricts]);
  const tableDistricts = useMemo(
    () => displayedDistricts
      .filter(district => district.district_type !== 'verwaltungsgrenze')
      .sort((a, b) => a.district_number - b.district_number),
    [displayedDistricts],
  );

  const searchResults = searchQuery.trim() ? searchElectionDistricts(electionDistricts, searchQuery) : electionDistricts;
  const activeResultIndex = activeResult < searchResults.length ? activeResult : 0;
  const openSearch = () => {
    setSearchOpen(true);
    setActiveResult(0);
  };
  const missingBoundaries = displayedDistricts.filter(d => !hasRenderableBoundary(d.boundaries));
  const focusDistrict = (district: ElectionDistrict) => {
    setSelectedDistrict(district);
    if (historyPeriod) setSelectedHistoricalDistrict(district.id);
    setFocusedDistrict({ ...district });
    if (district.district_type === 'verwaltungsgrenze') setShowAdministrativeBoundaries(true);
    else setShowElectionDistricts(true);
    setSearchQuery('');
    setSearchOpen(false);
    sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedParties(previous => new Set([...previous, directMandateParty(district)]));
    updateUrl(state => ({ ...state, districtId: district.id, periodId: historyPeriod?.id ?? state.periodId }), false);
  };

  const selectHistoricalDistrict = (id: string) => {
    setSelectedHistoricalDistrict(id);
    const district = districts.find(d => d.id === id);
    if (district) focusDistrict(district);
    else {
      setSelectedDistrict(null);
      setFocusedDistrict(undefined);
      sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      updateUrl(state => ({ ...state, districtId: null }), false);
    }
  };

  const selectPeriod = useCallback((periodId: string, replace = false) => {
    setHistoryPeriodId(periodId);
    setFocusedDistrict(undefined);
    setSelectedHistoricalDistrict('');
    setSelectedDistrict(null);
    updateUrl(state => ({ ...state, periodId, districtId: null }), replace);
  }, [updateUrl]);

  // Links, reloads and browser back/forward drive the legislature and selection.
  const periodParam = searchParams.get('periode');
  const districtParam = searchParams.get('wk');
  useEffect(() => {
    if (periodParam && periodParam !== historyPeriodId) setHistoryPeriodId(periodParam);
  }, [periodParam, historyPeriodId]);

  useEffect(() => {
    const changed = previousDistrictParam.current !== districtParam;
    previousDistrictParam.current = districtParam;
    if (!districtParam) {
      if (changed && selectedDistrictRecord) {
        setSelectedDistrict(null);
        setFocusedDistrict(undefined);
      }
      return;
    }
    if (selectedDistrictRecord?.id === districtParam || districts.length === 0) return;
    const district = districts.find(d => d.id === districtParam || String(d.district_number) === districtParam);
    if (!district) return;
    setSelectedDistrict(district);
    setSelectedHistoricalDistrict(district.id);
    setFocusedDistrict({ ...district });
  }, [districtParam, districts, selectedDistrictRecord]);

  const handleViewportChange = useCallback((viewport: MapViewport) => {
    updateUrl(state => ({ ...state, viewport }));
  }, [updateUrl]);

  const selectViewMode = (mode: 'karte' | 'kartogramm') => {
    setViewMode(mode);
    updateUrl(state => ({ ...state, mode }));
  };

  const toggleParty = (party: string) => {
    const next = new Set(selectedParties);
    if (next.has(party)) next.delete(party);
    else next.add(party);
    setSelectedParties(next);
    updateUrl(state => ({ ...state, parties: [...next] }));
  };

  const shareView = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify.success('Link zur Kartenansicht kopiert');
    } catch {
      notify.error('Link konnte nicht kopiert werden');
    }
  };

  const shareEmbed = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'wahlkreise');
    url.searchParams.set('embed', '1');
    const snippet = `<iframe src="${url.toString()}" title="Karte der Wahlkreise Baden-Württemberg" width="100%" height="640" loading="lazy" style="border:0"></iframe>`;
    try {
      await navigator.clipboard.writeText(snippet);
      notify.success('Einbettungscode kopiert');
    } catch {
      notify.error('Einbettungscode konnte nicht kopiert werden');
    }
  };

  const downloadCsv = () => {
    const rows = [
      ['Wahlkreis', 'Name', 'Direktmandat', 'Partei', 'Fläche (km²)', 'Einwohner'],
      ...tableDistricts.map(district => {
        const direct = district.representatives?.find(rep => rep.mandate_type === 'direct');
        return [
          electionDistrictNumberLabel(district),
          district.district_name,
          direct?.name ?? '',
          directMandateParty(district),
          boundaryAreaKm2(district.boundaries)?.toFixed(1) ?? '',
          district.population ?? '',
        ];
      }),
    ];
    const csv = rows.map(row => row.map(csvCell).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `wahlkreise-${historyPeriod?.election_year ?? 'aktuell'}.csv`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  // PNG export re-draws the geometry as SVG because the number markers are divIcons.
  const [exportingPng, setExportingPng] = useState(false);
  const exportPng = async () => {
    if (exportingPng) return;
    setExportingPng(true);
    try {
      await exportDistrictMapPng({
        districts: displayedDistricts,
        parties: selectedParties,
        legend: partyChoices.map(party => ({ party, label: partyLabel(party), count: partyCount(party) })),
        title: `Wahlkreise Baden-Württemberg${historyPeriod ? ` · ${historyPeriod.name}` : ''}`,
        standLabel: `Grenzstand ${historyPeriod?.boundary_geometry_year ?? 2021}${historyPeriod ? ` · Wahl ${historyPeriod.election_year}` : ''}`,
        sourceLabel: 'Quelle: LGL Baden-Württemberg, Statistisches Landesamt, © OpenStreetMap-Mitwirkende',
        selectedDistrictId: selectedDistrict?.id,
        fileName: `wahlkreise-${historyPeriod?.election_year ?? 'aktuell'}.png`,
      });
      notify.success('Karte als PNG heruntergeladen');
    } catch (error) {
      debugConsole.error('PNG export failed', error);
      notify.error(error instanceof Error ? error.message : 'PNG-Export fehlgeschlagen');
    } finally {
      setExportingPng(false);
    }
  };

  const [replaying, setReplaying] = useState(false);
  const chronology = useMemo(
    () => [...publishedPeriods].sort((a, b) => (a.election_year ?? 0) - (b.election_year ?? 0)),
    [publishedPeriods],
  );

  // Time travel replays every published boundary state from oldest to newest.
  useEffect(() => {
    if (!replaying || chronology.length < 2) return;
    const index = chronology.findIndex(period => period.id === historyPeriod?.id);
    const next = chronology[(index + 1) % chronology.length];
    const timer = window.setTimeout(() => selectPeriod(next.id, true), 2400);
    return () => window.clearTimeout(timer);
  }, [replaying, chronology, historyPeriod?.id, selectPeriod]);

  if (loading || periodIndex.isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Lade Wahlkreise...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden print:h-auto print:overflow-visible">
      <div className="flex-1 flex flex-col md:flex-row min-h-0 print:block">
        {/* Map */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {!embed && (
          <nav aria-label="Kartennavigation" className="relative z-[1100] flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-b bg-background px-3 py-1 print:hidden">
          <div className="min-w-0">
            <form className="relative flex min-w-0 items-center gap-2" onSubmit={event => {
              event.preventDefault();
              if (searchOpen && searchResults[activeResultIndex]) focusDistrict(searchResults[activeResultIndex]);
            }} onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
            }} role="search" aria-label="Wahlkreissuche">
              <label htmlFor="district-search" className="shrink-0 cursor-text text-sm font-medium">Wahlkreis suchen</label>
              <div className="relative min-w-0">
                <Input id="district-search" type="search" placeholder="Name oder Nummer …"
                  className="h-8 w-40 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1" value={searchQuery}
                  onFocus={openSearch} onClick={() => { if (!searchOpen) openSearch(); }}
                  onChange={event => { setSearchQuery(event.target.value); openSearch(); }}
                  role="combobox" aria-autocomplete="list" aria-expanded={searchOpen}
                  aria-activedescendant={searchOpen && searchResults[activeResultIndex] ? `district-result-${searchResults[activeResultIndex].id}` : undefined}
                  aria-controls={searchOpen ? 'district-search-results' : undefined} onKeyDown={event => {
                    if (event.key === 'Escape' && searchOpen) {
                      event.preventDefault();
                      setSearchOpen(false);
                    }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      if (!searchOpen) {
                        openSearch();
                        return;
                      }
                      const next = (activeResultIndex + (event.key === 'ArrowDown' ? 1 : -1) + searchResults.length) % Math.max(1, searchResults.length);
                      setActiveResult(next);
                      document.getElementById(`district-result-${searchResults[next]?.id}`)?.scrollIntoView({ block: 'nearest' });
                    }
                  }} />
              </div>
              {searchOpen && (
                <div id="district-search-results" role="listbox" className="absolute top-full left-0 right-0 mt-1 z-[1100] rounded-md border bg-popover text-popover-foreground shadow-md max-h-64 overflow-y-auto">
                  <p className="p-2 text-xs text-muted-foreground" role="status">{searchResults.length} Treffer</p>
                  {searchResults.map((district, index) => (
                    <button id={`district-result-${district.id}`} role="option" aria-selected={index === activeResultIndex} style={index === activeResultIndex ? { background: 'hsl(var(--accent))' } : undefined} key={district.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => focusDistrict(district)}>
                      WK {electionDistrictNumberLabel(district)}: {district.district_name}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>
          {historyPeriod && (
            <div className="flex min-w-0 items-center gap-2">
              <label htmlFor="map-legislature" className="text-sm font-medium">Legislaturperiode</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button id="map-legislature" type="button" className="inline-flex items-center gap-1 py-1 text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {historyPeriod.name}{historyPeriod.is_current ? ' · aktuell' : ''}<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[1200] max-h-80 overflow-y-auto">
                  {publishedPeriods.map(p => <DropdownMenuItem key={p.id} onSelect={() => { setReplaying(false); selectPeriod(p.id); }}>{p.name}{p.is_current ? ' · aktuell' : ''}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <div role="group" aria-label="Darstellung" className="flex items-center rounded border border-border">
              <button type="button" aria-pressed={viewMode === 'karte'} onClick={() => selectViewMode('karte')}
                className={`px-2 py-1 text-xs hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring ${viewMode === 'karte' ? 'bg-accent font-medium' : ''}`}>Karte</button>
              <button type="button" aria-pressed={viewMode === 'kartogramm'} onClick={() => selectViewMode('kartogramm')}
                className={`border-l border-border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring ${viewMode === 'kartogramm' ? 'bg-accent font-medium' : ''}`}>Kartogramm</button>
            </div>
            {chronology.length > 1 && (
              <button type="button" aria-pressed={replaying} onClick={() => setReplaying(value => !value)}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring">
                {replaying ? <Square className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                Zeitreise
              </button>
            )}
            <button type="button" onClick={() => void shareView()}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring">
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" /> Link teilen
            </button>
            <button type="button" onClick={() => void shareEmbed()}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring">
              Einbetten
            </button>
            <button type="button" onClick={() => void exportPng()} disabled={exportingPng}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60">
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> {exportingPng ? 'PNG …' : 'PNG'}
            </button>
            <button type="button" onClick={() => window.print()}
              className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring">
              <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Drucken
            </button>
          </div>
          </nav>
          )}
          <div className="relative h-[55dvh] min-h-[320px] shrink-0 md:h-auto md:flex-1 md:min-h-0 print:h-auto print:min-h-0">
          {viewMode === 'kartogramm' ? (
            <div className="h-full overflow-auto bg-card p-3">
              <DistrictCartogram
                districts={displayedDistricts}
                selectedDistrictId={selectedDistrict?.id}
                onSelect={handleDistrictClick}
              />
            </div>
          ) : useMapFallback ? (
            <LeafletMapFallback
              districts={displayedDistricts}
              onDistrictClick={handleDistrictClick}
               selectedDistrict={selectedDistrict ?? undefined}
            />
          ) : (
            <ErrorBoundary onError={handleMapError}>
              <SimpleLeafletMap
                key={historyPeriod?.id || 'legacy'}
                districtCount={electionDistrictCount}
                geometryAttribution={reconstructedGeometryAttribution(historyPeriod?.boundary_geometry_year)}
                districts={displayedDistricts}
                onDistrictClick={handleDistrictClick}
                selectedDistrict={selectedDistrict ?? undefined}
                showMunicipalityBoundaries={historyPeriod?.election_year === 2026 && confirmedPeriodGeometryYear(historyPeriod) === 2021}
                showPartyAssociations={showPartyAssociations}
                showDistrictPolygons={showDistrictPolygons}
                localAreas={localResults.data}
                localResultsError={localResults.isError}
                localAreaKey={localArea?.key}
                localBallot={localBallot}
                onLocalAreaClick={selectLocalArea}
                showDistrictMarkers={showDistrictMarkers}
                focusedDistrict={focusedDistrict}
                selectedParties={selectedParties}
                showBaseMap={showBaseMap}
                initialViewport={initialUrlState.viewport}
                onViewportChange={handleViewportChange}
                standLabel={historyPeriod ? `Grenzstand ${historyPeriod.boundary_geometry_year ?? 2021} · Wahl ${historyPeriod.election_year}` : 'Wahlkreise Baden-Württemberg'}
                sourceLabel="Quelle: LGL Baden-Württemberg, Statistisches Landesamt, © OpenStreetMap-Mitwirkende"
              />
            </ErrorBoundary>
          )}
          </div>
        </div>

        {/* Sidebar */}
        {!embed && (
        <div ref={sidebarRef} id="district-sidebar" className="w-full md:w-96 md:shrink-0 min-h-0 border-t md:border-t-0 md:border-l bg-muted/30 overflow-y-auto overscroll-contain md:h-full p-4 space-y-4 print:hidden">
          {sidebarHeader}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Legende</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="space-y-1">
                {partyChoices.map(party => (
                  <li key={party} className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-black/20" style={{ backgroundColor: partyColors[party] || '#9ca3af' }} />
                    <span>{partyLabel(party)}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">{partyCount(party)}</span>
                  </li>
                ))}
              </ul>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
                <dt aria-hidden="true">◯</dt><dd>Nummernkreis mit Wahlkreisnummer</dd>
                <dt aria-hidden="true">▭</dt><dd>Farbfläche = Partei des Direktmandats</dd>
                <dt aria-hidden="true">▨</dt><dd>Verwaltungsgrenze (gestrichelt)</dd>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-lg">Daten als Tabelle</CardTitle>
              <Button variant="outline" size="sm" onClick={downloadCsv}><Download className="mr-1 h-4 w-4" />CSV</Button>
            </CardHeader>
            <CardContent>
              <DistrictDataTable
                districts={tableDistricts}
                caption="Wahlkreise als Tabelle – Textalternative zur Karte"
                onSelect={focusDistrict}
                className="max-h-80 overflow-auto"
              />
            </CardContent>
          </Card>
          {localDistrict && <LocalElectionResults query={localResults} area={localArea} ballot={localBallot}
            onAreaChange={selectLocalArea} onBallotChange={setLocalBallot} />}
          {/* District Information */}
          {(!historyPeriod || selectedDistrict?.district_type === 'verwaltungsgrenze') && <Card>
            <CardContent className="pt-5">
              {selectedDistrict ? (
                <div className="space-y-3">
                  {(() => {
                    const representatives = selectedDistrict.representatives || [];
                    const byLegislature = representatives.reduce<Record<string, typeof representatives>>((groups, rep) => {
                      const period = rep.legislature_period?.trim() || '18. Legislaturperiode';
                      (groups[period] ||= []).push(rep);
                      return groups;
                    }, {});
                    // Keep historical mandates under their own period, newest first.
                    const periods = Object.keys(byLegislature).sort((a, b) => b.localeCompare(a, 'de', { numeric: true }));
                    if (!periods.length) periods.push('');
                    return periods.map(period => {
                      const reps = [...(byLegislature[period] || [])].sort((a, b) =>
                        Number(b.mandate_type === 'direct') - Number(a.mandate_type === 'direct') || a.order_index - b.order_index
                      );
                      const winner = reps.find(rep => rep.mandate_type === 'direct');
                      return (
                        <section key={period} className="space-y-2">
                          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Badge variant="outline" className="border-0 text-xs" style={{ backgroundColor: getPartyColor(winner?.party), color: getPartyTextColor(winner?.party) }}>
                              {electionDistrictNumberLabel(selectedDistrict)}
                            </Badge>
                            <span className="font-semibold">{selectedDistrict.district_name}</span>
                            {period && <span className="ml-auto text-xs font-normal text-muted-foreground">{period}</span>}
                          </h3>
                          {reps.map(rep => (
                            <div key={rep.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 py-2 text-sm">
                              <span className="font-medium">{rep.name}</span>
                              <Badge variant="outline" className="border-0 px-2 py-0 text-xs" style={{ backgroundColor: getPartyColor(rep.party), color: getPartyTextColor(rep.party) }}>
                                {rep.party}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{rep.mandate_type === 'direct' ? '★ Direkt' : 'Liste'}</span>
                            </div>
                          ))}
                        </section>
                      );
                    });
                  })()}

                  {selectedDistrict.population && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedDistrict.population.toLocaleString()} Einwohner</span>
                    </div>
                  )}

                  {selectedDistrict.contact_info?.phone && (
                    <p className="text-sm break-words">Telefon: {selectedDistrict.contact_info.phone}</p>
                  )}
                  {selectedDistrict.contact_info?.email && (
                    <p className="text-sm break-words">E-Mail: {selectedDistrict.contact_info.email}</p>
                  )}
                  {selectedDistrict.website_url && (
                    <a href={selectedDistrict.website_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary underline">Website</a>
                  )}
                  {!hasRenderableBoundary(selectedDistrict.boundaries) && (
                    <p className="text-sm text-muted-foreground">Für dieses Gebiet fehlen nutzbare Grenzdaten.</p>
                  )}
                  <div className="border-t pt-4 mt-4">
                    <DistrictNotes key={selectedDistrict.id} district={selectedDistrict} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Wählen Sie einen Wahlkreis auf der Karte aus, um Informationen anzuzeigen.
                </p>
              )}
            </CardContent>
          </Card>}


          {history.data && historyPeriod && <>
            {selectedHistoricalDistrict && <Card><CardContent className="pt-5"><DistrictElectionHistory data={history.data} periodId={historyPeriod.id} districtId={selectedHistoricalDistrict} /></CardContent></Card>}
          </>}
      {missingBoundaries.length > 0 && (
        <details className="mx-3 my-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <summary className="cursor-pointer">Bei {missingBoundaries.length} angezeigten Gebieten fehlen nutzbare Grenzdaten.</summary>
          <p className="mt-2 text-muted-foreground">Diese Flächen können nicht gezeichnet werden. Vorhandene Nummernkreise bleiben über die Ebenenschalter verfügbar.</p>
          <ul className="mt-1 max-h-32 overflow-y-auto">
            {missingBoundaries.map(district => <li key={district.id}>
              <button type="button" className="text-left underline py-1" onClick={() => focusDistrict(district)}>
                {electionDistrictNumberLabel(district)}: {district.district_name}
              </button>
            </li>)}
          </ul>
        </details>
      )}
          <HistoricalGeometryNotice year={historyPeriod?.boundary_geometry_year} />
          {history.isLoading && <p role="status" className="text-sm text-muted-foreground">Lade ausgewählte Legislatur …</p>}
          {unresolved1952 > 0 && <p role="status" className="rounded-lg border border-amber-500/40 p-3 text-xs">{unresolved1952} bestehende Wahlkreiseinträge sind noch keiner regionalen 1952-Quelle zugeordnet. Ihre Mandate bleiben erhalten und werden nicht anhand technischer Nummern auf die 74 Kartenflächen übertragen. Die Zuordnung kann unter Administration → Wahldaten &amp; Mandatshistorie → Mandate geprüft werden.</p>}
          {periodGeometry.isLoading && <p role="status" className="text-sm text-muted-foreground">Lade bestätigten historischen Grenzstand …</p>}
          {periodGeometry.error && <p role="alert" className="text-sm">Der bestätigte Grenzstand konnte nicht geladen werden. <button className="underline" onClick={() => void periodGeometry.refetch()}>Erneut laden</button></p>}
          {history.error && <p role="alert" className="text-sm">{historyError(history.error)}</p>}
          {history.data && historyPeriod && <>
            {!periodGeometry.isLoading && !periodGeometry.error && !mapHistory?.districts.some(d => hasRenderableBoundary(d.boundaries)) && <p className="rounded-lg border p-3 text-xs text-muted-foreground">Für diese Legislatur sind noch keine historischen Grenzumrisse hinterlegt oder bestätigt. Die Abgeordneten und damaligen Wahlkreise stehen in der Übersicht.</p>}
            <PeriodMembersOverview key={historyPeriod.id} data={history.data} onSelectDistrict={selectHistoricalDistrict} />
            <details className="rounded-xl border bg-card p-3 shadow-sm">
              <summary className="cursor-pointer text-sm font-medium">Historischer Wahlkreis</summary>
              <div className="mt-2 space-y-1">
                {history.data.districts.map(d => <button key={d.id} type="button" aria-pressed={selectedHistoricalDistrict === d.id} className="block w-full border-t py-2 text-left text-sm hover:text-primary aria-pressed:font-semibold aria-pressed:text-primary" onClick={() => selectHistoricalDistrict(d.id)}>
                  {d.district_number ?? d.number_label ?? '–'}: {d.name}{historyPeriod.election_year === 1952 && !d.geometry_source_key ? ' · Zuordnung ungeprüft' : ''}
                </button>)}
              </div>
            </details>
          </>}
          {/* Layer toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ebenen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="election-districts"
                  checked={showElectionDistricts}
                  onChange={(e) => setShowElectionDistricts(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="election-districts" className="text-sm font-medium">
                  Wahlkreise ({electionDistrictCount})
                </label>
              </div>
              <fieldset className="ml-4 space-y-2" disabled={!showElectionDistricts}>
                <legend className="sr-only">Darstellung der Wahlkreise</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showDistrictPolygons} onChange={event => setShowDistrictPolygons(event.target.checked)} className="rounded" />
                  Farbige Flächen
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showDistrictMarkers} onChange={event => setShowDistrictMarkers(event.target.checked)} className="rounded" />
                  Nummernkreise
                </label>
              </fieldset>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="admin-boundaries"
                  checked={showAdministrativeBoundaries}
                  onChange={(e) => setShowAdministrativeBoundaries(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="admin-boundaries" className="text-sm font-medium">
                  Verwaltungsgrenzen ({administrativeBoundaries.length})
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="party-associations"
                  checked={showPartyAssociations}
                  onChange={(e) => setShowPartyAssociations(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="party-associations" className="text-sm font-medium">
                  Grüne Kreisverbände
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium pt-2">
                <input type="checkbox" checked={showBaseMap} onChange={event => setShowBaseMap(event.target.checked)} />
                OpenStreetMap
              </label>
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-xs text-muted-foreground">Nach Direktmandaten filtern</p>
                <div className="flex flex-wrap gap-1.5">
                  {partyChoices.map(party => (
                    <button key={party} type="button" aria-pressed={selectedParties.has(party)}
                      onClick={() => toggleParty(party)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all duration-200 motion-reduce:transition-none ${selectedParties.has(party) ? 'border-[#626a59] bg-[#f0f2ed] dark:border-[#929b86] dark:bg-[#292c26] shadow-sm' : 'border-[#858d7b] dark:border-[#767e6b] bg-transparent text-muted-foreground hover:border-[#626a59]'}`}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: partyColors[party] || '#9ca3af' }} />
                      {partyLabel(party)}
                      <span className="text-muted-foreground">{partyCount(party)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Statistiken
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDistrict ? (
                <>
                  <p className="text-sm font-medium">{selectedDistrict.district_name}</p>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm text-muted-foreground">Einwohner:</span>
                    <Badge variant="outline" className="border-[#dfe3da] bg-[#f0f2ed] text-[#3f4938] dark:border-[#42483b] dark:bg-[#292c26] dark:text-[#dce3d5]">{selectedDistrict.population?.toLocaleString('de-DE') ?? 'Unbekannt'}</Badge>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm text-muted-foreground">Fläche:</span>
                    <Badge variant="outline" className="border-[#dfe3da] bg-[#f0f2ed] text-[#3f4938] dark:border-[#42483b] dark:bg-[#292c26] dark:text-[#dce3d5]">{boundaryAreaKm2(selectedDistrict.boundaries) != null ? `${boundaryAreaKm2(selectedDistrict.boundaries)!.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km² (Geometrie)` : 'Unbekannt'}</Badge>
                  </div>
                  {selectedDistrict.rural_percentage != null && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm text-muted-foreground">Ländlicher Anteil:</span>
                      <Badge variant="outline" className="border-[#dfe3da] bg-[#f0f2ed] text-[#3f4938] dark:border-[#42483b] dark:bg-[#292c26] dark:text-[#dce3d5]">{selectedDistrict.rural_percentage.toLocaleString('de-DE')} %</Badge>
                    </div>
                  )}
                  {/* Clearing the URL parameter also clears the selection through the sync effect. */}
                  <Button variant="outline" size="sm" onClick={() => updateUrl(state => ({ ...state, districtId: null }))}>Gesamtübersicht anzeigen</Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Gesamtübersicht</p>

                  {hasElectionData && (
                    <>
                      {[
                        ['Wahlkreise gesamt:', electionDistrictCount.toLocaleString('de-DE')],
                        ['Gesamtbevölkerung:', historyPeriod ? 'Nicht erfasst' : electionDistricts.reduce((sum, d) => sum + (d.population ?? 0), 0).toLocaleString('de-DE')],
                        ['Gesamtfläche:', historyPeriod && history.data?.districts.some(d => !hasRenderableBoundary(d.boundaries)) ? 'Nicht vollständig erfasst' : `${electionDistricts.reduce((sum, d) => sum + (boundaryAreaKm2(d.boundaries) ?? 0), 0).toLocaleString('de-DE')} km²`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between items-center gap-2">
                          <span className="text-sm text-muted-foreground">{label}</span>
                          <Badge variant="outline" className="border-[#dfe3da] bg-[#f0f2ed] text-[#3f4938] dark:border-[#42483b] dark:bg-[#292c26] dark:text-[#dce3d5]">{value}</Badge>
                        </div>
                      ))}
                    </>
                  )}
                  {hasAdministrativeData && (
                    <>
                      {[
                        ['Verwaltungsgrenzen:', administrativeBoundaries.length.toLocaleString('de-DE')],
                        ['Bevölkerung (Verwaltung):', administrativeBoundaries.reduce((sum, d) => sum + (d.population ?? 0), 0).toLocaleString('de-DE')],
                        ['Fläche (Verwaltung):', `${administrativeBoundaries.reduce((sum, d) => sum + (boundaryAreaKm2(d.boundaries) ?? 0), 0).toLocaleString('de-DE')} km²`],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between items-center gap-2">
                          <span className="text-sm text-muted-foreground">{label}</span>
                          <Badge variant="outline" className="border-[#dfe3da] bg-[#f0f2ed] text-[#3f4938] dark:border-[#42483b] dark:bg-[#292c26] dark:text-[#dce3d5]">{value}</Badge>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>


        </div>
        )}
      </div>
      <section className="hidden print:block">
        <h1 className="mt-2 text-base font-semibold">
          Wahlkreise Baden-Württemberg{historyPeriod ? ` · ${historyPeriod.name}` : ''}
        </h1>
        <p className="mb-2 text-xs text-muted-foreground">
          Grenzstand {historyPeriod?.boundary_geometry_year ?? 2021}. Quelle: LGL Baden-Württemberg,
          Statistisches Landesamt, © OpenStreetMap-Mitwirkende.
        </p>
        <DistrictDataTable districts={tableDistricts} caption="Wahlkreise Baden-Württemberg als Tabelle" />
      </section>
    </div>
  );
};
