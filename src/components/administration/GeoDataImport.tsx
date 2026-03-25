import { useState } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Map, Users, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { isFeatureCollection } from "@/types/geoDomain";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Bitte erneut versuchen.';
};

export function GeoDataImport() {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [importingBoundaries, setImportingBoundaries] = useState(false);
  const [importingPartyAssociations, setImportingPartyAssociations] = useState(false);
  const [importingKarlsruhe, setImportingKarlsruhe] = useState(false);

  const handleImportWahlkreise = async () => {
    try {
      setImporting(true);
      const res = await fetch('/data/LTWahlkreise2021-BW.geojson');
      const text = await res.text();
      const { data, error } = await supabase.functions.invoke('import-election-districts', {
        body: { geojson: text }
      });
      if (error) throw error;
      toast({ title: 'Import erfolgreich', description: `${data?.imported ?? 0} Wahlkreise importiert.` });
    } catch (error: unknown) {
      debugConsole.error(error);
      toast({ title: 'Import fehlgeschlagen', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleImportBoundaries = async () => {
    try {
      setImportingBoundaries(true);
      const response = await fetch('/data/kreise_bw.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const geoJsonData: unknown = await response.json();
      if (!isFeatureCollection(geoJsonData)) {
        throw new Error('Ungültiges GeoJSON: Erwartet wurde eine FeatureCollection.');
      }
      const { data, error } = await supabase.functions.invoke('import-administrative-boundaries', {
        body: { geoJsonData }
      });
      if (error) throw error;
      toast({ title: 'Import erfolgreich', description: `${data?.data?.length || 0} Verwaltungsgrenzen importiert.` });
    } catch (error: unknown) {
      debugConsole.error(error);
      toast({ title: 'Import fehlgeschlagen', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setImportingBoundaries(false);
    }
  };

  const handleImportRepresentatives = async () => {
    try {
      setImporting(true);
      const { data, error } = await supabase.functions.invoke('import-representatives');
      if (error) throw error;
      toast({ title: 'Import erfolgreich', description: data?.message || 'Abgeordnete erfolgreich importiert' });
    } catch (error: unknown) {
      debugConsole.error(error);
      toast({ title: 'Import fehlgeschlagen', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleImportPartyAssociations = async () => {
    try {
      setImportingPartyAssociations(true);
      // Use the same CSV content approach as ElectionDistrictsView had
      const { error } = await supabase.functions.invoke('import-party-associations');
      if (error) throw error;
      toast({ title: 'Import erfolgreich', description: 'Kreisverbände erfolgreich importiert.' });
    } catch (error: unknown) {
      debugConsole.error(error);
      toast({ title: 'Import fehlgeschlagen', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setImportingPartyAssociations(false);
    }
  };

  const handleImportKarlsruheDistricts = async () => {
    try {
      setImportingKarlsruhe(true);
      const { error } = await supabase.functions.invoke('import-karlsruhe-districts');
      if (error) throw error;
      toast({ title: 'Import erfolgreich', description: 'Karlsruher Stadtteile erfolgreich importiert.' });
    } catch (error: unknown) {
      debugConsole.error(error);
      toast({ title: 'Import fehlgeschlagen', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setImportingKarlsruhe(false);
    }
  };

  const anyImporting = importing || importingBoundaries || importingPartyAssociations || importingKarlsruhe;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Geo-Datenimport
          </CardTitle>
          <CardDescription>
            Importiere geographische Daten wie Wahlkreise, Verwaltungsgrenzen und Stadtteile.
            Diese Daten gelten für alle Tenants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              disabled={anyImporting}
              onClick={handleImportWahlkreise}
              className="w-full justify-start"
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
              variant="outline"
              disabled={anyImporting}
              onClick={handleImportBoundaries}
              className="w-full justify-start"
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
              variant="outline"
              disabled={anyImporting}
              onClick={handleImportRepresentatives}
              className="w-full justify-start"
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
              variant="outline"
              disabled={anyImporting}
              onClick={handleImportPartyAssociations}
              className="w-full justify-start"
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

            <Button
              variant="outline"
              disabled={anyImporting}
              onClick={handleImportKarlsruheDistricts}
              className="w-full justify-start"
            >
              {importingKarlsruhe ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importiere Stadtteile...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Karlsruhe Stadtteile importieren
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
