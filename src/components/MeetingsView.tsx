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
import { MeetingArchiveView } from "./MeetingArchiveView";

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
  const [activeMeetingItems, setActiveMeetingItems] = useState<AgendaItem[]>([]);
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
  const [showArchive, setShowArchive] = useState(false);

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

  // Sync task changes to meeting agenda items (only title and description, not files)
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
          // Update agenda items with current task data (but not files)
          for (const agendaItem of agendaItemsWithTasks) {
            const correspondingTask = tasks.find(task => task.id === agendaItem.task_id);
            if (correspondingTask) {
              // Update only title and description, not files
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

  // Update activeMeetingItems when agendaItems or activeMeeting changes
  useEffect(() => {
    console.log('🔄 useEffect [agendaItems, activeMeeting] triggered');
    console.log('- activeMeeting:', activeMeeting?.id);
    console.log('- agendaItems length:', agendaItems.length);
    if (activeMeeting) {
      console.log('🔄 Updating activeMeetingItems due to agendaItems or activeMeeting change');
      console.log('- Setting activeMeetingItems to:', agendaItems.map(item => ({ id: item.id, title: item.title, order_index: item.order_index })));
      setActiveMeetingItems([...agendaItems]);
    } else {
      console.log('🔄 No active meeting, clearing activeMeetingItems');
      setActiveMeetingItems([]);
    }
  }, [agendaItems, activeMeeting]);

  // Update active meeting when agenda items change
  useEffect(() => {
    console.log('🔄 agendaItems useEffect triggered');
    console.log('- activeMeeting:', activeMeeting?.id);
    console.log('- agendaItems length:', agendaItems.length);
    console.log('- agendaItems:', agendaItems.map(item => ({
      id: item.id,
      title: item.title,
      order_index: item.order_index
    })));
    
    if (activeMeeting && agendaItems.length >= 0) {
      console.log('🔄 agendaItems changed during active meeting, triggering re-render');
      // Force re-render by updating the state
      setActiveMeeting(prev => prev ? {...prev, lastUpdate: Date.now()} : prev);
    }
  }, [agendaItems, activeMeeting?.id]);

  const loadMeetings = async () => {
    console.log('=== LOAD MEETINGS STARTED ===');
    console.log('Current user:', user?.id);
    
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user?.id) // Filter by user
        .neq('status', 'archived') // Exclude archived meetings
        .order('meeting_date', { ascending: false });

      console.log('Meetings query result:', data);
      console.log('Meetings query error:', error);
      console.log('Number of meetings loaded:', data?.length || 0);

      if (error) throw error;
      setMeetings((data || []).map(meeting => ({
        ...meeting,
        meeting_date: new Date(meeting.meeting_date)
      })));
      
      console.log('=== LOAD MEETINGS COMPLETED ===');
    } catch (error) {
      console.error('Error in loadMeetings:', error);
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
      console.log('=== LOADING AGENDA ITEMS ===');
      console.log('Meeting ID:', meetingId);
      
      const { data, error } = await supabase
        .from('meeting_agenda_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('order_index');

      if (error) throw error;
      
      console.log('Raw data from database:', data);
      
      const items = (data || []).map((item) => ({
        ...item,
        localKey: item.id,
        parentLocalKey: item.parent_id || undefined,
      }));
      
      console.log('Processed items:', items);
      console.log('Items sorted by order_index:', items.sort((a, b) => a.order_index - b.order_index));
      
      console.log('🚀 SETTING AGENDA ITEMS - This should trigger the useEffect');
      console.log('- Setting agendaItems to:', items.map(item => ({
        id: item.id,
        title: item.title,
        order_index: item.order_index
      })));
      
      setAgendaItems(items);
      
      console.log('✅ setAgendaItems called - useEffect should now trigger');
      
      // Load documents for all agenda items
      if (items.length > 0) {
        await loadAgendaDocuments(items.map(item => item.id!).filter(Boolean));
      }
    } catch (error) {
      console.error('Error loading agenda items:', error);
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
        .in('meeting_agenda_item_id', agendaItemIds);

      if (error) throw error;
      
      // Group documents by agenda item id
      const docsByItemId: Record<string, any[]> = {};
      data?.forEach(doc => {
        if (!docsByItemId[doc.meeting_agenda_item_id]) {
          docsByItemId[doc.meeting_agenda_item_id] = [];
        }
        docsByItemId[doc.meeting_agenda_item_id].push(doc);
      });
      
      setAgendaDocuments(docsByItemId);
    } catch (error) {
      console.error('Error loading agenda documents:', error);
    }
  };

  const uploadAgendaDocument = async (agendaItemId: string, file: File) => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${agendaItemId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save document record
      const { data: document, error: dbError } = await supabase
        .from('meeting_agenda_documents')
        .insert({
          meeting_agenda_item_id: agendaItemId,
          user_id: user.id,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update local state
      setAgendaDocuments(prev => ({
        ...prev,
        [agendaItemId]: [...(prev[agendaItemId] || []), document]
      }));

      return document;
    } catch (error) {
      console.error('Error uploading agenda document:', error);
      throw error;
    }
  };

  const deleteAgendaDocument = async (documentId: string, agendaItemId: string, filePath: string) => {
    try {
      // Remove from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Remove from database
      const { error: dbError } = await supabase
        .from('meeting_agenda_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      // Update local state
      setAgendaDocuments(prev => ({
        ...prev,
        [agendaItemId]: (prev[agendaItemId] || []).filter(doc => doc.id !== documentId)
      }));

      toast({
        title: "Dokument entfernt",
        description: "Das Dokument wurde erfolgreich entfernt.",
      });
    } catch (error) {
      console.error('Error deleting agenda document:', error);
      toast({
        title: "Fehler",
        description: "Dokument konnte nicht entfernt werden.",
        variant: "destructive",
      });
    }
  };
  const createMeeting = async () => {
    toast({
      title: "Meeting wird erstellt...",
      description: "Bitte warten...",
    });
    
    if (!user) {
      toast({
        title: "Fehler",
        description: "Kein Benutzer gefunden!",
        variant: "destructive",
      });
      return;
    }
    
    if (!newMeeting.title.trim()) {
      toast({
        title: "Fehler", 
        description: "Bitte geben Sie einen Titel ein!",
        variant: "destructive",
      });
      return;
    }

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

      toast({
        title: "Meeting erstellt",
        description: "Das Meeting wurde mit vordefinierter Agenda erstellt.",
      });
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: "Fehler beim Erstellen",
        description: `Supabase Fehler: ${error.message || error.toString()}`,
        variant: "destructive",
      });
    }
  };

  const createDefaultAgendaItems = async (meetingId: string) => {
    const defaultItems = [
      { title: 'Begrüßung', order_index: 0 },
      { title: 'Aktuelles aus dem Landtag', order_index: 1 },
      { title: 'Politische Schwerpunktthemen & Projekte', order_index: 2 },
      { title: 'Wahlkreisarbeit', order_index: 3 },
      { title: 'Kommunikation & Öffentlichkeitsarbeit', order_index: 4 },
      { title: 'Organisation & Bürointerna', order_index: 5 },
      { title: 'Verschiedenes', order_index: 6 }
    ];

    const insertItems = defaultItems.map(item => ({
      meeting_id: meetingId,
      title: item.title,
      description: null,
      assigned_to: null,
      notes: null,
      is_completed: false,
      is_recurring: false,
      task_id: null,
      order_index: item.order_index,
      parent_id: null
    }));

    const { error } = await supabase
      .from('meeting_agenda_items')
      .insert(insertItems);

    if (error) throw error;
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

  const archiveMeeting = async (meeting: Meeting) => {
    try {
      console.log('=== ARCHIVE MEETING STARTED ===');
      console.log('Meeting to archive:', meeting);
      console.log('User ID:', user?.id);
      
      if (!meeting) {
        console.log('ERROR: No meeting provided');
        throw new Error('Kein Meeting angegeben');
      }
      
      if (!meeting.id) {
        console.log('ERROR: No meeting ID provided');
        throw new Error('Meeting hat keine ID');
      }
      
      if (!user?.id) {
        console.log('ERROR: No user ID');
        throw new Error('Benutzer nicht angemeldet');
      }

      console.log('Step 1: Getting agenda items...');
      // First, get all agenda items with their results and assignments
      const { data: agendaItemsData, error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .select('*')
        .eq('meeting_id', meeting.id);

      console.log('Agenda items data:', agendaItemsData);
      console.log('Agenda error:', agendaError);

      if (agendaError) throw agendaError;

      console.log('Step 2: Creating follow-up task...');
      // Create follow-up task
      const followUpTaskData = {
        user_id: user.id,
        title: `Nachbereitung ${meeting.title} vom ${format(new Date(), 'dd.MM.yyyy')}`,
        description: `Nachbereitung der Besprechung "${meeting.title}"`,
        priority: 'medium',
        category: 'administrative',
        status: 'todo',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      };

      const { data: followUpTask, error: taskError } = await supabase
        .from('tasks')
        .insert(followUpTaskData)
        .select()
        .single();

      if (taskError) throw taskError;

      console.log('Step 3: Creating subtasks from agenda results...');
      // Create subtasks for all agenda items and sub-items with results
      const subtasksToCreate = [];
      
      if (agendaItemsData) {
        for (const item of agendaItemsData) {
          if (item.result_text && item.result_text.trim()) {
            const assignedUserId = item.assigned_to || user.id;
            subtasksToCreate.push({
              task_id: followUpTask.id,
              title: item.title,
              description: `Ergebnis: ${item.result_text}`,
              assigned_to: assignedUserId,
              completed: false,
              order_index: subtasksToCreate.length
            });
          }
        }
      }

      if (subtasksToCreate.length > 0) {
        const { error: subtaskError } = await supabase
          .from('subtasks')
          .insert(subtasksToCreate);

        if (subtaskError) {
          console.error('Error creating subtasks:', subtaskError);
        }
      }

      console.log('Step 4: Archiving meeting...');
      // Archive the meeting
      const { data: archiveData, error: archiveError } = await supabase
        .from('meetings')
        .update({ status: 'archived' })
        .eq('id', meeting.id)
        .select();

      console.log('Archive update result:', archiveData);
      console.log('Archive error:', archiveError);
      
      if (archiveError) throw archiveError;

      // Process agenda items for task updates and creation
      if (agendaItemsData && agendaItemsData.length > 0) {
        for (const item of agendaItemsData) {
          // Update existing tasks with results
          if (item.task_id && item.result_text) {
            const { data: existingTask, error: taskError } = await supabase
              .from('tasks')
              .select('description')
              .eq('id', item.task_id)
              .single();

            if (!taskError && existingTask) {
              const currentDescription = existingTask.description || '';
              const meetingResult = `\n\n--- Ergänzung aus Besprechung "${meeting.title}": ---\n${item.result_text}`;
              
              await supabase
                .from('tasks')
                .update({
                  description: currentDescription + meetingResult,
                  updated_at: new Date().toISOString()
                })
                .eq('id', item.task_id);
            }
          }

          // Create new tasks for items with results and assignments (but no existing task)
          if (item.result_text && item.assigned_to && !item.task_id) {
            // Determine task category based on agenda item parent or title
            let taskCategory = 'meeting'; // Default fallback
            
            // Map agenda categories to task categories
            const categoryMapping: { [key: string]: string } = {
              'Politische Schwerpunktthemen & Projekte': 'political',
              'Termine & Veranstaltungen': 'events',
              'Wahlkreisarbeit': 'constituency',
              'Kommunikation & Öffentlichkeitsarbeit': 'communication',
              'Organisation & Bürointerna': 'organization',
              'Verschiedenes': 'personal'
            };

            // If this is a sub-item, find its parent to determine category
            if (item.parent_id) {
              const parentItem = agendaItemsData.find(parent => parent.id === item.parent_id);
              if (parentItem && categoryMapping[parentItem.title]) {
                taskCategory = categoryMapping[parentItem.title];
              }
            } else {
              // If this is a main category item, use its title to determine category
              if (categoryMapping[item.title]) {
                taskCategory = categoryMapping[item.title];
              }
            }

            const { data: newTask, error: newTaskError } = await supabase
              .from('tasks')
              .insert({
                user_id: user?.id,
                title: item.title,
                description: item.description || '',
                priority: 'medium',
                category: taskCategory,
                status: 'todo',
                assigned_to: item.assigned_to,
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
              })
              .select()
              .single();

            if (!newTaskError && newTask) {
              // Create a subtask with the meeting result
              await supabase
                .from('tasks')
                .insert({
                  user_id: user?.id,
                  title: `Ergebnis aus Besprechung: ${item.title}`,
                  description: item.result_text,
                  priority: 'medium',
                  category: taskCategory,
                  status: 'todo',
                  assigned_to: item.assigned_to,
                  due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days from now
                });

              // Copy documents from agenda item to new task
              const { data: agendaDocuments } = await supabase
                .from('planning_item_documents')
                .select('*')
                .eq('planning_item_id', item.id);

              if (agendaDocuments && agendaDocuments.length > 0) {
                const taskDocuments = agendaDocuments.map(doc => ({
                  task_id: newTask.id,
                  user_id: user?.id,
                  file_name: doc.file_name,
                  file_path: doc.file_path,
                  file_type: doc.file_type,
                  file_size: doc.file_size
                }));

                await supabase
                  .from('task_documents')
                  .insert(taskDocuments);
              }
            }
          }
        }
      }
      
      console.log('Step 3: Setting active meeting to null...');
      setActiveMeeting(null);
      
      console.log('Step 4: Reloading meetings...');
      await loadMeetings(); // Reload to update UI
      
      console.log('=== ARCHIVE MEETING COMPLETED SUCCESSFULLY ===');
      toast({
        title: "Besprechung archiviert",
        description: "Die Besprechung wurde erfolgreich archiviert und Aufgaben wurden aktualisiert."
      });
    } catch (error) {
      console.error('=== ARCHIVE MEETING ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      
      // Mehr Debug-Informationen
      console.log('Meeting object:', meeting);
      console.log('User object:', user);
      
      const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error));
      
      toast({
        title: "Fehler",
        description: `Die Besprechung konnte nicht archiviert werden: ${errorMessage}`,
        variant: "destructive"
      });
    }
  };

  const updateAgendaItemResult = async (itemId: string, field: 'result_text' | 'carry_over_to_next', value: any) => {
    try {
      await supabase
        .from('meeting_agenda_items')
        .update({ [field]: value })
        .eq('id', itemId);
      
      // Update local state
      setAgendaItems(items => 
        items.map(item => 
          item.id === itemId ? { ...item, [field]: value } : item
        )
      );
    } catch (error) {
      console.error('Error updating agenda item:', error);
      toast({
        title: "Fehler",
        description: "Die Änderung konnte nicht gespeichert werden.",
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

  const updateAgendaItem = async (index: number, field: keyof AgendaItem, value: any) => {
    console.log('🔧 UPDATE AGENDA ITEM:', { index, field, value });
    
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    setAgendaItems(updated);
    
    // Auto-save if item has an ID and we have a selected meeting
    if (updated[index].id && selectedMeeting?.id) {
      try {
        console.log('💾 Auto-saving agenda item change to database');
        await supabase
          .from('meeting_agenda_items')
          .update({ [field]: value })
          .eq('id', updated[index].id);
          
        console.log('✅ Auto-save successful');
        
        // If this is the active meeting, immediately reload agenda items  
        if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
          console.log('🔄 Active meeting detected - immediately reloading agenda after item update');
          loadAgendaItems(selectedMeeting.id);
        }
      } catch (error) {
        console.error('Auto-save error:', error);
      }
    }
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
      
      console.log('🔍 SAVE AGENDA - Checking for active meeting');
      console.log('- activeMeeting:', activeMeeting);
      console.log('- selectedMeeting:', selectedMeeting);
      console.log('- activeMeeting.id === selectedMeeting.id:', activeMeeting?.id === selectedMeeting?.id);
      
      // If this is the active meeting, reload the agenda to reflect changes
      if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
        console.log('🔄 RELOADING AGENDA for active meeting:', selectedMeeting.id);
        await loadAgendaItems(selectedMeeting.id);
        console.log('✅ AGENDA RELOADED for active meeting');
      } else {
        console.log('❌ NOT reloading agenda - not an active meeting or conditions not met');
      }
    } catch (error) {
      toast({
        title: 'Fehler beim Speichern',
        description: 'Die Agenda konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
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
      
      // Get task documents for this task
      const taskDocs = taskDocuments[task.id] || [];
      let documentPath = null;
      
      // If task has documents, we'll reference the first one (or could concatenate all)
      if (taskDocs.length > 0) {
        documentPath = taskDocs[0].file_path;
      }

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
          file_path: documentPath,
        })
        .select()
        .single();

      if (taskError) throw taskError;
      
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

      // Update order_index in database for all existing items
      for (const item of reindexedItems) {
        if (item.id && item.id !== taskData.id) { // Don't update the newly created item
          await supabase
            .from('meeting_agenda_items')
            .update({ order_index: item.order_index })
            .eq('id', item.id);
        }
      }
      
      // If this is the active meeting, reload the agenda to reflect changes
      if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
        await loadAgendaItems(selectedMeeting.id);
      }
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

  const addSubItem = async (parent: AgendaItem, title: string) => {
    if (!selectedMeeting?.id) return;
    
    try {
      let parentId = parent.id;
      const parentIndex = agendaItems.findIndex(item => item.localKey === parent.localKey || item.id === parent.id);
      
      // If parent doesn't have an ID yet, save it first
      if (!parentId) {
        const { data: parentData, error: parentError } = await supabase
          .from('meeting_agenda_items')
          .insert({
            meeting_id: selectedMeeting.id,
            title: parent.title,
            description: parent.description || null,
            order_index: parent.order_index,
            is_completed: false,
            is_recurring: false,
          })
          .select()
          .single();
        
        if (parentError) throw parentError;
        parentId = parentData.id;
        
        // Update parent in local state
        const updatedItems = [...agendaItems];
        updatedItems[parentIndex] = { ...parent, id: parentId };
        setAgendaItems(updatedItems);
      }

      // Calculate the correct order index for the sub-item (right after parent)
      const subItemOrderIndex = parentIndex + 1;

      // Insert the sub-item with correct parent_id
      const { data: subItemData, error: subItemError } = await supabase
        .from('meeting_agenda_items')
        .insert({
          meeting_id: selectedMeeting.id,
          title: title || '',
          description: '',
          parent_id: parentId, // This is the key - setting the correct parent_id
          order_index: subItemOrderIndex,
          is_completed: false,
          is_recurring: false,
        })
        .select()
        .single();

      if (subItemError) throw subItemError;

      // Create the new sub-item with proper parent reference
      const newSubItem: AgendaItem = {
        ...subItemData,
        localKey: subItemData.id,
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

      // Update order_index in database for all existing items
      for (const item of reindexedItems) {
        if (item.id && item.id !== subItemData.id) { // Don't update the newly created item
          await supabase
            .from('meeting_agenda_items')
            .update({ order_index: item.order_index })
            .eq('id', item.id);
        }
      }

      // If this is the active meeting, reload the agenda to reflect changes
      if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
        await loadAgendaItems(selectedMeeting.id);
      }

      toast({
        title: "Unterpunkt hinzugefügt",
        description: `Unterpunkt wurde zu "${parent.title}" hinzugefügt.`,
      });
      
    } catch (error) {
      console.error('Error saving sub-item:', error);
      toast({
        title: "Fehler",
        description: "Unterpunkt konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
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

        // Remove item from local state and reindex properly
        const updatedItems = agendaItems.filter((_, i) => i !== index);
        const reindexedItems = updatedItems.map((item, idx) => ({
          ...item,
          order_index: idx
        }));
        setAgendaItems(reindexedItems);

        toast({
          title: "Punkt gelöscht",
          description: "Der Agenda-Punkt wurde erfolgreich gelöscht.",
        });
      } else {
        // If no ID, just remove locally and reindex
        const updatedItems = agendaItems.filter((_, i) => i !== index);
        const reindexedItems = updatedItems.map((item, idx) => ({
          ...item,
          order_index: idx
        }));
        setAgendaItems(reindexedItems);
      }
    } catch (error) {
      toast({
        title: "Fehler beim Löschen",
        description: "Der Agenda-Punkt konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    
    console.log('🚀 DRAG & DROP START');
    console.log('Source:', source.index, 'Destination:', destination.index);
    console.log('Current agendaItems before drag:', agendaItems.map(item => ({
      id: item.id,
      title: item.title,
      order_index: item.order_index,
      parent_id: item.parent_id,
      localKey: item.localKey,
      parentLocalKey: item.parentLocalKey
    })));

    // Create a copy of all items
    const allItems = [...agendaItems];
    
    // Get the dragged item
    const draggedItem = allItems[source.index];
    
    console.log('Dragged item:', {
      title: draggedItem.title,
      parent_id: draggedItem.parent_id,
      parentLocalKey: draggedItem.parentLocalKey,
      isMainItem: !draggedItem.parent_id && !draggedItem.parentLocalKey
    });

    // Remove the dragged item from its current position
    allItems.splice(source.index, 1);

    // If this is a main item (no parent), move it with all its children
    if (!draggedItem.parent_id && !draggedItem.parentLocalKey) {
      const draggedKey = draggedItem.id || draggedItem.localKey;
      
      // Find all children of this main item
      const children = allItems.filter(item => 
        item.parent_id === draggedItem.id || item.parentLocalKey === draggedKey
      );
      
      console.log('Found children for main item:', children.map(c => c.title));
      
      // Remove children from their current positions (in reverse order)
      children.reverse().forEach(child => {
        const childIndex = allItems.findIndex(item => 
          item.id === child.id || item.localKey === child.localKey
        );
        if (childIndex !== -1) {
          allItems.splice(childIndex, 1);
        }
      });

      // Insert the main item at the new position
      allItems.splice(destination.index, 0, draggedItem);

      // Insert all children right after the main item
      children.reverse().forEach((child, index) => {
        allItems.splice(destination.index + 1 + index, 0, child);
      });
    } else {
      // For sub-items, we need to check if they're being moved under a different parent
      // Find the new parent by looking at the item before the destination
      let newParentItem = null;
      let newParentKey = null;
      
      // Look backwards from destination to find the main item this sub-item should belong to
      for (let i = destination.index - 1; i >= 0; i--) {
        const potentialParent = allItems[i];
        // If we find a main item (no parent), this is our new parent
        if (!potentialParent.parent_id && !potentialParent.parentLocalKey) {
          newParentItem = potentialParent;
          newParentKey = potentialParent.id || potentialParent.localKey;
          break;
        }
      }
      
      console.log('🔄 Sub-item being moved. New parent:', newParentItem?.title);
      
      // Update the dragged item's parent
      if (newParentItem) {
        draggedItem.parent_id = newParentItem.id || null;
        draggedItem.parentLocalKey = newParentKey;
      } else {
        // If no parent found, make it a main item
        draggedItem.parent_id = null;
        draggedItem.parentLocalKey = undefined;
      }
      
      // Insert at the new position
      allItems.splice(destination.index, 0, draggedItem);
    }

    // Update order indices for all items
    const reorderedItems = allItems.map((item, index) => ({
      ...item,
      order_index: index
    }));

    console.log('🎯 Final reordered items:', reorderedItems.map(item => ({
      id: item.id,
      title: item.title,
      order_index: item.order_index,
      parent_id: item.parent_id,
      parentLocalKey: item.parentLocalKey,
      type: (item.parent_id || item.parentLocalKey) ? 'sub-item' : 'main-item'
    })));

    // Update the state
    console.log('🔴 BEFORE setAgendaItems - Current agendaItems:', agendaItems.map(item => ({
      title: item.title,
      order_index: item.order_index,
      parent_id: item.parent_id
    })));
    
    console.log('🟢 AFTER drag & drop - Setting new agendaItems:', reorderedItems.map(item => ({
      title: item.title,
      order_index: item.order_index,
      parent_id: item.parent_id
    })));
    
    setAgendaItems(reorderedItems);
    
    console.log('🔵 Active meeting should now re-render with new order');
    
    // Force re-render if this is an active meeting
    if (activeMeeting?.id === selectedMeeting?.id) {
      console.log('🚀 This is the active meeting - forcing re-render');
      // This will trigger a re-render of the active meeting section
      setActiveMeeting({...activeMeeting});
    }

    // Save the new order to database immediately for ALL items that already exist
      if (selectedMeeting?.id) {
        try {
          console.log('🔄 Batch updating order_index for all items in database...');
          
          // Batch update all existing items at once
          const existingItems = reorderedItems.filter(item => item.id);
          if (existingItems.length > 0) {
            const { error } = await supabase
              .from('meeting_agenda_items')
              .upsert(
                existingItems.map(item => ({
                  id: item.id,
                  order_index: item.order_index,
                  meeting_id: selectedMeeting.id,
                  title: item.title,
                  description: item.description || '',
                   assigned_to: item.assigned_to || 'unassigned',
                   parent_id: item.parent_id,
                   updated_at: new Date().toISOString()
                })),
                { onConflict: 'id' }
              );

            if (error) throw error;
          }
          
          // If this is the active meeting, immediately reload agenda items
          if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
            console.log('🔄 Active meeting detected - immediately reloading agenda');
            loadAgendaItems(selectedMeeting.id);
          }
          
          console.log('✅ Drag & drop completed - all order_index values updated in database');
        } catch (error) {
          console.error('Error updating order:', error);
          toast({
            title: "Fehler",
            description: "Die neue Reihenfolge konnte nicht gespeichert werden.",
            variant: "destructive",
          });
        }
      }
  };

  // Helper functions for meeting management
  const updateMeeting = async (meetingId: string, updates: Partial<Meeting>) => {
    try {
      // Format meeting_date to string if it's a Date object
      const formattedUpdates = {
        ...updates,
        meeting_date: updates.meeting_date instanceof Date 
          ? format(updates.meeting_date, 'yyyy-MM-dd')
          : updates.meeting_date
      };

      const { error } = await supabase
        .from('meetings')
        .update(formattedUpdates)
        .eq('id', meetingId);

      if (error) throw error;

      // Update local state
      setMeetings(meetings.map(m => 
        m.id === meetingId ? { ...m, ...updates } : m
      ));

      // Update selected meeting if it's the current one
      if (selectedMeeting?.id === meetingId) {
        setSelectedMeeting({ ...selectedMeeting, ...updates });
      }

      // Update corresponding appointment in calendar
      await supabase
        .from('appointments')
        .update({
          title: updates.title,
          description: updates.description,
          location: updates.location,
          start_time: updates.meeting_date ? 
            `${format(new Date(updates.meeting_date), 'yyyy-MM-dd')}T${newMeetingTime}:00` : 
            undefined,
          end_time: updates.meeting_date ? 
            `${format(new Date(updates.meeting_date), 'yyyy-MM-dd')}T${String(parseInt(newMeetingTime.split(':')[0]) + 1).padStart(2, '0')}:${newMeetingTime.split(':')[1]}:00` : 
            undefined,
        })
        .eq('meeting_id', meetingId);

      toast({
        title: "Meeting aktualisiert",
        description: "Das Meeting wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Das Meeting konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      // Delete agenda items first
      await supabase
        .from('meeting_agenda_items')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete corresponding appointment
      await supabase
        .from('appointments')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete meeting
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
      toast({
        title: "Fehler",
        description: "Das Meeting konnte nicht gelöscht werden.",
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

  // Show archive view if requested
  if (showArchive) {
    return <MeetingArchiveView onBack={() => setShowArchive(false)} />;
  }

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
                <label className="text-sm font-medium">Ort</label>
                <Input
                  value={newMeeting.location || ''}
                  onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                  placeholder="Meeting Ort"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Template</label>
                <Select
                  value={newMeeting.template_id || 'none'}
                  onValueChange={(value) => setNewMeeting({ ...newMeeting, template_id: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Template auswählen (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Template</SelectItem>
                    {meetingTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="text-sm font-medium">Startzeit</label>
                  <Input
                    type="time"
                    value={newMeetingTime}
                    onChange={(e) => setNewMeetingTime(e.target.value)}
                    className="w-full"
                  />
                </div>
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
          <Button variant="link" className="text-primary px-0" onClick={() => setShowArchive(true)}>Archiv</Button>
        </div>
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
                          className="font-semibold"
                        />
                         <Textarea
                           value={editingMeeting.description || ''}
                           onChange={(e) => setEditingMeeting({ ...editingMeeting, description: e.target.value })}
                           placeholder="Beschreibung"
                           className="text-sm"
                         />
                         <Input
                           value={editingMeeting.location || ''}
                           onChange={(e) => setEditingMeeting({ ...editingMeeting, location: e.target.value })}
                           placeholder="Ort"
                           className="text-sm"
                         />
                        <div className="grid grid-cols-2 gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-3 w-3" />
                                {format(new Date(editingMeeting.meeting_date), "dd.MM.yyyy", { locale: de })}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={new Date(editingMeeting.meeting_date)}
                                onSelect={(date) => date && setEditingMeeting({ ...editingMeeting, meeting_date: date })}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="time"
                            value={newMeetingTime}
                            onChange={(e) => setNewMeetingTime(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-base">{meeting.title}</CardTitle>
                        <CardDescription>
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            {format(new Date(meeting.meeting_date), 'PPP', { locale: de })}
                          </div>
                          {meeting.location && (
                            <div className="flex items-center gap-2 mt-1">
                              <Users className="h-4 w-4" />
                              <span className="text-xs">{meeting.location}</span>
                            </div>
                          )}
                          {meeting.description && (
                            <p className="text-xs mt-1 text-muted-foreground">{meeting.description}</p>
                          )}
                        </CardDescription>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    {editingMeeting?.id === meeting.id ? (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8" 
                          onClick={() => {
                            updateMeeting(meeting.id!, editingMeeting);
                            setEditingMeeting(null);
                          }}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" 
                          onClick={() => setEditingMeeting(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8" 
                          onClick={() => setEditingMeeting(meeting)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                         <AlertDialog>
                           <AlertDialogTrigger asChild>
                             <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                               <Trash className="h-4 w-4" />
                             </Button>
                           </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Meeting löschen</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sind Sie sicher, dass Sie das Meeting "{meeting.title}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
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
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-end">
                  <Button size="sm" variant="default" 
                    onClick={() => startMeeting(meeting)}
                    className="w-full">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Start
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {upcomingMeetings.length === 0 && (
            <Card className="md:col-span-3"><CardContent className="p-4 text-muted-foreground">Keine anstehenden Besprechungen</CardContent></Card>
          )}
        </div>
      </div>

      {/* Active Meeting View */}
      {activeMeeting && (
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">
              Aktive Besprechung: {activeMeeting.title}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={stopMeeting}>
                Besprechung unterbrechen
              </Button>
              <Button variant="default" onClick={() => {
                console.log('=== ARCHIVE BUTTON CLICKED ===');
                console.log('Active Meeting:', activeMeeting);
                alert('Button wurde geklickt!'); // Einfacher Test
                archiveMeeting(activeMeeting);
              }}>
                Besprechung beenden und archivieren
              </Button>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Tagesordnung</CardTitle>
              <CardDescription>
                {format(new Date(activeMeeting.meeting_date), 'PPP', { locale: de })}
                {activeMeeting.location && ` • ${activeMeeting.location}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(() => {
                  console.log('🎯 ACTIVE MEETING RENDER - activeMeetingItems at render time:', activeMeetingItems.map(item => ({
                    title: item.title,
                    order_index: item.order_index,
                    parent_id: item.parent_id,
                    isMainItem: !item.parent_id && !item.parentLocalKey
                  })));
                  
                  console.log('=== ACTIVE MEETING RENDERING ===');
                  console.log('All agenda items before processing:', activeMeetingItems.map(item => ({
                    id: item.id,
                    title: item.title,
                    order_index: item.order_index,
                    parent_id: item.parent_id,
                    parentLocalKey: item.parentLocalKey
                  })));
                  
                  // Sort ALL items by order_index first - this is the order from drag & drop
                  const allItemsSorted = [...activeMeetingItems].sort((a, b) => a.order_index - b.order_index);
                  console.log('All items sorted by order_index:', allItemsSorted.map(item => ({
                    title: item.title,
                    order_index: item.order_index,
                    hasParent: !!(item.parent_id || item.parentLocalKey)
                  })));
                  
                  const processedItems: any[] = [];

                  // Process items in their order_index sequence to maintain drag & drop order
                  allItemsSorted.forEach((item) => {
                    // Only process main items (no parent)
                    if (!item.parent_id && !item.parentLocalKey) {
                      // Find ALL sub-items that belong to this main item and sort by order_index
                      const subItems = allItemsSorted.filter(subItem => {
                        // For items saved to database: check parent_id matches item.id
                        if (subItem.parent_id && item.id) {
                          return subItem.parent_id === item.id;
                        }
                        // For local items not yet saved: check parentLocalKey matches item.localKey
                        if (subItem.parentLocalKey && item.localKey) {
                          return subItem.parentLocalKey === item.localKey;
                        }
                        return false;
                      }).sort((a, b) => a.order_index - b.order_index);
                      
                      console.log(`Main item: ${item.title} (order: ${item.order_index}) with ${subItems.length} sub-items:`, 
                        subItems.map(sub => ({ title: sub.title, order_index: sub.order_index })));
                      
                      processedItems.push({ item, subItems });
                    }
                  });

                  console.log('Final processed items for active meeting:', processedItems.map(proc => ({
                    mainTitle: proc.item.title,
                    order: proc.item.order_index,
                    subItemsCount: proc.subItems.length
                  })));

                  return processedItems.map(({ item, subItems: sortedSubItems }, index) => {
                    
                    console.log(`Item ${index + 1} (${item.title}):`, {
                      item,
                      subItems: sortedSubItems,
                      sortedSubItems
                    });
                    
                    return (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-medium">
                            {index + 1}
                        </div>
                         <Input
                           value={item.title}
                           onChange={(e) => updateAgendaItem(
                             agendaItems.findIndex(i => i.id === item.id),
                             'title',
                             e.target.value
                           )}
                           className="font-medium text-lg flex-1 border-none shadow-none p-0 h-auto bg-transparent"
                           placeholder="Agenda-Punkt Titel"
                         />
                        <div className="flex items-center gap-2">
                          <Select
                            value={item.assigned_to || 'unassigned'}
                            onValueChange={(value) => updateAgendaItem(
                              agendaItems.findIndex(i => i.id === item.id), 
                              'assigned_to', 
                              value === 'unassigned' ? null : value
                            )}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Bearbeiter zuweisen" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                              {profiles.map((profile) => (
                                <SelectItem key={profile.user_id} value={profile.user_id}>
                                  {profile.display_name || 'Unbekannter Benutzer'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {item.description && (
                        <p className="text-muted-foreground mb-3 ml-12">{item.description}</p>
                      )}

                      {/* Display notes if available */}
                      {item.notes && (
                        <div className="ml-12 mb-3">
                          <label className="text-sm font-medium mb-1 block">Notizen</label>
                          <div className="bg-muted/30 p-3 rounded-lg border text-sm">
                            {item.notes}
                          </div>
                        </div>
                      )}

                      {/* Display file attachment if available */}
                      {item.file_path && (
                        <div className="ml-12 mb-3">
                          <label className="text-sm font-medium mb-1 block">Anhang</label>
                          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded border">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm flex-1">
                              {item.file_path.split('/').pop()?.split('_').slice(2).join('_') || 'Datei'}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={async () => {
                                try {
                                  const { data, error } = await supabase.storage
                                    .from('documents')
                                    .download(item.file_path!);
                                  
                                  if (error) throw error;
                                  
                                  const fileName = item.file_path!.split('/').pop()?.split('_').slice(2).join('_') || 'download';
                                  const url = URL.createObjectURL(data);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = fileName;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } catch (error) {
                                  toast({
                                    title: "Download-Fehler",
                                    description: "Datei konnte nicht heruntergeladen werden.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                       {/* Display sub-items */}
                       {sortedSubItems.length > 0 && (
                         <div className="ml-12 mb-3">
                           <label className="text-sm font-medium mb-2 block">Unterpunkte</label>
                           <div className="space-y-2">
                                 {sortedSubItems.map((subItem, subIndex) => (
                                 <div key={subItem.id} className="pl-4 border-l-2 border-muted">
                                   <div className="flex items-center gap-2 mb-2">
                                     <span className="text-xs font-medium text-muted-foreground">
                                       {index + 1}.{subIndex + 1}
                                     </span>
                                     <span className="text-sm font-medium flex-1">{subItem.title}</span>
                                     <Select
                                       value={subItem.assigned_to || 'unassigned'}
                                       onValueChange={(value) => {
                                         const itemIndex = agendaItems.findIndex(i => i.id === subItem.id);
                                         if (itemIndex !== -1) {
                                           updateAgendaItem(itemIndex, 'assigned_to', value === 'unassigned' ? null : value);
                                         }
                                       }}
                                     >
                                       <SelectTrigger className="w-[140px] h-6 text-xs">
                                         <SelectValue placeholder="Zuweisen" />
                                       </SelectTrigger>
                                       <SelectContent>
                                         <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                                         {profiles.map((profile) => (
                                           <SelectItem key={profile.user_id} value={profile.user_id}>
                                             {profile.display_name || 'Unbekannter Benutzer'}
                                           </SelectItem>
                                         ))}
                                       </SelectContent>
                                     </Select>
                                   </div>
                                   {subItem.description && (
                                     <div className="mb-2 bg-muted/20 p-2 rounded border-l-2 border-primary/20">
                                       <p className="text-sm text-foreground whitespace-pre-wrap">{subItem.description}</p>
                                     </div>
                                   )}
                                {subItem.notes && (
                                  <div className="mb-2">
                                    <span className="text-xs font-medium text-muted-foreground">Notizen: </span>
                                    <span className="text-xs">{subItem.notes}</span>
                                  </div>
                                )}
                                {/* Show all documents: agenda documents + task documents + legacy file_path */}
                                {(
                                  (agendaDocuments[subItem.id!] && agendaDocuments[subItem.id!].length > 0) ||
                                  (subItem.task_id && taskDocuments[subItem.task_id] && taskDocuments[subItem.task_id].length > 0) ||
                                  subItem.file_path
                                ) && (
                                  <div className="mb-2">
                                    <div className="text-xs font-medium text-muted-foreground mb-1">Dokumente:</div>
                                    <div className="space-y-1">
                                      {/* Agenda documents */}
                                      {agendaDocuments[subItem.id!] && agendaDocuments[subItem.id!].map((doc, docIndex) => (
                                        <div key={`agenda-${docIndex}`} className="flex items-center gap-1">
                                          <FileText className="h-3 w-3 text-blue-600" />
                                          <span className="text-xs text-blue-700">{doc.file_name}</span>
                                          <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="h-4 w-4 p-0"
                                            onClick={async () => {
                                              try {
                                                const { data, error } = await supabase.storage
                                                  .from('documents')
                                                  .download(doc.file_path);
                                                
                                                if (error) throw error;
                                                
                                                const url = URL.createObjectURL(data);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = doc.file_name;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                              } catch (error) {
                                                console.error('Download error:', error);
                                                toast({
                                                  title: "Download-Fehler",
                                                  description: "Datei konnte nicht heruntergeladen werden.",
                                                  variant: "destructive",
                                                });
                                              }
                                            }}
                                          >
                                            <Download className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                      
                                      {/* Task documents */}
                                      {subItem.task_id && taskDocuments[subItem.task_id] && taskDocuments[subItem.task_id].map((doc, docIndex) => (
                                        <div key={`task-${docIndex}`} className="flex items-center gap-1">
                                          <FileText className="h-3 w-3 text-green-600" />
                                          <span className="text-xs text-green-700">{doc.file_name}</span>
                                          <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="h-4 w-4 p-0"
                                            onClick={async () => {
                                              try {
                                                const { data, error } = await supabase.storage
                                                  .from('task-documents')
                                                  .download(doc.file_path);
                                                
                                                if (error) throw error;
                                                
                                                const url = URL.createObjectURL(data);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = doc.file_name;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                              } catch (error) {
                                                console.error('Download error:', error);
                                                toast({
                                                  title: "Download-Fehler",
                                                  description: "Datei konnte nicht heruntergeladen werden.",
                                                  variant: "destructive",
                                                });
                                              }
                                            }}
                                          >
                                            <Download className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                      
                                      {/* Legacy file_path documents */}
                                      {subItem.file_path && !subItem.task_id && (
                                        <div className="flex items-center gap-1">
                                          <FileText className="h-3 w-3 text-blue-600" />
                                          <span className="text-xs">
                                            {subItem.file_path.split('/').pop()?.split('_').slice(2).join('_') || 'Datei'}
                                          </span>
                                          <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="h-4 w-4 p-0"
                                            onClick={async () => {
                                              try {
                                                const { data, error } = await supabase.storage
                                                  .from('documents')
                                                  .download(subItem.file_path!);
                                                
                                                if (error) throw error;
                                                
                                                const fileName = subItem.file_path!.split('/').pop()?.split('_').slice(2).join('_') || 'download';
                                                const url = URL.createObjectURL(data);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = fileName;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                              } catch (error) {
                                                toast({
                                                  title: "Download-Fehler",
                                                  description: "Datei konnte nicht heruntergeladen werden.",
                                                  variant: "destructive",
                                                });
                                              }
                                            }}
                                          >
                                            <Download className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  <div>
                                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
                                    <Textarea
                                      value={subItem.result_text || ''}
                                      onChange={(e) => updateAgendaItemResult(subItem.id!, 'result_text', e.target.value)}
                                      placeholder="Ergebnis für diesen Unterpunkt..."
                                      className="min-h-[60px] text-xs"
                                    />
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`carryover-sub-${subItem.id}`}
                                      checked={subItem.carry_over_to_next || false}
                                      onCheckedChange={(checked) => 
                                        updateAgendaItemResult(subItem.id!, 'carry_over_to_next', checked)
                                      }
                                    />
                                    <label 
                                      htmlFor={`carryover-sub-${subItem.id}`}
                                      className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                      Auf nächste Besprechung übertragen
                                    </label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="ml-12 space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Ergebnis der Besprechung</label>
                          <Textarea
                            value={item.result_text || ''}
                            onChange={(e) => updateAgendaItemResult(item.id!, 'result_text', e.target.value)}
                            placeholder="Ergebnis, Beschlüsse oder wichtige Punkte..."
                            className="min-h-[80px]"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`carryover-${item.id}`}
                            checked={item.carry_over_to_next || false}
                            onCheckedChange={(checked) => 
                              updateAgendaItemResult(item.id!, 'carry_over_to_next', checked)
                            }
                          />
                          <label 
                            htmlFor={`carryover-${item.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Auf nächste Besprechung übertragen
                          </label>
                        </div>
                      </div>
                      </div>
                    );
                  });
                })()}
                
                {activeMeetingItems.filter(item => !item.parent_id && !item.parentLocalKey).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4" />
                    <p>Keine Agenda-Punkte für diese Besprechung gefunden.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agenda Editor */}
      <div className="space-y-4">
          {selectedMeeting && !activeMeeting ? (
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


              {/* Agenda Items */}
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="agenda-items">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3"
                    >
                      {agendaItems.map((item, index) => (
                        <Draggable 
                          key={item.localKey || item.id || index} 
                          draggableId={item.localKey || item.id || `item-${index}`}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <Card 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                item.parentLocalKey && 'ml-6 border-l border-border',
                                snapshot.isDragging && 'shadow-glow'
                              )}
                            > 
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <div 
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
                                  </div>
                                  
                                   <div className="flex-1 space-y-3">
                                     <div className="flex items-center gap-2">
                                       <Input
                                         value={item.title}
                                         onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                                         placeholder={item.parentLocalKey ? 'Unterpunkt' : 'Agenda-Punkt Titel'}
                                         className="font-medium flex-1"
                                       />
                                        {!item.parentLocalKey && (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button size="icon" variant="ghost" className="shrink-0" aria-label="Unterpunkt hinzufügen">
                                                <Plus className="h-4 w-4" />
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80">
                                              <div className="space-y-2">
                                                {SUBPOINT_OPTIONS[item.title] && SUBPOINT_OPTIONS[item.title].map((opt) => (
                                                  <Button key={opt} variant="outline" className="w-full justify-start text-left whitespace-normal h-auto p-3"
                                                    onClick={() => addSubItem(item, opt)}>
                                                    <span className="text-sm">{opt}</span>
                                                  </Button>
                                                ))}
                                                <Button variant="secondary" className="w-full" onClick={() => addSubItem(item, '')}>
                                                  <Plus className="h-4 w-4 mr-2" />
                                                  Freien Unterpunkt hinzufügen
                                                </Button>
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        )}
                                        {!item.parentLocalKey && (
                                          <Popover open={showTaskSelector?.itemIndex === index} onOpenChange={(open) => 
                                            setShowTaskSelector(open ? {itemIndex: index} : null)
                                          }>
                                            <PopoverTrigger asChild>
                                              <Button size="icon" variant="ghost" className="shrink-0" aria-label="Aufgabe hinzufügen">
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
                                         onClick={() => deleteAgendaItem(item, index)} aria-label="Punkt löschen">
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

                                          {/* Display task documents above notes field (subtle) */}
                                          {item.task_id && taskDocuments[item.task_id] && taskDocuments[item.task_id].length > 0 && (
                                            <div className="mb-3">
                                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                                <FileText className="h-3 w-3" />
                                                <span>Aufgaben-Dokumente:</span>
                                              </div>
                                              <div className="space-y-1">
                                                {taskDocuments[item.task_id].map((doc, docIndex) => (
                                                  <div key={docIndex} className="flex items-center justify-between py-1 px-2 hover:bg-muted/30 rounded text-xs">
                                                    <span className="text-muted-foreground truncate">
                                                      {doc.file_name || 'Dokument'}
                                                    </span>
                                                    <Button 
                                                      variant="ghost" 
                                                      size="sm"
                                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                      onClick={async () => {
                                                        try {
                                                          const { data, error } = await supabase.storage
                                                            .from('task-documents')
                                                            .download(doc.file_path);
                                                          
                                                          if (error) throw error;
                                                          
                                                          const url = URL.createObjectURL(data);
                                                          const a = document.createElement('a');
                                                          a.href = url;
                                                          a.download = doc.file_name || 'download';
                                                          a.click();
                                                          URL.revokeObjectURL(url);
                                                        } catch (error) {
                                                          console.error('Download error:', error);
                                                          toast({
                                                            title: "Download-Fehler",
                                                            description: "Datei konnte nicht heruntergeladen werden.",
                                                            variant: "destructive",
                                                          });
                                                        }
                                                      }}
                                                    >
                                                      <Download className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          <div>
                                            <label className="text-sm font-medium">Notizen</label>
                                            <Textarea
                                              value={item.notes || ''}
                                              onChange={(e) => updateAgendaItem(index, 'notes', e.target.value)}
                                              placeholder="Notizen und Hinweise"
                                              className="min-h-[80px]"
                                            />
                                          </div>

                                            <div>
                                              {/* Display agenda documents (multiple files) */}
                                              {agendaDocuments[item.id!] && agendaDocuments[item.id!].length > 0 && (
                                                <div className="mb-4 bg-muted/30 p-3 rounded-lg border">
                                                  <h4 className="text-sm font-medium mb-2">Angehängte Dokumente:</h4>
                                                  <div className="space-y-2">
                                                    {agendaDocuments[item.id!].map((doc, docIndex) => (
                                                      <div key={docIndex} className="flex items-center justify-between p-2 bg-background rounded border">
                                                        <div className="flex items-center gap-2">
                                                          <FileText className="h-4 w-4 text-blue-600" />
                                                          <span className="text-sm">{doc.file_name}</span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                          <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={async () => {
                                                              try {
                                                                const { data, error } = await supabase.storage
                                                                  .from('documents')
                                                                  .download(doc.file_path);
                                                                
                                                                if (error) throw error;
                                                                
                                                                const url = URL.createObjectURL(data);
                                                                const a = document.createElement('a');
                                                                a.href = url;
                                                                a.download = doc.file_name;
                                                                a.click();
                                                                URL.revokeObjectURL(url);
                                                              } catch (error) {
                                                                console.error('Download error:', error);
                                                                toast({
                                                                  title: "Download-Fehler",
                                                                  description: "Datei konnte nicht heruntergeladen werden.",
                                                                  variant: "destructive",
                                                                });
                                                              }
                                                            }}
                                                          >
                                                            <Download className="h-4 w-4" />
                                                          </Button>
                                                          <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => deleteAgendaDocument(doc.id, item.id!, doc.file_path)}
                                                          >
                                                            <X className="h-4 w-4" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                             
                                              <label className="text-sm font-medium">Dokument hinzufügen</label>
                                              <div className="flex items-center gap-2">
                                                <Button 
                                                  variant="outline" 
                                                  size="sm" 
                                                  className="flex-1"
                                                  onClick={async () => {
                                                    const fileInput = document.createElement('input');
                                                    fileInput.type = 'file';
                                                    fileInput.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg';
                                                    fileInput.onchange = async (e) => {
                                                      const file = (e.target as HTMLInputElement).files?.[0];
                                                      if (file && selectedMeeting?.id) {
                                                        try {
                                                          // If item doesn't have an ID yet, save it first
                                                          let itemId = item.id;
                                                          if (!itemId) {
                                                            const { data: savedItem, error: saveError } = await supabase
                                                              .from('meeting_agenda_items')
                                                              .insert({
                                                                meeting_id: selectedMeeting.id,
                                                                title: item.title || 'Agenda-Punkt',
                                                                description: item.description || '',
                                                                notes: item.notes || '',
                                                                parent_id: item.parent_id || null,
                                                                order_index: item.order_index,
                                                                is_completed: false,
                                                                is_recurring: false,
                                                              })
                                                              .select()
                                                              .single();
                                                            
                                                            if (saveError) throw saveError;
                                                            itemId = savedItem.id;
                                                            
                                                            // Update local state with the new ID
                                                            const updatedItems = [...agendaItems];
                                                            updatedItems[index] = { ...item, id: itemId };
                                                            setAgendaItems(updatedItems);
                                                          }
                                                          
                                                          await uploadAgendaDocument(itemId, file);
                                                          
                                                          toast({
                                                            title: "Dokument hochgeladen",
                                                            description: "Das Dokument wurde erfolgreich hinzugefügt.",
                                                          });
                                                        } catch (error) {
                                                          console.error('Upload error:', error);
                                                          toast({
                                                            title: "Upload-Fehler",
                                                            description: "Dokument konnte nicht hochgeladen werden.",
                                                            variant: "destructive",
                                                          });
                                                        }
                                                      }
                                                    };
                                                    fileInput.click();
                                                  }}
                                                >
                                                  <Upload className="h-4 w-4 mr-2" />
                                                  Dokument hinzufügen
                                                </Button>
                                              </div>
                                            </div>
                                       </>
                                     )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

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
            </>
          ) : !activeMeeting ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Kein Meeting ausgewählt</h3>
                <p className="text-muted-foreground">
                  Wählen Sie ein Meeting aus der Liste links aus, um die Agenda zu bearbeiten
                </p>
              </CardContent>
            </Card>
          ) : null}
      </div>
    </div>
  );
}