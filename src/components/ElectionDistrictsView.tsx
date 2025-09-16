import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, BarChart3, Loader2, Crown, Award, FileText, Map } from "lucide-react";
import { useElectionDistricts } from "@/hooks/useElectionDistricts";
import { DistrictDetailDialog } from "./DistrictDetailDialog";
import SimpleLeafletMap from "./SimpleLeafletMap";
import LeafletMapFallback from "./LeafletMapFallback";
import { supabase } from "@/integrations/supabase/client";
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
  const [importing, setImporting] = useState(false);
  const [importingBoundaries, setImportingBoundaries] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<any>(null);
  const [showDistrictDialog, setShowDistrictDialog] = useState(false);
  const [useMapFallback, setUseMapFallback] = useState(false);
  const [showElectionDistricts, setShowElectionDistricts] = useState(true);
  const [showAdministrativeBoundaries, setShowAdministrativeBoundaries] = useState(false);
  const [showPartyAssociations, setShowPartyAssociations] = useState(false);
  const [importingPartyAssociations, setImportingPartyAssociations] = useState(false);

  const handleDistrictClick = (district: any) => {
    setSelectedDistrict(district);
    setShowDistrictDialog(true);
  };

  const handleMapError = () => {
    console.error('Leaflet map failed to load, switching to fallback');
    setUseMapFallback(true);
  };

  const handleImportRepresentatives = async () => {
    try {
      setImporting(true);
      
      const { data, error } = await supabase.functions.invoke('import-representatives');
      
      if (error) {
        throw error;
      }
      
      toast({ 
        title: 'Import erfolgreich', 
        description: `${data?.message || 'Abgeordnete erfolgreich importiert'}` 
      });
      
      await refetch();
      
    } catch (error: any) {
      console.error('Error importing representatives:', error);
      toast({ 
        title: 'Import fehlgeschlagen', 
        description: error.message || 'Bitte erneut versuchen.', 
        variant: 'destructive' 
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportAdministrativeBoundaries = async () => {
    try {
      setImportingBoundaries(true);
      
      // Load the file client-side first
      const response = await fetch('/data/kreise_bw.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const geoJsonData = await response.json();
      
      // Send the data to the edge function
      const { data, error } = await supabase.functions.invoke('import-administrative-boundaries', {
        body: { geoJsonData }
      });
      
      if (error) {
        throw error;
      }
      
      toast({ 
        title: 'Import erfolgreich', 
        description: `${data?.data?.length || 0} Verwaltungsgrenzen wurden erfolgreich importiert.` 
      });
      
      await refetch();
      
    } catch (error: any) {
      console.error('Error importing administrative boundaries:', error);
      toast({ 
        title: 'Import fehlgeschlagen', 
        description: error.message || 'Bitte erneut versuchen.', 
        variant: 'destructive' 
      });
    } finally {
      setImportingBoundaries(false);
    }
  };

  const handleImportPartyAssociations = async () => {
    try {
      setImportingPartyAssociations(true);
      
      // Load the CSV file - using the uploaded file content
      const csvContent = `Kreisverband,Telefon,Webseite,E-Mail,Social,StraÃe,Hausnummer,Ort,Vorwahl,Rufnummer
Aalen / Ellwangen,,https://www.gruene-aalen-ellwangen.de,,,,,,,
Alb-Donau,,https://www.gruene-alb-donau.de,,,Bockgasse,2,89073 Ulm,,
Biberach,15150637863,https://www.gruene-kreis-biberach.de,,,,,,1515063786,3
BÃ¶blingen,7031224677,https://www.gruene-boeblingen.de,,,Marktplatz,29,71032 BÃ¶blingen,703122467,7
Bodenseekreis,7543500423,https://www.gruene-bodenseekreis.de,kreisgeschaeftsstelle@gruene-bodenseekreis.de,,Bahnhofplatz,3,88045 Friedrichshafen,754350042,3
Breisgau-Hochschwarzwald,7614535613,https://www.gruene-breisgau-hochschwarzwald.de,,,RehlingstraÃe,16a,79100 Freiburg,761453561,3
Calw,,https://www.gruene-kreis-calw.de,,,,,,,
Emmendingen,7641932757,https://www.gruene-em.de,,,Theodor-Ludwig-Str.,24,"-26, 79312 Emmendingen",764193275,7
Esslingen,702235851,https://www.gruene-es.de,,,Plochinger Strasse,14,72622 NÃ¼rtingen,70223585,1
Ettlingen,15566393709,https://www.gruene-ettlingen.de,,,,,,1556639370,9
Freiburg,761701214,https://www.gruene-freiburg.de,,,RehlingstraÃe,16a,79100 Freiburg,76170121,4
Freudenstadt,1758272704,https://www.gruene-freudenstadt.de,,,,,,175827270,4
GÃ¶ppingen,71614077913,http://gruene-gp.de,,,,,,7161407791,3
Heidelberg,62219146610,https://www.gruene-heidelberg.de,,,Bergheimerstr.,147,69115 Heidelberg,6221914661,0
Heidenheim,73213530925,https://www.gruene-heidenheim.de,,,Schnaitheimer StraÃe,40,89520 Heidenheim,7321353092,5
Heilbronn,7131162416,https://www.gruene-heilbronn.de,,,KaiserstraÃe,17,74072 Heilbronn,713116241,6
Hohenlohe,79409692500,https://www.gruene-hohenlohe.de,,,Untere TorstraÃe,12,74613 Ãhringen,7940969250,0
Karlsruhe,7212031232,https://www.gruenekarlsruhe.de,,,RedtenbacherstraÃe,9,76133 Karlsruhe,721203123,2
Karlsruhe-Land,1734364909,https://www.gruene-karlsruhe-land.de,,,KÃ¼belmarkt,6,76646 Bruchsal,173436490,9
Konstanz,7531457581,https://www.gruene-konstanz.de,,,Rheinsteig,15,78462 Konstanz,753145758,1
Kurpfalz-Hardt,62024094403,https://www.gruene-kurpfalz-hardt.de,,,Mannheimer StraÃe,7,68723 Schwetzingen,6202409440,3
LÃ¶rrach,7621165268,https://www.gruene-loerrach.de,,,SpitalstraÃe,56,79539 LÃ¶rrach,762116526,8
Ludwigsburg,7141927926,https://www.gruene-ludwigsburg.de,,,LindenstraÃe,16,71634 Ludwigsburg,714192792,6
Main-Tauber,934221462,https://www.gruene-main-tauber.de,,,,,,93422146,2
Mannheim,62122920,https://www.gruene-mannheim.de,,,Kaiserring,38,68161 Mannheim,6212292,0
Neckar-BergstraÃe,,https://www.gruene-neckar-bergstrasse.de,,,HauptstraÃe,23,69469 Weinheim,,
Neckar-Odenwald,,https://www.gruene-nok.de,,,,,,,
Odenwald-Kraichgau,6223866423,https://www.gruene-odenwald-kraichgau.de,,,HauptstraÃe,20,69151 NeckargemÃ¼nd,622386642,3
Ortenau,7819197820,https://www.gruene-ortenau.de,,,GlaserstraÃe,4a,77652 Offenburg,781919782,0
Pforzheim-Enzkreis,723117928,https://www.gruene-pforzheim-enz.de,,,Westliche Karl-Friedrich-StraÃe,28,75172 Pforzheim,72311792,8
Rastatt/Baden-Baden,,https://www.gruene-ra-bad.de,,,Schwarzwaldstr.,139,76532 Baden-Baden,,
Ravensburg,7513593970,https://www.gruene-ravensburg.de,david.rosenkranz@gruene-rv.de,,RosenstraÃe,39,88212 Ravensburg,751359397,0
Rems-Murr,71511693412,https://www.gruene-rems-murr.de,,,Mittlere Sackgasse,19,"-21, 71332 Waiblingen",7151169341,2
Reutlingen,7121372677,https://www.gruene-reutlingen.de,,,GartenstraÃe,18,72764 Reutlingen,712137267,7
Rottweil,7711763035,https://www.gruene-rottweil.de,,,,,,771176303,5
SchwÃ¤bisch GmÃ¼nd,1778634706,https://www.gruene-schwaebisch-gmuend.de,,,MÃ¼nsterplatz,13,73525 SchwÃ¤bisch GmÃ¼nd,177863470,6
SchwÃ¤bisch Hall,7919464892,https://www.gruene-sha.de,,,Blendstatt,3,74523 SchwÃ¤bisch Hall,791946489,2
Schwarzwald-Baar,77239297200,https://www.gruene-schwarzwald-baar.de,,,Postfach 17,28,78007 Villingen-Schwenningen,7723929720,0
Sigmaringen,,https://www.gruene-sigmaringen.de,,,BahnhofstraÃe,3,72488 Sigmaringen,,
Stuttgart,7116159501,https://www.gruene-stuttgart.de,info@gruene-stuttgart.de,,KÃ¶nigstr.,78,70173 Stuttgart,711615950,1
TÃ¼bingen,707151496,https://www.gruene-tuebingen.de,,,Poststr.,2,"-4, 72072 TÃ¼bingen",70715149,6
Tuttlingen,7711763035,https://www.gruene-tuttlingen.de,,,,,,771176303,5
Waldshut,77646259,https://www.gruene-wt.de,,,,,,7764625,9
Wangen,1773345782,https://www.gruene-wangen.de,,,Ravensburger StraÃe,40,88239 Wangen im AllgÃ¤u,177334578,2
Ulm,7311658066,https://www.gruene-ulm.de,,,HeimstraÃe,7,89073 Ulm,731165806,6
Zollernalb,74339021500,https://www.gruene-zollernalb.de,,,Postfach,4016,72322 Balingen,7433902150,0`;
      
      const { data, error } = await supabase.functions.invoke('import-party-associations', {
        body: csvContent
      });
      
      if (error) {
        throw error;
      }
      
      toast({ 
        title: 'Import erfolgreich', 
        description: 'Grüne Kreisverbände erfolgreich importiert' 
      });
      
      await refetch();
    } catch (error: any) {
      console.error('Error importing party associations:', error);
      toast({ 
        title: 'Import fehlgeschlagen', 
        description: error.message || 'Bitte erneut versuchen.', 
        variant: 'destructive' 
      });
    } finally {
      setImportingPartyAssociations(false);
    }
  };

  // Filter districts based on data
  const electionDistricts = districts.filter(d => !d.district_type || d.district_type === 'wahlkreis');
  const administrativeBoundaries = districts.filter(d => d.district_type === 'verwaltungsgrenze');
  const hasElectionData = electionDistricts.length > 0;
  const hasAdministrativeData = administrativeBoundaries.length > 0;

  // Create filtered districts based on layer visibility
  const visibleDistricts = [
    ...(showElectionDistricts ? electionDistricts : []),
    ...(showAdministrativeBoundaries ? administrativeBoundaries : [])
  ];

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
              {visibleDistricts.length === 0 && !showPartyAssociations && (
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Keine Daten auf der Karte sichtbar.</p>
                  <p className="text-xs text-muted-foreground">Aktivieren Sie Layer oder importieren Sie Daten über die Seitenleiste.</p>
                </div>
              )}
              <ErrorBoundary onError={handleMapError}>
                <SimpleLeafletMap 
                  districts={visibleDistricts}
                  onDistrictClick={handleDistrictClick}
                  selectedDistrict={selectedDistrict}
                  showPartyAssociations={showPartyAssociations}
                />
              </ErrorBoundary>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Layer Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Karten-Layer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
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
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="administrative-boundaries"
                  checked={showAdministrativeBoundaries}
                  onChange={(e) => setShowAdministrativeBoundaries(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="administrative-boundaries" className="text-sm font-medium">
                  Verwaltungsgrenzen ({administrativeBoundaries.length})
                </label>
              </div>
              <div className="flex items-center space-x-2">
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

          {/* Data Import */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datenimport</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                disabled={importing}
                onClick={async () => {
                  try {
                    setImporting(true);
                    const res = await fetch('/data/LTWahlkreise2021-BW.geojson');
                    const text = await res.text();
                    const { data, error } = await supabase.functions.invoke('import-election-districts', {
                      body: { geojson: text }
                    });
                    if (error) throw error;
                    toast({ title: 'Import erfolgreich', description: `${data?.imported ?? 0} Wahlkreise importiert.` });
                    await refetch();
                  } catch (e: any) {
                    console.error(e);
                    toast({ title: 'Import fehlgeschlagen', description: e.message ?? 'Bitte erneut versuchen.', variant: 'destructive' });
                  } finally {
                    setImporting(false);
                  }
                }}
                className="w-full"
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importiere Wahlkreise...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Wahlkreise importieren
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={importingBoundaries}
                onClick={handleImportAdministrativeBoundaries}
                className="w-full"
              >
                {importingBoundaries ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importiere Grenzen...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Map className="h-4 w-4" />
                    Verwaltungsgrenzen importieren
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={importing}
                onClick={handleImportRepresentatives}
                className="w-full"
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importiere...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Abgeordnete importieren
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={importingPartyAssociations}
                onClick={handleImportPartyAssociations}
                className="w-full border-green-500 text-green-700 hover:bg-green-50"
              >
                {importingPartyAssociations ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importiere Kreisverbände...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    🌱 Grüne Kreisverbände importieren
                  </span>
                )}
              </Button>
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