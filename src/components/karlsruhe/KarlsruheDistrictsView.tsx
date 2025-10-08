import { useState } from 'react';
import { useKarlsruheDistricts, KarlsruheDistrict } from '@/hooks/useKarlsruheDistricts';
import { KarlsruheDistrictsMap } from './KarlsruheDistrictsMap';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';

export const KarlsruheDistrictsView = () => {
  const { districts, isLoading, refetch } = useKarlsruheDistricts();
  const [selectedDistrict, setSelectedDistrict] = useState<KarlsruheDistrict | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const totalPopulation = districts.reduce((sum, d) => sum + (d.population || 0), 0);

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
                  districts={districts}
                  onDistrictClick={setSelectedDistrict}
                  selectedDistrict={selectedDistrict}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
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
    </div>
  );
};
