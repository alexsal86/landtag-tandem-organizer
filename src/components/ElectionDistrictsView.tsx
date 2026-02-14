import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, BarChart3, Crown, Award } from "lucide-react";
import { useElectionDistricts } from "@/hooks/useElectionDistricts";
import { DistrictDetailDialog } from "./DistrictDetailDialog";
import SimpleLeafletMap from "./SimpleLeafletMap";
import LeafletMapFallback from "./LeafletMapFallback";
import { useToast } from "@/components/ui/use-toast";

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
    console.error('Leaflet map error:', error, errorInfo);
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
  const { districts, loading, refetch } = useElectionDistricts();
  const { toast } = useToast();
  const [selectedDistrict, setSelectedDistrict] = useState<any>(null);
  const [showDistrictDialog, setShowDistrictDialog] = useState(false);
  const [useMapFallback, setUseMapFallback] = useState(false);
  const [showElectionDistricts, setShowElectionDistricts] = useState(true);
  const [showAdministrativeBoundaries, setShowAdministrativeBoundaries] = useState(false);
  const [showPartyAssociations, setShowPartyAssociations] = useState(false);

  const handleDistrictClick = (district: any) => {
    setSelectedDistrict(district);
    setShowDistrictDialog(true);
  };

  const handleMapError = () => {
    console.error('Leaflet map failed to load, switching to fallback');
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
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {useMapFallback ? (
            <LeafletMapFallback
              districts={displayedDistricts}
              onDistrictClick={handleDistrictClick}
              selectedDistrict={selectedDistrict}
            />
          ) : (
            <ErrorBoundary onError={handleMapError}>
              <SimpleLeafletMap
                districts={displayedDistricts}
                onDistrictClick={handleDistrictClick}
                selectedDistrict={selectedDistrict}
                showPartyAssociations={showPartyAssociations}
              />
            </ErrorBoundary>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l bg-muted/30 overflow-y-auto p-4 space-y-4">
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
                  Grüne Kreisverbände (46)
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
                  
                  {selectedDistrict.representatives && selectedDistrict.representatives.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-1">
                        <Crown className="h-4 w-4" />
                        Abgeordnete
                      </h4>
                      {selectedDistrict.representatives.map((rep: any) => (
                        <div key={rep.id} className="flex items-center gap-2 text-sm">
                          {rep.mandate_type === 'direct' && <Award className="h-3 w-3 text-yellow-600" />}
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
                  )}
                  
                  {selectedDistrict.population && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedDistrict.population.toLocaleString()} Einwohner</span>
                    </div>
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
                      {electionDistricts.reduce((sum: number, d: any) => sum + (d.population || 0), 0).toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Gesamtfläche:</span>
                    <Badge variant="secondary">
                      ca. {electionDistricts.reduce((sum: number, d: any) => sum + (d.area_km2 || 0), 0)} km²
                    </Badge>
                  </div>
                </>
              )}
              {hasAdministrativeData && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Verwaltungsgrenzen:</span>
                  <Badge variant="outline">{administrativeBoundaries.length}</Badge>
                </div>
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
                        <div className="w-3 h-3 bg-red-600 rounded"></div>
                        <span>SPD</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-600 rounded"></div>
                        <span>GRÜNE</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                        <span>FDP</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-800 rounded"></div>
                        <span>AfD</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-purple-600 rounded"></div>
                        <span>LINKE</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="h-3 w-3 text-yellow-600" />
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
                      <div className="w-3 h-3 bg-purple-600 rounded-sm opacity-60"></div>
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