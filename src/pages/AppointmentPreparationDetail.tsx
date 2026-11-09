import { useBriefingEditorView } from "@/features/appointments/briefing/useBriefingEditorView";
import { briefingDepthLabel } from "@/features/appointments/briefing/briefingModel";
import { CompactBriefingEditor } from "@/features/appointments/briefing/CompactBriefingEditor";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useAppointmentBriefing } from "@/features/appointments/briefing/useBriefing";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, ExternalLink, Notebook, Download, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppointmentPreparation } from "@/hooks/useAppointmentPreparation";
import { AppointmentPreparationFileUpload } from "@/components/appointments/AppointmentPreparationFileUpload";
import { AppointmentDetailsSidebar } from "@/components/calendar/AppointmentDetailsSidebar";
import { AppointmentBriefingView } from "@/components/appointment-preparations/AppointmentBriefingView";
import { PhaseSidebar } from "@/components/appointment-preparations/workflow/PhaseSidebar";
import { PhaseStepper } from "@/components/appointment-preparations/workflow/PhaseStepper";
import { PhaseContent } from "@/components/appointment-preparations/workflow/PhaseContent";
import { LiveBriefingPane } from "@/components/appointment-preparations/workflow/LiveBriefingPane";
import { AutosaveIndicator } from "@/components/appointment-preparations/workflow/AutosaveIndicator";
import { KeyboardShortcutsHelp } from "@/components/appointment-preparations/workflow/KeyboardShortcutsHelp";
import { useAppointmentPreparationShortcuts } from "@/hooks/useAppointmentPreparationShortcuts";
import { usePhaseStatus, type PhaseId } from "@/components/appointment-preparations/workflow/usePhaseStatus";
import { supabase } from "@/integrations/supabase/client";
import { generateBriefingPdf } from "@/components/appointment-preparations/briefingPdfGenerator";
import { useAuth } from "@/hooks/useAuth";
import { debugConsole } from "@/utils/debugConsole";
import { useTenant } from "@/hooks/useTenant";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notify } from "@/lib/notify";
import { toast } from "@/hooks/use-toast";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useResolvedUserRole();
  const view = searchParams.get("view");
  const { getView, rememberView } = useBriefingEditorView();
  const setEditingDepth = (depth: "compact" | "full") => {
    if (preparationId) rememberView(preparationId, depth);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("view", "preparation");
      next.set("depth", depth);
      return next;
    });
  };
  const briefingMode = view === "briefing" || (view !== "preparation" && role === "abgeordneter");
  const setView = (view: "preparation" | "briefing") => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set("view", view);
      return next;
    });
  };
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [selectedPhase, setSelectedPhase] = useState<PhaseId | null>(null);
  const creationStarted = useRef<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [appointmentInfo, setAppointmentInfo] = useState<AppointmentPreparationAppointmentDetails | null>(null);
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
    updatePreparation,
    saveStatus,
    lastSavedAt,
  } = useAppointmentPreparation(preparationId);
  const { data: briefingAssignment, isPending: assignmentPending } = useAppointmentBriefing(preparation?.appointment_id ?? undefined);
  const urlDepth = searchParams.get("depth");
  const editingDepth = urlDepth === "compact" || urlDepth === "full"
    ? urlDepth
    : getView(preparationId) ?? briefingAssignment?.briefing_depth ?? "full";
  const compactEditing = editingDepth === "compact";

  const [focusMode, setFocusMode] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

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
      if (!preparationId && appointmentId && !isCreating && user && currentTenant) {
        if (creationStarted.current === appointmentId) return;
        creationStarted.current = appointmentId;
        setIsCreating(true);
        try {
          const { data: existing, error: lookupError } = await supabase.from('appointment_preparations').select('id').eq('appointment_id', appointmentId).eq('is_archived', false).order('created_at').limit(1).maybeSingle();
          if (lookupError) throw lookupError;
          if (existing) { navigate(`/appointment-preparation/${existing.id}`, { replace: true }); return; }
          const { data: appointment, error: appointmentError } = await supabase.from('appointments').select('title').eq('id', appointmentId).single();
          if (appointmentError) throw appointmentError;
          const resolvedTitle = title || appointment.title;
          const { data, error } = await supabase
            .from('appointment_preparations')
            .insert([{
              title: `Terminplanung: ${resolvedTitle}`,
              appointment_id: appointmentId,
              tenant_id: currentTenant.id,
              created_by: user.id,
              status: 'draft',
              preparation_data: {
                contact_name: resolvedTitle.includes('@') ? resolvedTitle : '',
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
          setCreationError('Terminvorbereitung konnte nicht geöffnet oder angelegt werden.');
          debugConsole.error('Error creating preparation:', error);
          notify.error("Fehler", {
            description: "Terminplanung konnte nicht erstellt werden."
});
        } finally {
          setIsCreating(false);
        }
      }
    };
    createNewPreparation();
  }, [preparationId, appointmentId, title, date, time, location, isCreating, user, currentTenant, navigate, toast]);

  if (creationError) return <div className="p-6"><p>{creationError}</p><Button onClick={() => navigate(-1)}>Zurück</Button></div>;

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
                        notify.error("Fehler", { description: "PDF konnte nicht erstellt werden."
});
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
                <div className="flex flex-col items-end gap-0.5">
                  <AutosaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    Zuletzt bearbeitet: {new Date(preparation.updated_at).toLocaleString('de-DE')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {preparation.appointment_id && <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium">Beauftragtes Briefing: {assignmentPending ? "Wird geladen…" : briefingAssignment?.briefing_status === "none" ? "Kein Briefing beauftragt" : briefingAssignment?.briefing_status === "undecided" ? "Noch nicht beauftragt" : briefingDepthLabel(briefingAssignment?.briefing_depth)}</p>
          {briefingAssignment?.briefing_instructions && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">Auftrag: {briefingAssignment.briefing_instructions}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Kurz- und Langansicht sind deine persönliche Bearbeitungsansicht. Ein Wechsel ändert den Auftrag nicht.</p>
        </div>}

        {/* Workflow Workspace */}
        {briefingMode ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="section-label text-muted-foreground">Briefing-Ansicht</p>
              <Button variant="ghost" size="sm" onClick={() => setView("preparation")}>
                Zur Vorbereitung
              </Button>
            </div>
            <AppointmentBriefingView
              preparation={preparation}
              appointmentInfo={appointmentInfo ? {
                title: appointmentInfo.title,
                start_time: appointmentInfo.start_time,
                end_time: appointmentInfo.end_time,
                location: appointmentInfo.location ?? null,
              } : null}
            />
          </div>
        ) : assignmentPending && preparation.appointment_id && urlDepth !== "compact" && urlDepth !== "full" && !getView(preparationId) ? (
          <p className="py-6 text-sm text-muted-foreground" role="status">Briefing-Ansicht wird geladen…</p>
        ) : compactEditing && preparation.appointment_id ? (
          <CompactBriefingEditor
            open
            embedded
            appointmentId={preparation.appointment_id}
            preparationId={preparation.id}
            title={appointmentInfo?.title ?? preparation.title}
            onOpenChange={() => {}}
            onSaved={() => updatePreparation({})}
            onShowFull={() => setEditingDepth("full")}
          />
        ) : (
          <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Terminvorbereitung</h2>
            <div className="inline-flex rounded-md border p-1" role="group" aria-label="Briefing-Ansicht">
              <Button size="sm" variant="ghost" aria-pressed={false} disabled={saveStatus === "saving" || !preparation.appointment_id} onClick={() => setEditingDepth("compact")}>Kurzbriefing</Button>
              <Button size="sm" variant="default" aria-pressed={true}>Langbriefing</Button>
            </div>
          </div>
          <WorkflowWorkspace
            preparation={preparation}
            appointmentInfo={appointmentInfo}
            updatePreparation={updatePreparation}
            onOpenAppointmentDetails={() => setShowAppointmentSidebar(true)}
            selectedPhase={selectedPhase}
            setSelectedPhase={setSelectedPhase}
            onShowBriefing={() => setView("briefing")}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode((v) => !v)}
            onShowShortcutsHelp={() => setShortcutsHelpOpen(true)}
          />
          </>
        )}
        <KeyboardShortcutsHelp open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen} />
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

interface WorkflowWorkspaceProps {
  preparation: NonNullable<ReturnType<typeof useAppointmentPreparation>['preparation']>;
  appointmentInfo: AppointmentPreparationAppointmentDetails | null;
  updatePreparation: (updates: Parameters<ReturnType<typeof useAppointmentPreparation>['updatePreparation']>[0]) => Promise<void>;
  onOpenAppointmentDetails: () => void;
  selectedPhase: PhaseId | null;
  setSelectedPhase: (id: PhaseId | null) => void;
  onShowBriefing: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  onShowShortcutsHelp: () => void;
}

function WorkflowWorkspace({
  preparation,
  appointmentInfo,
  updatePreparation,
  onOpenAppointmentDetails,
  selectedPhase,
  setSelectedPhase,
  onShowBriefing,
  focusMode,
  onToggleFocus,
  onShowShortcutsHelp,
}: WorkflowWorkspaceProps) {
  const { data: briefing } = useAppointmentBriefing(preparation.appointment_id ?? undefined);
  const { phases, activePhase, blockers } = usePhaseStatus(preparation, selectedPhase, briefing?.briefing_status);
  const currentIdx = phases.findIndex((p) => p.id === activePhase);
  const nextPhase = phases[currentIdx + 1];
  const prevPhase = phases[currentIdx - 1];

  useAppointmentPreparationShortcuts({
    onNextPhase: () => nextPhase && setSelectedPhase(nextPhase.id),
    onPrevPhase: () => prevPhase && setSelectedPhase(prevPhase.id),
    onToggleFocus,
    onOpenBriefing: onShowBriefing,
    onShowHelp: onShowShortcutsHelp,
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-4 border-b pb-3">
        <div className="flex-1 min-w-0">
          <PhaseStepper phases={phases} activePhase={activePhase} onSelect={(id) => setSelectedPhase(id)} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={onToggleFocus}>
            {focusMode ? "Sidebar einblenden" : "Fokus-Modus"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onShowShortcutsHelp} aria-label="Tastenkürzel">
            ?
          </Button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${focusMode ? 'lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]' : 'lg:grid-cols-[minmax(0,1.8fr)_minmax(0,7.2fr)_minmax(0,3fr)]'}`}>
        {!focusMode && (
          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <PhaseSidebar
              phases={phases}
              activePhase={activePhase}
              onSelect={(id) => setSelectedPhase(id)}
              blockers={blockers}
            />
          </div>
        )}

        <div className="min-w-0">
          <PhaseContent
            phase={activePhase}
            preparation={preparation}
            appointmentDetails={appointmentInfo}
            onUpdate={updatePreparation}
            onOpenAppointmentDetails={onOpenAppointmentDetails}
          />
          {nextPhase && (
            <div className="mt-6 flex justify-end">
              <Button variant="default" size="sm" onClick={() => setSelectedPhase(nextPhase.id)}>
                Weiter zur nächsten Phase
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="hidden min-w-0 lg:block lg:sticky lg:top-4 lg:self-start">
          <LiveBriefingPane
            preparation={preparation}
            appointmentInfo={appointmentInfo ? {
              title: appointmentInfo.title,
              start_time: appointmentInfo.start_time,
              end_time: appointmentInfo.end_time,
              location: appointmentInfo.location ?? null,
            } : null}
          />
          <div className="mt-3 text-right">
            <Button variant="ghost" size="sm" onClick={onShowBriefing}>
              Vollbild-Briefing →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
