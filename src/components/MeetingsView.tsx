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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CalendarIcon, Plus, Save, Clock, Users, CheckCircle, Circle, GripVertical, Trash, ListTodo, Upload, FileText, Edit, Check, X, Download } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useMeetingDocuments } from "@/hooks/useMeetingDocuments";

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
  file_path?: string | null;
  result_text?: string | null;
  carry_over_to_next?: boolean;
  localKey?: string;
  parentLocalKey?: string;
}

interface Meeting {
  id?: string;
  user_id?: string;
  title: string;
  description?: string;
  meeting_date: string | Date;
  location?: string;
  status: string;
  template_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface MeetingTemplate {
  id: string;
  name: string;
  description?: string;
  template_items: any;
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
  const [taskDocuments, setTaskDocuments] = useState<Record<string, any[]>>({});
  const [meetingTemplates, setMeetingTemplates] = useState<MeetingTemplate[]>([]);
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [newMeeting, setNewMeeting] = useState<Meeting>({
    title: "",
    description: "",
    meeting_date: new Date(),
    location: "",
    status: "planned"
  });
  const [showTaskSelector, setShowTaskSelector] = useState<{itemIndex: number} | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);

  // Use the new multi-file documents hook
  const { 
    agendaDocuments, 
    loadAgendaDocuments, 
    uploadAgendaDocument, 
    downloadAgendaDocument, 
    deleteAgendaDocument 
  } = useMeetingDocuments();

  // Load data on component mount
  useEffect(() => {
    if (user) {
      loadMeetings();
      loadProfiles();
      loadTasks();
      loadMeetingTemplates();
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
      setProfiles(data || []);
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

  const loadMeetingTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setMeetingTemplates(data || []);
    } catch (error) {
      console.error('Error loading meeting templates:', error);
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

      // Load documents for all agenda items
      const itemIds = items.filter(item => item.id).map(item => item.id!);
      if (itemIds.length > 0) {
        await loadAgendaDocuments(itemIds);
      }
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
      const insertData = {
        title: newMeeting.title,
        description: newMeeting.description || null,
        meeting_date: format(newMeeting.meeting_date, 'yyyy-MM-dd'),
        location: newMeeting.location || null,
        status: newMeeting.status,
        user_id: user.id,
        template_id: newMeeting.template_id || null
      };

      const { data, error } = await supabase
        .from('meetings')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      const newMeetingWithDate = {...data, meeting_date: new Date(data.meeting_date)};
      setMeetings([newMeetingWithDate, ...meetings]);
      setSelectedMeeting(newMeetingWithDate);
      setIsNewMeetingOpen(false);
      
      // Load agenda items after creation
      setTimeout(async () => {
        await loadAgendaItems(data.id);
      }, 500);

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

  // File upload handler for agenda items
  const handleFileUpload = async (agendaItemId: string, files: FileList) => {
    if (!user) return;

    try {
      for (const file of Array.from(files)) {
        await uploadAgendaDocument(agendaItemId, file, user.id);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meetings</h1>
          <p className="text-muted-foreground">Meetings verwalten und Agenden bearbeiten - jetzt mit Multi-File-Support!</p>
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
                Erstellen Sie ein neues Meeting mit Multi-File-Unterstützung.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Meeting-Titel"
                value={newMeeting.title}
                onChange={(e) => setNewMeeting(prev => ({ ...prev, title: e.target.value }))}
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsNewMeetingOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={createMeeting}>
                  Erstellen
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
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedMeeting?.id === meeting.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => {
                setSelectedMeeting(meeting);
                if (meeting.id) {
                  loadAgendaItems(meeting.id);
                }
              }}
            >
              <CardHeader>
                <CardTitle className="text-base">{meeting.title}</CardTitle>
                <CardDescription>
                  {format(new Date(meeting.meeting_date), 'dd. MMMM yyyy', { locale: de })}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Meeting Details */}
        <div className="lg:col-span-2">
          {selectedMeeting ? (
            <Card>
              <CardHeader>
                <CardTitle>Agenda - {selectedMeeting.title}</CardTitle>
                <CardDescription>Multi-File-Upload pro Agenda-Punkt verfügbar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {agendaItems.map((item, index) => (
                  <div key={item.id || index} className="p-4 border rounded-lg space-y-3">
                    <h4 className="font-medium">{item.title}</h4>
                    
                    {/* Multi-File Upload Section */}
                    {item.id && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            multiple
                            onChange={(e) => e.target.files && handleFileUpload(item.id!, e.target.files)}
                            className="hidden"
                            id={`file-upload-${item.id}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById(`file-upload-${item.id}`)?.click()}
                            className="flex items-center gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            Dateien hinzufügen
                          </Button>
                        </div>
                        
                        {/* Display uploaded files */}
                        {item.id && agendaDocuments[item.id] && agendaDocuments[item.id].length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-muted-foreground">
                              Angehängte Dateien ({agendaDocuments[item.id].length})
                            </div>
                            <div className="grid gap-2">
                              {agendaDocuments[item.id].map((doc) => (
                                <div key={doc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm truncate" title={doc.file_name}>
                                      {doc.file_name}
                                    </span>
                                    {doc.file_size && (
                                      <span className="text-xs text-muted-foreground flex-shrink-0">
                                        ({Math.round(doc.file_size / 1024)} KB)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => downloadAgendaDocument(doc)}
                                      className="h-8 w-8 p-0"
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteAgendaDocument(doc.id, doc.meeting_agenda_item_id, doc.file_path)}
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Kein Meeting ausgewählt</h3>
                <p className="text-muted-foreground text-center">
                  Wählen Sie ein Meeting aus, um die Multi-File-Agenda zu bearbeiten.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}