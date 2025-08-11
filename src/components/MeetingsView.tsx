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
    } catch (error) {
      toast({
        title: "Fehler beim Laden der Agenda",
        description: "Die Agenda-Punkte konnten nicht geladen werden.",
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

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const newItems = Array.from(agendaItems);
    const draggedItem = newItems[source.index];

    // Remove the dragged item from its original position
    newItems.splice(source.index, 1);

    // If moving a parent item, also move all its children
    if (!draggedItem.parentLocalKey) {
      const draggedKey = draggedItem.localKey || draggedItem.id;
      const children = newItems.filter(item => item.parentLocalKey === draggedKey);
      
      // Remove children from their current positions
      children.forEach(child => {
        const childIndex = newItems.findIndex(item => 
          (item.localKey || item.id) === (child.localKey || child.id)
        );
        if (childIndex !== -1) {
          newItems.splice(childIndex, 1);
        }
      });

      // Insert parent at new position
      newItems.splice(destination.index, 0, draggedItem);

      // Insert children right after parent
      children.forEach((child, index) => {
        newItems.splice(destination.index + 1 + index, 0, child);
      });
    } else {
      // For child items, just move them normally
      newItems.splice(destination.index, 0, draggedItem);
    }

    // Update order indices
    const reorderedItems = newItems.map((item, index) => ({
      ...item,
      order_index: index
    }));

    setAgendaItems(reorderedItems);
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
          <Button variant="link" className="text-primary px-0" onClick={() => toast({ title: 'Archiv', description: 'Archivansicht folgt.' })}>Archiv</Button>
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
            </Card>
          ))}
          {upcomingMeetings.length === 0 && (
            <Card className="md:col-span-3"><CardContent className="p-4 text-muted-foreground">Keine anstehenden Besprechungen</CardContent></Card>
          )}
        </div>
      </div>

      {/* Agenda Editor */}
      <div className="space-y-4">
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
                                            {/* Display uploaded files */}
                                            {item.file_path && (
                                              <div className="mb-4 bg-muted/30 p-3 rounded-lg border">
                                                <h4 className="text-sm font-medium mb-2">Angehängte Dateien:</h4>
                                                <div className="flex items-center justify-between p-2 bg-background rounded border">
                                                  <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-blue-600" />
                                                    <span className="text-sm">
                                                      {item.file_path.split('/').pop()?.split('_').slice(2).join('_') || 'Datei'}
                                                    </span>
                                                  </div>
                                                  <div className="flex gap-1">
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
                                                    <Button 
                                                      variant="ghost" 
                                                      size="sm"
                                                      onClick={async () => {
                                                        try {
                                                          // Remove file from storage
                                                          await supabase.storage
                                                            .from('documents')
                                                            .remove([item.file_path!]);
                                                          
                                                          // Update agenda item
                                                          await updateAgendaItem(index, 'file_path', null);
                                                          
                                                          toast({
                                                            title: "Datei entfernt",
                                                            description: "Die Datei wurde erfolgreich entfernt.",
                                                          });
                                                        } catch (error) {
                                                          toast({
                                                            title: "Fehler",
                                                            description: "Datei konnte nicht entfernt werden.",
                                                            variant: "destructive",
                                                          });
                                                        }
                                                      }}
                                                    >
                                                      <X className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                            
                                            <label className="text-sm font-medium">Datei anhängen</label>
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
                                                               title: item.title || 'Unterpunkt',
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
                                                         
                                                          const fileName = `${user?.id}/${itemId}_${Date.now()}_${file.name}`;
                                                          const { error: uploadError } = await supabase.storage
                                                            .from('documents')
                                                            .upload(fileName, file);
                                                         
                                                         if (uploadError) throw uploadError;
                                                         
                                                         // Update the agenda item with file path
                                                         await updateAgendaItem(index, 'file_path', fileName);
                                                         
                                                         toast({
                                                           title: "Datei hochgeladen",
                                                           description: `${file.name} wurde erfolgreich angehängt.`,
                                                         });
                                                       } catch (error) {
                                                         console.error('Upload error:', error);
                                                         toast({
                                                           title: "Upload-Fehler",
                                                           description: error.message || "Die Datei konnte nicht hochgeladen werden.",
                                                           variant: "destructive",
                                                         });
                                                       }
                                                     }
                                                   };
                                                   fileInput.click();
                                                 }}
                                              >
                                                <Upload className="h-4 w-4 mr-2" />
                                                Datei auswählen
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
  );
}