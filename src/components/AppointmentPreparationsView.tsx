import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarIcon, Archive, Clock } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AppointmentPreparation {
  id: string;
  appointment_id: string;
  template_id?: string;
  tenant_id: string;
  created_by: string;
  title: string;
  status: string;
  notes?: string;
  preparation_data: any;
  checklist_items: any;
  is_archived: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
  appointment?: {
    title: string;
    category: string;
    start_time: string;
  };
}

export function AppointmentPreparationsView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointmentPreparations, setAppointmentPreparations] = useState<AppointmentPreparation[]>([]);
  const [archivedPreparations, setArchivedPreparations] = useState<AppointmentPreparation[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAppointmentPreparations();
      syncPreparationWithAppointment();
      const interval = setInterval(syncPreparationWithAppointment, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchAppointmentPreparations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch active preparations
      const { data: activeData, error: activeError } = await supabase
        .from("appointment_preparations")
        .select(`
          *,
          appointment:appointments(title, category, start_time)
        `)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (activeError) {
        console.error("Error fetching appointment preparations:", activeError);
        return;
      }

      setAppointmentPreparations((activeData || []).map(item => ({
        ...item,
        checklist_items: Array.isArray(item.checklist_items) ? item.checklist_items : 
                        (typeof item.checklist_items === 'string' ? JSON.parse(item.checklist_items) : []),
        preparation_data: typeof item.preparation_data === 'string' ? JSON.parse(item.preparation_data) : item.preparation_data
      })));

      // Fetch archived preparations
      const { data: archivedData, error: archivedError } = await supabase
        .from("appointment_preparations")
        .select(`
          *,
          appointment:appointments(title, category, start_time)
        `)
        .eq("is_archived", true)
        .order("archived_at", { ascending: false });

      if (archivedError) {
        console.error("Error fetching archived preparations:", archivedError);
        return;
      }

      setArchivedPreparations((archivedData || []).map(item => ({
        ...item,
        checklist_items: Array.isArray(item.checklist_items) ? item.checklist_items : 
                        (typeof item.checklist_items === 'string' ? JSON.parse(item.checklist_items) : []),
        preparation_data: typeof item.preparation_data === 'string' ? JSON.parse(item.preparation_data) : item.preparation_data
      })));

    } catch (error) {
      console.error("Unexpected error fetching preparations:", error);
      toast({
        title: "Fehler",
        description: "Terminvorbereitungen konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to sync appointment category with preparation
  const syncPreparationWithAppointment = async () => {
    if (!user) return;

    try {
      const { data: preparations, error } = await supabase
        .from("appointment_preparations")
        .select(`
          id,
          appointment_id,
          preparation_data,
          appointment:appointments(category)
        `)
        .eq("is_archived", false);

      if (error || !preparations) return;

      for (const prep of preparations) {
        if (prep.appointment && prep.preparation_data) {
          const prepData = typeof prep.preparation_data === 'string' ? 
                          JSON.parse(prep.preparation_data) : prep.preparation_data;
          const currentEventType = prepData?.event_type;
          const appointmentCategory = prep.appointment.category;
          
          // Update if category changed
          if (currentEventType !== appointmentCategory) {
            const updatedData = {
              ...prepData,
              event_type: appointmentCategory
            };

            await supabase
              .from("appointment_preparations")
              .update({ preparation_data: updatedData })
              .eq("id", prep.id);
          }
        }
      }
    } catch (error) {
      console.error("Error syncing preparations with appointments:", error);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Abgeschlossen';
      case 'in_progress': return 'In Bearbeitung';
      default: return 'Entwurf';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Terminvorbereitungen</h3>
        <Button
          variant={showArchive ? 'default' : 'outline'}
          onClick={() => setShowArchive(!showArchive)}
          size="sm"
        >
          <Archive className="h-4 w-4 mr-2" />
          {showArchive ? 'Aktive anzeigen' : 'Archiv anzeigen'}
        </Button>
      </div>

      <Separator />

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
          {showArchive ? (
            archivedPreparations.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">
                    Keine archivierten Terminvorbereitungen vorhanden.
                  </p>
                </CardContent>
              </Card>
            ) : (
              archivedPreparations.map((prep) => (
                <Card key={prep.id} className="opacity-75">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="truncate">{prep.title}</span>
                      <Badge variant="outline" className="text-xs">
                        <Archive className="h-3 w-3 mr-1" />
                        Archiviert
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        <span>
                          {prep.appointment?.start_time ? 
                            format(new Date(prep.appointment.start_time), "dd.MM.yyyy HH:mm", { locale: de }) :
                            'Kein Termin'
                          }
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="text-xs">
                          {prep.preparation_data?.event_type || prep.appointment?.category || 'Unbekannt'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          Archiviert: {prep.archived_at ? format(new Date(prep.archived_at), "dd.MM.yyyy", { locale: de }) : ''}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )
          ) : (
            appointmentPreparations.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">
                    Keine aktiven Terminvorbereitungen vorhanden.
                    <br />
                    <span className="text-xs">Terminvorbereitungen werden über den Kalender erstellt.</span>
                  </p>
                </CardContent>
              </Card>
            ) : (
              appointmentPreparations.map((prep) => (
                <Card key={prep.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span className="truncate">{prep.title}</span>
                      <Badge variant={getStatusBadgeVariant(prep.status)} className="text-xs">
                        {getStatusLabel(prep.status)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        <span>
                          {prep.appointment?.start_time ? 
                            format(new Date(prep.appointment.start_time), "dd.MM.yyyy HH:mm", { locale: de }) :
                            'Kein Termin'
                          }
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="text-xs">
                          {prep.preparation_data?.event_type || prep.appointment?.category || 'Unbekannt'}
                        </Badge>
                      </div>
                      {prep.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {prep.notes}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Erstellt: {format(new Date(prep.created_at), "dd.MM.yyyy", { locale: de })}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )
          )}
        </div>
      )}
    </div>
  );
}