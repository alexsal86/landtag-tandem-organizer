import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { hasRenderableBoundary, searchElectionDistricts } from "../mapModel";
import { Button } from "@/components/ui/button";
import { Users, BarChart3, Crown, Award, Search, SlidersHorizontal } from "lucide-react";
import { useElectionDistricts } from "@/hooks/useElectionDistricts";
import { DistrictDetailDialog } from "@/features/election-districts/components/DistrictDetailDialog";
import SimpleLeafletMap from "@/features/election-districts/components/SimpleLeafletMap";
import LeafletMapFallback from "@/features/election-districts/components/LeafletMapFallback";
import { debugConsole } from '@/utils/debugConsole';
import { ElectionDistrict } from "@/hooks/useElectionDistricts";

const getPartyColor = (party?: string): string => {
  switch (party?.toLowerCase()) {
    case 'fdp': return '#FFD700';
    case 'grüne': return '#4CAF50'; 
    case 'cdu': return '#0066CC';
    case 'spd': return '#E3000F';
    case 'afd': return '#00A0E6';
    case 'die linke': return '#BE3075';
    default: return '#9E9E9E';
  }
};

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

export const ElectionDistrictsView = () => {
  const { districts, loading } = useElectionDistricts();
  const [selectedDistrict, setSelectedDistrict] = useState<ElectionDistrict | null>(null);
  const [showDistrictDialog, setShowDistrictDialog] = useState(false);
  const [useMapFallback, setUseMapFallback] = useState(false);
  const [showElectionDistricts, setShowElectionDistricts] = useState(true);
  const [showAdministrativeBoundaries, setShowAdministrativeBoundaries] = useState(false);
  const [showDistrictPolygons, setShowDistrictPolygons] = useState(true);
  const [showDistrictMarkers, setShowDistrictMarkers] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedDistrict, setFocusedDistrict] = useState<ElectionDistrict>();
  const [showPartyAssociations, setShowPartyAssociations] = useState(false);

  const handleDistrictClick = (district: ElectionDistrict) => {
    setSelectedDistrict(district);
    setShowDistrictDialog(true);
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
  const displayedDistricts = districts.filter(d => {
    if (d.district_type === 'verwaltungsgrenze') return showAdministrativeBoundaries;
    return showElectionDistricts;
  });

  const searchResults = searchElectionDistricts(districts, searchQuery);
  const missingBoundaries = displayedDistricts.filter(d => !hasRenderableBoundary(d.boundaries)
    && (d.district_type === 'verwaltungsgrenze' || showDistrictPolygons));
  const focusDistrict = (district: ElectionDistrict) => {
    setSelectedDistrict(district);
    setFocusedDistrict({ ...district });
    if (district.district_type === 'verwaltungsgrenze') setShowAdministrativeBoundaries(true);
    else setShowElectionDistricts(true);
    setSearchQuery('');
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
      <div className="flex flex-wrap items-end gap-3 p-3 border-b">
        <form className="relative flex-1 min-w-0" onSubmit={event => {
          event.preventDefault();
          if (searchResults[0]) focusDistrict(searchResults[0]);
        }} role="search" aria-label="Wahlkreissuche">
          <label htmlFor="district-search" className="text-sm font-medium">Wahlkreis suchen</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input id="district-search" type="search" placeholder="Name oder Nummer eingeben …"
              className="pl-9" value={searchQuery} onChange={event => setSearchQuery(event.target.value)}
              aria-controls="district-search-results" onKeyDown={event => {
                if (event.key === 'Escape') setSearchQuery('');
              }} />
          </div>
          {searchQuery.trim() && (
            <div id="district-search-results" className="absolute top-full left-0 right-0 mt-1 z-[1100] rounded-md border bg-popover text-popover-foreground shadow-md max-h-64 overflow-y-auto">
              <p className="p-2 text-xs text-muted-foreground" role="status">{searchResults.length} Treffer</p>
              {searchResults.map(district => (
                <button key={district.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent"
                  onClick={() => focusDistrict(district)}>
                  WK {district.district_number}: {district.district_name}
                </button>
              ))}
            </div>
          )}
        </form>
        <Button variant="outline" className="md:hidden" aria-expanded={sidebarOpen}
          aria-controls="district-sidebar" onClick={() => setSidebarOpen(open => !open)}>
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          {sidebarOpen ? 'Optionen schließen' : 'Ebenen & Infos'}
        </Button>
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
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Map */}
        <div className="flex-1 min-w-0 relative">
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
              />
            </ErrorBoundary>
          )}
        </div>

        {/* Sidebar */}
        <div id="district-sidebar" className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-80 md:shrink-0 border-t md:border-t-0 md:border-l bg-muted/30 overflow-y-auto max-h-[60vh] md:max-h-none p-4 space-y-4`}>
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
                                    color: '#fff',
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
                  
                  {!hasRenderableBoundary(selectedDistrict.boundaries) && (
                    <p className="text-sm text-muted-foreground">Für dieses Gebiet fehlen nutzbare Grenzdaten.</p>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3"
                    onClick={() => setShowDistrictDialog(true)}
                  >
                    Details & Notizen
                  </Button>
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
              {hasElectionData && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Wahlkreise gesamt:</span>
                    <Badge variant="secondary">{electionDistricts.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Gesamtbevölkerung:</span>
                    <Badge variant="secondary">
                      {electionDistricts.reduce((sum, d) => sum + (d.population || 0), 0).toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Gesamtfläche:</span>
                    <Badge variant="secondary">
                      ca. {electionDistricts.reduce((sum, d) => sum + (d.area_km2 || 0), 0)} km²
                    </Badge>
                  </div>
                </>
              )}
              {hasAdministrativeData && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Verwaltungsgrenzen:</span>
                    <Badge variant="outline">{administrativeBoundaries.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bevölkerung (Verwaltung):</span>
                    <Badge variant="outline">
                      {administrativeBoundaries.reduce((sum, d) => sum + (d.population || 0), 0).toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fläche (Verwaltung):</span>
                    <Badge variant="outline">
                      ca. {administrativeBoundaries.reduce((sum, d) => sum + (d.area_km2 || 0), 0).toLocaleString()} km²
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Legende</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {hasElectionData && (
                  <>
                    <div className="text-sm text-muted-foreground">Parteifarben (Direktmandate):</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-black rounded"></div>
                        <span>CDU</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-palette-red rounded"></div>
                        <span>SPD</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-palette-green rounded"></div>
                        <span>GRÜNE</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-palette-yellow/60 rounded"></div>
                        <span>FDP</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-palette-blue rounded"></div>
                        <span>AfD</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-palette-purple rounded"></div>
                        <span>LINKE</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="h-3 w-3 text-palette-yellow" />
                        <span className="text-xs">Direktmandat</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Farben zeigen die Partei des Direktmandats
                      </p>
                    </div>
                  </>
                )}
                {hasAdministrativeData && (
                  <div className={hasElectionData ? "pt-2 border-t" : ""}>
                    <div className="text-sm text-muted-foreground mb-2">Verwaltungsgrenzen:</div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-palette-purple rounded-sm opacity-60"></div>
                      <span className="text-xs">Landkreise (gestrichelt)</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* District Detail Dialog */}
      <DistrictDetailDialog
        district={selectedDistrict}
        open={showDistrictDialog}
        onOpenChange={setShowDistrictDialog}
      />
    </div>
  );
};
