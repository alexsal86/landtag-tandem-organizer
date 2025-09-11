import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Info, Layers, ZoomIn, ZoomOut, StickyNote } from "lucide-react";
import LeafletKarlsruheMap from "./LeafletKarlsruheMap";
import { DistrictDetailDialog } from "./DistrictDetailDialog";
import { useElectionDistricts, ElectionDistrict } from "@/hooks/useElectionDistricts";

export function ElectionDistrictsView() {
  const { districts, loading } = useElectionDistricts();
  const [selectedDistrict, setSelectedDistrict] = useState<ElectionDistrict | null>(null);
  const [showDistrictDialog, setShowDistrictDialog] = useState(false);

  const handleDistrictClick = (district: ElectionDistrict) => {
    setSelectedDistrict(district);
    setShowDistrictDialog(true);
  };

  const getPartyColor = (party?: string) => {
    switch (party?.toLowerCase()) {
      case "fdp": return "bg-yellow-500";
      case "grüne": return "bg-green-500";
      case "cdu": return "bg-blue-500";
      case "spd": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Wahlkreisdaten werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wahlkreise Karlsruhe</h1>
          <p className="text-muted-foreground">
            Übersicht der Landtagswahlkreise in und um Karlsruhe
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Baden-Württemberg
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map Section */}
        <div className="lg:col-span-3">
          <Card className="h-[600px]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Interaktive Karte
                  </CardTitle>
                  <CardDescription>
                    Wahlkreisgrenzen und Stadtteile von Karlsruhe - Klicken Sie auf einen Wahlkreis für Details
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Layers className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-[500px]">
              <LeafletKarlsruheMap 
                districts={districts}
                onDistrictClick={handleDistrictClick}
                selectedDistrict={selectedDistrict}
              />
            </CardContent>
          </Card>
        </div>

        {/* Info Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                {selectedDistrict ? "Wahlkreis-Info" : "Wahlkreis wählen"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDistrict ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Wahlkreis {selectedDistrict.district_number}</h4>
                    <p className="text-sm font-semibold">{selectedDistrict.district_name}</p>
                  </div>
                  {selectedDistrict.representative_name && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Abgeordnete/r</h4>
                      <p className="font-semibold">{selectedDistrict.representative_name}</p>
                      {selectedDistrict.representative_party && (
                        <Badge variant="outline" className="mt-1">
                          {selectedDistrict.representative_party}
                        </Badge>
                      )}
                    </div>
                  )}
                  {selectedDistrict.population && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground">Einwohner</h4>
                      <p className="font-semibold">{selectedDistrict.population.toLocaleString()}</p>
                    </div>
                  )}
                  <Button 
                    onClick={() => setShowDistrictDialog(true)}
                    className="w-full flex items-center gap-2"
                  >
                    <StickyNote className="h-4 w-4" />
                    Details & Notizen
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Klicken Sie auf einen Wahlkreis auf der Karte, um Details anzuzeigen.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statistiken</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Wahlkreise</span>
                  <span className="font-medium">{districts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Einwohner gesamt</span>
                  <span className="font-medium">
                    {districts.reduce((sum, d) => sum + (d.population || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Fläche gesamt</span>
                  <span className="font-medium">
                    {districts.reduce((sum, d) => sum + (d.area_km2 || 0), 0).toFixed(1)} km²
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Legende</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {districts.map((district) => (
                  <div key={district.id} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 ${getPartyColor(district.representative_party)}`}></div>
                    <span className="text-sm">
                      WK {district.district_number}: {district.district_name}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DistrictDetailDialog
        district={selectedDistrict}
        open={showDistrictDialog}
        onOpenChange={setShowDistrictDialog}
      />
    </div>
  );
}