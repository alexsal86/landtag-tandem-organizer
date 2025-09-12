import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, BarChart3, Loader2, Crown, Award } from "lucide-react";
import { useElectionDistricts } from "@/hooks/useElectionDistricts";
import { DistrictDetailDialog } from "./DistrictDetailDialog";
import SimpleLeafletMap from "./SimpleLeafletMap";
import { supabase } from "@/integrations/supabase/client";


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

  // One-time sync of all election districts - trigger manually
  useEffect(() => {
    const syncData = async () => {
      try {
        console.log('Starting sync of all Baden-Württemberg election districts...');
        const { data, error } = await supabase.functions.invoke('sync-bw-districts');
        if (error) throw error;
        console.log('Sync completed successfully:', data);
        // Refresh districts data after sync
        setTimeout(() => window.location.reload(), 2000);
      } catch (e) {
        console.error('Sync failed:', e);
      }
    };

    // Trigger sync automatically on component mount (only once)
    const key = 'districts_synced_v3';
    if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
      syncData();
      sessionStorage.setItem(key, '1');
    }
  }, []);

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
              <ErrorBoundary onError={handleMapError}>
                <SimpleLeafletMap 
                  districts={districts}
                  onDistrictClick={handleDistrictClick}
                  selectedDistrict={selectedDistrict}
                />
              </ErrorBoundary>
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
                      {selectedDistrict.representatives.map((rep, index) => (
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
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="h-3 w-3 text-yellow-600" />
                    <span className="text-xs">Direktmandat</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Farben zeigen die Partei des Direktmandats
                  </p>
                </div>
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