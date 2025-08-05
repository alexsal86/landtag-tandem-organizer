import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Save, Clock, Users, CheckCircle, Circle, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AgendaItem {
  id?: string;
  title: string;
  description?: string;
  assigned_to?: string;
  notes?: string;
  is_completed: boolean;
  is_recurring: boolean;
  task_id?: string;
  order_index: number;
}

interface Meeting {
  id?: string;
  title: string;
  description?: string;
  meeting_date: string | Date;
  status: string;
  template_id?: string;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

export function MeetingsView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [newMeeting, setNewMeeting] = useState<Meeting>({
    title: "",
    description: "",
    meeting_date: new Date(),
    status: "planned"
  });

  // Load data on component mount
  useEffect(() => {
    if (user) {
      loadMeetings();
      loadProfiles();
      loadTasks();
    }
  }, [user]);

  const loadMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      setMeetings((data || []).map(meeting => ({
        ...meeting,
        meeting_date: new Date(meeting.meeting_date)
      })));
    } catch (error) {
      toast({
        title: "Fehler beim Laden der Meetings",
        description: "Die Meetings konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      if (error) throw error;
      
      // Current user first, then others
      const currentUserProfile = data?.find(p => p.user_id === user?.id);
      const otherProfiles = data?.filter(p => p.user_id !== user?.id) || [];
      
      const sortedProfiles = currentUserProfile 
        ? [currentUserProfile, ...otherProfiles]
        : otherProfiles;
        
      setProfiles(sortedProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'todo')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadAgendaItems = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('meeting_agenda_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('order_index');

      if (error) throw error;
      setAgendaItems(data || []);
    } catch (error) {
      toast({
        title: "Fehler beim Laden der Agenda",
        description: "Die Agenda-Punkte konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const createMeeting = async () => {
    if (!user || !newMeeting.title.trim()) return;

    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert([{
          ...newMeeting,
          user_id: user.id,
          meeting_date: format(newMeeting.meeting_date, 'yyyy-MM-dd')
        }])
        .select()
        .single();

      if (error) throw error;

      setMeetings([{...data, meeting_date: new Date(data.meeting_date)}, ...meetings]);
      setIsNewMeetingOpen(false);
      setNewMeeting({
        title: "",
        description: "",
        meeting_date: new Date(),
        status: "planned"
      });

      toast({
        title: "Meeting erstellt",
        description: "Das Meeting wurde erfolgreich erstellt.",
      });
    } catch (error) {
      toast({
        title: "Fehler beim Erstellen",
        description: "Das Meeting konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const addAgendaItem = () => {
    if (!selectedMeeting?.id) return;
    
    const newItem: AgendaItem = {
      title: "",
      description: "",
      assigned_to: "unassigned",
      notes: "",
      is_completed: false,
      is_recurring: false,
      order_index: agendaItems.length
    };
    
    setAgendaItems([...agendaItems, newItem]);
  };

  const updateAgendaItem = (index: number, field: keyof AgendaItem, value: any) => {
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    setAgendaItems(updated);
  };

  const saveAgendaItems = async () => {
    if (!selectedMeeting?.id) return;

    try {
      // Delete existing items
      await supabase
        .from('meeting_agenda_items')
        .delete()
        .eq('meeting_id', selectedMeeting.id);

      // Insert new items
      const itemsToInsert = agendaItems
        .filter(item => item.title.trim())
        .map(item => ({
          meeting_id: selectedMeeting.id,
          title: item.title,
          description: item.description,
          assigned_to: item.assigned_to === "unassigned" ? null : item.assigned_to,
          notes: item.notes,
          is_completed: item.is_completed,
          is_recurring: item.is_recurring,
          task_id: item.task_id,
          order_index: item.order_index
        }));

      if (itemsToInsert.length > 0) {
        const { error } = await supabase
          .from('meeting_agenda_items')
          .insert(itemsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Agenda gespeichert",
        description: "Die Agenda wurde erfolgreich gespeichert.",
      });
    } catch (error) {
      toast({
        title: "Fehler beim Speichern",
        description: "Die Agenda konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const addTaskToAgenda = (task: any) => {
    const newItem: AgendaItem = {
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to || "unassigned",
      notes: "",
      is_completed: false,
      is_recurring: false,
      task_id: task.id,
      order_index: agendaItems.length
    };
    
    setAgendaItems([...agendaItems, newItem]);
  };

  const getDisplayName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.display_name || 'Unbekannt';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Meeting Agenda</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre wöchentlichen Besprechungen und Agenda-Punkte
          </p>
        </div>
        <Dialog open={isNewMeetingOpen} onOpenChange={setIsNewMeetingOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neues Meeting
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Meeting erstellen</DialogTitle>
              <DialogDescription>
                Erstellen Sie ein neues Meeting mit Agenda
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Titel</label>
                <Input
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  placeholder="Meeting Titel"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Beschreibung</label>
                <Textarea
                  value={newMeeting.description || ''}
                  onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                  placeholder="Meeting Beschreibung"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Datum</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(newMeeting.meeting_date, "PPP", { locale: de })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newMeeting.meeting_date instanceof Date ? newMeeting.meeting_date : new Date(newMeeting.meeting_date)}
                      onSelect={(date) => date && setNewMeeting({ ...newMeeting, meeting_date: date })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsNewMeetingOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={createMeeting}>
                  Meeting erstellen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Meetings List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Meetings</h2>
          {meetings.map((meeting) => (
            <Card 
              key={meeting.id} 
              className={cn(
                "cursor-pointer transition-colors",
                selectedMeeting?.id === meeting.id && "ring-2 ring-primary"
              )}
              onClick={() => {
                setSelectedMeeting(meeting);
                if (meeting.id) loadAgendaItems(meeting.id);
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{meeting.title}</CardTitle>
                <CardDescription>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(meeting.meeting_date), "PPP", { locale: de })}
                  </div>
                </CardDescription>
              </CardHeader>
              {meeting.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{meeting.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Agenda Editor */}
        <div className="lg:col-span-2 space-y-4">
          {selectedMeeting ? (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  Agenda: {selectedMeeting.title}
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={addAgendaItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Punkt hinzufügen
                  </Button>
                  <Button onClick={saveAgendaItems}>
                    <Save className="h-4 w-4 mr-2" />
                    Speichern
                  </Button>
                </div>
              </div>

              {/* Task Integration */}
              {tasks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Aufgaben hinzufügen</CardTitle>
                    <CardDescription>
                      Offene Aufgaben zur Agenda hinzufügen
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {tasks.slice(0, 6).map((task) => (
                        <Button
                          key={task.id}
                          variant="outline"
                          size="sm"
                          onClick={() => addTaskToAgenda(task)}
                          className="justify-start h-auto p-2"
                        >
                          <div className="text-left">
                            <div className="font-medium truncate">{task.title}</div>
                            <div className="text-xs text-muted-foreground">
                              <Badge variant="secondary" className="text-xs">
                                {task.priority}
                              </Badge>
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Agenda Items */}
              <div className="space-y-3">
                {agendaItems.map((item, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={item.is_completed}
                              onCheckedChange={(checked) => 
                                updateAgendaItem(index, 'is_completed', !!checked)
                              }
                            />
                            <Input
                              value={item.title}
                              onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                              placeholder="Agenda-Punkt Titel"
                              className="font-medium"
                            />
                          </div>

                          <Textarea
                            value={item.description || ''}
                            onChange={(e) => updateAgendaItem(index, 'description', e.target.value)}
                            placeholder="Beschreibung"
                            className="min-h-[60px]"
                          />

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-sm font-medium">Zugewiesen an</label>
                              <Select
                                value={item.assigned_to || "unassigned"}
                                onValueChange={(value) => updateAgendaItem(index, 'assigned_to', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Benutzer auswählen" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Niemand zugewiesen</SelectItem>
                                  {profiles.map((profile) => (
                                    <SelectItem key={profile.user_id} value={profile.user_id}>
                                      {getDisplayName(profile.user_id)}
                                      {profile.user_id === user?.id && " (Sie)"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center gap-4 pt-6">
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={item.is_recurring}
                                  onCheckedChange={(checked) => 
                                    updateAgendaItem(index, 'is_recurring', !!checked)
                                  }
                                />
                                Wiederkehrend
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium">Notizen</label>
                            <Textarea
                              value={item.notes || ''}
                              onChange={(e) => updateAgendaItem(index, 'notes', e.target.value)}
                              placeholder="Notizen und Hinweise"
                              className="min-h-[80px]"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {agendaItems.length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">Keine Agenda-Punkte</h3>
                      <p className="text-muted-foreground mb-4">
                        Fügen Sie Punkte zur Agenda hinzu oder importieren Sie Aufgaben
                      </p>
                      <Button onClick={addAgendaItem}>
                        <Plus className="h-4 w-4 mr-2" />
                        Ersten Punkt hinzufügen
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Kein Meeting ausgewählt</h3>
                <p className="text-muted-foreground">
                  Wählen Sie ein Meeting aus der Liste links aus, um die Agenda zu bearbeiten
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}