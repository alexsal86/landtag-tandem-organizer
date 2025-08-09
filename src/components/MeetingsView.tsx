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
import { CalendarIcon, Plus, Save, Clock, Users, CheckCircle, Circle, GripVertical, Trash } from "lucide-react";
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
  assigned_to?: string | null;
  notes?: string | null;
  is_completed: boolean;
  is_recurring: boolean;
  task_id?: string | null;
  order_index: number;
  parent_id?: string | null;
  // lokale Hilfskeys für Hierarchie vor dem Speichern
  localKey?: string;
  parentLocalKey?: string;
}

interface Meeting {
  id?: string;
  user_id?: string;
  title: string;
  description?: string;
  meeting_date: string | Date;
  status: string;
  template_id?: string;
  created_at?: string;
  updated_at?: string;
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
    console.log('=== MeetingsView useEffect triggered ===');
    console.log('User:', user);
    if (user) {
      console.log('Loading meetings data...');
      loadMeetings();
      loadProfiles();
      loadTasks();
    } else {
      console.log('No user found, skipping data load');
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
      const items = (data || []).map((item) => ({
        ...item,
        localKey: item.id,
        parentLocalKey: item.parent_id || undefined,
      }));
      setAgendaItems(items);
    } catch (error) {
      toast({
        title: "Fehler beim Laden der Agenda",
        description: "Die Agenda-Punkte konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };
  const createMeeting = async () => {
    // Visuelles Feedback am Anfang
    toast({
      title: "Meeting wird erstellt...",
      description: "Bitte warten...",
    });

    console.log('=== createMeeting function called ===');
    console.log('User:', user);
    console.log('newMeeting:', newMeeting);
    console.log('Title trimmed:', newMeeting.title.trim());
    
    if (!user) {
      console.log('No user found, returning early');
      toast({
        title: "Fehler",
        description: "Kein Benutzer gefunden!",
        variant: "destructive",
      });
      return;
    }
    
    if (!newMeeting.title.trim()) {
      console.log('No title found, returning early');
      toast({
        title: "Fehler", 
        description: "Bitte geben Sie einen Titel ein!",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Creating meeting with data:', {
        ...newMeeting,
        user_id: user.id,
        meeting_date: format(newMeeting.meeting_date, 'yyyy-MM-dd')
      });

      const insertData = {
        title: newMeeting.title,
        description: newMeeting.description || null,
        meeting_date: format(newMeeting.meeting_date, 'yyyy-MM-dd'),
        status: newMeeting.status,
        user_id: user.id,
        template_id: newMeeting.template_id || null
      };

      console.log('Creating meeting with data:', insertData);

      const { data, error } = await supabase
        .from('meetings')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating meeting:', error);
        throw error;
      }

      console.log('Meeting created successfully:', data);

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
      console.error('Error creating meeting:', error);
      toast({
        title: "Fehler beim Erstellen",
        description: "Das Meeting konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const addAgendaItem = () => {
    if (!selectedMeeting?.id) return;

    const localKey = `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const newItem: AgendaItem = {
      title: "",
      description: "",
      assigned_to: "unassigned",
      notes: "",
      is_completed: false,
      is_recurring: false,
      order_index: agendaItems.length,
      localKey,
    };

    const next = [...agendaItems, newItem].map((it, idx) => ({ ...it, order_index: idx }));
    setAgendaItems(next);
  };

  const updateAgendaItem = (index: number, field: keyof AgendaItem, value: any) => {
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    setAgendaItems(updated);
  };

  const saveAgendaItems = async () => {
    if (!selectedMeeting?.id) return;

    try {
      // Always recompute order_index based on current order
      const ordered = agendaItems
        .filter((i) => i.title.trim())
        .map((it, idx) => ({ ...it, order_index: idx }));

      // Wipe existing items for this meeting
      await supabase.from('meeting_agenda_items').delete().eq('meeting_id', selectedMeeting.id);

      // Split into parents and children
      const parents = ordered.filter((i) => !i.parentLocalKey);
      const children = ordered.filter((i) => i.parentLocalKey);

      // Insert parents first and capture returned ids in same order
      const parentInserts = parents.map((p) => ({
        meeting_id: selectedMeeting.id,
        title: p.title,
        description: p.description,
        assigned_to: p.assigned_to === 'unassigned' ? null : p.assigned_to || null,
        notes: p.notes || null,
        is_completed: p.is_completed,
        is_recurring: p.is_recurring,
        task_id: p.task_id || null,
        order_index: p.order_index,
      }));

      let parentIdByLocalKey: Record<string, string> = {};
      if (parentInserts.length > 0) {
        const { data: insertedParents, error: insErr } = await supabase
          .from('meeting_agenda_items')
          .insert(parentInserts)
          .select();
        if (insErr) throw insErr;
        insertedParents?.forEach((row, idx) => {
          const localKey = parents[idx].localKey || `${parents[idx].title}-${parents[idx].order_index}`;
          parentIdByLocalKey[localKey] = row.id;
        });
      }

      // Insert children with mapped parent_id
      if (children.length > 0) {
        const childInserts = children.map((c) => ({
          meeting_id: selectedMeeting.id,
          title: c.title,
          description: c.description,
          assigned_to: c.assigned_to === 'unassigned' ? null : c.assigned_to || null,
          notes: c.notes || null,
          is_completed: c.is_completed,
          is_recurring: c.is_recurring,
          task_id: c.task_id || null,
          order_index: c.order_index,
          parent_id: c.parentLocalKey ? parentIdByLocalKey[c.parentLocalKey] || null : null,
        }));
        const { error: childErr } = await supabase.from('meeting_agenda_items').insert(childInserts);
        if (childErr) throw childErr;
      }

      toast({ title: 'Agenda gespeichert', description: 'Die Agenda wurde erfolgreich gespeichert.' });
    } catch (error) {
      toast({
        title: 'Fehler beim Speichern',
        description: 'Die Agenda konnte nicht gespeichert werden.',
        variant: 'destructive',
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

  // Vordefinierte Unterpunkte für bestimmte Hauptpunkte
  const SUBPOINT_OPTIONS: Record<string, string[]> = {
    'Aktuelles aus dem Landtag': [
      'Rückblick auf vergangene Plenarsitzungen, Ausschusssitzungen, Fraktionssitzungen',
      'Wichtige Beschlüsse, Gesetze, Debatten',
      'Anstehende Termine und Fraktionspositionen',
      'Offene Punkte, bei denen Handlungsbedarf besteht',
    ],
    'Politische Schwerpunktthemen & Projekte': [
      'Laufende politische Initiativen (z. B. Gesetzesvorhaben, Anträge, Kleine Anfragen)',
      'Vorbereitung auf anstehende Reden, Stellungnahmen, Medienbeiträge',
      'Strategische Planung zu Kernthemen des Abgeordneten',
      'Recherche- und Hintergrundaufträge an Mitarbeiter',
    ],
    'Wahlkreisarbeit': [
      'Aktuelle Anliegen aus dem Wahlkreis (Bürgeranfragen, Vereine, Unternehmen, Kommunen)',
      'Geplante Wahlkreisbesuche und Gesprächstermine',
      'Veranstaltungen im Wahlkreis (Planung, Teilnahme, Redeinhalte)',
      'Presse- und Öffentlichkeitsarbeit vor Ort',
    ],
    'Kommunikation & Öffentlichkeitsarbeit': [
      'Social Media: Planung und Freigabe von Beiträgen, Abstimmung von Inhalten',
      'Pressearbeit: Pressemeldungen, Interviews, Pressegespräche',
      'Newsletter, Website-Updates',
      'Abstimmung mit Fraktions-Pressestelle',
    ],
    'Organisation & Bürointerna': [
      'Aufgabenverteilung im Team',
      'Rückmeldung zu laufenden Projekten und Deadlines',
      'Büroorganisation, Urlaubsplanung, Vertretungsregelungen',
      'Technische und administrative Fragen',
    ],
  };

  const makeLocalKey = () => `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  const addSubItem = (parent: AgendaItem, title: string) => {
    if (!selectedMeeting?.id) return;
    const parentKey = parent.localKey || parent.id || makeLocalKey();
    // Count existing children
    const parentIndex = agendaItems.findIndex((i) => (i.localKey || i.id) === parentKey);
    const childCount = agendaItems.filter((i) => i.parentLocalKey === parentKey).length;
    const insertIndex = parentIndex + childCount + 1;

    const newChild: AgendaItem = {
      title: title || '',
      description: '',
      assigned_to: 'unassigned',
      notes: '',
      is_completed: false,
      is_recurring: false,
      order_index: insertIndex,
      localKey: makeLocalKey(),
      parentLocalKey: parentKey,
    };

    const next = [
      ...agendaItems.slice(0, insertIndex),
      newChild,
      ...agendaItems.slice(insertIndex),
    ].map((it, idx) => ({ ...it, order_index: idx }));

    setAgendaItems(next);
  };

  const deleteAgendaItem = async (item: AgendaItem, index: number) => {
    if (!selectedMeeting?.id) return;

    try {
      // If item has an ID, delete from Supabase
      if (item.id) {
        const { error } = await supabase
          .from('meeting_agenda_items')
          .delete()
          .eq('id', item.id);

        if (error) throw error;

        toast({
          title: "Punkt gelöscht",
          description: "Der Agenda-Punkt wurde erfolgreich gelöscht.",
        });

        // Reload agenda items to get fresh data
        await loadAgendaItems(selectedMeeting.id);
      } else {
        // If no ID, just remove locally
        const updated = agendaItems.filter((_, i) => i !== index);
        setAgendaItems(updated.map((it, idx) => ({ ...it, order_index: idx })));
      }
    } catch (error) {
      toast({
        title: "Fehler beim Löschen",
        description: "Der Agenda-Punkt konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const getDisplayName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.display_name || 'Unbekannt';
  };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcomingMeetings = [...meetings]
    .filter((m) => new Date(m.meeting_date as any) >= startOfToday)
    .sort((a, b) => new Date(a.meeting_date as any).getTime() - new Date(b.meeting_date as any).getTime())
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="flex justify-between items-center mb-8">
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Nächste Besprechungen</h2>
          <Button variant="link" className="text-primary px-0" onClick={() => toast({ title: 'Archiv', description: 'Archivansicht folgt.' })}>Archiv</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {upcomingMeetings.map((meeting) => (
            <Card key={meeting.id} className="cursor-pointer hover:shadow-elegant transition"
              onClick={() => { setSelectedMeeting(meeting); if (meeting.id) loadAgendaItems(meeting.id as string); }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{meeting.title}</CardTitle>
                <CardDescription>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(meeting.meeting_date), 'PPP', { locale: de })}
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
          {upcomingMeetings.length === 0 && (
            <Card className="md:col-span-3"><CardContent className="p-4 text-muted-foreground">Keine anstehenden Besprechungen</CardContent></Card>
          )}
        </div>
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
                  <Card key={index} className={cn(item.parentLocalKey && 'ml-6 border-l border-border')}> 
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
                              placeholder={item.parentLocalKey ? 'Unterpunkt' : 'Agenda-Punkt Titel'}
                              className="font-medium flex-1"
                            />
                            {!item.parentLocalKey && SUBPOINT_OPTIONS[item.title] && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button size="icon" variant="ghost" className="shrink-0" aria-label="Unterpunkt hinzufügen">
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64">
                                  <div className="space-y-2">
                                    {SUBPOINT_OPTIONS[item.title].map((opt) => (
                                      <Button key={opt} variant="outline" className="w-full justify-start"
                                        onClick={() => addSubItem(item, opt)}>
                                        {opt}
                                      </Button>
                                    ))}
                                    <Button variant="secondary" className="w-full" onClick={() => addSubItem(item, '')}>
                                      Freien Unterpunkt hinzufügen
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            <Button size="icon" variant="ghost" className="shrink-0 text-destructive hover:text-destructive" 
                              onClick={() => deleteAgendaItem(item, index)} aria-label="Punkt löschen">
                              <Trash className="h-4 w-4" />
                            </Button>
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