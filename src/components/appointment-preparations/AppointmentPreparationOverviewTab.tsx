import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, ExternalLinkIcon, EditIcon, SaveIcon, XIcon, MapPinIcon, ClockIcon } from "lucide-react";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { supabase } from "@/integrations/supabase/client";

interface AppointmentPreparationOverviewTabProps {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function AppointmentPreparationOverviewTab({ 
  preparation, 
  onUpdate 
}: AppointmentPreparationOverviewTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: preparation.title,
    status: preparation.status,
    notes: preparation.notes || ""
  });
  const [saving, setSaving] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);
  const [loadingAppointment, setLoadingAppointment] = useState(false);

  // Fetch appointment details if appointment_id exists
  useEffect(() => {
    const fetchAppointmentDetails = async () => {
      if (!preparation.appointment_id) return;
      
      try {
        setLoadingAppointment(true);
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', preparation.appointment_id)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching appointment:', error);
          return;
        }
        
        setAppointmentDetails(data);
      } catch (error) {
        console.error('Error fetching appointment details:', error);
      } finally {
        setLoadingAppointment(false);
      }
    };

    fetchAppointmentDetails();
  }, [preparation.appointment_id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onUpdate(editData);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving changes:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      title: preparation.title,
      status: preparation.status,
      notes: preparation.notes || ""
    });
    setIsEditing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Abgeschlossen</Badge>;
      case "in_progress":
        return <Badge variant="secondary">In Bearbeitung</Badge>;
      case "draft":
        return <Badge variant="outline">Entwurf</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCompletionPercentage = () => {
    if (!preparation.checklist_items || preparation.checklist_items.length === 0) {
      return 0;
    }
    const completed = preparation.checklist_items.filter(item => item.completed).length;
    return Math.round((completed / preparation.checklist_items.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Basic Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Grundinformationen
            </CardTitle>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <EditIcon className="h-4 w-4 mr-2" />
                Bearbeiten
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Titel</label>
                <Input
                  value={editData.title}
                  onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Titel der Terminplanung"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={editData.status} onValueChange={(value) => setEditData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                    <SelectItem value="completed">Abgeschlossen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Notizen</label>
                <Textarea
                  value={editData.notes}
                  onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Zusätzliche Notizen zur Terminplanung"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  <SaveIcon className="h-4 w-4 mr-2" />
                  {saving ? "Speichern..." : "Speichern"}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <XIcon className="h-4 w-4 mr-2" />
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Titel</label>
                <p className="text-lg font-medium">{preparation.title}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  {getStatusBadge(preparation.status)}
                </div>
              </div>
              
              {preparation.notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notizen</label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{preparation.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Fortschritt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Checkliste</span>
                <span className="text-sm text-muted-foreground">
                  {getCompletionPercentage()}% abgeschlossen
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getCompletionPercentage()}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {preparation.checklist_items?.filter(item => item.completed).length || 0} von{" "}
                {preparation.checklist_items?.length || 0} Aufgaben erledigt
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked Appointment */}
      {preparation.appointment_id && (
        <Card>
          <CardHeader>
            <CardTitle>Termindetails</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAppointment ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : appointmentDetails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Datum & Zeit</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(appointmentDetails.start_time).toLocaleString('de-DE', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {appointmentDetails.end_time && (
                          <> - {new Date(appointmentDetails.end_time).toLocaleTimeString('de-DE', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {appointmentDetails.location && (
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Ort</p>
                        <p className="text-sm text-muted-foreground">{appointmentDetails.location}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Art der Veranstaltung</p>
                      <p className="text-sm text-muted-foreground">
                        {appointmentDetails.category === 'meeting' ? 'Besprechung' :
                         appointmentDetails.category === 'event' ? 'Veranstaltung' :
                         appointmentDetails.category === 'deadline' ? 'Termin' :
                         appointmentDetails.category || 'Sonstiges'}
                      </p>
                    </div>
                  </div>
                  
                  {appointmentDetails.priority && (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 flex items-center justify-center">
                        <div className={`h-2 w-2 rounded-full ${
                          appointmentDetails.priority === 'high' ? 'bg-red-500' :
                          appointmentDetails.priority === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Priorität</p>
                        <p className="text-sm text-muted-foreground">
                          {appointmentDetails.priority === 'high' ? 'Hoch' :
                           appointmentDetails.priority === 'medium' ? 'Mittel' :
                           'Niedrig'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {appointmentDetails.description && (
                  <div>
                    <p className="text-sm font-medium mb-2">Beschreibung</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {appointmentDetails.description}
                    </p>
                  </div>
                )}
                
                <div className="flex justify-end">
                  <Button variant="outline" size="sm">
                    <ExternalLinkIcon className="h-4 w-4 mr-2" />
                    Termin öffnen
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Termindetails konnten nicht geladen werden.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadaten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Erstellt am:</span>
              <p className="font-medium">
                {new Date(preparation.created_at).toLocaleString('de-DE')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Zuletzt bearbeitet:</span>
              <p className="font-medium">
                {new Date(preparation.updated_at).toLocaleString('de-DE')}
              </p>
            </div>
            {preparation.template_id && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Template ID:</span>
                <p className="font-mono text-xs">{preparation.template_id}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}