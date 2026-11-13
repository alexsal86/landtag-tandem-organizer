import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { boundaryAreaKm2, directMandateParty, partyColors, hasRenderableBoundary, searchElectionDistricts } from "../mapModel";
import { Button } from "@/components/ui/button";
import { Users, BarChart3, Crown, Award, Search } from "lucide-react";
import { useElectionDistricts } from "@/hooks/useElectionDistricts";
import { DistrictNotes } from "./DistrictNotes";
import { getPartyColor, getPartyTextColor } from "../partyColors";
import SimpleLeafletMap from "@/features/election-districts/components/SimpleLeafletMap";
import LeafletMapFallback from "@/features/election-districts/components/LeafletMapFallback";
import { debugConsole } from '@/utils/debugConsole';
import { ElectionDistrict } from "@/hooks/useElectionDistricts";

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
  const { districts, loading } = useElectionDistricts();
  const [selectedDistrict, setSelectedDistrict] = useState<ElectionDistrict | null>(null);
  const [useMapFallback, setUseMapFallback] = useState(false);
  const [showElectionDistricts, setShowElectionDistricts] = useState(true);
  const [showAdministrativeBoundaries, setShowAdministrativeBoundaries] = useState(false);
  const [showDistrictPolygons, setShowDistrictPolygons] = useState(true);
  const [showDistrictMarkers, setShowDistrictMarkers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeResult, setActiveResult] = useState(0);
  const [selectedParties, setSelectedParties] = useState<Set<string>>(() => new Set(['CDU', 'GRÜNE', 'SPD', 'FDP', 'AFD']));
  const [showBaseMap, setShowBaseMap] = useState(false);
  const [focusedDistrict, setFocusedDistrict] = useState<ElectionDistrict>();
  const [showPartyAssociations, setShowPartyAssociations] = useState(false);

  const handleDistrictClick = (district: ElectionDistrict) => {
    setSelectedDistrict(district);
    setFocusedDistrict({ ...district });
  };

  const handleMapError = () => {
    debugConsole.error('Leaflet map failed to load, switching to fallback');
    setUseMapFallback(true);
  };

  // Separate district types
  const electionDistricts = districts.filter(d => d.district_type !== 'verwaltungsgrenze');
  const administrativeBoundaries = districts.filter(d => d.district_type === 'verwaltungsgrenze');
  const hasElectionData = electionDistricts.length > 0;
  const hasAdministrativeData = administrativeBoundaries.length > 0;

  // Filter displayed districts based on toggles
  const displayedDistricts = useMemo(() => districts.filter(d => {
    if (d.district_type === 'verwaltungsgrenze') return showAdministrativeBoundaries;
    return showElectionDistricts;
  }), [districts, showAdministrativeBoundaries, showElectionDistricts]);

  const searchResults = searchElectionDistricts(districts, searchQuery);
  const missingBoundaries = displayedDistricts.filter(d => !hasRenderableBoundary(d.boundaries));
  const focusDistrict = (district: ElectionDistrict) => {
    setSelectedDistrict(district);
    setFocusedDistrict({ ...district });
    if (district.district_type === 'verwaltungsgrenze') setShowAdministrativeBoundaries(true);
    else setShowElectionDistricts(true);
    setSearchQuery('');
    setSelectedParties(previous => new Set([...previous, directMandateParty(district)]));
  };

  if (loading) {
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
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Map */}
        <div className="flex-1 min-w-0 min-h-[400px] relative">
          {useMapFallback ? (
            <LeafletMapFallback
              districts={displayedDistricts}
              onDistrictClick={handleDistrictClick}
               selectedDistrict={selectedDistrict ?? undefined}
            />
          ) : (
            <ErrorBoundary onError={handleMapError}>
              <SimpleLeafletMap
                districts={displayedDistricts}
                onDistrictClick={handleDistrictClick}
                selectedDistrict={selectedDistrict ?? undefined}
                showPartyAssociations={showPartyAssociations}
                showDistrictPolygons={showDistrictPolygons}
                showDistrictMarkers={showDistrictMarkers}
                focusedDistrict={focusedDistrict}
                selectedParties={selectedParties}
                showBaseMap={showBaseMap}
              />
            </ErrorBoundary>
          )}
        </div>

        {/* Sidebar */}
        <div id="district-sidebar" className="w-full md:w-80 md:shrink-0 border-t md:border-t-0 md:border-l bg-muted/30 overflow-y-auto md:max-h-full p-4 space-y-4">
          {sidebarHeader}
          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <form className="relative flex-1 min-w-0" onSubmit={event => {
              event.preventDefault();
              if (searchResults[activeResult]) focusDistrict(searchResults[activeResult]);
            }} role="search" aria-label="Wahlkreissuche">
              <label htmlFor="district-search" className="text-sm font-medium">Wahlkreis suchen</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input id="district-search" type="search" placeholder="Name oder Nummer eingeben …"
                  className="pl-9" value={searchQuery} onChange={event => { setSearchQuery(event.target.value); setActiveResult(0); }}
                  role="combobox" aria-autocomplete="list" aria-expanded={!!searchQuery.trim()}
                  aria-activedescendant={searchResults[activeResult] ? `district-result-${searchResults[activeResult].id}` : undefined}
                  aria-controls="district-search-results" onKeyDown={event => {
                    if (event.key === 'Escape') setSearchQuery('');
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      const next = (activeResult + (event.key === 'ArrowDown' ? 1 : -1) + searchResults.length) % Math.max(1, searchResults.length);
                      setActiveResult(next);
                      document.getElementById(`district-result-${searchResults[next]?.id}`)?.scrollIntoView({ block: 'nearest' });
                    }
                  }} />
              </div>
              {searchQuery.trim() && (
                <div id="district-search-results" role="listbox" className="absolute top-full left-0 right-0 mt-1 z-[1100] rounded-md border bg-popover text-popover-foreground shadow-md max-h-64 overflow-y-auto">
                  <p className="p-2 text-xs text-muted-foreground" role="status">{searchResults.length} Treffer</p>
                  {searchResults.map((district, index) => (
                    <button id={`district-result-${district.id}`} role="option" aria-selected={index === activeResult} style={index === activeResult ? { background: 'hsl(var(--accent))' } : undefined} key={district.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent"
                      onClick={() => focusDistrict(district)}>
                      WK {district.district_number}: {district.district_name}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>
      {missingBoundaries.length > 0 && (
        <details className="mx-3 my-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <summary className="cursor-pointer">Bei {missingBoundaries.length} angezeigten Gebieten fehlen nutzbare Grenzdaten.</summary>
          <p className="mt-2 text-muted-foreground">Diese Flächen können nicht gezeichnet werden. Vorhandene Nummernkreise bleiben über die Ebenenschalter verfügbar.</p>
          <ul className="mt-1 max-h-32 overflow-y-auto">
            {missingBoundaries.map(district => <li key={district.id}>
              <button type="button" className="text-left underline py-1" onClick={() => focusDistrict(district)}>
                {district.district_number}: {district.district_name}
              </button>
            </li>)}
          </ul>
        </details>
      )}
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
                  Wahlkreise ({electionDistricts.length})
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
                  {['CDU', 'GRÜNE', 'SPD', 'FDP', 'AFD'].map(party => (
                    <button key={party} type="button" aria-pressed={selectedParties.has(party)}
                      onClick={() => setSelectedParties(previous => {
                        const next = new Set(previous);
                        if (next.has(party)) next.delete(party); else next.add(party);
                        return next;
                      })}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all duration-200 motion-reduce:transition-none ${selectedParties.has(party) ? 'border-[#aeb4a6] bg-[#f0f2ed] dark:border-[#676e60] dark:bg-[#292c26] shadow-sm' : 'border-border bg-transparent opacity-50 hover:opacity-80'}`}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: partyColors[party] }} />
                      {party === 'AFD' ? 'AfD' : party}
                      <span className="text-muted-foreground">{electionDistricts.filter(d => directMandateParty(d) === party).length}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* District Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedDistrict?.district_type === 'verwaltungsgrenze' ? 'Verwaltungsgrenze' : 'Wahlkreis-Informationen'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDistrict ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {selectedDistrict.district_number}
                    </Badge>
                    <span className="font-semibold">{selectedDistrict.district_name}</span>
                  </div>
                  
                  {selectedDistrict.representatives && selectedDistrict.representatives.length > 0 && (() => {
                    // Group representatives by legislature period
                    const byLegislature = selectedDistrict.representatives.reduce<Record<string, typeof selectedDistrict.representatives>>((acc, rep) => {
                      const period = rep.legislature_period || '18. Legislaturperiode';
                      if (!acc[period]) acc[period] = [];
                      acc[period].push(rep);
                      return acc;
                    }, {});
                    const periods = Object.keys(byLegislature).sort().reverse();

                    return (
                      <div className="space-y-3">
                        {periods.map(period => (
                          <div key={period} className="space-y-2">
                            <h4 className="font-semibold text-sm flex items-center gap-1">
                              <Crown className="h-4 w-4" />
                              {period}
                            </h4>
                            {byLegislature[period].map((rep) => (
                              <div key={rep.id} className="flex items-center gap-2 text-sm">
                                {rep.mandate_type === 'direct' && <Award className="h-3 w-3 text-palette-yellow" />}
                                <span className="font-medium">{rep.name}</span>
                                <Badge 
                                  variant="outline" 
                                  className="text-xs"
                                  style={{ 
                                    backgroundColor: getPartyColor(rep.party), 
                                    color: getPartyTextColor(rep.party),
                                    border: 'none'
                                  }}
                                >
                                  {rep.party}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  ({rep.mandate_type === 'direct' ? 'Direkt' : 'Liste'})
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  
                  {selectedDistrict.population && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedDistrict.population.toLocaleString()} Einwohner</span>
                    </div>
                  )}
                  
                  {selectedDistrict.region && <p className="text-sm text-muted-foreground">Region: {selectedDistrict.region}</p>}
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
                  <Button variant="outline" size="sm" onClick={() => setSelectedDistrict(null)}>Gesamtübersicht anzeigen</Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Gesamtübersicht</p>

                  {hasElectionData && (
                    <>
                      {[
                        ['Wahlkreise gesamt:', electionDistricts.length.toLocaleString('de-DE')],
                        ['Gesamtbevölkerung:', electionDistricts.reduce((sum, d) => sum + (d.population ?? 0), 0).toLocaleString('de-DE')],
                        ['Gesamtfläche:', `${electionDistricts.reduce((sum, d) => sum + (boundaryAreaKm2(d.boundaries) ?? 0), 0).toLocaleString('de-DE')} km²`],
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
      </div>
    </div>
  );
};
