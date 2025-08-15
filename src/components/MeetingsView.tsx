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
import { CalendarIcon, Plus, Save, Clock, Users, CheckCircle, Circle, GripVertical, Trash, ListTodo, Edit, Check, X } from "lucide-react";
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
        // Get all agenda items that are linked to tasks
        const { data: agendaItemsData, error: agendaError } = await supabase
          .from('meeting_agenda_items')
          .select('*')
          .not('task_id', 'is', null);

        if (agendaError) throw agendaError;

        // Update agenda items with current task data
        for (const agendaItem of agendaItemsData || []) {
          const correspondingTask = tasks.find(task => task.id === agendaItem.task_id);
          
          if (correspondingTask) {
            // Check if anything has changed
            const hasChanges = 
              agendaItem.title !== correspondingTask.title ||
              agendaItem.description !== correspondingTask.description ||
              agendaItem.assigned_to !== correspondingTask.assigned_to ||
              agendaItem.is_completed !== (correspondingTask.status === 'completed');

            if (hasChanges) {
              const updates = {
                title: correspondingTask.title,
                description: correspondingTask.description,
                assigned_to: correspondingTask.assigned_to,
                is_completed: correspondingTask.status === 'completed',
                updated_at: new Date().toISOString()
              };

              // Update in database
              await supabase
                .from('meeting_agenda_items')
                .update(updates)
                .eq('id', agendaItem.id);
              
              // Reload agenda items for the selected meeting to reflect changes
              if (selectedMeeting?.id === agendaItem.meeting_id) {
                await loadAgendaItems(selectedMeeting.id);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error syncing task changes:', error);
      }
    };

    syncTaskChanges();
  }, [tasks, selectedMeeting]);

  const loadMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (error) throw error;
      
      // Transform the date strings to Date objects
      const meetingsWithDates = (data || []).map(meeting => ({
        ...meeting,
        meeting_date: new Date(meeting.meeting_date)
      }));
      
      setMeetings(meetingsWithDates);
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

    // Load task documents
    try {
      const { data: taskDocs, error: taskDocsError } = await supabase
        .from('task_documents')
        .select('*');

      if (taskDocsError) throw taskDocsError;

      // Group documents by task_id
      const docsByTaskId: Record<string, any[]> = {};
      (taskDocs || []).forEach((doc) => {
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
        localKey: `existing-${item.id}`
      }));
      setAgendaItems(items);
    } catch (error) {
      console.error('Error loading agenda items:', error);
    }
  };

  const addAgendaItem = () => {
    const newItem: AgendaItem = {
      title: "",
      description: "",
      notes: "",
      is_completed: false,
      is_recurring: false,
      order_index: agendaItems.length,
      localKey: `new-${Date.now()}-${Math.random()}`
    };
    setAgendaItems([...agendaItems, newItem]);
  };

  const addSubItem = (parentIndex: number) => {
    const parent = agendaItems[parentIndex];
    const newSubItem: AgendaItem = {
      title: "",
      description: "",
      notes: "",
      is_completed: false,
      is_recurring: false,
      order_index: parentIndex + 1,
      parent_id: parent.id || null,
      parentLocalKey: parent.localKey,
      localKey: `sub-${Date.now()}-${Math.random()}`
    };
    
    const newItems = [...agendaItems];
    newItems.splice(parentIndex + 1, 0, newSubItem);
    
    // Update order_index for subsequent items
    for (let i = parentIndex + 2; i < newItems.length; i++) {
      newItems[i].order_index = i;
    }
    
    setAgendaItems(newItems);
  };

  const updateAgendaItem = async (index: number, field: keyof AgendaItem, value: any) => {
    const updatedItems = [...agendaItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setAgendaItems(updatedItems);

    // If the item has an ID, update it in the database immediately
    const item = updatedItems[index];
    if (item.id && selectedMeeting?.id) {
      try {
        await supabase
          .from('meeting_agenda_items')
          .update({ [field]: value })
          .eq('id', item.id);
      } catch (error) {
        console.error('Error updating agenda item:', error);
      }
    }
  };

  const removeAgendaItem = async (index: number) => {
    const item = agendaItems[index];
    
    // If item has an ID, delete from database
    if (item.id) {
      try {
        await supabase
          .from('meeting_agenda_items')
          .delete()
          .eq('id', item.id);
      } catch (error) {
        console.error('Error deleting agenda item:', error);
        toast({
          title: "Fehler",
          description: "Der Punkt konnte nicht gelöscht werden.",
          variant: "destructive",
        });
        return;
      }
    }

    // Remove from local state
    const updatedItems = agendaItems.filter((_, i) => i !== index);
    
    // Update order indices
    const reorderedItems = updatedItems.map((item, i) => ({ ...item, order_index: i }));
    setAgendaItems(reorderedItems);

    toast({
      title: "Punkt entfernt",
      description: "Der Agenda-Punkt wurde erfolgreich entfernt.",
    });
  };

  const saveMeeting = async () => {
    if (!selectedMeeting?.id || !user?.id) return;

    try {
      // Save all agenda items
      for (let i = 0; i < agendaItems.length; i++) {
        const item = agendaItems[i];
        
        // Handle parent items that need to be saved first
        if (!item.id && (item.parentLocalKey || item.parent_id)) {
          // Find parent and ensure it has an ID
          let parentId = item.parent_id;
          
          if (!parentId && item.parentLocalKey) {
            const parentIndex = agendaItems.findIndex(parent => parent.localKey === item.parentLocalKey);
            if (parentIndex !== -1) {
              const parentItem = agendaItems[parentIndex];
              if (!parentItem.id) {
                // Save parent first
                const { data: parentData, error: parentError } = await supabase
                  .from('meeting_agenda_items')
                  .insert({
                    meeting_id: selectedMeeting.id,
                    title: parentItem.title || 'Unterpunkt',
                    description: parentItem.description || '',
                    notes: parentItem.notes || '',
                    parent_id: parentItem.parent_id || null,
                    order_index: parentItem.order_index,
                    is_completed: parentItem.is_completed,
                    is_recurring: parentItem.is_recurring,
                    assigned_to: parentItem.assigned_to,
                    task_id: parentItem.task_id,
                    file_path: parentItem.file_path,
                    result_text: parentItem.result_text,
                    carry_over_to_next: parentItem.carry_over_to_next
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
              
              // Insert the sub-item with correct parent_id
              const { data: subItemData, error: subItemError } = await supabase
                .from('meeting_agenda_items')
                .insert({
                  meeting_id: selectedMeeting.id,
                  title: item.title || 'Unterpunkt',
                  description: item.description || '',
                  notes: item.notes || '',
                  parent_id: parentId,
                  order_index: subItemOrderIndex,
                  is_completed: item.is_completed,
                  is_recurring: item.is_recurring,
                  assigned_to: item.assigned_to,
                  task_id: item.task_id,
                  file_path: item.file_path,
                  result_text: item.result_text,
                  carry_over_to_next: item.carry_over_to_next
                })
                .select()
                .single();
              
              if (subItemError) throw subItemError;
              
              // Update sub-item in local state
              const updatedItems = [...agendaItems];
              updatedItems[i] = { ...item, id: subItemData.id, parent_id: parentId };
              setAgendaItems(updatedItems);
              continue;
            }
          }
        }

        // Save normal items (including main items and items that already have parent_id)
        if (!item.id) {
          const { data, error } = await supabase
            .from('meeting_agenda_items')
            .insert({
              meeting_id: selectedMeeting.id,
              title: item.title || 'Neuer Punkt',
              description: item.description || '',
              notes: item.notes || '',
              parent_id: item.parent_id || null,
              order_index: item.order_index,
              is_completed: item.is_completed,
              is_recurring: item.is_recurring,
              assigned_to: item.assigned_to,
              task_id: item.task_id,
              file_path: item.file_path,
              result_text: item.result_text,
              carry_over_to_next: item.carry_over_to_next
            })
            .select()
            .single();

          if (error) throw error;

          // Update local state with the new ID
          const updatedItems = [...agendaItems];
          updatedItems[i] = { ...item, id: data.id };
          setAgendaItems(updatedItems);
        } else {
          // Update existing items
          await supabase
            .from('meeting_agenda_items')
            .update({
              title: item.title,
              description: item.description,
              notes: item.notes,
              order_index: item.order_index,
              is_completed: item.is_completed,
              is_recurring: item.is_recurring,
              assigned_to: item.assigned_to,
              file_path: item.file_path,
              result_text: item.result_text,
              carry_over_to_next: item.carry_over_to_next
            })
            .eq('id', item.id);
        }
      }

      toast({
        title: "Meeting gespeichert",
        description: "Die Agenda wurde erfolgreich gespeichert.",
      });
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast({
        title: "Speicherfehler",
        description: "Das Meeting konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const createMeeting = async () => {
    if (!user?.id) return;

    try {
      // Combine date and time
      const meetingDate = new Date(newMeeting.meeting_date);
      const [hours, minutes] = newMeetingTime.split(':').map(Number);
      meetingDate.setHours(hours, minutes, 0, 0);

      const { data, error } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: newMeeting.title,
          description: newMeeting.description,
          meeting_date: meetingDate.toISOString(),
          location: newMeeting.location,
          status: newMeeting.status,
          template_id: newMeeting.template_id
        })
        .select()
        .single();

      if (error) throw error;

      // The database trigger automatically creates default agenda items
      // so we don't need to call createDefaultAgendaItems here

      const newMeetingWithDate = {...data, meeting_date: new Date(data.meeting_date)};
      setMeetings([newMeetingWithDate, ...meetings]);
      setSelectedMeeting(newMeetingWithDate);
      
      // Clear the agenda items first to prevent conflicts
      setAgendaItems([]);
      
      // Wait a moment for the trigger to complete, then load the items
      setTimeout(async () => {
        await loadAgendaItems(data.id);
      }, 500);
      
      setIsNewMeetingOpen(false);
      setNewMeeting({
        title: "",
        description: "",
        meeting_date: new Date(),
        location: "",
        status: "planned"
      });
      setNewMeetingTime("10:00");

      toast({
        title: "Meeting erstellt",
        description: "Das neue Meeting wurde erfolgreich erstellt.",
      });
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: "Erstellungsfehler",
        description: "Das Meeting konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const addTaskToAgenda = async (task: any, itemIndex: number) => {
    if (!selectedMeeting?.id) return;

    try {
      // Find parent item and ensure it has an ID
      let parentId = null;
      const parent = agendaItems[itemIndex];
      
      if (!parent.id) {
        // Save parent first
        const { data: parentData, error: parentError } = await supabase
          .from('meeting_agenda_items')
          .insert({
            meeting_id: selectedMeeting.id,
            title: parent.title || 'Unterpunkt',
            description: parent.description || '',
            notes: parent.notes || '',
            parent_id: parent.parent_id || null,
            order_index: parent.order_index,
            is_completed: parent.is_completed,
            is_recurring: parent.is_recurring,
            assigned_to: parent.assigned_to,
            task_id: parent.task_id,
            file_path: parent.file_path,
            result_text: parent.result_text,
            carry_over_to_next: parent.carry_over_to_next
          })
          .select()
          .single();
        
        if (parentError) throw parentError;
        parentId = parentData.id;
        
        // Update parent in local state
        const updatedItems = [...agendaItems];
        updatedItems[itemIndex] = { ...parent, id: parentId };
        setAgendaItems(updatedItems);
      }

      // Calculate the correct order index for the sub-item (right after parent)
      const subItemOrderIndex = itemIndex + 1;

      // Insert the sub-item with correct parent_id
      const { data: subItemData, error: subItemError } = await supabase
        .from('meeting_agenda_items')
        .insert({
          meeting_id: selectedMeeting.id,
          title: task.title,
          description: task.description,
          parent_id: parentId || parent.id,
          order_index: subItemOrderIndex,
          is_completed: task.status === 'completed',
          is_recurring: false,
          assigned_to: task.assigned_to,
          task_id: task.id,
          notes: `Aufgabe hinzugefügt: ${task.title}`,
          file_path: null,
          result_text: null,
          carry_over_to_next: false
        })
        .select()
        .single();
      
      if (subItemError) throw subItemError;
      
      // Insert into local state at the correct position
      const newItems = [...agendaItems];
      const newSubItem: AgendaItem = {
        ...subItemData,
        localKey: `task-${subItemData.id}`
      };
      
      newItems.splice(itemIndex + 1, 0, newSubItem);
      
      // Update order_index for subsequent items
      for (let i = itemIndex + 2; i < newItems.length; i++) {
        newItems[i].order_index = i;
      }
      
      setAgendaItems(newItems);
      setShowTaskSelector(null);

      toast({
        title: "Aufgabe hinzugefügt",
        description: `"${task.title}" wurde zur Agenda hinzugefügt.`,
      });
    } catch (error) {
      console.error('Error adding task to agenda:', error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newItems = Array.from(agendaItems);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    // Update order indices
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      order_index: index
    }));

    setAgendaItems(updatedItems);
  };

  const updateMeeting = async (meetingId: string, updates: Partial<Omit<Meeting, 'meeting_date'>> & { meeting_date?: string }) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update(updates)
        .eq('id', meetingId);

      if (error) throw error;

      // Update local state
      setMeetings(meetings.map(m => 
        m.id === meetingId ? { ...m, ...updates, meeting_date: updates.meeting_date ? new Date(updates.meeting_date) : m.meeting_date } : m
      ));

      // Update selected meeting if it's the current one
      if (selectedMeeting?.id === meetingId) {
        setSelectedMeeting({ ...selectedMeeting, ...updates, meeting_date: updates.meeting_date ? new Date(updates.meeting_date) : selectedMeeting.meeting_date });
      }

      // Update corresponding appointment in calendar
      await supabase
        .from('appointments')
        .update({
          title: updates.title,
          description: updates.description,
        })
        .eq('meeting_id', meetingId);

      toast({
        title: "Meeting aktualisiert",
        description: "Die Änderungen wurden gespeichert.",
      });
    } catch (error) {
      console.error('Error updating meeting:', error);
      toast({
        title: "Fehler",
        description: "Das Meeting konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      // Delete the meeting (cascade will handle agenda items)
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      // Update local state
      setMeetings(meetings.filter(m => m.id !== meetingId));
      
      if (selectedMeeting?.id === meetingId) {
        setSelectedMeeting(null);
        setAgendaItems([]);
      }

      toast({
        title: "Meeting gelöscht",
        description: "Das Meeting wurde erfolgreich gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast({
        title: "Fehler",
        description: "Das Meeting konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const startMeeting = async (meeting: Meeting) => {
    setActiveMeeting(meeting);
    if (meeting.id) {
      await loadAgendaItems(meeting.id);
    }
  };

  const stopMeeting = () => {
    setActiveMeeting(null);
  };

  // Helper function to check if user can edit
  const canEdit = (item: any) => {
    return !item.task_id; // Can't edit if it's a synced task
  };

  // Get upcoming meetings (next 7 days)
  const upcomingMeetings = meetings.filter(meeting => {
    const meetingDate = new Date(meeting.meeting_date);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return meetingDate >= today && meetingDate <= nextWeek;
  });

  // Get past meetings
  const pastMeetings = meetings.filter(meeting => {
    const meetingDate = new Date(meeting.meeting_date);
    const today = new Date();
    return meetingDate < today;
  });

  if (activeMeeting) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Meeting läuft</h1>
            <p className="text-muted-foreground">{activeMeeting.title}</p>
          </div>
          <Button onClick={stopMeeting} variant="outline">
            Meeting beenden
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {agendaItems.map((item, index) => (
                <div key={item.id || item.localKey} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Checkbox
                    checked={item.is_completed}
                    onCheckedChange={(checked) => updateAgendaItem(index, 'is_completed', checked)}
                  />
                  <div className="flex-1">
                    <h3 className="font-medium">{item.title}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    )}
                    {item.assigned_to && (
                      <Badge variant="secondary" className="mt-1">
                        {profiles.find(p => p.user_id === item.assigned_to)?.display_name || item.assigned_to}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.task_id && <Badge variant="outline">Aufgabe</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jour fixe</h1>
          <p className="text-muted-foreground">
            Verwalte regelmäßige Meetings und Agenda-Punkte
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
                Erstelle ein neues Meeting mit Datum und Agenda
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Titel</label>
                <Input
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  placeholder="Meeting-Titel"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Beschreibung</label>
                <Textarea
                  value={newMeeting.description || ""}
                  onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                  placeholder="Kurze Beschreibung..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Datum</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(new Date(newMeeting.meeting_date), "dd.MM.yyyy", { locale: de })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(newMeeting.meeting_date)}
                        onSelect={(date) => date && setNewMeeting({ ...newMeeting, meeting_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium">Uhrzeit</label>
                  <Input
                    type="time"
                    value={newMeetingTime}
                    onChange={(e) => setNewMeetingTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Ort</label>
                <Input
                  value={newMeeting.location || ""}
                  onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                  placeholder="Meeting-Ort"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Vorlage</label>
                <Select onValueChange={(value) => setNewMeeting({ ...newMeeting, template_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vorlage auswählen (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {meetingTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createMeeting} className="w-full">
                Meeting erstellen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {upcomingMeetings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Kommende Meetings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcomingMeetings.map((meeting) => (
              <Card key={meeting.id} className="hover:shadow-elegant transition">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 cursor-pointer" onClick={() => { 
                      setSelectedMeeting(meeting); 
                      if (meeting.id) {
                        setAgendaItems([]);
                        loadAgendaItems(meeting.id as string);
                      }
                    }}>
                      {editingMeeting?.id === meeting.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editingMeeting.title}
                            onChange={(e) => setEditingMeeting({ ...editingMeeting, title: e.target.value })}
                            onBlur={() => {
                              updateMeeting(meeting.id!, { title: editingMeeting.title });
                              setEditingMeeting(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateMeeting(meeting.id!, { title: editingMeeting.title });
                                setEditingMeeting(null);
                              }
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      )}
                      <CardDescription>
                        {format(new Date(meeting.meeting_date), "dd.MM.yyyy 'um' HH:mm", { locale: de })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMeeting(meeting);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Meeting löschen</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sind Sie sicher, dass Sie dieses Meeting löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMeeting(meeting.id!)}>
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {meeting.description && (
                    <p className="text-sm text-muted-foreground mb-3">{meeting.description}</p>
                  )}
                  {meeting.location && (
                    <p className="text-xs text-muted-foreground mb-3">📍 {meeting.location}</p>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={(e) => {
                        e.stopPropagation();
                        startMeeting(meeting);
                      }}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Starten
                    </Button>
                    <Badge variant="secondary">{meeting.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedMeeting && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedMeeting.title}</CardTitle>
                <CardDescription>
                  {format(new Date(selectedMeeting.meeting_date), "dd.MM.yyyy 'um' HH:mm", { locale: de })}
                  {selectedMeeting.location && ` • ${selectedMeeting.location}`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveMeeting} variant="outline">
                  <Save className="h-4 w-4 mr-2" />
                  Speichern
                </Button>
                <Button onClick={addAgendaItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Punkt hinzufügen
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="agenda">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                    {agendaItems.map((item, index) => (
                      <Draggable key={item.id || item.localKey} draggableId={item.id || item.localKey || `item-${index}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "bg-card border rounded-lg transition-all",
                              snapshot.isDragging && "shadow-lg",
                              item.parent_id && "ml-8 border-l-4 border-l-primary/30"
                            )}
                          >
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                  <div {...provided.dragHandleProps} className="mt-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  
                                  <Checkbox
                                    checked={item.is_completed}
                                    onCheckedChange={(checked) => updateAgendaItem(index, 'is_completed', checked)}
                                  />
                                  
                                  <div className="flex-1 space-y-3">
                                    <div>
                                      <Input
                                        value={item.title}
                                        onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                                        placeholder="Agenda-Punkt"
                                        className="font-medium"
                                        disabled={!canEdit(item)}
                                      />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">Beschreibung</label>
                                        <Textarea
                                          value={item.description || ""}
                                          onChange={(e) => updateAgendaItem(index, 'description', e.target.value)}
                                          placeholder="Zusätzliche Details..."
                                          disabled={!canEdit(item)}
                                        />
                                      </div>
                                      
                                      <div>
                                        <label className="text-sm font-medium">Notizen</label>
                                        <Textarea
                                          value={item.notes || ""}
                                          onChange={(e) => updateAgendaItem(index, 'notes', e.target.value)}
                                          placeholder="Notizen während des Meetings..."
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">Zugewiesen an</label>
                                        <Select
                                          value={item.assigned_to || ""}
                                          onValueChange={(value) => updateAgendaItem(index, 'assigned_to', value)}
                                          disabled={!canEdit(item)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Person auswählen" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {profiles.map((profile) => (
                                              <SelectItem key={profile.user_id} value={profile.user_id}>
                                                {profile.display_name || 'Unbekannt'}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div>
                                        <label className="text-sm font-medium">Ergebnis</label>
                                        <Textarea
                                          value={item.result_text || ""}
                                          onChange={(e) => updateAgendaItem(index, 'result_text', e.target.value)}
                                          placeholder="Ergebnis oder Entscheidung..."
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`recurring-${index}`}
                                          checked={item.is_recurring}
                                          onCheckedChange={(checked) => updateAgendaItem(index, 'is_recurring', checked)}
                                          disabled={!canEdit(item)}
                                        />
                                        <label htmlFor={`recurring-${index}`} className="text-sm font-medium">
                                          Wiederkehrend
                                        </label>
                                      </div>

                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`carryover-${index}`}
                                          checked={item.carry_over_to_next || false}
                                          onCheckedChange={(checked) => updateAgendaItem(index, 'carry_over_to_next', checked)}
                                        />
                                        <label htmlFor={`carryover-${index}`} className="text-sm font-medium">
                                          Ins nächste Meeting übertragen
                                        </label>
                                      </div>
                                    </div>

                                    {/* Task documents display */}
                                    {item.task_id && taskDocuments[item.task_id] && taskDocuments[item.task_id].length > 0 && (
                                      <div className="mt-4">
                                        <h4 className="text-sm font-medium mb-2">Aufgaben-Dokumente:</h4>
                                        {taskDocuments[item.task_id].map((doc, docIndex) => (
                                          <div key={doc.id} className="flex items-center justify-between p-2 bg-background rounded border mb-2">
                                            <div className="flex items-center gap-2">
                                              <div className="h-4 w-4 text-blue-600">📄</div>
                                              <span className="text-sm">{doc.file_name}</span>
                                            </div>
                                            <Button 
                                              variant="ghost" 
                                              size="sm"
                                              onClick={async () => {
                                                try {
                                                  const { data: urlData } = await supabase.storage
                                                    .from('task-documents')
                                                    .createSignedUrl(doc.file_path, 3600);
                                                  
                                                  if (urlData?.signedUrl) {
                                                    const a = document.createElement('a');
                                                    a.href = urlData.signedUrl;
                                                    a.download = doc.file_name;
                                                    a.target = '_blank';
                                                    a.click();
                                                  }
                                                } catch (error) {
                                                  console.error('Download error:', error);
                                                }
                                              }}
                                            >
                                              ⬇️
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex flex-col gap-2">
                                    {item.task_id && (
                                      <Badge variant="outline" className="text-xs">
                                        <ListTodo className="h-3 w-3 mr-1" />
                                        Aufgabe
                                      </Badge>
                                    )}
                                    
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => addSubItem(index)}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                    
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setShowTaskSelector({ itemIndex: index })}
                                    >
                                      <ListTodo className="h-4 w-4" />
                                    </Button>
                                    
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeAgendaItem(index)}
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardContent>
        </Card>
      )}

      {pastMeetings.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Vergangene Meetings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pastMeetings.slice(0, 6).map((meeting) => (
              <Card key={meeting.id} className="opacity-75">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{meeting.title}</CardTitle>
                  <CardDescription>
                    {format(new Date(meeting.meeting_date), "dd.MM.yyyy 'um' HH:mm", { locale: de })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {meeting.description && (
                    <p className="text-sm text-muted-foreground mb-3">{meeting.description}</p>
                  )}
                  <Badge variant="secondary">Abgeschlossen</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Task Selector Dialog */}
      {showTaskSelector && (
        <Dialog open={!!showTaskSelector} onOpenChange={() => setShowTaskSelector(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aufgabe zur Agenda hinzufügen</DialogTitle>
              <DialogDescription>
                Wähle eine Aufgabe aus, die zur Agenda hinzugefügt werden soll
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-accent"
                  onClick={() => addTaskToAgenda(task, showTaskSelector.itemIndex)}
                >
                  <div>
                    <h4 className="font-medium">{task.title}</h4>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{task.priority}</Badge>
                      <Badge variant="secondary">{task.category}</Badge>
                    </div>
                  </div>
                  <Plus className="h-4 w-4" />
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}