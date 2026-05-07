import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, ExternalLink, Notebook, Download, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { AppointmentPreparationFileUpload } from "@/components/appointments/AppointmentPreparationFileUpload";
import { AppointmentDetailsSidebar } from "@/components/calendar/AppointmentDetailsSidebar";
import { AppointmentBriefingView } from "@/components/appointment-preparations/AppointmentBriefingView";
import { PhaseSidebar } from "@/components/appointment-preparations/workflow/PhaseSidebar";
import { PhaseContent } from "@/components/appointment-preparations/workflow/PhaseContent";
import { LiveBriefingPane } from "@/components/appointment-preparations/workflow/LiveBriefingPane";
import { usePhaseStatus, type PhaseId } from "@/components/appointment-preparations/workflow/usePhaseStatus";
import { supabase } from "@/integrations/supabase/client";
import { generateBriefingPdf } from "@/components/appointment-preparations/briefingPdfGenerator";
import { useAuth } from "@/hooks/useAuth";
import { debugConsole } from "@/utils/debugConsole";
import { useTenant } from "@/hooks/useTenant";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface AppointmentPreparationAppointmentDetails {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  meeting_link?: string | null;
  meeting_details?: string | null;
}

export default function AppointmentPreparationDetail() {
  const { id, subId } = useParams();
  const preparationId = id ?? subId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [selectedPhase, setSelectedPhase] = useState<PhaseId | null>(null);
  const [briefingMode, setBriefingMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [appointmentInfo, setAppointmentInfo] = useState<AppointmentPreparationAppointmentDetails | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAppointmentSidebar, setShowAppointmentSidebar] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [responsiblePerson, setResponsiblePerson] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);

  const appointmentId = searchParams.get('appointmentId');
  const title = searchParams.get('title');
  const date = searchParams.get('date');
  const time = searchParams.get('time');
  const location = searchParams.get('location');

  const {
    preparation,
    loading,
    error,
    updatePreparation
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
        setBriefingMode(true);
      }
    };
    fetchRole();
  }, [user]);

  const fetchAppointmentInfo = useCallback(async (appointmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, title, start_time, end_time, location, description, category, priority, status, meeting_link, meeting_details')
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      setAppointmentInfo(data);
    } catch (e) {
      debugConsole.error('Error fetching appointment info:', e);
    }
  }, []);

  // Fetch linked appointment details
  useEffect(() => {
    const apptId = preparation?.appointment_id;

    if (!apptId) {
      setAppointmentInfo(null);
      return;
    }

    fetchAppointmentInfo(apptId);
  }, [fetchAppointmentInfo, preparation?.appointment_id]);

  // Fetch responsible person (created_by)
  useEffect(() => {
    if (!preparation?.created_by) {
      setResponsiblePerson(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', preparation.created_by)
        .maybeSingle();
      setResponsiblePerson(data ?? null);
    })();
  }, [preparation?.created_by]);

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
        <div className="w-full">
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
    if (status === "draft" && !briefingMode) {
      return null;
    }

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
      <div className="w-full">
        {/* Back Button */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate("/eventplanning")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Planungen
          </Button>
        </div>

        {/* Compact Appointment Info Header */}
        <Card className="bg-card shadow-card border-border mb-6 overflow-hidden">
          <div className="px-6 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-primary/10 p-2 text-primary shrink-0">
                    <Notebook className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h1 className="text-xl font-semibold leading-tight truncate">
                        {appointmentInfo?.title ?? preparation.title}
                      </h1>
                      {getStatusBadge(preparation.status)}
                    </div>
                    {appointmentInfo && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(appointmentInfo.start_time), 'EEE, dd. MMM yyyy', { locale: de })}
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(appointmentInfo.start_time), 'HH:mm', { locale: de })}
                          {'–'}
                          {format(new Date(appointmentInfo.end_time), 'HH:mm', { locale: de })}
                        </span>
                        {appointmentInfo.location && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="inline-flex items-center gap-1.5 truncate max-w-xs">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{appointmentInfo.location}</span>
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowAppointmentSidebar(true)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Termindetails
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 lg:items-end shrink-0">
                <div className="flex items-center gap-3">
                  {appointmentInfo && new Date(appointmentInfo.start_time).getTime() > Date.now() && (
                    <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      <Clock className="h-3 w-3" />
                      In {formatDistanceToNow(new Date(appointmentInfo.start_time), { locale: de })}
                    </div>
                  )}
                  {responsiblePerson && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={responsiblePerson.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {(responsiblePerson.display_name ?? '?').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{responsiblePerson.display_name ?? 'Unbekannt'}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pdfLoading}
                    onClick={async () => {
                      setPdfLoading(true);
                      try {
                        await generateBriefingPdf({
                          preparation,
                          appointmentTitle: appointmentInfo?.title,
                          appointmentLocation: appointmentInfo?.location ?? undefined,
                          appointmentStartTime: appointmentInfo?.start_time,
                          appointmentEndTime: appointmentInfo?.end_time,
                        });
                      } catch (e) {
                        toast({ title: "Fehler", description: "PDF konnte nicht erstellt werden.", variant: "destructive" });
                      } finally {
                        setPdfLoading(false);
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {pdfLoading ? "Wird erstellt..." : "PDF"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate(`/briefing-live?preparationId=${preparation.id}${preparation.appointment_id ? `&appointmentId=${preparation.appointment_id}` : ''}`)}
                  >
                    Live-Briefing
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  Zuletzt bearbeitet: {new Date(preparation.updated_at).toLocaleString('de-DE')}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="briefing">Briefing</TabsTrigger>
            <TabsTrigger value="preparation">Vorbereitung</TabsTrigger>
            <TabsTrigger value="checklist">
              Checkliste
              {preparation.checklist_items?.length ? (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({preparation.checklist_items.filter(i => i.completed).length}/{preparation.checklist_items.length})
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
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
                appointmentDetails={appointmentInfo}
                onUpdate={updatePreparation}
                onOpenAppointmentDetails={() => setShowAppointmentSidebar(true)}
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
        {appointmentInfo && (
          <AppointmentDetailsSidebar
            appointment={{
              id: appointmentInfo.id,
              title: appointmentInfo.title,
              description: appointmentInfo.description ?? undefined,
              time: format(new Date(appointmentInfo.start_time), 'HH:mm', { locale: de }),
              duration: Math.round((new Date(appointmentInfo.end_time).getTime() - new Date(appointmentInfo.start_time).getTime()) / (1000 * 60)).toString(),
              date: new Date(appointmentInfo.start_time),
              endTime: new Date(appointmentInfo.end_time),
              location: appointmentInfo.location ?? undefined,
              attendees: 0,
              type: (appointmentInfo.category || 'meeting') as 'deadline' | 'birthday' | 'vacation' | 'meeting' | 'appointment' | 'session' | 'blocked' | 'veranstaltung' | 'vacation_request',
              priority: (appointmentInfo.priority as 'high' | 'low' | 'medium') || 'medium',
              category: { color: '#3b82f6' }
            }}
            open={showAppointmentSidebar}
            onClose={() => setShowAppointmentSidebar(false)}
            onUpdate={() => preparation.appointment_id ? fetchAppointmentInfo(preparation.appointment_id) : Promise.resolve()}
          />
        )}
    </div>
  );
}
