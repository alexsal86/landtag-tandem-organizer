import { useState, useEffect, useMemo } from 'react';
import { useKarlsruheDistricts, KarlsruheDistrict } from '@/hooks/useKarlsruheDistricts';
import { useMapFlags, MapFlag } from '@/hooks/useMapFlags';
import { useMapFlagTypes } from '@/hooks/useMapFlagTypes';
import { KarlsruheDistrictsMap } from './KarlsruheDistrictsMap';
import { MapFlagTypeManager } from './MapFlagTypeManager';
import { MapFlagEditor } from './MapFlagEditor';
import { MapFlagLayerToggle } from './MapFlagLayerToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, RefreshCw, Users, Flag, Building2, Map } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export const KarlsruheDistrictsView = () => {
  const { districts, isLoading, refetch } = useKarlsruheDistricts();
  const { flags, deleteFlag } = useMapFlags();
  const { flagTypes } = useMapFlagTypes();
  const [selectedDistrict, setSelectedDistrict] = useState<KarlsruheDistrict | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [flagEditorOpen, setFlagEditorOpen] = useState(false);
  const [flagCoordinates, setFlagCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [editingFlag, setEditingFlag] = useState<MapFlag | null>(null);
  const [visibleFlagTypes, setVisibleFlagTypes] = useState<Set<string>>(
    new Set(flagTypes.map(t => t.id))
  );
  const [showDistricts, setShowDistricts] = useState(true);
  const [showStakeholders, setShowStakeholders] = useState(true);
  const [isColorMap, setIsColorMap] = useState(false); // Default: schwarz-weiß

  // Initialize visible flag types when flagTypes are loaded
  useEffect(() => {
    if (flagTypes.length > 0 && visibleFlagTypes.size === 0) {
      setVisibleFlagTypes(new Set(flagTypes.map(t => t.id)));
    }
  }, [flagTypes]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success('Stadtteile wurden aktualisiert');
    } catch (error) {
      toast.error('Fehler beim Aktualisieren der Stadtteile');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFlagClick = (coordinates: { lat: number; lng: number }) => {
    setFlagCoordinates(coordinates);
    setEditingFlag(null);
    setFlagEditorOpen(true);
  };

  const handleFlagEdit = (flag: MapFlag) => {
    setEditingFlag(flag);
    setFlagCoordinates(null);
    setFlagEditorOpen(true);
  };

  const handleFlagDelete = async (flagId: string) => {
    if (confirm('Möchten Sie diese Flagge wirklich löschen?')) {
      await deleteFlag.mutateAsync(flagId);
    }
  };

  const toggleFlagType = (typeId: string) => {
    setVisibleFlagTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeId)) {
        next.delete(typeId);
      } else {
        next.add(typeId);
      }
      return next;
    });
  };

  const totalPopulation = districts.reduce((sum, d) => sum + (d.population || 0), 0);

  // Memoize displayed districts to prevent unnecessary re-renders
  const displayedDistricts = useMemo(
    () => showDistricts ? districts : [],
    [showDistricts, districts]
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stadtteile Karlsruhe</h1>
          <p className="text-muted-foreground mt-1">
            Übersicht der Karlsruher Stadtteile und deren Grenzen
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Stadtteilkarte</CardTitle>
              <CardDescription>
                {districts.length} Stadtteile in Karlsruhe
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="w-full h-[600px] rounded-lg" />
              ) : (
                <KarlsruheDistrictsMap
                  districts={displayedDistricts}
                  onDistrictClick={setSelectedDistrict}
                  selectedDistrict={selectedDistrict}
                  flags={flags}
                  flagTypes={flagTypes}
                  visibleFlagTypes={visibleFlagTypes}
                  flagMode={flagMode}
                  onFlagClick={handleFlagClick}
                  onFlagEdit={handleFlagEdit}
                  onFlagDelete={handleFlagDelete}
                  showStakeholders={showStakeholders}
                  showDistrictBoundaries={showDistricts}
                  isColorMap={isColorMap}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Flag Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Flaggen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="flag-mode" className="text-sm">Flaggen-Modus</Label>
                <Switch
                  id="flag-mode"
                  checked={flagMode}
                  onCheckedChange={setFlagMode}
                />
              </div>
              {flagMode && (
                <p className="text-xs text-muted-foreground">
                  Klicken Sie auf die Karte, um eine Flagge zu setzen
                </p>
              )}
              <MapFlagTypeManager />
              {flagTypes.length > 0 && (
                <MapFlagLayerToggle
                  visibleTypes={visibleFlagTypes}
                  onToggleType={toggleFlagType}
                />
              )}
              <div className="text-xs text-muted-foreground">
                <Flag className="h-3 w-3 inline mr-1" />
                {flags.length} Flaggen gesetzt
              </div>
            </CardContent>
          </Card>

          {/* Layer Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Kartenebenen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="show-districts" className="text-sm">Stadtteile anzeigen</Label>
                </div>
                <Switch
                  id="show-districts"
                  checked={showDistricts}
                  onCheckedChange={setShowDistricts}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="show-stakeholders" className="text-sm">Stakeholder anzeigen</Label>
                </div>
                <Switch
                  id="show-stakeholders"
                  checked={showStakeholders}
                  onCheckedChange={setShowStakeholders}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Map className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="map-color" className="text-sm">Farbige Karte</Label>
                </div>
                <Switch
                  id="map-color"
                  checked={isColorMap}
                  onCheckedChange={setIsColorMap}
                />
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Legende</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-lg">
                  🎯
                </div>
                <span className="text-sm text-muted-foreground">Flaggen (nach Typ gefärbt)</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-lg">
                  🏢
                </div>
                <span className="text-sm text-muted-foreground">Stakeholder (Tag-basiert)</span>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Stakeholder werden automatisch angezeigt, wenn ihre Tags mit den Tags einer Flagge übereinstimmen.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statistiken</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Stadtteile</div>
                  <div className="text-2xl font-bold">{districts.length}</div>
                </div>
              </div>
              {totalPopulation > 0 && (
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Einwohner</div>
                    <div className="text-2xl font-bold">
                      {totalPopulation.toLocaleString('de-DE')}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected District Details */}
          {selectedDistrict && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stadtteil Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div className="font-semibold">{selectedDistrict.name}</div>
                </div>
                {selectedDistrict.population && (
                  <div>
                    <div className="text-sm text-muted-foreground">Einwohner</div>
                    <div className="font-semibold">
                      {selectedDistrict.population.toLocaleString('de-DE')}
                    </div>
                  </div>
                )}
                <div
                  className="h-8 w-full rounded border"
                  style={{ backgroundColor: selectedDistrict.color }}
                />
              </CardContent>
            </Card>
          )}

          {/* District List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stadtteile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))
                ) : (
                  districts.map(district => (
                    <button
                      key={district.id}
                      onClick={() => setSelectedDistrict(district)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                        selectedDistrict?.id === district.id
                          ? 'bg-accent'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0"
                        style={{ backgroundColor: district.color }}
                      />
                      <span className="text-sm font-medium truncate">
                        {district.name}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <MapFlagEditor
        open={flagEditorOpen}
        onOpenChange={setFlagEditorOpen}
        coordinates={flagCoordinates}
        editFlag={editingFlag}
      />
    </div>
  );
};
