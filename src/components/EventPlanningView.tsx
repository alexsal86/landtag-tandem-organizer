import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Grid, List, Archive } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNewItemIndicators } from "@/hooks/useNewItemIndicators";
import { NewItemIndicator } from "./NewItemIndicator";
import { EventPlanningDetailView } from "./EventPlanningDetailView";
import AppointmentPreparationSidebar from "./AppointmentPreparationSidebar";

interface EventPlanning {
  id: string;
  title: string;
  description?: string;
  location?: string;
  background_info?: string;
  confirmed_date?: string;
  is_private: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_digital?: boolean;
  digital_platform?: string;
  digital_link?: string;
  digital_access_info?: string;
}

interface AppointmentPreparation {
  id: string;
  title: string;
  appointment_id?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at?: string;
}

export function EventPlanningView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isItemNew } = useNewItemIndicators('eventplanning');
  const [plannings, setPlannings] = useState<EventPlanning[]>([]);
  const [selectedPlanning, setSelectedPlanning] = useState<EventPlanning | null>(null);
  const [appointmentPreparations, setAppointmentPreparations] = useState<AppointmentPreparation[]>([]);
  const [selectedPreparation, setSelectedPreparation] = useState<AppointmentPreparation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentTenant || !user) return;
    fetchPlannings();
    fetchAppointmentPreparations();
  }, [user, currentTenant?.id]);

  const fetchPlannings = async () => {
    if (!user || !currentTenant?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("event_plannings")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlannings(data || []);
    } catch (error) {
      console.error('Error fetching plannings:', error);
      toast({
        title: "Fehler",
        description: "Planungen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointmentPreparations = async () => {
    if (!user || !currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from("appointment_preparations")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAppointmentPreparations(data || []);
    } catch (error) {
      console.error("Error fetching appointment preparations:", error);
    }
  };

  const handlePreparationClick = (preparation: AppointmentPreparation) => {
    setSelectedPreparation(preparation);
  };

  if (selectedPlanning) {
    return (
      <EventPlanningDetailView
        planning={selectedPlanning}
        planningDates={[]}
        checklistItems={[]}
        collaborators={[]}
        contacts={[]}
        speakers={[]}
        onBack={() => setSelectedPlanning(null)}
        onDelete={async () => {
          try {
            const { error } = await supabase
              .from("event_plannings")
              .delete()
              .eq("id", selectedPlanning.id);
            if (error) throw error;
            setPlannings(prev => prev.filter(p => p.id !== selectedPlanning.id));
            setSelectedPlanning(null);
            toast({ title: "Planung gelöscht" });
          } catch (error) {
            toast({ title: "Fehler", variant: "destructive" });
          }
        }}
        onUpdate={async (updates) => {
          try {
            const { error } = await supabase
              .from("event_plannings")
              .update(updates)
              .eq("id", selectedPlanning.id);
            if (error) throw error;
            setSelectedPlanning({ ...selectedPlanning, ...updates });
            setPlannings(prev => prev.map(p => p.id === selectedPlanning.id ? { ...p, ...updates } : p));
            toast({ title: "Planung aktualisiert" });
          } catch (error) {
            toast({ title: "Fehler", variant: "destructive" });
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Event Plannings Section */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Veranstaltungsplanung</h1>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Neue Planung
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plannings.map((planning) => (
            <Card
              key={planning.id}
              className="cursor-pointer hover:shadow-md transition-shadow relative"
              onClick={() => setSelectedPlanning(planning)}
            >
              <NewItemIndicator isVisible={isItemNew(planning.id, planning.created_at)} />
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{planning.title}</span>
                  {planning.is_private && (
                    <Badge variant="outline" className="ml-2">
                      Privat
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {planning.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {planning.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between">
                  <Badge variant={planning.confirmed_date ? "default" : "secondary"}>
                    {planning.confirmed_date ? "Bestätigt" : "In Planung"}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(planning.created_at), "dd.MM.yyyy", { locale: de })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Separator */}
        <div className="flex items-center my-8">
          <Separator className="flex-1" />
          <div className="px-4 text-muted-foreground text-sm font-medium">
            Terminvorbereitungen
          </div>
          <Separator className="flex-1" />
        </div>

        {/* Appointment Preparations Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Terminvorbereitungen</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {appointmentPreparations.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Keine Terminvorbereitungen vorhanden
              </div>
            ) : (
              appointmentPreparations.map((preparation) => (
                <Card 
                  key={preparation.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow relative"
                  onClick={() => handlePreparationClick(preparation)}
                >
                  <NewItemIndicator isVisible={isItemNew(preparation.id, preparation.created_at)} />
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate font-medium relative">{preparation.title}</span>
                      <Badge 
                        variant={preparation.status === 'completed' ? 'default' : 
                               preparation.status === 'in_progress' ? 'secondary' : 'outline'}
                      >
                        {preparation.status === 'completed' ? 'Abgeschlossen' :
                         preparation.status === 'in_progress' ? 'In Bearbeitung' : 'Entwurf'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {preparation.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {preparation.notes}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Erstellt am {format(new Date(preparation.created_at), "dd.MM.yyyy", { locale: de })}
                    </p>
                    {preparation.updated_at !== preparation.created_at && (
                      <p className="text-xs text-muted-foreground">
                        Zuletzt bearbeitet am {format(new Date(preparation.updated_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Appointment Preparation Sidebar */}
      {selectedPreparation && (
        <AppointmentPreparationSidebar
          appointmentId={selectedPreparation.appointment_id || null}
          appointmentTitle={selectedPreparation.title}
          appointmentDate={selectedPreparation.created_at}
          isOpen={!!selectedPreparation}
          onClose={() => setSelectedPreparation(null)}
        />
      )}
    </div>
  );
}