import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { useState } from "react";
import { generateBriefingPdf } from "./briefingPdfGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoIcon, ExternalLinkIcon, DownloadIcon, SettingsIcon } from "lucide-react";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

interface AppointmentPreparationDetailsTabProps {
  preparation: AppointmentPreparation;
  onOpenAppointment?: () => void;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function AppointmentPreparationDetailsTab({ 
  preparation, 
  onOpenAppointment
}: AppointmentPreparationDetailsTabProps) {

  const [showHistory, setShowHistory] = useState(false);
  const { data: history = [], isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ["preparation-history", preparation.id, preparation.updated_at],
    enabled: showHistory,
    queryFn: async () => {
      const { data, error } = await supabase.from("appointment_preparation_history").select("id,changed_at,actor_id,changed_fields").eq("preparation_id", preparation.id).order("changed_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const downloadJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(preparation, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `Vorbereitung_${preparation.id}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  return (
    <div className="space-y-6">
      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <InfoIcon className="h-5 w-5" />
            System-Informationen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">ID</label>
              <p className="font-mono text-xs bg-muted/30 p-2 rounded">
                {preparation.id}
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Tenant ID</label>
              <p className="font-mono text-xs bg-muted/30 p-2 rounded">
                {preparation.tenant_id}
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Ersteller ID</label>
              <p className="font-mono text-xs bg-muted/30 p-2 rounded">
                {preparation.created_by}
              </p>
            </div>
            
            {preparation.template_id && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Template ID</label>
                <p className="font-mono text-xs bg-muted/30 p-2 rounded">
                  {preparation.template_id}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle>Zeitstempel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Erstellt am:</span>
              <span className="text-sm text-muted-foreground">
                {formatDate(preparation.created_at)}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Zuletzt bearbeitet:</span>
              <span className="text-sm text-muted-foreground">
                {formatDate(preparation.updated_at)}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Archivierungsstatus:</span>
              <Badge variant={preparation.is_archived ? "secondary" : "default"}>
                {preparation.is_archived ? "Archiviert" : "Aktiv"}
              </Badge>
            </div>
            
            {preparation.archived_at && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium">Archiviert am:</span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(preparation.archived_at)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Linked Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Verknüpfte Ressourcen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {preparation.appointment_id ? (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="font-medium">Verknüpfter Termin</p>
                  <p className="text-sm text-muted-foreground">
                    ID: {preparation.appointment_id}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onOpenAppointment} disabled={!onOpenAppointment}>
                  <ExternalLinkIcon className="h-4 w-4 mr-2" />
                  Termin öffnen
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p>Kein verknüpfter Termin vorhanden</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiken</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-primary">
                {preparation.checklist_items?.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Checklisten-Items</p>
            </div>
            
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-palette-green">
                {preparation.checklist_items?.filter(item => item.completed).length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Abgeschlossen</p>
            </div>
            
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-palette-blue">
                {Object.keys(preparation.preparation_data || {}).length}
              </p>
              <p className="text-sm text-muted-foreground">Datenfelder</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Erweiterte Aktionen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => { void generateBriefingPdf({ preparation }).catch(() => notify.error("PDF konnte nicht erstellt werden.")); }}>
              <DownloadIcon className="h-4 w-4 mr-2" />
              Als PDF exportieren
            </Button>
            
            <Button variant="outline" className="w-full justify-start" onClick={downloadJson}>
              <ExternalLinkIcon className="h-4 w-4 mr-2" />
              Daten als JSON herunterladen
            </Button>
            
            <Button variant="outline" className="w-full justify-start" onClick={() => setShowHistory(v => !v)}>
              <InfoIcon className="h-4 w-4 mr-2" />
              Bearbeitungsverlauf anzeigen
            </Button>
          </div>
          {showHistory && <div className="mt-3 space-y-2 text-sm">
            {historyLoading && <p>Verlauf wird geladen…</p>}
            {historyError && <p>Verlauf konnte nicht geladen werden.</p>}
            {!historyLoading && !historyError && history.length === 0 && <p>Noch keine Änderungen seit Einführung des Verlaufs erfasst.</p>}
            {history.map(entry => <div key={entry.id} className="rounded border p-2"><p>{formatDate(entry.changed_at)}</p><p>Geändert: {entry.changed_fields.join(", ")}</p><p className="text-xs text-muted-foreground">Bearbeiter: {entry.actor_id ?? "System"}</p></div>)}
          </div>}
        </CardContent>
      </Card>
    </div>
  );
}