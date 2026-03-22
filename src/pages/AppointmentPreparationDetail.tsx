import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Edit, FileText, Upload, Calendar, Clock, MapPin, Briefcase } from "lucide-react";
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
import { AppointmentBriefingView } from "@/components/appointment-preparations/AppointmentBriefingView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { debugConsole } from "@/utils/debugConsole";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface AppointmentInfo {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  description?: string | null;
}

export default function AppointmentPreparationDetail() {
  const { id, subId } = useParams();
  const preparationId = id ?? subId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [activeTab, setActiveTab] = useState("preparation");
  const [isCreating, setIsCreating] = useState(false);
  const [appointmentInfo, setAppointmentInfo] = useState<AppointmentInfo | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

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
  } = useAppointmentPreparation(preparationId);

  // Fetch user role to determine default tab
  useEffect(() => {
    if (!user) return;
    const fetchRole = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      const role = data?.role || null;
      setUserRole(role);
      if (role === 'abgeordneter') {
        setActiveTab('briefing');
      }
    };
    fetchRole();
  }, [user]);

  // Fetch linked appointment details
  useEffect(() => {
    const fetchAppointment = async () => {
      const apptId = preparation?.appointment_id;
      if (!apptId) return;
      try {
        const { data } = await supabase
          .from('appointments')
          .select('id, title, start_time, end_time, location, description')
          .eq('id', apptId)
          .single();
        if (data) setAppointmentInfo(data);
      } catch (e) {
        debugConsole.error('Error fetching appointment info:', e);
      }
    };
    fetchAppointment();
  }, [preparation?.appointment_id]);

  // Create new preparation if we have URL parameters but no ID
  useEffect(() => {
    const createNewPreparation = async () => {
      if (!preparationId && appointmentId && title && !isCreating && user && currentTenant) {
        setIsCreating(true);
        try {
          const { data, error } = await supabase
            .from('appointment_preparations')
            .insert([{
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
            }])
            .select()
            .single();

          if (error) throw error;
          navigate(`/appointment-preparation/${data.id}`, { replace: true });
        } catch (error) {
          debugConsole.error('Error creating preparation:', error);
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
  }, [preparationId, appointmentId, title, date, time, location, isCreating, user, currentTenant, navigate, toast]);

  if (loading || isCreating) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
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
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-6">
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

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate("/calendar")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Kalender
          </Button>
        </div>

        {/* Prominent Appointment Info Header */}
        <Card className="bg-card shadow-elegant border-border mb-6 overflow-hidden">
          <div className="bg-primary/5 border-b border-border px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(preparation.status)}
                  <span className="text-xs text-muted-foreground">
                    Erstellt {new Date(preparation.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
                <h1 className="text-2xl font-bold leading-tight truncate">
                  {appointmentInfo?.title ?? preparation.title}
                </h1>
              </div>
              <div className="text-right text-xs text-muted-foreground whitespace-nowrap shrink-0">
                <p>Zuletzt bearbeitet</p>
                <p className="font-medium">{new Date(preparation.updated_at).toLocaleString('de-DE')}</p>
              </div>
            </div>
          </div>

          {appointmentInfo && (
            <CardContent className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
                  <Calendar className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Datum</p>
                    <p className="font-semibold">
                      {format(new Date(appointmentInfo.start_time), 'EEEE, dd. MMMM yyyy', { locale: de })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
                  <Clock className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Uhrzeit</p>
                    <p className="font-semibold">
                      {format(new Date(appointmentInfo.start_time), 'HH:mm', { locale: de })}
                      {' – '}
                      {format(new Date(appointmentInfo.end_time), 'HH:mm', { locale: de })} Uhr
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-3">
                  <MapPin className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ort</p>
                    <p className="font-semibold truncate">
                      {appointmentInfo.location ?? <span className="text-muted-foreground font-normal italic">Kein Ort angegeben</span>}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="briefing" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Briefing
            </TabsTrigger>
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
            <TabsContent value="briefing">
              <AppointmentBriefingView
                preparation={preparation}
                appointmentInfo={appointmentInfo}
              />
            </TabsContent>

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
