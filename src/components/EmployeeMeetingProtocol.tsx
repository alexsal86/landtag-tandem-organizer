import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Save, Check, Lock, Unlock, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmployeeMeetingProtocolProps {
  meetingId: string;
  onBack?: () => void;
}

interface ProtocolData {
  // Befinden & Work-Life-Balance
  wellbeing_mood?: string;
  wellbeing_workload?: string;
  wellbeing_balance?: string;
  
  // Rückblick
  review_successes?: string;
  review_challenges?: string;
  review_learnings?: string;
  
  // Aktuelle Projekte
  projects_status?: string;
  projects_blockers?: string;
  projects_support?: string;
  
  // Entwicklung
  development_skills?: string;
  development_training?: string;
  development_career?: string;
  
  // Team & Zusammenarbeit
  team_dynamics?: string;
  team_communication?: string;
  
  // Zielvereinbarungen
  goals?: string;
  
  // Feedback
  feedback_mutual?: string;
  
  // Nächste Schritte
  next_steps?: string;
}

interface ActionItem {
  id?: string;
  description: string;
  owner: string;
  assigned_to?: string;
  due_date?: string;
  status: string;
  notes?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  meeting_id?: string;
  tenant_id?: string;
}

export function EmployeeMeetingProtocol({ meetingId, onBack }: EmployeeMeetingProtocolProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meeting, setMeeting] = useState<any>(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  
  // Protocol data
  const [protocolData, setProtocolData] = useState<ProtocolData>({});
  const [employeePrep, setEmployeePrep] = useState<any>({});
  const [supervisorPrep, setSupervisorPrep] = useState<any>({});
  const [privateNotes, setPrivateNotes] = useState("");
  const [sharedDuringMeeting, setSharedDuringMeeting] = useState(false);
  
  // Action items
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newActionItem, setNewActionItem] = useState<ActionItem>({
    description: "",
    owner: "employee",
    status: "open",
  });

  // Load meeting data
  useEffect(() => {
    if (!meetingId || !user) return;
    loadMeetingData();
  }, [meetingId, user]);

  const loadMeetingData = async () => {
    try {
      setLoading(true);

      // Load meeting
      const { data: meetingData, error: meetingError } = await supabase
        .from("employee_meetings")
        .select("*, employee:profiles!employee_id(display_name), supervisor:profiles!conducted_by(display_name)")
        .eq("id", meetingId)
        .single();

      if (meetingError) throw meetingError;

      setMeeting(meetingData);
      setIsEmployee(meetingData.employee_id === user.id);
      setIsSupervisor(meetingData.conducted_by === user.id);
      
      // Load protocol data
      if (meetingData.protocol_data) {
        setProtocolData(meetingData.protocol_data as ProtocolData);
      }

      // Load preparation data
      if (meetingData.employee_preparation) {
        const empPrep = meetingData.employee_preparation as any;
        setEmployeePrep(empPrep);
        if (user.id === meetingData.employee_id && empPrep?.private_notes) {
          setPrivateNotes(empPrep.private_notes);
        }
      }
      if (meetingData.supervisor_preparation) {
        const supPrep = meetingData.supervisor_preparation as any;
        setSupervisorPrep(supPrep);
        if (user.id === meetingData.conducted_by && supPrep?.private_notes) {
          setPrivateNotes(supPrep.private_notes);
        }
      }
      setSharedDuringMeeting(meetingData.shared_during_meeting || false);

      // Load action items
      const { data: actionData, error: actionError } = await supabase
        .from("employee_meeting_action_items")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });

      if (actionError) throw actionError;
      setActionItems((actionData || []) as ActionItem[]);

    } catch (error: any) {
      console.error("Error loading meeting:", error);
      toast({
        title: "Fehler",
        description: "Besprechungsdaten konnten nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!meeting || meeting.status === 'completed') return;
    
    const interval = setInterval(() => {
      saveProtocol(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [protocolData, privateNotes, meeting]);

  const saveProtocol = async (isAutoSave = false) => {
    if (!meeting || !user) return;

    setSaving(true);
    try {
      const updates: any = { protocol_data: protocolData };

      // Update preparation with private notes
      if (isEmployee) {
        updates.employee_preparation = {
          ...employeePrep,
          private_notes: privateNotes,
        };
      } else if (isSupervisor) {
        updates.supervisor_preparation = {
          ...supervisorPrep,
          private_notes: privateNotes,
        };
      }

      const { error } = await supabase
        .from("employee_meetings")
        .update(updates)
        .eq("id", meetingId);

      if (error) throw error;

      if (!isAutoSave) {
        toast({
          title: "Gespeichert",
          description: "Protokoll wurde gespeichert",
        });
      }
    } catch (error: any) {
      console.error("Error saving protocol:", error);
      if (!isAutoSave) {
        toast({
          title: "Fehler",
          description: "Protokoll konnte nicht gespeichert werden",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const sharePreparation = async () => {
    if (!meeting) return;

    try {
      const { error } = await supabase
        .from("employee_meetings")
        .update({ shared_during_meeting: true })
        .eq("id", meetingId);

      if (error) throw error;

      setSharedDuringMeeting(true);
      toast({
        title: "Vorbereitung geteilt",
        description: "Beide Parteien können jetzt die Vorbereitungen sehen",
      });
    } catch (error: any) {
      console.error("Error sharing preparation:", error);
      toast({
        title: "Fehler",
        description: "Vorbereitung konnte nicht geteilt werden",
        variant: "destructive",
      });
    }
  };

  const markAsCompleted = async () => {
    if (!meeting) return;

    try {
      const { error } = await supabase
        .from("employee_meetings")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", meetingId);

      if (error) throw error;

      toast({
        title: "Abgeschlossen",
        description: "Gespräch wurde als abgeschlossen markiert",
      });

      loadMeetingData();
    } catch (error: any) {
      console.error("Error completing meeting:", error);
      toast({
        title: "Fehler",
        description: "Status konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const addActionItem = async () => {
    if (!newActionItem.description.trim() || !currentTenant) return;

    try {
      const { data, error } = await supabase
        .from("employee_meeting_action_items")
        .insert({
          meeting_id: meetingId,
          tenant_id: currentTenant.id,
          description: newActionItem.description,
          owner: newActionItem.owner,
          assigned_to: newActionItem.assigned_to || (isEmployee ? meeting.employee_id : meeting.conducted_by),
          due_date: newActionItem.due_date,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      setActionItems([data as ActionItem, ...actionItems]);
      setNewActionItem({
        description: "",
        owner: "employee",
        status: "open",
      });

      toast({
        title: "Action Item hinzugefügt",
        description: "Neue Maßnahme wurde erfolgreich erstellt",
      });
    } catch (error: any) {
      console.error("Error adding action item:", error);
      toast({
        title: "Fehler",
        description: "Action Item konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
  };

  const updateActionItem = async (itemId: string, updates: Partial<ActionItem>) => {
    try {
      const { error } = await supabase
        .from("employee_meeting_action_items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;

      setActionItems(actionItems.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ));

      toast({
        title: "Aktualisiert",
        description: "Action Item wurde aktualisiert",
      });
    } catch (error: any) {
      console.error("Error updating action item:", error);
      toast({
        title: "Fehler",
        description: "Action Item konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const deleteActionItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("employee_meeting_action_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setActionItems(actionItems.filter(item => item.id !== itemId));

      toast({
        title: "Gelöscht",
        description: "Action Item wurde entfernt",
      });
    } catch (error: any) {
      console.error("Error deleting action item:", error);
      toast({
        title: "Fehler",
        description: "Action Item konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  const updateProtocolField = (field: keyof ProtocolData, value: string) => {
    setProtocolData({ ...protocolData, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Lade Protokoll...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center space-y-4">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium">Gespräch nicht gefunden</h3>
        {onBack && (
          <Button onClick={onBack} variant="outline">
            Zurück
          </Button>
        )}
      </div>
    );
  }

  const isCompleted = meeting.status === 'completed';
  const canEdit = !isCompleted && (isEmployee || isSupervisor);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gesprächsprotokoll</h1>
          <p className="text-muted-foreground">
            {meeting.employee?.display_name || 'Mitarbeiter'} • {format(new Date(meeting.meeting_date), 'PPP', { locale: de })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isCompleted ? "default" : "secondary"}>
            {isCompleted ? (
              <>
                <Lock className="h-3 w-3 mr-1" />
                Abgeschlossen
              </>
            ) : (
              <>
                <Unlock className="h-3 w-3 mr-1" />
                In Bearbeitung
              </>
            )}
          </Badge>
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              Zurück
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="preparation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preparation">Vorbereitung</TabsTrigger>
          <TabsTrigger value="protocol">Protokoll</TabsTrigger>
          <TabsTrigger value="actions">Action Items ({actionItems.length})</TabsTrigger>
        </TabsList>

        {/* Tab: Vorbereitung */}
        <TabsContent value="preparation" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Vorbereitung</CardTitle>
                {!sharedDuringMeeting && canEdit && (
                  <Button onClick={sharePreparation} size="sm">
                    <Unlock className="h-4 w-4 mr-2" />
                    Vorbereitung teilen
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Employee preparation */}
              <div>
                <h3 className="font-semibold mb-2">Vorbereitung Mitarbeiter</h3>
                {sharedDuringMeeting || isEmployee ? (
                  <Textarea
                    value={isEmployee ? (employeePrep.notes || "") : (employeePrep.notes || "Keine Vorbereitung")}
                    onChange={(e) => setEmployeePrep({ ...employeePrep, notes: e.target.value })}
                    disabled={!isEmployee || isCompleted}
                    rows={6}
                    placeholder="Notizen zur Vorbereitung..."
                  />
                ) : (
                  <div className="text-sm text-muted-foreground italic p-4 border rounded-md">
                    Vorbereitung noch nicht geteilt
                  </div>
                )}
              </div>

              {/* Supervisor preparation */}
              <div>
                <h3 className="font-semibold mb-2">Vorbereitung Vorgesetzter</h3>
                {sharedDuringMeeting || isSupervisor ? (
                  <Textarea
                    value={isSupervisor ? (supervisorPrep.notes || "") : (supervisorPrep.notes || "Keine Vorbereitung")}
                    onChange={(e) => setSupervisorPrep({ ...supervisorPrep, notes: e.target.value })}
                    disabled={!isSupervisor || isCompleted}
                    rows={6}
                    placeholder="Notizen zur Vorbereitung..."
                  />
                ) : (
                  <div className="text-sm text-muted-foreground italic p-4 border rounded-md">
                    Vorbereitung noch nicht geteilt
                  </div>
                )}
              </div>

              {/* Private notes */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Meine privaten Notizen
                </h3>
                <Textarea
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                  disabled={isCompleted}
                  rows={4}
                  placeholder="Nur für Sie sichtbar..."
                />
              </div>

              {canEdit && (
                <Button onClick={() => saveProtocol(false)} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Speichere..." : "Speichern"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Protokoll */}
        <TabsContent value="protocol" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Strukturiertes Protokoll</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Befinden & Work-Life-Balance */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Befinden & Work-Life-Balance</h3>
                <div className="space-y-3">
                  <div>
                    <Label>Stimmung</Label>
                    <Textarea
                      value={protocolData.wellbeing_mood || ""}
                      onChange={(e) => updateProtocolField("wellbeing_mood", e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Wie geht es Ihnen aktuell?"
                    />
                  </div>
                  <div>
                    <Label>Arbeitsbelastung</Label>
                    <Textarea
                      value={protocolData.wellbeing_workload || ""}
                      onChange={(e) => updateProtocolField("wellbeing_workload", e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Wie empfinden Sie die aktuelle Arbeitsbelastung?"
                    />
                  </div>
                  <div>
                    <Label>Work-Life-Balance</Label>
                    <Textarea
                      value={protocolData.wellbeing_balance || ""}
                      onChange={(e) => updateProtocolField("wellbeing_balance", e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Wie ist Ihre Work-Life-Balance?"
                    />
                  </div>
                </div>
              </div>

              {/* Rückblick */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Rückblick</h3>
                <div className="space-y-3">
                  <div>
                    <Label>Erfolge</Label>
                    <Textarea
                      value={protocolData.review_successes || ""}
                      onChange={(e) => updateProtocolField("review_successes", e.target.value)}
                      disabled={!canEdit}
                      rows={3}
                      placeholder="Was lief besonders gut?"
                    />
                  </div>
                  <div>
                    <Label>Herausforderungen</Label>
                    <Textarea
                      value={protocolData.review_challenges || ""}
                      onChange={(e) => updateProtocolField("review_challenges", e.target.value)}
                      disabled={!canEdit}
                      rows={3}
                      placeholder="Welche Schwierigkeiten gab es?"
                    />
                  </div>
                  <div>
                    <Label>Learnings</Label>
                    <Textarea
                      value={protocolData.review_learnings || ""}
                      onChange={(e) => updateProtocolField("review_learnings", e.target.value)}
                      disabled={!canEdit}
                      rows={3}
                      placeholder="Was haben wir gelernt?"
                    />
                  </div>
                </div>
              </div>

              {/* Aktuelle Projekte */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Aktuelle Projekte</h3>
                <div className="space-y-3">
                  <div>
                    <Label>Status</Label>
                    <Textarea
                      value={protocolData.projects_status || ""}
                      onChange={(e) => updateProtocolField("projects_status", e.target.value)}
                      disabled={!canEdit}
                      rows={3}
                      placeholder="Aktueller Stand der Projekte"
                    />
                  </div>
                  <div>
                    <Label>Blocker</Label>
                    <Textarea
                      value={protocolData.projects_blockers || ""}
                      onChange={(e) => updateProtocolField("projects_blockers", e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Was blockiert den Fortschritt?"
                    />
                  </div>
                  <div>
                    <Label>Benötigte Unterstützung</Label>
                    <Textarea
                      value={protocolData.projects_support || ""}
                      onChange={(e) => updateProtocolField("projects_support", e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Welche Hilfe wird benötigt?"
                    />
                  </div>
                </div>
              </div>

              {/* Entwicklung */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Entwicklung & Karriere</h3>
                <div className="space-y-3">
                  <div>
                    <Label>Skills & Kompetenzen</Label>
                    <Textarea
                      value={protocolData.development_skills || ""}
                      onChange={(e) => updateProtocolField("development_skills", e.target.value)}
                      disabled={!canEdit}
                      rows={3}
                      placeholder="Welche Fähigkeiten sollen entwickelt werden?"
                    />
                  </div>
                  <div>
                    <Label>Weiterbildung</Label>
                    <Textarea
                      value={protocolData.development_training || ""}
                      onChange={(e) => updateProtocolField("development_training", e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Welche Schulungen/Trainings sind geplant?"
                    />
                  </div>
                  <div>
                    <Label>Karriereziele</Label>
                    <Textarea
                      value={protocolData.development_career || ""}
                      onChange={(e) => updateProtocolField("development_career", e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Langfristige Ziele und Perspektiven"
                    />
                  </div>
                </div>
              </div>

              {/* Team & Zusammenarbeit */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Team & Zusammenarbeit</h3>
                <div className="space-y-3">
                  <div>
                    <Label>Team-Dynamik</Label>
                    <Textarea
                      value={protocolData.team_dynamics || ""}
                      onChange={(e) => updateProtocolField("team_dynamics", e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Wie läuft die Zusammenarbeit im Team?"
                    />
                  </div>
                  <div>
                    <Label>Kommunikation</Label>
                    <Textarea
                      value={protocolData.team_communication || ""}
                      onChange={(e) => updateProtocolField("team_communication", e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                      placeholder="Wie ist die Kommunikation?"
                    />
                  </div>
                </div>
              </div>

              {/* Zielvereinbarungen */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Zielvereinbarungen</h3>
                <Textarea
                  value={protocolData.goals || ""}
                  onChange={(e) => updateProtocolField("goals", e.target.value)}
                  disabled={!canEdit}
                  rows={4}
                  placeholder="Konkrete Ziele mit Deadlines und Erfolgskriterien"
                />
              </div>

              {/* Feedback */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Beidseitiges Feedback</h3>
                <Textarea
                  value={protocolData.feedback_mutual || ""}
                  onChange={(e) => updateProtocolField("feedback_mutual", e.target.value)}
                  disabled={!canEdit}
                  rows={4}
                  placeholder="Wechselseitiges Feedback"
                />
              </div>

              {/* Nächste Schritte */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold text-lg">Nächste Schritte</h3>
                <Textarea
                  value={protocolData.next_steps || ""}
                  onChange={(e) => updateProtocolField("next_steps", e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                  placeholder="Was sind die nächsten konkreten Schritte?"
                />
              </div>

              <div className="flex gap-2 pt-4">
                {canEdit && (
                  <>
                    <Button onClick={() => saveProtocol(false)} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Speichere..." : "Speichern"}
                    </Button>
                    {isSupervisor && (
                      <Button onClick={markAsCompleted} variant="default">
                        <Check className="h-4 w-4 mr-2" />
                        Als abgeschlossen markieren
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Action Items */}
        <TabsContent value="actions" className="space-y-4">
          {/* New Action Item Form */}
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle>Neue Maßnahme hinzufügen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Beschreibung</Label>
                  <Textarea
                    value={newActionItem.description}
                    onChange={(e) => setNewActionItem({ ...newActionItem, description: e.target.value })}
                    rows={2}
                    placeholder="Was muss getan werden?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Verantwortlich</Label>
                    <Select
                      value={newActionItem.owner}
                      onValueChange={(value: any) => setNewActionItem({ ...newActionItem, owner: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Mitarbeiter</SelectItem>
                        <SelectItem value="supervisor">Vorgesetzter</SelectItem>
                        <SelectItem value="both">Beide</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fälligkeitsdatum</Label>
                    <Input
                      type="date"
                      value={newActionItem.due_date || ""}
                      onChange={(e) => setNewActionItem({ ...newActionItem, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={addActionItem} disabled={!newActionItem.description.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Hinzufügen
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Action Items List */}
          <div className="space-y-3">
            {actionItems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Noch keine Action Items vorhanden
                </CardContent>
              </Card>
            ) : (
              actionItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.status === 'completed' ? 'default' : 'secondary'}>
                            {item.owner === 'employee' ? 'Mitarbeiter' : item.owner === 'supervisor' ? 'Vorgesetzter' : 'Beide'}
                          </Badge>
                          <Badge variant={item.status === 'completed' ? 'default' : item.status === 'in_progress' ? 'secondary' : 'outline'}>
                            {item.status === 'completed' ? 'Erledigt' : item.status === 'in_progress' ? 'In Arbeit' : 'Offen'}
                          </Badge>
                          {item.due_date && (
                            <span className="text-sm text-muted-foreground">
                              Fällig: {format(new Date(item.due_date), 'dd.MM.yyyy', { locale: de })}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{item.description}</p>
                        {item.notes && (
                          <p className="text-sm text-muted-foreground italic">{item.notes}</p>
                        )}
                        {canEdit && item.status !== 'completed' && (
                          <div className="flex gap-2 mt-2">
                            {item.status === 'open' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateActionItem(item.id!, { status: 'in_progress' })}
                              >
                                In Arbeit
                              </Button>
                            )}
                            {item.status === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateActionItem(item.id!, { status: 'completed', completed_at: new Date().toISOString() })}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Erledigt
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {canEdit && isSupervisor && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteActionItem(item.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
