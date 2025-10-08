import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Edit, FileText, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { AppointmentPreparationDataTab } from "@/components/appointment-preparations/AppointmentPreparationDataTab";
import { AppointmentPreparationChecklistTab } from "@/components/appointment-preparations/AppointmentPreparationChecklistTab";
import { AppointmentPreparationDetailsTab } from "@/components/appointment-preparations/AppointmentPreparationDetailsTab";
import { AppointmentPreparationFileUpload } from "@/components/appointments/AppointmentPreparationFileUpload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

export default function AppointmentPreparationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState("preparation"); // Changed default from "overview"
  const [isCreating, setIsCreating] = useState(false);

  // Check if we have URL parameters for creating a new preparation
  const appointmentId = searchParams.get('appointmentId');
  const title = searchParams.get('title');
  const date = searchParams.get('date');
  const time = searchParams.get('time');
  const location = searchParams.get('location');

  const {
    preparation,
    loading,
    error,
    updatePreparation,
    archivePreparation
  } = useAppointmentPreparation(id);

  // Create new preparation if we have URL parameters but no ID
  useEffect(() => {
    const createNewPreparation = async () => {
      if (!id && appointmentId && title && !isCreating && user && currentTenant) {
        setIsCreating(true);
        try {
          const { data, error } = await supabase
            .from('appointment_preparations')
            .insert({
              title: `Terminplanung: ${title}`,
              appointment_id: appointmentId,
              tenant_id: currentTenant.id,
              created_by: user.id,
              status: 'draft',
              preparation_data: {
                contact_name: title.includes('@') ? title : '',
                event_type: 'Termin',
                ...(location && { contact_info: location }),
                ...(date && time && { 
                  notes: `Geplant für ${new Date(date).toLocaleDateString('de-DE')} um ${time}` 
                })
              },
              checklist_items: [
                { id: crypto.randomUUID(), label: 'Agenda vorbereiten', completed: false },
                { id: crypto.randomUUID(), label: 'Unterlagen zusammenstellen', completed: false },
                { id: crypto.randomUUID(), label: 'Teilnehmer informieren', completed: false },
                { id: crypto.randomUUID(), label: 'Technische Ausstattung prüfen', completed: false }
              ]
            })
            .select()
            .single();

          if (error) throw error;

          // Redirect to the new preparation
          navigate(`/appointment-preparation/${data.id}`, { replace: true });
        } catch (error) {
          console.error('Error creating preparation:', error);
          toast({
            title: "Fehler",
            description: "Terminplanung konnte nicht erstellt werden.",
            variant: "destructive",
          });
        } finally {
          setIsCreating(false);
        }
      }
    };

    createNewPreparation();
  }, [id, appointmentId, title, date, time, location, isCreating, user, currentTenant, navigate, toast]);

  if (loading || isCreating) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isCreating ? "Erstelle neue Terminplanung..." : "Terminplanung wird geladen..."}
          </p>
        </div>
      </div>
    );
  }

  if (error || !preparation) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6">
        <div className="max-w-6xl mx-auto">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <Card className="bg-card shadow-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold mb-2">Terminplanung nicht gefunden</h3>
              <p className="text-muted-foreground">{error || "Die angeforderte Terminplanung existiert nicht."}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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

  const handleArchive = async () => {
    try {
      await archivePreparation();
      toast({
        title: "Archiviert",
        description: "Terminplanung wurde erfolgreich archiviert.",
      });
      navigate("/calendar");
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Terminplanung konnte nicht archiviert werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate("/calendar")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Kalender
          </Button>
        </div>

        {/* Title Card */}
        <Card className="bg-card shadow-elegant border-border mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{preparation.title}</CardTitle>
                <div className="flex gap-2 items-center">
                  {getStatusBadge(preparation.status)}
                  <span className="text-sm text-muted-foreground">
                    Erstellt am {new Date(preparation.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Zuletzt bearbeitet:</p>
                <p>{new Date(preparation.updated_at).toLocaleString('de-DE')}</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="preparation" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Vorbereitung
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Checkliste
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="dokumente" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Dokumente
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="preparation">
              <AppointmentPreparationDataTab
                preparation={preparation}
                onUpdate={updatePreparation}
              />
            </TabsContent>

            <TabsContent value="checklist">
              <AppointmentPreparationChecklistTab
                preparation={preparation}
                onUpdate={updatePreparation}
              />
            </TabsContent>

            <TabsContent value="details">
              <AppointmentPreparationDetailsTab
                preparation={preparation}
                onUpdate={updatePreparation}
              />
            </TabsContent>

            <TabsContent value="dokumente">
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle>Dokumente</CardTitle>
                </CardHeader>
                <CardContent>
                  <AppointmentPreparationFileUpload
                    preparationId={preparation.id}
                    tenantId={preparation.tenant_id}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}