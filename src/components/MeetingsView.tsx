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
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

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
  const [agendaDocuments, setAgendaDocuments] = useState<Record<string, any[]>>({});
  const [meetingTemplates, setMeetingTemplates] = useState<MeetingTemplate[]>([]);
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [newMeeting, setNewMeeting] = useState<Meeting>({
    title: "",
    description: "",
    meeting_date: new Date(),
    location: "",
    status: "planned"
  });
  const [newMeetingTime, setNewMeetingTime] = useState<string>("10:00");
  const [showTaskSelector, setShowTaskSelector] = useState<{itemIndex: number} | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);

  // Load data on component mount
  useEffect(() => {
    console.log('=== MeetingsView useEffect triggered ===');
    console.log('User:', user);
    if (user) {
      console.log('Loading meetings data...');
      loadMeetings();
      loadProfiles();
      loadTasks();
      loadMeetingTemplates();
    } else {
      console.log('No user found, skipping data load');
    }
  }, [user]);

  // Sync task changes to meeting agenda items
  useEffect(() => {
    const syncTaskChanges = async () => {
      if (!tasks || tasks.length === 0) return;
      
      try {
        // Get all meeting agenda items that reference tasks
        const { data: agendaItemsWithTasks, error } = await supabase
          .from('meeting_agenda_items')
          .select('*')
          .not('task_id', 'is', null);
        
        if (error) throw error;
        
        if (agendaItemsWithTasks && agendaItemsWithTasks.length > 0) {
          // Update agenda items with current task data
          for (const agendaItem of agendaItemsWithTasks) {
            const correspondingTask = tasks.find(task => task.id === agendaItem.task_id);
            if (correspondingTask) {
              // Update only title and description, preserve other fields like file_path from meeting-specific documents
              const updates: any = {};
              if (agendaItem.title !== correspondingTask.title) {
                updates.title = correspondingTask.title;
              }
              if (agendaItem.description !== correspondingTask.description) {
                updates.description = correspondingTask.description;
              }
              
              // Only update if there are actual changes
              if (Object.keys(updates).length > 0) {
                await supabase
                  .from('meeting_agenda_items')
                  .update(updates)
                  .eq('id', agendaItem.id);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error syncing task changes:', error);
      }
    };
    
    if (tasks.length > 0) {
      syncTaskChanges();
    }
  }, [tasks]);

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
      
      // Load task documents for all tasks
      if (data && data.length > 0) {
        await loadTaskDocuments(data.map(task => task.id));
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadTaskDocuments = async (taskIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('task_documents')
        .select('*')
        .in('task_id', taskIds);

      if (error) throw error;
      
      // Group documents by task_id
      const docsByTaskId: Record<string, any[]> = {};
      data?.forEach(doc => {
        if (!docsByTaskId[doc.task_id]) {
          docsByTaskId[doc.task_id] = [];
        }
        docsByTaskId[doc.task_id].push(doc);
      });
      
      setTaskDocuments(docsByTaskId);
    } catch (error) {
      console.error('Error loading task documents:', error);
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
      
      // Load documents for agenda items
      if (items.length > 0) {
        await loadAgendaDocuments(items.map(item => item.id).filter(Boolean));
      }
    } catch (error) {
      toast({
        title: "Fehler beim Laden der Agenda",
        description: "Die Agenda-Punkte konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const loadAgendaDocuments = async (agendaItemIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('meeting_agenda_documents')
        .select('*')
        .in('agenda_item_id', agendaItemIds);

      if (error) throw error;
      
      // Group documents by agenda_item_id
      const docsByItemId: Record<string, any[]> = {};
      data?.forEach(doc => {
        if (!docsByItemId[doc.agenda_item_id]) {
          docsByItemId[doc.agenda_item_id] = [];
        }
        docsByItemId[doc.agenda_item_id].push(doc);
      });
      
      setAgendaDocuments(docsByItemId);
    } catch (error) {
      console.error('Error loading agenda documents:', error);
    }
  };

  const addTaskToAgenda = async (task: any, parentItem: AgendaItem, parentIndex: number) => {
    if (!selectedMeeting?.id) return;
    
    setShowTaskSelector(null);
    
    try {
      let parentId = parentItem.id;
      
      // If parent doesn't have an ID yet, save it first
      if (!parentId) {
        const { data: parentData, error: parentError } = await supabase
          .from('meeting_agenda_items')
          .insert({
            meeting_id: selectedMeeting.id,
            title: parentItem.title,
            description: parentItem.description || null,
            order_index: parentItem.order_index,
            is_completed: false,
            is_recurring: false,
          })
          .select()
          .single();
        
        if (parentError) throw parentError;
        parentId = parentData.id;
        
        // Update parent in local state
        const updatedItems = [...agendaItems];
        updatedItems[parentIndex] = { ...parentItem, id: parentId };
        setAgendaItems(updatedItems);
      }

      // Calculate the correct order index for the sub-item (right after parent)
      const subItemOrderIndex = parentIndex + 1;
      
      // Get task documents for this task and copy them to meeting agenda documents
      const taskDocs = taskDocuments[task.id] || [];
      
      // Insert the task as a sub-item with correct parent_id
      const { data: taskData, error: taskError } = await supabase
        .from('meeting_agenda_items')
        .insert({
          meeting_id: selectedMeeting.id,
          title: task.title,
          description: task.description || null,
          task_id: task.id,
          parent_id: parentId, // This is the key - setting the correct parent_id
          order_index: subItemOrderIndex,
          is_completed: false,
          is_recurring: false,
        })
        .select()
        .single();

      if (taskError) throw taskError;
      
      // Copy task documents as meeting agenda documents
      if (taskDocs.length > 0 && taskData.id && user) {
        const agendaDocumentInserts = taskDocs.map(doc => ({
          agenda_item_id: taskData.id,
          user_id: user.id,
          file_name: doc.file_name,
          file_path: doc.file_path,
          file_type: doc.file_type,
          file_size: doc.file_size,
        }));
        
        await supabase
          .from('meeting_agenda_documents')
          .insert(agendaDocumentInserts);
      }
      
      // Create the new sub-item with proper parent reference
      const newSubItem: AgendaItem = {
        ...taskData,
        localKey: taskData.id,
        parentLocalKey: parentId,
      };
      
      // Insert the sub-item right after its parent in local state
      const updatedItems = [...agendaItems];
      updatedItems.splice(parentIndex + 1, 0, newSubItem);
      
      // Reindex all items to maintain proper order
      const reindexedItems = updatedItems.map((item, idx) => ({
        ...item,
        order_index: idx
      }));
      
      setAgendaItems(reindexedItems);
      
      toast({
        title: "Aufgabe hinzugefügt",
        description: `"${task.title}" wurde als Unterpunkt zu "${parentItem.title}" hinzugefügt.`,
      });
      
    } catch (error) {
      console.error('Error saving task to agenda:', error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const uploadAgendaDocument = async (agendaItemId: string, file: File) => {
    if (!user || !selectedMeeting?.id) return;
    
    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `meetings/${selectedMeeting.id}/agenda-items/${agendaItemId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Save document reference to database
      const { error: dbError } = await supabase
        .from('meeting_agenda_documents')
        .insert({
          agenda_item_id: agendaItemId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
        });
      
      if (dbError) throw dbError;
      
      // Reload agenda documents
      await loadAgendaDocuments([agendaItemId]);
      
      toast({
        title: "Dokument hochgeladen",
        description: `"${file.name}" wurde erfolgreich hinzugefügt.`,
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Upload-Fehler",
        description: "Das Dokument konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    }
  };

  const deleteAgendaDocument = async (documentId: string, agendaItemId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_agenda_documents')
        .delete()
        .eq('id', documentId);
      
      if (error) throw error;
      
      // Reload agenda documents
      await loadAgendaDocuments([agendaItemId]);
      
      toast({
        title: "Dokument gelöscht",
        description: "Das Dokument wurde entfernt.",
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Lösch-Fehler",
        description: "Das Dokument konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const downloadDocument = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Download-Fehler",
        description: "Das Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const updateAgendaItem = async (index: number, field: keyof AgendaItem, value: any) => {
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    setAgendaItems(updated);
    
    // Auto-save if item has an ID and we have a selected meeting
    if (updated[index].id && selectedMeeting?.id) {
      try {
        await supabase
          .from('meeting_agenda_items')
          .update({ [field]: value })
          .eq('id', updated[index].id);
      } catch (error) {
        console.error('Auto-save error:', error);
      }
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

  const deleteAgendaItem = (item: AgendaItem, index: number) => {
    const newItems = agendaItems.filter((_, i) => i !== index);
    setAgendaItems(newItems);
  };

  return (
    <div className="h-full bg-background">
      <div className="flex flex-col h-full">
        <div className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Jour fixe</h1>
            <Button onClick={() => setIsNewMeetingOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neues Meeting
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Meetings List */}
            <div className="lg:col-span-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Anstehende Meetings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meetings.length > 0 ? (
                    meetings.map((meeting) => (
                      <Card
                        key={meeting.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/50",
                          selectedMeeting?.id === meeting.id && "bg-muted"
                        )}
                        onClick={() => {
                          setSelectedMeeting(meeting);
                          if (meeting.id) {
                            loadAgendaItems(meeting.id);
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium">{meeting.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}
                              </p>
                              {meeting.location && (
                                <p className="text-sm text-muted-foreground">{meeting.location}</p>
                              )}
                            </div>
                            <Badge variant={meeting.status === 'completed' ? 'default' : 'secondary'}>
                              {meeting.status === 'planned' && 'Geplant'}
                              {meeting.status === 'in-progress' && 'Läuft'}
                              {meeting.status === 'completed' && 'Abgeschlossen'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4" />
                      <p>Keine Meetings geplant</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Agenda Editor */}
            <div className="lg:col-span-2">
              {selectedMeeting ? (
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedMeeting.title}</CardTitle>
                        <CardDescription>
                          {format(new Date(selectedMeeting.meeting_date), 'dd.MM.yyyy', { locale: de })}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {agendaItems.length > 0 ? (
                      <div className="space-y-3">
                        {agendaItems.map((item, index) => (
                          <Card key={item.localKey || item.id || index}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={item.title}
                                      onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                                      placeholder={item.parentLocalKey ? 'Unterpunkt' : 'Agenda-Punkt Titel'}
                                      className="font-medium flex-1"
                                    />
                                    
                                    {!item.parentLocalKey && (
                                      <Popover open={showTaskSelector?.itemIndex === index} onOpenChange={(open) => 
                                        setShowTaskSelector(open ? {itemIndex: index} : null)
                                      }>
                                        <PopoverTrigger asChild>
                                          <Button size="icon" variant="ghost" className="shrink-0">
                                            <ListTodo className="h-4 w-4" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80">
                                          <div className="space-y-2">
                                            <div className="text-sm font-medium mb-3">Aufgabe als Unterpunkt hinzufügen</div>
                                            {tasks.length > 0 ? (
                                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {tasks.map((task) => (
                                                  <Button 
                                                    key={task.id} 
                                                    variant="outline" 
                                                    className="w-full justify-start text-left h-auto p-3"
                                                    onClick={() => addTaskToAgenda(task, item, index)}
                                                  >
                                                    <div>
                                                      <div className="font-medium">{task.title}</div>
                                                    </div>
                                                  </Button>
                                                ))}
                                              </div>
                                            ) : (
                                              <div className="text-sm text-muted-foreground text-center py-4">
                                                Keine offenen Aufgaben verfügbar
                                              </div>
                                            )}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                    
                                    <Button size="icon" variant="ghost" className="shrink-0 text-destructive hover:text-destructive" 
                                      onClick={() => deleteAgendaItem(item, index)}>
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  {item.parentLocalKey && (
                                    <>
                                      <Textarea
                                        value={item.description || ''}
                                        onChange={(e) => updateAgendaItem(index, 'description', e.target.value)}
                                        placeholder="Beschreibung"
                                        className="min-h-[60px]"
                                      />

                                      <div>
                                        <label className="text-sm font-medium">Notizen</label>
                                        <Textarea
                                          value={item.notes || ''}
                                          onChange={(e) => updateAgendaItem(index, 'notes', e.target.value)}
                                          placeholder="Notizen und Hinweise"
                                          className="min-h-[80px]"
                                        />
                                      </div>

                                      {/* Meeting-specific documents section */}
                                      {item.id && (
                                        <div>
                                          <label className="text-sm font-medium mb-2 block">Dokumente</label>
                                          
                                          {/* Display existing documents */}
                                          {agendaDocuments[item.id] && agendaDocuments[item.id].length > 0 && (
                                            <div className="mb-3 space-y-2">
                                              {agendaDocuments[item.id].map((doc) => (
                                                <div key={doc.id} className="flex items-center justify-between p-2 bg-muted/30 rounded border">
                                                  <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm">{doc.file_name}</span>
                                                  </div>
                                                  <div className="flex gap-1">
                                                    <Button 
                                                      variant="ghost" 
                                                      size="sm"
                                                      onClick={() => downloadDocument(doc.file_path, doc.file_name)}
                                                    >
                                                      <Download className="h-3 w-3" />
                                                    </Button>
                                                    <Button 
                                                      variant="ghost" 
                                                      size="sm"
                                                      onClick={() => deleteAgendaDocument(doc.id, item.id!)}
                                                      className="text-destructive hover:text-destructive"
                                                    >
                                                      <X className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          
                                          {/* Upload new document */}
                                          <div>
                                            <Input
                                              type="file"
                                              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                                              onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file && item.id) {
                                                  await uploadAgendaDocument(item.id, file);
                                                  e.target.value = ''; // Reset file input
                                                }
                                              }}
                                              className="text-sm"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                              PDF, Word, Text oder Bilder hochladen
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
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
                    
                    <div className="mt-4 flex gap-2">
                      <Button onClick={addAgendaItem}>
                        <Plus className="h-4 w-4 mr-2" />
                        Punkt hinzufügen
                      </Button>
                      <Button onClick={saveAgendaItems} variant="outline">
                        <Save className="h-4 w-4 mr-2" />
                        Speichern
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full">
                  <CardContent className="p-8 text-center h-full flex items-center justify-center">
                    <div>
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">Kein Meeting ausgewählt</h3>
                      <p className="text-muted-foreground">
                        Wählen Sie ein Meeting aus der Liste links aus, um die Agenda zu bearbeiten
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}