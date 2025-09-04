import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoIcon, ExternalLinkIcon, DownloadIcon, SettingsIcon } from "lucide-react";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

interface AppointmentPreparationDetailsTabProps {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function AppointmentPreparationDetailsTab({ 
  preparation, 
  onUpdate 
}: AppointmentPreparationDetailsTabProps) {

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
                <Button variant="outline" size="sm">
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
              <p className="text-2xl font-bold text-green-600">
                {preparation.checklist_items?.filter(item => item.completed).length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Abgeschlossen</p>
            </div>
            
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
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
            <Button variant="outline" className="w-full justify-start">
              <DownloadIcon className="h-4 w-4 mr-2" />
              Als PDF exportieren
            </Button>
            
            <Button variant="outline" className="w-full justify-start">
              <ExternalLinkIcon className="h-4 w-4 mr-2" />
              Daten als JSON herunterladen
            </Button>
            
            <Button variant="outline" className="w-full justify-start">
              <InfoIcon className="h-4 w-4 mr-2" />
              Audit-Log anzeigen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}