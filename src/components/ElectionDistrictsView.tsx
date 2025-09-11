import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, BarChart3, Loader2 } from "lucide-react";
import { useElectionDistricts } from "@/hooks/useElectionDistricts";
import { DistrictDetailDialog } from "./DistrictDetailDialog";
import LeafletBasicKarlsruheMap from "./LeafletBasicKarlsruheMap";
import LeafletMapFallback from "./LeafletMapFallback";

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
  const { districts, loading } = useElectionDistricts();
  const [selectedDistrict, setSelectedDistrict] = useState<any>(null);
  const [showDistrictDialog, setShowDistrictDialog] = useState(false);
  const [useMapFallback, setUseMapFallback] = useState(false);

  const handleDistrictClick = (district: any) => {
    setSelectedDistrict(district);
    setShowDistrictDialog(true);
  };

  const handleMapError = () => {
    console.error('Leaflet map failed to load, switching to fallback');
    setUseMapFallback(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Wahlkreisdaten werden geladen...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <MapPin className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold">Wahlkreise Karlsruhe</h1>
        <Badge variant="outline" className="ml-2">Baden-Württemberg</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Interaktive Karte
              </CardTitle>
              <CardDescription>
                Klicken Sie auf einen Wahlkreis für weitere Informationen
              </CardDescription>
            </CardHeader>
            <CardContent>
              {useMapFallback ? (
                <LeafletMapFallback 
                  districts={districts}
                  onDistrictClick={handleDistrictClick}
                  selectedDistrict={selectedDistrict}
                />
              ) : (
                <ErrorBoundary onError={handleMapError}>
                  <LeafletBasicKarlsruheMap 
                    districts={districts}
                    onDistrictClick={handleDistrictClick}
                    selectedDistrict={selectedDistrict}
                  />
                </ErrorBoundary>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* District Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Wahlkreis-Informationen</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDistrict ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      style={{ backgroundColor: getPartyColor(selectedDistrict.representative_party), color: '#fff' }}
                    >
                      {selectedDistrict.district_number}
                    </Badge>
                    <span className="font-semibold">{selectedDistrict.district_name}</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedDistrict.representative_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {selectedDistrict.representative_party}
                      </Badge>
                    </div>
                    {selectedDistrict.population && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedDistrict.population.toLocaleString()} Einwohner</span>
                      </div>
                    )}
                  </div>
                  
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
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Wahlkreise gesamt:</span>
                <Badge variant="secondary">{districts.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Gesamtbevölkerung:</span>
                <Badge variant="secondary">
                  {districts.reduce((sum, d) => sum + (d.population || 0), 0).toLocaleString()}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Gesamtfläche:</span>
                <Badge variant="secondary">
                  ca. {districts.reduce((sum, d) => sum + (d.area_km2 || 0), 0)} km²
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Legende</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {districts.map((district) => (
                  <div key={district.id} className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-sm"
                      style={{ backgroundColor: getPartyColor(district.representative_party) }}
                    />
                    <span className="text-sm">
                      {district.district_name} ({district.representative_party})
                    </span>
                  </div>
                ))}
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