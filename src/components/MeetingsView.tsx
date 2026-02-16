import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { CalendarIcon, CalendarDays, Plus, Save, Clock, Users, CheckCircle, Circle, GripVertical, Trash, ListTodo, Upload, FileText, Edit, Check, X, Download, Repeat, StickyNote, Eye, EyeOff, MapPin, Archive, Maximize2, Globe, Star, MessageSquarePlus, ChevronRight, Cake } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { format, startOfDay, endOfDay, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { MeetingArchiveView } from "./MeetingArchiveView";
import { TimePickerCombobox } from "@/components/ui/time-picker-combobox";
import { UserSelector } from "@/components/UserSelector";
import { RecurrenceSelector } from "@/components/ui/recurrence-selector";
import { MeetingParticipantsManager } from "@/components/meetings/MeetingParticipantsManager";
import { InlineMeetingParticipantsEditor } from "@/components/meetings/InlineMeetingParticipantsEditor";
import { MeetingParticipantAvatars } from "@/components/meetings/MeetingParticipantAvatars";
import { UpcomingAppointmentsSection } from "@/components/meetings/UpcomingAppointmentsSection";
import { PendingJourFixeNotes } from "@/components/meetings/PendingJourFixeNotes";
import { SystemAgendaItem } from "@/components/meetings/SystemAgendaItem";
import { BirthdayAgendaItem } from "@/components/meetings/BirthdayAgendaItem";
import { FocusModeView } from "@/components/meetings/FocusModeView";
import { MultiUserAssignSelect } from "@/components/meetings/MultiUserAssignSelect";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RecurrenceData {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays: number[];
  endDate?: string;
}

interface NewMeetingParticipant {
  userId: string;
  role: 'organizer' | 'participant' | 'optional';
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface AgendaItem {
  id?: string;
  meeting_id?: string;
  title: string;
  description?: string;
  assigned_to?: string[] | null;
  notes?: string | null;
  is_completed: boolean;
  is_recurring: boolean;
  task_id?: string | null;
  order_index: number;
  parent_id?: string | null;
  file_path?: string | null;
  result_text?: string | null;
  carry_over_to_next?: boolean;
  sub_items?: any[];
  source_meeting_id?: string | null;
  carried_over_from?: string | null;
  original_meeting_date?: string | null;
  original_meeting_title?: string | null;
  carryover_notes?: string | null;
  system_type?: string | null;
  is_optional?: boolean;
  is_visible?: boolean;
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
  meeting_time?: string;
  location?: string;
  status: string;
  template_id?: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  lastUpdate?: number;
}

interface MeetingTemplate {
  id: string;
  name: string;
  description?: string;
  template_items: any;
  default_participants?: string[];
  default_recurrence?: any;
  is_default?: boolean;
  auto_create_count?: number;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

export function MeetingsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
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
  const [linkedQuickNotes, setLinkedQuickNotes] = useState<any[]>([]);
  const [meetingLinkedTasks, setMeetingLinkedTasks] = useState<any[]>([]);
  const [meetingUpcomingAppointments, setMeetingUpcomingAppointments] = useState<any[]>([]);
  const [isNewMeetingOpen, setIsNewMeetingOpen] = useState(false);
  const [newMeeting, setNewMeeting] = useState<Meeting>({
    title: "",
    description: "",
    meeting_date: new Date(),
    location: "Stuttgart",
    status: "planned",
    is_public: false
  });
  const [newMeetingTime, setNewMeetingTime] = useState<string>("10:00");
  const [newMeetingParticipants, setNewMeetingParticipants] = useState<NewMeetingParticipant[]>([]);
  const [newMeetingRecurrence, setNewMeetingRecurrence] = useState<RecurrenceData>({
    enabled: false,
    frequency: 'weekly',
    interval: 1,
    weekdays: []
  });
  const [showTaskSelector, setShowTaskSelector] = useState<{itemIndex: number} | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [meetingParticipants, setMeetingParticipants] = useState<any[]>([]);
  const [currentUserIsParticipant, setCurrentUserIsParticipant] = useState(false);
  const updateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [starredAppointmentIds, setStarredAppointmentIds] = useState<Set<string>>(new Set());
  const [expandedApptNotes, setExpandedApptNotes] = useState<Set<string>>(new Set());

  // Handle URL action parameter for QuickActions
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-meeting') {
      setIsNewMeetingOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Handle URL id parameter for deep-linking from MyWork
  useEffect(() => {
    const urlMeetingId = searchParams.get('id');
    if (urlMeetingId && meetings.length > 0) {
      const meetingFromUrl = meetings.find(m => m.id === urlMeetingId);
      if (meetingFromUrl && selectedMeeting?.id !== urlMeetingId) {
        setSelectedMeeting(meetingFromUrl);
        loadAgendaItems(urlMeetingId);
        loadLinkedQuickNotes(urlMeetingId);
        loadMeetingLinkedTasks(urlMeetingId);
        if (meetingFromUrl?.meeting_date) loadMeetingUpcomingAppointments(urlMeetingId, meetingFromUrl.meeting_date);
        loadStarredAppointments(urlMeetingId);
        // Clear the id param after selecting
        searchParams.delete('id');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, meetings]);

  // Load data on component mount - now depends on currentTenant for proper profile loading
  useEffect(() => {
    console.log('=== MeetingsView useEffect triggered ===');
    console.log('User:', user);
    console.log('CurrentTenant:', currentTenant?.id);
    if (user && currentTenant?.id) {
      console.log('Loading meetings data...');
      loadMeetings();
      loadProfiles();
      loadTasks();
      loadMeetingTemplates();
    } else {
      console.log('No user or tenant found, skipping data load');
    }
  }, [user, currentTenant?.id]);

  // Auto-select the next upcoming meeting when meetings are loaded
  useEffect(() => {
    if (meetings.length > 0 && !selectedMeeting && !activeMeeting) {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const nextMeeting = meetings
        .filter(m => new Date(m.meeting_date) >= startOfToday)
        .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())[0];
      
      if (nextMeeting) {
        setSelectedMeeting(nextMeeting);
        if (nextMeeting.id) {
          loadAgendaItems(nextMeeting.id);
          loadLinkedQuickNotes(nextMeeting.id);
          loadMeetingLinkedTasks(nextMeeting.id);
          loadMeetingUpcomingAppointments(nextMeeting.id, nextMeeting.meeting_date);
          loadStarredAppointments(nextMeeting.id);
        }
      }
    }
  }, [meetings]);

  // Load Quick Notes when selectedMeeting changes (for preview)
  useEffect(() => {
    if (selectedMeeting?.id && !activeMeeting) {
      loadLinkedQuickNotes(selectedMeeting.id);
      loadMeetingLinkedTasks(selectedMeeting.id);
      if (selectedMeeting.meeting_date) loadMeetingUpcomingAppointments(selectedMeeting.id, selectedMeeting.meeting_date);
      loadStarredAppointments(selectedMeeting.id);
    }
  }, [selectedMeeting?.id, activeMeeting]);

  useEffect(() => {
    return () => {
      Object.values(updateTimeouts.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

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

  // Check if current user is a participant of the selected meeting
  useEffect(() => {
    const checkParticipation = async () => {
      if (!selectedMeeting?.id || !user?.id) {
        setCurrentUserIsParticipant(false);
        return;
      }
      
      const { data } = await supabase
        .from('meeting_participants')
        .select('user_id')
        .eq('meeting_id', selectedMeeting.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      setCurrentUserIsParticipant(!!data);
    };
    
    checkParticipation();
  }, [selectedMeeting?.id, user?.id]);

  // Calculate edit permission based on owner, participant, or public meeting
  const hasEditPermission = React.useMemo(() => {
    if (!selectedMeeting || !user) return false;
    
    // Creator always has edit rights
    if (selectedMeeting.user_id === user.id) return true;
    
    // Participants have edit rights
    if (currentUserIsParticipant) return true;
    
    // Public meetings: all team members have edit rights
    if (selectedMeeting.is_public) return true;
    
    return false;
  }, [selectedMeeting, user, currentUserIsParticipant]);

  const loadMeetings = async () => {
    console.log('=== LOAD MEETINGS STARTED ===');
    console.log('Current user:', user?.id);
    
    try {
      // 1. Load meetings where user is the creator
      const { data: ownMeetings, error: ownError } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user?.id)
        .neq('status', 'archived')
        .order('meeting_date', { ascending: false });

      if (ownError) throw ownError;
      
      // 2. Load meetings where user is a participant
      const { data: participantMeetings, error: participantError } = await supabase
        .from('meeting_participants')
        .select('meeting_id, meetings(*)')
        .eq('user_id', user?.id);

      if (participantError) {
        console.error('Error loading participant meetings:', participantError);
      }

      // Combine and deduplicate meetings
      const ownMeetingIds = new Set((ownMeetings || []).map(m => m.id));
      const participantMeetingsData = (participantMeetings || [])
        .filter(p => p.meetings && !ownMeetingIds.has(p.meeting_id) && p.meetings.status !== 'archived')
        .map(p => p.meetings);

      const allMeetings = [...(ownMeetings || []), ...participantMeetingsData];
      
      console.log('Meetings query result:', allMeetings);
      console.log('Number of meetings loaded:', allMeetings.length);

      setMeetings(allMeetings.map(meeting => ({
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
    if (!currentTenant?.id) return;
    
    try {
      // Get user IDs from tenant memberships first
      const { data: memberships, error: membershipError } = await supabase
        .from('user_tenant_memberships')
        .select('user_id')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);
      
      if (membershipError) throw membershipError;
      
      if (!memberships || memberships.length === 0) {
        setProfiles([]);
        return;
      }
      
      const userIds = memberships.map(m => m.user_id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

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
    if (!user?.id || !currentTenant?.id) return;
    
    try {
      // Load all todo tasks for this tenant
      const { data: allTenantTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'todo')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading tasks:', error);
        return;
      }
      
      // Filter client-side for tasks created by user or assigned to user
      const filteredTasks = (allTenantTasks || []).filter(task => 
        task.user_id === user.id || 
        (task.assigned_to && task.assigned_to.includes(user.id))
      );
      
      setTasks(filteredTasks);
      
      // Load task documents for all tasks
      if (filteredTasks.length > 0) {
        await loadTaskDocuments(filteredTasks.map(task => task.id));
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
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      setMeetingTemplates(data || []);
      
      // Auto-select default template for new meetings
      const defaultTemplate = data?.find(t => t.is_default);
      if (defaultTemplate) {
        setNewMeeting(prev => ({ ...prev, template_id: defaultTemplate.id }));
        // Load default participants if available
        if (defaultTemplate.default_participants?.length) {
          supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', defaultTemplate.default_participants)
            .then(({ data: profilesData }) => {
              if (profilesData) {
                setNewMeetingParticipants(profilesData.map(u => ({
                  userId: u.user_id,
                  role: 'participant' as const,
                  user: {
                    id: u.user_id,
                    display_name: u.display_name || 'Unbekannt',
                    avatar_url: u.avatar_url
                  }
                })));
              }
            });
        }
        // Load default recurrence if available
        if (defaultTemplate.default_recurrence) {
          setNewMeetingRecurrence(defaultTemplate.default_recurrence as unknown as RecurrenceData);
        }
      }
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
      
      // Hierarchische Sortierung: Hauptpunkte zuerst, dann deren Kinder direkt darunter
      const mainItems = (data || [])
        .filter(item => !item.parent_id)
        .sort((a, b) => a.order_index - b.order_index);
      
      const sortedItems: any[] = [];
      mainItems.forEach(main => {
        sortedItems.push({ 
          ...main, 
          localKey: main.id,
          parentLocalKey: undefined 
        });
        
        // Kinder dieses Hauptpunkts direkt darunter einfügen
        const children = (data || [])
          .filter(item => item.parent_id === main.id)
          .sort((a, b) => a.order_index - b.order_index);
        
        children.forEach(child => {
          sortedItems.push({ 
            ...child, 
            localKey: child.id, 
            parentLocalKey: child.parent_id 
          });
        });
      });
      
      console.log('Hierarchically sorted items:', sortedItems.map(item => ({
        id: item.id,
        title: item.title,
        order_index: item.order_index,
        parent_id: item.parent_id
      })));
      
      setAgendaItems(sortedItems);
      
      // Load documents for all agenda items
      if (sortedItems.length > 0) {
        await loadAgendaDocuments(sortedItems.map(item => item.id!).filter(Boolean));
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
      const insertData: any = {
        title: newMeeting.title,
        description: newMeeting.description || null,
        meeting_date: format(newMeeting.meeting_date, 'yyyy-MM-dd'),
        meeting_time: newMeetingTime,
        location: newMeeting.location || null,
        status: newMeeting.status,
        user_id: user.id,
        tenant_id: currentTenant?.id,
        template_id: newMeeting.template_id || null,
        is_public: newMeeting.is_public || false,
        recurrence_rule: newMeetingRecurrence.enabled ? newMeetingRecurrence : null
      };

      const { data, error } = await supabase
        .from('meetings')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      // Create corresponding calendar appointment for this meeting
      if (data.id && currentTenant?.id) {
        try {
          const meetingDateStr = format(newMeeting.meeting_date, 'yyyy-MM-dd');
          const timeHour = parseInt(newMeetingTime.split(':')[0]);
          const timeMinute = newMeetingTime.split(':')[1];
          const endHour = String(timeHour + 1).padStart(2, '0');
          
          // Create Date objects in local time and convert to ISO for proper UTC handling
          const localStartTime = new Date(`${meetingDateStr}T${newMeetingTime}:00`);
          const localEndTime = new Date(localStartTime.getTime() + 60 * 60 * 1000); // +1 hour
          
          const appointmentData = {
            title: newMeeting.title,
            description: newMeeting.description || null,
            location: newMeeting.location || null,
            start_time: localStartTime.toISOString(),
            end_time: localEndTime.toISOString(),
            category: 'meeting',
            status: 'planned',
            user_id: user.id,
            tenant_id: currentTenant.id,
            meeting_id: data.id
          };
          
          const { error: appointmentError } = await supabase
            .from('appointments')
            .insert(appointmentData);
          
          if (appointmentError) {
            console.error('Error creating calendar appointment:', appointmentError);
          } else {
            console.log('✅ Calendar appointment created for meeting');
          }
        } catch (appointmentCreationError) {
          console.error('Error creating appointment for meeting:', appointmentCreationError);
        }
      }

      // Add participants if any
      if (newMeetingParticipants.length > 0 && data.id) {
        const participantInserts = newMeetingParticipants.map(p => ({
          meeting_id: data.id,
          user_id: p.userId,
          role: p.role,
          status: 'pending'
        }));
        
        await supabase
          .from('meeting_participants')
          .insert(participantInserts);
      }

      const newMeetingWithDate = {...data, meeting_date: new Date(data.meeting_date)};
      setMeetings([newMeetingWithDate, ...meetings]);
      setSelectedMeeting(newMeetingWithDate);
      
      // Clear the agenda items first to prevent conflicts
      setAgendaItems([]);
      
      // Auto-assign pending notes (marked for next Jour Fixe) to this meeting
      try {
        const { data: pendingNotes, error: pendingError } = await supabase
          .from('quick_notes')
          .select('id')
          .eq('user_id', user.id)
          .eq('pending_for_jour_fixe', true)
          .is('deleted_at', null);

        if (!pendingError && pendingNotes && pendingNotes.length > 0) {
          console.log('📝 Found pending notes for Jour Fixe:', pendingNotes.length);
          
          // Link pending notes to this meeting and reset the flag
          const noteIds = pendingNotes.map(n => n.id);
          const { error: updateError } = await supabase
            .from('quick_notes')
            .update({ 
              meeting_id: data.id,
              pending_for_jour_fixe: false 
            })
            .in('id', noteIds);

          if (updateError) {
            console.error('Error linking pending notes:', updateError);
          } else {
            toast({
              title: "Notizen verknüpft",
              description: `${pendingNotes.length} vorgemerkte Notiz(en) wurden automatisch hinzugefügt.`,
            });
          }
        }
      } catch (pendingNotesError) {
        console.error('Error processing pending notes:', pendingNotesError);
      }
      
      // Auto-create future recurring meetings if enabled
      if (newMeetingRecurrence.enabled && newMeeting.template_id) {
        try {
          // Get template's auto_create_count
          const template = meetingTemplates.find(t => t.id === newMeeting.template_id);
          const autoCreateCount = template?.auto_create_count || 3;
          
          // Count existing future meetings for this template
          const { count: existingCount } = await supabase
            .from('meetings')
            .select('id', { count: 'exact', head: true })
            .eq('template_id', newMeeting.template_id)
            .eq('status', 'planned')
            .gte('meeting_date', format(new Date(), 'yyyy-MM-dd'));
          
          const toCreate = autoCreateCount - (existingCount || 1);
          
          if (toCreate > 0) {
            console.log(`📅 Creating ${toCreate} future recurring meetings`);
            
            // Calculate next meeting dates based on recurrence
            const futureDates: Date[] = [];
            let currentDate = new Date(newMeeting.meeting_date);
            
            for (let i = 0; i < toCreate; i++) {
              // Calculate next occurrence based on frequency
              switch (newMeetingRecurrence.frequency) {
                case 'daily':
                  currentDate = new Date(currentDate);
                  currentDate.setDate(currentDate.getDate() + newMeetingRecurrence.interval);
                  break;
                case 'weekly':
                  currentDate = new Date(currentDate);
                  currentDate.setDate(currentDate.getDate() + (7 * newMeetingRecurrence.interval));
                  break;
                case 'monthly':
                  currentDate = new Date(currentDate);
                  currentDate.setMonth(currentDate.getMonth() + newMeetingRecurrence.interval);
                  break;
                case 'yearly':
                  currentDate = new Date(currentDate);
                  currentDate.setFullYear(currentDate.getFullYear() + newMeetingRecurrence.interval);
                  break;
              }
              futureDates.push(new Date(currentDate));
            }
            
            // Create future meetings
            for (const futureDate of futureDates) {
              const futureMeetingData: any = {
                title: newMeeting.title,
                description: newMeeting.description || null,
                meeting_date: format(futureDate, 'yyyy-MM-dd'),
                location: newMeeting.location || null,
                status: 'planned',
                user_id: user.id,
                tenant_id: currentTenant?.id,
                template_id: newMeeting.template_id,
                recurrence_rule: newMeetingRecurrence as any
              };
              
              const { data: futureMeeting, error: futureError } = await supabase
                .from('meetings')
                .insert([futureMeetingData])
                .select()
                .single();
              
              if (futureError) {
                console.error('Error creating future meeting:', futureError);
              } else {
                console.log(`✅ Created future meeting for ${format(futureDate, 'dd.MM.yyyy')}`);
                
                // Add participants to future meetings too
                if (newMeetingParticipants.length > 0 && futureMeeting?.id) {
                  const participantInserts = newMeetingParticipants.map(p => ({
                    meeting_id: futureMeeting.id,
                    user_id: p.userId,
                    role: p.role,
                    status: 'pending'
                  }));
                  
                  await supabase
                    .from('meeting_participants')
                    .insert(participantInserts);
                }
              }
            }
            
            toast({
              title: "Wiederkehrende Meetings erstellt",
              description: `${toCreate} zukünftige Meeting(s) wurden automatisch erstellt.`,
            });
          }
        } catch (recurringError) {
          console.error('Error creating recurring meetings:', recurringError);
        }
      }
      
      // Wait a moment for the trigger to complete, then load the items and apply carryover
      setTimeout(async () => {
        await loadAgendaItems(data.id);
        
        // Apply any pending carryover items for this template
        if (data.template_id) {
          await loadAndApplyCarryoverItems(data.id, data.template_id);
        }
        
        // Reload all meetings to show the newly created ones (filter out archived)
        if (currentTenant && user) {
          const { data: allMeetings } = await supabase
            .from('meetings')
            .select('*')
            .eq('tenant_id', currentTenant.id)
            .eq('user_id', user.id)
            .neq('status', 'archived')
            .order('meeting_date', { ascending: false });
          
          if (allMeetings) {
            setMeetings(allMeetings.map(m => ({ ...m, meeting_date: new Date(m.meeting_date) })));
          }
        }
      }, 500);
      
      setIsNewMeetingOpen(false);
      setNewMeeting({
        title: "",
        description: "",
        meeting_date: new Date(),
        location: "",
        status: "planned",
        is_public: false
      });
      setNewMeetingParticipants([]);
      setNewMeetingRecurrence({
        enabled: false,
        frequency: 'weekly',
        interval: 1,
        weekdays: []
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

  const loadLinkedQuickNotes = async (meetingId: string) => {
    try {
      console.log('📝 Loading linked quick notes for meeting:', meetingId);
      const { data, error } = await supabase
        .from('quick_notes')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading linked quick notes:', error);
        return;
      }

      console.log('📝 Found quick notes:', data?.length || 0);
      setLinkedQuickNotes(data || []);
    } catch (error) {
      console.error('Error loading linked quick notes:', error);
    }
  };

  const loadMeetingLinkedTasks = async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, due_date, priority, status, user_id')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeetingLinkedTasks(data || []);
    } catch (error) {
      console.error('Error loading meeting linked tasks:', error);
      setMeetingLinkedTasks([]);
    }
  };

  const loadMeetingUpcomingAppointments = async (meetingId: string, meetingDate: string | Date) => {
    if (!currentTenant?.id) return;
    try {
      const baseDate = typeof meetingDate === 'string' ? new Date(meetingDate) : meetingDate;
      const start = startOfDay(baseDate);
      const end = endOfDay(addDays(baseDate, 14));

      const { data: internalData } = await supabase
        .from('appointments')
        .select('id, title, start_time, end_time, location, category, status')
        .eq('tenant_id', currentTenant.id)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true });

      const { data: externalData } = await supabase
        .from('external_events')
        .select('id, title, start_time, end_time, location, external_calendars!inner(name, color, tenant_id)')
        .eq('external_calendars.tenant_id', currentTenant.id)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString());

      const all = [
        ...(internalData || []).map(a => ({ ...a, isExternal: false })),
        ...(externalData || []).map((e: any) => ({
          id: e.id, title: e.title, start_time: e.start_time, end_time: e.end_time,
          location: e.location, isExternal: true,
          calendarName: e.external_calendars?.name, calendarColor: e.external_calendars?.color
        }))
      ].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      setMeetingUpcomingAppointments(all);
    } catch (error) {
      console.error('Error loading upcoming appointments:', error);
      setMeetingUpcomingAppointments([]);
    }
  };

  const loadStarredAppointments = async (meetingId: string) => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('starred_appointments')
        .select('id, appointment_id, external_event_id')
        .eq('meeting_id', meetingId)
        .eq('user_id', user.id);

      if (error) throw error;
      const ids = new Set<string>();
      data?.forEach(item => {
        if (item.appointment_id) ids.add(item.appointment_id);
        if (item.external_event_id) ids.add(item.external_event_id);
      });
      setStarredAppointmentIds(ids);
    } catch (error) {
      console.error('Error loading starred appointments:', error);
    }
  };

  const toggleStarAppointment = async (appt: any) => {
    if (!activeMeeting?.id || !user?.id || !currentTenant?.id) return;
    const isCurrentlyStarred = starredAppointmentIds.has(appt.id);

    setStarredAppointmentIds(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyStarred) newSet.delete(appt.id);
      else newSet.add(appt.id);
      return newSet;
    });

    try {
      if (isCurrentlyStarred) {
        await supabase
          .from('starred_appointments')
          .delete()
          .eq('meeting_id', activeMeeting.id)
          .eq('user_id', user.id)
          .or(`appointment_id.eq.${appt.id},external_event_id.eq.${appt.id}`);
      } else {
        const insertData: any = {
          meeting_id: activeMeeting.id,
          user_id: user.id,
          tenant_id: currentTenant.id
        };
        if (appt.isExternal) insertData.external_event_id = appt.id;
        else insertData.appointment_id = appt.id;
        await supabase.from('starred_appointments').insert(insertData);
      }
    } catch (error) {
      console.error('Error toggling star:', error);
      setStarredAppointmentIds(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyStarred) newSet.add(appt.id);
        else newSet.delete(appt.id);
        return newSet;
      });
    }
  };

  const updateQuickNoteResult = async (noteId: string, result: string) => {
    // Update local state immediately to avoid dropped characters while requests are in-flight
    setLinkedQuickNotes(prev =>
      prev.map(note =>
        note.id === noteId ? { ...note, meeting_result: result } : note
      )
    );

    const timeoutKey = `quick-note-${noteId}-meeting_result`;
    if (updateTimeouts.current[timeoutKey]) {
      clearTimeout(updateTimeouts.current[timeoutKey]);
    }

    updateTimeouts.current[timeoutKey] = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('quick_notes')
          .update({ meeting_result: result })
          .eq('id', noteId);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating quick note result:', error);
        toast({
          title: "Fehler",
          description: "Das Ergebnis konnte nicht gespeichert werden.",
          variant: "destructive",
        });
      }
    }, 500);
  };

  const startMeeting = async (meeting: Meeting) => {
    // Stop any currently active meeting first
    if (activeMeetingId && activeMeetingId !== meeting.id) {
      setActiveMeeting(null);
      setActiveMeetingId(null);
      setLinkedQuickNotes([]);
    }
    
    setActiveMeeting(meeting);
    setActiveMeetingId(meeting.id || null);
    if (meeting.id) {
      await loadAgendaItems(meeting.id);
      await loadLinkedQuickNotes(meeting.id);
      await loadMeetingLinkedTasks(meeting.id);
      await loadMeetingUpcomingAppointments(meeting.id, meeting.meeting_date);
      await loadStarredAppointments(meeting.id);
    }
  };

  const stopMeeting = () => {
    setActiveMeeting(null);
    setActiveMeetingId(null);
    setLinkedQuickNotes([]);
  };

  const archiveMeeting = async (meeting: Meeting) => {
    try {
      console.log('=== ARCHIVE MEETING STARTED ===');
      
      if (!meeting?.id) throw new Error('Meeting hat keine ID');
      if (!user?.id) throw new Error('Benutzer nicht angemeldet');

      // Step 1: Get agenda items
      const { data: agendaItemsData, error: agendaError } = await supabase
        .from('meeting_agenda_items')
        .select('*')
        .eq('meeting_id', meeting.id);

      if (agendaError) throw agendaError;

      // Step 2: Process carryover items FIRST
      const carryoverItems = agendaItemsData?.filter(item => item.carry_over_to_next) || [];
      if (carryoverItems.length > 0) {
        try {
          await processCarryoverItems(meeting, carryoverItems);
        } catch (carryoverError) {
          console.error('Carryover error (non-fatal):', carryoverError);
        }
      }

      // Step 3: Create standalone tasks for items with assigned_to AND result_text
      // Also handle items that already have a task_id - append result to existing task
      const itemsWithAssignment = agendaItemsData?.filter(item => 
        item.assigned_to && item.result_text?.trim()
      ) || [];
      
      for (const item of itemsWithAssignment) {
        try {
          if (item.task_id) {
            // Item already has a linked task - append result to existing task description
            const { data: existingTask } = await supabase
              .from('tasks')
              .select('description')
              .eq('id', item.task_id)
              .maybeSingle();

            if (existingTask) {
              const meetingResult = `\n\n--- Ergebnis aus Besprechung "${meeting.title}" vom ${format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}: ---\n${item.result_text}`;
              await supabase
                .from('tasks')
                .update({
                  description: (existingTask.description || '') + meetingResult,
                  updated_at: new Date().toISOString()
                })
                .eq('id', item.task_id);
              console.log(`Updated existing task with result for: ${item.title}`);
            }
          } else {
            // No linked task - create new standalone task
            let assignedUserId: string | null = null;
            if (Array.isArray(item.assigned_to)) {
              const flattened = item.assigned_to.flat().filter(Boolean) as string[];
              assignedUserId = flattened[0] || null;
            } else if (typeof item.assigned_to === 'string') {
              assignedUserId = item.assigned_to;
            }
            
            const assigneeNames = Array.isArray(item.assigned_to) 
              ? item.assigned_to.flat().filter(Boolean).map(id => {
                  const profile = profiles.find(p => p.user_id === id);
                  return profile?.display_name || 'Unbekannt';
                }).join(', ')
              : '';
            
            const multiAssigneeNote = assigneeNames && item.assigned_to && item.assigned_to.length > 1
              ? `\n\n**Zuständige:** ${assigneeNames}`
              : '';
            
            const taskDescription = `**Aus Besprechung:** ${meeting.title} vom ${format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}\n\n**Ergebnis:**\n${item.result_text}${item.description ? `\n\n**Details:**\n${item.description}` : ''}${item.notes ? `\n\n**Notizen:**\n${item.notes}` : ''}${multiAssigneeNote}`;
            
            const { error: taskInsertError } = await supabase
              .from('tasks')
              .insert({
                user_id: user.id,
                title: item.title,
                description: taskDescription,
                priority: 'medium',
                category: 'meeting',
                status: 'todo',
                assigned_to: assignedUserId,
                tenant_id: currentTenant?.id || '',
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
              });
            
            if (taskInsertError) {
              console.error('Error inserting task for assigned item:', taskInsertError);
            }
            
            console.log(`Created task for assigned item: ${item.title}`);
          }
        } catch (taskCreateError) {
          console.error('Error creating task for assigned item (non-fatal):', taskCreateError);
        }
      }

      // Step 4: Create follow-up task with subtasks for remaining items
      let followUpTask = null;
      try {
        const { data: createdTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: `Nachbereitung ${meeting.title} vom ${format(new Date(), 'dd.MM.yyyy')}`,
            description: `Nachbereitung der Besprechung "${meeting.title}"`,
            priority: 'medium',
            category: 'meeting',
            status: 'todo',
            tenant_id: currentTenant?.id || '',
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            assigned_to: user.id,
          })
          .select()
          .single();

        if (taskError) throw taskError;
        followUpTask = createdTask;
      } catch (followUpError) {
        console.error('Error creating follow-up task (non-fatal):', followUpError);
      }

      // Step 5: Create subtasks for items with results but no assignment
      if (followUpTask && agendaItemsData) {
        const subtasksToCreate = [];
        
        for (const item of agendaItemsData) {
          // Skip items that were assigned (already handled in Step 3, including those with task_id)
          if (item.assigned_to && item.result_text?.trim()) continue;
          // Skip items with task_id that were already handled in Step 3
          if (item.task_id) continue;
          
          if (item.result_text?.trim()) {
            let description = item.title;
            if (item.description?.trim()) description += `: ${item.description}`;
            if (item.notes?.trim()) description += (item.description ? ' - ' : ': ') + item.notes;
            
            subtasksToCreate.push({
              task_id: followUpTask.id,
              user_id: user.id,
              description: description,
              result_text: item.result_text || '',
              checklist_item_title: item.title,
              assigned_to: user.id,
              is_completed: false,
              order_index: subtasksToCreate.length,
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            });
          }
        }
        
        if (subtasksToCreate.length > 0) {
          try {
            await supabase.from('subtasks').insert(subtasksToCreate);
          } catch (subtaskError) {
            console.error('Error creating subtasks (non-fatal):', subtaskError);
          }
        }
      }

      // Step 5b: Process quick note results - write back to owner's note
      try {
        for (const note of linkedQuickNotes) {
          if (note.meeting_result?.trim()) {
            const meetingContext = `Besprechung "${meeting.title}" vom ${format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}`;
            await supabase
              .from('quick_notes')
              .update({ 
                meeting_result: `[${meetingContext}]\n${note.meeting_result}` 
              })
              .eq('id', note.id);
          }
        }
      } catch (noteResultError) {
        console.error('Error processing quick note results (non-fatal):', noteResultError);
      }

      // Step 5c: Process task results - add subtask to original task
      try {
        const taskSystemItems = agendaItemsData?.filter(item => item.system_type === 'tasks') || [];
        for (const taskItem of taskSystemItems) {
          if (!taskItem.result_text?.trim()) continue;
          
          try {
            const taskResults = JSON.parse(taskItem.result_text);
            for (const [taskId, resultText] of Object.entries(taskResults)) {
              if (!resultText || !(resultText as string).trim()) continue;
              
              const originalTask = meetingLinkedTasks.find(t => t.id === taskId);
              if (!originalTask) continue;
              
              const meetingContext = `Aus Besprechung "${meeting.title}" vom ${format(new Date(meeting.meeting_date), 'dd.MM.yyyy', { locale: de })}`;
              
              const { data: maxOrder } = await supabase
                .from('subtasks')
                .select('order_index')
                .eq('task_id', taskId)
                .order('order_index', { ascending: false })
                .limit(1);
              
              const nextOrder = (maxOrder?.[0]?.order_index ?? -1) + 1;
              
              await supabase.from('subtasks').insert({
                task_id: taskId,
                user_id: user.id,
                description: `${meetingContext}: ${resultText}`,
                assigned_to: originalTask.user_id || user.id,
                is_completed: false,
                order_index: nextOrder,
              });
            }
          } catch (e) {
            console.error('Error processing task results:', e);
          }
        }
      } catch (taskResultError) {
        console.error('Error processing task results (non-fatal):', taskResultError);
      }

      // Step 5d: Create single task with subtasks for starred appointments
      try {
        const { data: starredAppts } = await supabase
          .from('starred_appointments')
          .select('id, appointment_id, external_event_id')
          .eq('meeting_id', meeting.id);

        if (starredAppts && starredAppts.length > 0) {
          const appointmentIds = starredAppts.filter(s => s.appointment_id).map(s => s.appointment_id);
          const externalEventIds = starredAppts.filter(s => s.external_event_id).map(s => s.external_event_id);
          
          const allAppointments: Array<{ title: string; start_time: string }> = [];
          
          if (appointmentIds.length > 0) {
            const { data: appointments } = await supabase
              .from('appointments')
              .select('title, start_time')
              .in('id', appointmentIds);
            if (appointments) allAppointments.push(...appointments);
          }
          
          if (externalEventIds.length > 0) {
            const { data: externalEvents } = await supabase
              .from('external_events')
              .select('title, start_time')
              .in('id', externalEventIds);
            if (externalEvents) allAppointments.push(...externalEvents);
          }
          
          if (allAppointments.length > 0) {
            const { data: participants } = await supabase
              .from('meeting_participants')
              .select('user_id')
              .eq('meeting_id', meeting.id);
            
            const participantIds = participants?.map(p => p.user_id) || [user.id];
            // Ensure the meeting creator is also included
            if (!participantIds.includes(user.id)) {
              participantIds.push(user.id);
            }
            
            // Create one task per participant with the same subtasks
            for (const participantId of participantIds) {
              const { data: apptTask } = await supabase
                .from('tasks')
                .insert({
                  user_id: user.id,
                  title: `Vorbereitung: Markierte Termine aus ${meeting.title}`,
                  description: `Folgende Termine wurden in der Besprechung als wichtig markiert.`,
                  priority: 'medium',
                  category: 'meeting',
                  status: 'todo',
                  assigned_to: participantId,
                  tenant_id: currentTenant?.id || '',
                  due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
                })
                .select()
                .single();
              
              if (apptTask) {
                const subtasks = allAppointments.map((apt, idx) => ({
                  task_id: apptTask.id,
                  user_id: user.id,
                  description: `${apt.title} (${format(new Date(apt.start_time), 'dd.MM.yyyy HH:mm', { locale: de })})`,
                  assigned_to: null,
                  is_completed: false,
                  order_index: idx,
                }));
                
                await supabase.from('subtasks').insert(subtasks);
              }
            }
            
            console.log(`Created starred appointments tasks for ${participantIds.length} participants with ${allAppointments.length} subtasks each`);
          }
        }
      } catch (starredError) {
        console.error('Error creating starred appointments tasks (non-fatal):', starredError);
      }

      // Step 6: Archiving meeting
      // Archive the meeting
      const { data: archiveData, error: archiveError } = await supabase
        .from('meetings')
        .update({ status: 'archived' })
        .eq('id', meeting.id)
        .select();

      console.log('Archive update result:', archiveData);
      console.log('Archive error:', archiveError);
      
      if (archiveError) throw archiveError;
      
      // Step 7: Reset ALL related state BEFORE reloading
      console.log('Step 7: Resetting all meeting state...');
      setActiveMeeting(null);
      setActiveMeetingId(null);
      setAgendaItems([]);  // Clear agenda items
      setLinkedQuickNotes([]);  // Clear linked notes
      setSelectedMeeting(null);  // Clear selected meeting
      setIsFocusMode(false);  // Exit focus mode if active
      
      console.log('Step 8: Reloading meetings...');
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

  const processCarryoverItems = async (meeting: Meeting, carryoverItems: AgendaItem[]) => {
    if (!user || !meeting.template_id) return;

    try {
      // Check if there's already a next meeting with the same template
      const { data: nextMeeting } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .eq('template_id', meeting.template_id)
        .eq('status', 'planned')
        .gt('meeting_date', meeting.meeting_date)
        .order('meeting_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextMeeting) {
        // Transfer directly to the next meeting
        await transferItemsToMeeting(carryoverItems, nextMeeting.id, meeting);
        toast({
          title: "Punkte übertragen",
          description: `${carryoverItems.length} Punkte wurden auf die nächste Besprechung übertragen`
        });
      } else {
        // Store in carryover_items table for later
        await storeCarryoverItems(carryoverItems, meeting);
        toast({
          title: "Punkte vorgemerkt",
          description: `${carryoverItems.length} Punkte wurden für die nächste Besprechung vorgemerkt`
        });
      }
    } catch (error) {
      console.error('Error processing carryover items:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Übertragen der Agenda-Punkte",
        variant: "destructive"
      });
    }
  };

  const transferItemsToMeeting = async (items: AgendaItem[], targetMeetingId: string, sourceMeeting: Meeting) => {
    for (const item of items) {
      try {
        // Get current max order index for target meeting
        const { data: maxOrderData } = await supabase
          .from('meeting_agenda_items')
          .select('order_index')
          .eq('meeting_id', targetMeetingId)
          .order('order_index', { ascending: false })
          .limit(1);

        const nextOrderIndex = (maxOrderData?.[0]?.order_index || 0) + 1;

        // Insert the carried over item
        const { error } = await supabase
          .from('meeting_agenda_items')
          .insert({
            meeting_id: targetMeetingId,
            title: item.title,
            description: item.description,
            notes: item.notes,
            result_text: item.result_text,
            assigned_to: item.assigned_to,
            order_index: nextOrderIndex,
            source_meeting_id: sourceMeeting.id,
            original_meeting_date: typeof sourceMeeting.meeting_date === 'string' ? sourceMeeting.meeting_date : sourceMeeting.meeting_date?.toISOString().split('T')[0],
            original_meeting_title: sourceMeeting.title,
            carryover_notes: `Übertragen von: ${sourceMeeting.title} (${sourceMeeting.meeting_date})`
          });

        if (error) {
          console.error('Error transferring item:', error);
        }
      } catch (error) {
        console.error('Error transferring agenda item:', item.title, error);
      }
    }
  };

  const storeCarryoverItems = async (items: AgendaItem[], sourceMeeting: Meeting) => {
    for (const item of items) {
      try {
        const { error } = await supabase
          .from('carryover_items')
          .insert({
            user_id: user!.id,
            template_id: sourceMeeting.template_id,
            title: item.title,
            description: item.description,
            notes: item.notes,
            result_text: item.result_text,
            assigned_to: item.assigned_to,
            order_index: item.order_index,
            original_meeting_id: sourceMeeting.id,
            original_meeting_date: typeof sourceMeeting.meeting_date === 'string' ? sourceMeeting.meeting_date : sourceMeeting.meeting_date?.toISOString().split('T')[0],
            original_meeting_title: sourceMeeting.title
          });

        if (error) {
          console.error('Error storing carryover item:', error);
        }
      } catch (error) {
        console.error('Error storing carryover item:', item.title, error);
      }
    }
  };

  const loadAndApplyCarryoverItems = async (meetingId: string, templateId: string) => {
    if (!user) return;
    
    try {
      // Find pending carryover items for this template
      const { data: pendingItems, error } = await supabase
        .from('carryover_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('template_id', templateId);
      
      if (error || !pendingItems || pendingItems.length === 0) return;
      
      console.log(`📋 Found ${pendingItems.length} carryover items to apply`);
      
      // Get current max order_index for the new meeting
      const { data: existingItems } = await supabase
        .from('meeting_agenda_items')
        .select('order_index')
        .eq('meeting_id', meetingId)
        .order('order_index', { ascending: false })
        .limit(1);
      
      let nextOrderIndex = (existingItems?.[0]?.order_index || 0) + 1;
      
      // Insert carryover items into the new meeting
      for (const item of pendingItems) {
        const { error: insertError } = await supabase.from('meeting_agenda_items').insert({
          meeting_id: meetingId,
          title: item.title,
          description: item.description,
          notes: item.notes,
          result_text: item.result_text,
          assigned_to: item.assigned_to,
          order_index: nextOrderIndex++,
          source_meeting_id: item.original_meeting_id,
          original_meeting_date: item.original_meeting_date,
          original_meeting_title: item.original_meeting_title,
          carryover_notes: `Übertragen von: ${item.original_meeting_title} (${item.original_meeting_date})`
        });
        
        if (insertError) {
          console.error('Error inserting carryover item:', insertError);
        }
      }
      
      // Delete the applied carryover items
      const itemIds = pendingItems.map(i => i.id);
      await supabase.from('carryover_items').delete().in('id', itemIds);
      
      toast({
        title: "Übertragene Punkte hinzugefügt",
        description: `${pendingItems.length} Punkt(e) aus vorherigen Besprechungen wurden übernommen.`
      });
      
      // Reload agenda items
      await loadAgendaItems(meetingId);
    } catch (error) {
      console.error('Error applying carryover items:', error);
    }
  };

  const updateAgendaItemResult = async (itemId: string, field: 'result_text' | 'carry_over_to_next', value: any) => {
    // Update local state immediately for responsive UI
    setAgendaItems(items => 
      items.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
    
    // Debounce database updates for result_text to avoid conflicts during typing
    if (field === 'result_text') {
      // Clear any existing timeout for this item and field
      const timeoutKey = `${itemId}-${field}`;
      if (updateTimeouts.current[timeoutKey]) {
        clearTimeout(updateTimeouts.current[timeoutKey]);
      }
      
      // Set new timeout for database update
      updateTimeouts.current[timeoutKey] = setTimeout(async () => {
        try {
          await supabase
            .from('meeting_agenda_items')
            .update({ [field]: value })
            .eq('id', itemId);
        } catch (error) {
          console.error('Error updating agenda item:', error);
          toast({
            title: "Fehler",
            description: "Die Änderung konnte nicht gespeichert werden.",
            variant: "destructive",
          });
        }
      }, 500); // 500ms delay
    } else {
      // For non-text fields (like checkboxes), update immediately
      try {
        await supabase
          .from('meeting_agenda_items')
          .update({ [field]: value })
          .eq('id', itemId);
      } catch (error) {
        console.error('Error updating agenda item:', error);
        toast({
          title: "Fehler",
          description: "Die Änderung konnte nicht gespeichert werden.",
          variant: "destructive",
        });
      }
    }
  };

  const addAgendaItem = () => {
    if (!selectedMeeting?.id) return;

    const localKey = `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const newItem: AgendaItem = {
      title: "",
      description: "",
      assigned_to: [],
      notes: "",
      is_completed: false,
      is_recurring: false,
      order_index: agendaItems.length,
      localKey,
    };

    const next = [...agendaItems, newItem].map((it, idx) => ({ ...it, order_index: idx }));
    setAgendaItems(next);
  };

  const addSystemAgendaItem = async (systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks' | 'birthdays', parentItem?: AgendaItem) => {
    if (!selectedMeeting?.id) return;
    
    // Check if already exists
    if (agendaItems.some(i => i.system_type === systemType)) {
      toast({
        title: "Bereits vorhanden",
        description: "Dieser dynamische Punkt ist bereits in der Agenda.",
        variant: "destructive",
      });
      return;
    }
    
    const titles: Record<string, string> = {
      'upcoming_appointments': 'Kommende Termine',
      'quick_notes': 'Meine Notizen',
      'tasks': 'Aufgaben',
      'birthdays': 'Geburtstage'
    };

    try {
      let parentId: string | null = null;
      let parentIndex = -1;

      if (parentItem) {
        parentId = parentItem.id || null;
        parentIndex = agendaItems.findIndex(
          item => item.id === parentItem.id || item.localKey === parentItem.localKey
        );

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
          updatedItems[parentIndex] = { ...parentItem, id: parentId, localKey: parentId };
          setAgendaItems(updatedItems);
        }
      }

      // Calculate insertion index
      let insertIndex: number;
      if (parentItem && parentIndex !== -1) {
        insertIndex = parentIndex + 1;
        const parentKey = parentItem.id || parentItem.localKey;
        while (insertIndex < agendaItems.length && 
               (agendaItems[insertIndex].parent_id === parentId || 
                agendaItems[insertIndex].parentLocalKey === parentKey)) {
          insertIndex++;
        }
      } else {
        insertIndex = agendaItems.length;
      }

      // Insert into database
      const { data: savedItem, error } = await supabase
        .from('meeting_agenda_items')
        .insert({
          meeting_id: selectedMeeting.id,
          title: titles[systemType],
          description: null,
          system_type: systemType,
          parent_id: parentId,
          order_index: insertIndex,
          is_completed: false,
          is_recurring: false,
          is_visible: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Create new item for local state
      const newItem: AgendaItem = {
        ...savedItem,
        localKey: savedItem.id,
        parentLocalKey: parentId || undefined,
      };

      // Update local state
      const next = [...agendaItems];
      next.splice(insertIndex, 0, newItem);
      const reindexed = next.map((it, idx) => ({ ...it, order_index: idx }));
      setAgendaItems(reindexed);

      // Update order_index in DB for shifted items
      for (const item of reindexed) {
        if (item.id && item.id !== savedItem.id) {
          await supabase
            .from('meeting_agenda_items')
            .update({ order_index: item.order_index })
            .eq('id', item.id);
        }
      }

      toast({
        title: "Dynamischer Punkt hinzugefügt",
        description: `"${titles[systemType]}" wurde zur Agenda hinzugefügt.`,
      });
    } catch (error) {
      console.error('Error saving system agenda item:', error);
      toast({
        title: "Fehler",
        description: "Der dynamische Punkt konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

  const updateAgendaItem = async (index: number, field: keyof AgendaItem, value: any) => {
    console.log('🔧 UPDATE AGENDA ITEM:', { index, field, value });
    
    // Normalize assigned_to to prevent double-nested arrays
    let normalizedValue = value;
    if (field === 'assigned_to' && Array.isArray(value)) {
      normalizedValue = value.flat(); // Flatten in case of [[userId]]
    }
    
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: normalizedValue };
    setAgendaItems(updated);
    
    // Auto-save if item has an ID and we have a selected meeting
    if (updated[index].id && selectedMeeting?.id) {
      try {
        console.log('💾 Auto-saving agenda item change to database');
        
        // For assigned_to, ensure it's a flat array for database
        let dbValue = normalizedValue;
        if (field === 'assigned_to') {
          dbValue = normalizedValue && Array.isArray(normalizedValue) && normalizedValue.length > 0 
            ? normalizedValue.flat() 
            : null;
        }
        
        await supabase
          .from('meeting_agenda_items')
          .update({ [field]: dbValue })
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
        title: p.title || '',
        description: p.description || null,
        assigned_to: Array.isArray(p.assigned_to) && p.assigned_to.length > 0 
          ? p.assigned_to.filter(Boolean) 
          : null,
        notes: p.notes || null,
        is_completed: Boolean(p.is_completed),
        is_recurring: Boolean(p.is_recurring),
        task_id: p.task_id || null,
        order_index: p.order_index,
        system_type: p.system_type || null,
        is_optional: Boolean(p.is_optional),
        is_visible: p.is_visible !== false,
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
          title: c.title || '',
          description: c.description || null,
          assigned_to: Array.isArray(c.assigned_to) && c.assigned_to.length > 0 
            ? c.assigned_to.filter(Boolean) 
            : null,
          notes: c.notes || null,
          is_completed: Boolean(c.is_completed),
          is_recurring: Boolean(c.is_recurring),
          task_id: c.task_id || null,
          order_index: c.order_index,
          parent_id: c.parentLocalKey ? parentIdByLocalKey[c.parentLocalKey] || null : null,
          system_type: c.system_type || null,
          is_optional: Boolean(c.is_optional),
          is_visible: c.is_visible !== false,
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
    } catch (error: any) {
      console.error('Error saving agenda:', error);
      
      let errorMessage = 'Die Agenda konnte nicht gespeichert werden.';
      if (error.message?.includes('invalid input syntax for type json')) {
        errorMessage = 'Ungültiges Datenformat. Bitte prüfen Sie die Eingaben.';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Netzwerkfehler. Die Änderungen werden beim nächsten Laden synchronisiert.';
      }
      
      toast({
        title: 'Fehler beim Speichern',
        description: errorMessage,
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

      // Determine the assignee: task.assigned_to, then task.user_id, then current user
      const taskOwner = task.assigned_to || task.user_id || user?.id;

      // Insert the task as a sub-item with correct parent_id and automatic assignment
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
          assigned_to: taskOwner ? [taskOwner] : null, // Automatic assignment from task owner
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

      // Insert the sub-item with correct parent_id and current user as default assignee
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
          assigned_to: user?.id ? [user.id] : null, // Current user as default assignee
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

    // Optimistic update: remove from local state first
    const previousItems = [...agendaItems];
    const updatedItems = agendaItems.filter((_, i) => i !== index);
    const reindexedItems = updatedItems.map((it, idx) => ({
      ...it,
      order_index: idx
    }));
    setAgendaItems(reindexedItems);

    // If item has an ID, delete from database
    if (item.id) {
      try {
        const { error } = await supabase
          .from('meeting_agenda_items')
          .delete()
          .eq('id', item.id);

        // Resilient pattern: ignore network errors that don't prevent DB deletion
        if (error) {
          const errorMessage = error.message || '';
          const isNetworkError = errorMessage.includes('Failed to fetch') || 
                                 errorMessage.includes('NetworkError') ||
                                 errorMessage.includes('TypeError');
          
          if (!isNetworkError) {
            // Rollback only on real errors
            setAgendaItems(previousItems);
            console.error('Delete error:', error);
            toast({
              title: "Fehler beim Löschen",
              description: "Der Agenda-Punkt konnte nicht gelöscht werden.",
              variant: "destructive",
            });
            return;
          }
          // For network errors, stay optimistic
          console.log('Network error during delete, staying optimistic');
        }

        toast({
          title: "Punkt gelöscht",
          description: "Der Agenda-Punkt wurde erfolgreich gelöscht.",
        });
      } catch (error: any) {
        const errorMessage = error?.message || '';
        const isNetworkError = errorMessage.includes('Failed to fetch') || 
                               errorMessage.includes('NetworkError') ||
                               errorMessage.includes('TypeError');
        
        if (!isNetworkError) {
          // Rollback only on real errors
          setAgendaItems(previousItems);
          console.error('Delete error:', error);
          toast({
            title: "Fehler beim Löschen",
            description: "Der Agenda-Punkt konnte nicht gelöscht werden.",
            variant: "destructive",
          });
        }
      }
    }
  };

  // Toggle visibility of optional sub-items
  const toggleOptionalItemVisibility = async (itemId: string, currentVisibility: boolean) => {
    try {
      const newVisibility = !currentVisibility;
      
      const { error } = await supabase
        .from('meeting_agenda_items')
        .update({ is_visible: newVisibility })
        .eq('id', itemId);
      
      if (error) throw error;
      
      // Update local state
      setAgendaItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, is_visible: newVisibility } : item
      ));
      
      toast({
        title: newVisibility ? "Punkt aktiviert" : "Punkt ausgeblendet",
        description: newVisibility ? "Der optionale Punkt wird nun angezeigt." : "Der optionale Punkt wurde ausgeblendet.",
      });
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast({
        title: "Fehler",
        description: "Sichtbarkeit konnte nicht geändert werden.",
        variant: "destructive",
      });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    

    // Create a copy of all items
    const allItems = [...agendaItems];
    
    // Get the dragged item
    const draggedItem = allItems[source.index];
    
                  // Remove the dragged item from its current position
                  allItems.splice(source.index, 1);

                  // If this is a main item (no parent), move it with all its children
                  if (!draggedItem.parent_id && !draggedItem.parentLocalKey) {
                    const draggedKey = draggedItem.id || draggedItem.localKey;
                    
                    // Find all children of this main item
                    const children = allItems.filter(item => 
                      item.parent_id === draggedItem.id || item.parentLocalKey === draggedKey
                    );
      
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
                    assigned_to: Array.isArray(item.assigned_to) ? item.assigned_to : 
                      (item.assigned_to ? [item.assigned_to] : []),
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
  const updateMeeting = async (meetingId: string, updates: Partial<Meeting>, meetingTimeOverride?: string) => {
    // Optimistic update FIRST
    const optimisticUpdates = { ...updates };
    setMeetings(prev => prev.map(m => 
      m.id === meetingId ? { ...m, ...optimisticUpdates } : m
    ));
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting(prev => prev ? { ...prev, ...optimisticUpdates } : prev);
    }

    try {
      // Format meeting_date to string if it's a Date object
      const formattedUpdates: any = {
        ...updates,
        meeting_date: updates.meeting_date instanceof Date 
          ? format(updates.meeting_date, 'yyyy-MM-dd')
          : updates.meeting_date
      };
      
      // Include meeting_time - prioritize the value from updates/editingMeeting
      // First check if updates has meeting_time, then check editingMeeting, then fetch from DB if needed
      let timeToUse = meetingTimeOverride || updates.meeting_time?.substring(0, 5) || editingMeeting?.meeting_time?.substring(0, 5);
      
      // If still no time, fetch the current meeting to get its time
      if (!timeToUse) {
        const { data: currentMeeting } = await supabase
          .from('meetings')
          .select('meeting_time')
          .eq('id', meetingId)
          .single();
        timeToUse = currentMeeting?.meeting_time?.substring(0, 5) || '10:00';
      }
      
      formattedUpdates.meeting_time = timeToUse;

      const { error } = await supabase
        .from('meetings')
        .update(formattedUpdates)
        .eq('id', meetingId);

      if (error) {
        const errorMsg = error.message || '';
        const isNetworkError = errorMsg.includes('Failed to fetch') || 
                               errorMsg.includes('NetworkError');
        if (!isNetworkError) throw error;
        // For network errors, stay optimistic
        console.log('Network error during update, staying optimistic');
      }

      // Update corresponding appointment in calendar with proper timezone handling
      if (updates.meeting_date) {
        const dateStr = format(new Date(updates.meeting_date), 'yyyy-MM-dd');
        const localStartTime = new Date(`${dateStr}T${timeToUse}:00`);
        const localEndTime = new Date(localStartTime.getTime() + 60 * 60 * 1000);
        
        await supabase
          .from('appointments')
          .update({
            title: updates.title,
            description: updates.description,
            location: updates.location,
            start_time: localStartTime.toISOString(),
            end_time: localEndTime.toISOString(),
          })
          .eq('meeting_id', meetingId);
      } else {
        await supabase
          .from('appointments')
          .update({
            title: updates.title,
            description: updates.description,
            location: updates.location,
          })
          .eq('meeting_id', meetingId);
      }
      toast({
        title: "Meeting aktualisiert",
        description: "Das Meeting wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      // Rollback on real error
      await loadMeetings();
      toast({
        title: "Fehler",
        description: "Das Meeting konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      // 1. Get all agenda item IDs for this meeting first
      const { data: agendaItemIds, error: agendaFetchError } = await supabase
        .from('meeting_agenda_items')
        .select('id')
        .eq('meeting_id', meetingId);

      if (agendaFetchError) {
        console.error('Error fetching agenda items:', agendaFetchError);
      }

      // 2. Delete agenda documents if there are agenda items
      if (agendaItemIds && agendaItemIds.length > 0) {
        const { error: docError } = await supabase
          .from('meeting_agenda_documents')
          .delete()
          .in('meeting_agenda_item_id', agendaItemIds.map(i => i.id));
        if (docError) console.error('Error deleting agenda docs:', docError);
      }

      // 3. Delete agenda items
      const { error: itemsError } = await supabase
        .from('meeting_agenda_items')
        .delete()
        .eq('meeting_id', meetingId);
      if (itemsError) console.error('Error deleting agenda items:', itemsError);

      // 4. Delete meeting participants
      const { error: participantsError } = await supabase
        .from('meeting_participants')
        .delete()
        .eq('meeting_id', meetingId);
      if (participantsError) console.error('Error deleting participants:', participantsError);

      // 5. Unlink quick notes (don't delete, just remove meeting reference)
      const { error: notesError } = await supabase
        .from('quick_notes')
        .update({ meeting_id: null })
        .eq('meeting_id', meetingId)
        .select();
      if (notesError) console.error('Error unlinking notes:', notesError);

      // 6. Delete corresponding appointment
      const { error: appointmentError } = await supabase
        .from('appointments')
        .delete()
        .eq('meeting_id', meetingId);
      if (appointmentError) console.error('Error deleting appointment:', appointmentError);

      // 7. Delete meeting with proper RLS handling
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId)
        .select();

      if (error) throw error;

      // Update local state
      setMeetings(prev => prev.filter(m => m.id !== meetingId));
      
      if (selectedMeeting?.id === meetingId) {
        setSelectedMeeting(null);
        setAgendaItems([]);
      }
      
      if (activeMeetingId === meetingId) {
        setActiveMeeting(null);
        setActiveMeetingId(null);
        setLinkedQuickNotes([]);
      }

      toast({
        title: "Meeting gelöscht",
        description: "Das Meeting wurde erfolgreich gelöscht.",
      });
    } catch (error: any) {
      console.error('Delete meeting error:', error);
      
      let errorMessage = 'Das Meeting konnte nicht gelöscht werden.';
      if (error.message?.includes('invalid input syntax for type json')) {
        errorMessage = 'Datenbankfehler bei der Verarbeitung. Bitte versuchen Sie es erneut.';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Netzwerkfehler. Bitte prüfen Sie Ihre Verbindung.';
      }
      
      toast({
        title: "Fehler",
        description: errorMessage,
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

  // Show focus mode if active
  if (isFocusMode && activeMeeting) {
    return (
      <FocusModeView
        meeting={activeMeeting}
        agendaItems={agendaItems}
        profiles={profiles}
        linkedQuickNotes={linkedQuickNotes}
        linkedTasks={meetingLinkedTasks}
        upcomingAppointments={meetingUpcomingAppointments}
        starredAppointmentIds={starredAppointmentIds}
        onToggleStar={toggleStarAppointment}
        onClose={() => setIsFocusMode(false)}
        onUpdateItem={updateAgendaItem}
        onUpdateResult={updateAgendaItemResult}
        onUpdateNoteResult={updateQuickNoteResult}
        onArchive={() => archiveMeeting(activeMeeting)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-2rem)] rounded-lg">
        {/* Sidebar */}
        <ResizablePanel defaultSize={28} minSize={22} maxSize={38}>
          <div className="h-full flex flex-col pr-4 space-y-4 overflow-y-auto">
            {/* Header & Buttons */}
            <div>
              <h1 className="text-2xl font-bold mb-1">Meeting Agenda</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Ihre wöchentlichen Besprechungen
              </p>
              <div className="flex gap-2">
                <Dialog open={isNewMeetingOpen} onOpenChange={setIsNewMeetingOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex-1" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Neues Meeting
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                          onValueChange={(value) => {
                            const templateId = value === 'none' ? undefined : value;
                            setNewMeeting({ ...newMeeting, template_id: templateId });
                            
                            if (templateId) {
                              const template = meetingTemplates.find(t => t.id === templateId);
                              if (template) {
                                if (template.default_participants && template.default_participants.length > 0) {
                                  supabase
                                    .from('profiles')
                                    .select('user_id, display_name, avatar_url')
                                    .in('user_id', template.default_participants)
                                    .then(({ data }) => {
                                      if (data) {
                                        setNewMeetingParticipants(data.map(u => ({
                                          userId: u.user_id,
                                          role: 'participant' as const,
                                          user: {
                                            id: u.user_id,
                                            display_name: u.display_name || 'Unbekannt',
                                            avatar_url: u.avatar_url
                                          }
                                        })));
                                      }
                                    });
                                }
                                if (template.default_recurrence) {
                                  setNewMeetingRecurrence(template.default_recurrence);
                                }
                              }
                            }
                          }}
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
                          <TimePickerCombobox
                            value={newMeetingTime}
                            onChange={setNewMeetingTime}
                          />
                        </div>
                      </div>

                      {/* Participants Section */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <label className="text-sm font-medium">Teilnehmer</label>
                        </div>
                        <UserSelector
                          onSelect={(user) => {
                            if (!newMeetingParticipants.some(p => p.userId === user.id)) {
                              setNewMeetingParticipants(prev => [...prev, {
                                userId: user.id,
                                role: 'participant',
                                user: {
                                  id: user.id,
                                  display_name: user.display_name,
                                  avatar_url: user.avatar_url
                                }
                              }]);
                            }
                          }}
                          placeholder="Teammitglied hinzufügen..."
                          clearAfterSelect
                          excludeUserIds={newMeetingParticipants.map(p => p.userId)}
                        />
                        {newMeetingParticipants.length > 0 && (
                          <div className="space-y-2">
                            {newMeetingParticipants.map((p, idx) => (
                              <div key={p.userId} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                                <span className="flex-1 text-sm">{p.user?.display_name}</span>
                                <Select 
                                  value={p.role} 
                                  onValueChange={(v) => {
                                    const updated = [...newMeetingParticipants];
                                    updated[idx] = { ...p, role: v as any };
                                    setNewMeetingParticipants(updated);
                                  }}
                                >
                                  <SelectTrigger className="w-28 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="organizer">Organisator</SelectItem>
                                    <SelectItem value="participant">Teilnehmer</SelectItem>
                                    <SelectItem value="optional">Optional</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => setNewMeetingParticipants(prev => prev.filter((_, i) => i !== idx))}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Public Meeting Option */}
                      <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
                        <Checkbox 
                          id="is_public" 
                          checked={newMeeting.is_public || false}
                          onCheckedChange={(checked) => setNewMeeting({ ...newMeeting, is_public: !!checked })}
                        />
                        <div className="flex-1">
                          <label htmlFor="is_public" className="text-sm font-medium cursor-pointer">
                            Öffentliches Meeting
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Alle Teammitglieder können dieses Meeting sehen
                          </p>
                        </div>
                      </div>

                      {/* Recurrence Section */}
                      <RecurrenceSelector
                        value={newMeetingRecurrence}
                        onChange={setNewMeetingRecurrence}
                        startDate={format(newMeeting.meeting_date instanceof Date ? newMeeting.meeting_date : new Date(newMeeting.meeting_date), 'yyyy-MM-dd')}
                      />

                      <div className="flex justify-end space-x-2 pt-4">
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
                <Button variant="outline" size="sm" onClick={() => setShowArchive(true)}>
                  <Archive className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Meeting List */}
            <div className="flex-1 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nächste Besprechungen
              </h3>
              <div className="space-y-2">
                {upcomingMeetings.map((meeting) => (
                  <Card 
                    key={meeting.id} 
                    className={cn(
                      "cursor-pointer hover:shadow-sm transition-all",
                      selectedMeeting?.id === meeting.id && "border-primary ring-1 ring-primary bg-primary/5"
                    )}
                    onClick={() => { 
                      setSelectedMeeting(meeting); 
                      if (meeting.id) {
                        setAgendaItems([]);
                        loadAgendaItems(meeting.id as string);
                      }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm truncate">{meeting.title}</h4>
                            {meeting.is_public && (
                              <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <CalendarIcon className="h-3 w-3" />
                            <span>{format(new Date(meeting.meeting_date), 'dd.MM.', { locale: de })}</span>
                            {meeting.meeting_time && (
                              <>
                                <Clock className="h-3 w-3 ml-1" />
                                <span>{meeting.meeting_time.substring(0, 5)}</span>
                              </>
                            )}
                          </div>
                          {meeting.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{meeting.location}</span>
                            </div>
                          )}
                          <MeetingParticipantAvatars meetingId={meeting.id} size="xs" />
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      
                      {/* Start/Stop Button */}
                      <div className="mt-2 pt-2 border-t">
                        {activeMeetingId === meeting.id ? (
                          <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); stopMeeting(); }} className="w-full h-7 text-xs bg-green-600 hover:bg-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Laufend
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startMeeting(meeting); }} className="w-full h-7 text-xs" disabled={activeMeetingId !== null}>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Starten
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {upcomingMeetings.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Keine anstehenden Besprechungen
                  </p>
                )}
              </div>
            </div>

            {/* Selected Meeting Details */}
            {selectedMeeting && !activeMeeting && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Details
                  </h3>
                  <div className="flex gap-1">
                    {editingMeeting?.id === selectedMeeting.id ? (
                      <>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { updateMeeting(selectedMeeting.id!, editingMeeting); setEditingMeeting(null); }}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMeeting(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMeeting(selectedMeeting)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive">
                              <Trash className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Meeting löschen</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sind Sie sicher, dass Sie das Meeting "{selectedMeeting.title}" löschen möchten?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMeeting(selectedMeeting.id!)}>Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
                
                {editingMeeting?.id === selectedMeeting.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Titel</label>
                      <Input value={editingMeeting.title} onChange={(e) => setEditingMeeting({ ...editingMeeting, title: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Beschreibung</label>
                      <Textarea value={editingMeeting.description || ''} onChange={(e) => setEditingMeeting({ ...editingMeeting, description: e.target.value })} className="text-sm min-h-[60px]" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Ort</label>
                      <Input value={editingMeeting.location || ''} onChange={(e) => setEditingMeeting({ ...editingMeeting, location: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Datum</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal text-xs">
                              {format(new Date(editingMeeting.meeting_date), "dd.MM.yy", { locale: de })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={new Date(editingMeeting.meeting_date)} onSelect={(date) => date && setEditingMeeting({ ...editingMeeting, meeting_date: date })} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Uhrzeit</label>
                        <TimePickerCombobox value={(editingMeeting.meeting_time || '10:00').substring(0, 5)} onChange={(time) => setEditingMeeting({ ...editingMeeting, meeting_time: time })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Teilnehmer</label>
                      {selectedMeeting.id && <InlineMeetingParticipantsEditor meetingId={selectedMeeting.id} />}
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded-md">
                      <Checkbox id={`edit_public_${selectedMeeting.id}`} checked={editingMeeting?.is_public || false} onCheckedChange={(checked) => setEditingMeeting({ ...editingMeeting!, is_public: !!checked })} />
                      <label htmlFor={`edit_public_${selectedMeeting.id}`} className="text-xs cursor-pointer">Öffentlich</label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {selectedMeeting.description && (
                      <p className="text-muted-foreground text-xs">{selectedMeeting.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" />
                      <span>{format(new Date(selectedMeeting.meeting_date), 'EEEE, d. MMMM yyyy', { locale: de })}</span>
                    </div>
                    {selectedMeeting.meeting_time && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{selectedMeeting.meeting_time.substring(0, 5)} Uhr</span>
                      </div>
                    )}
                    {selectedMeeting.location && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{selectedMeeting.location}</span>
                      </div>
                    )}
                    <div className="pt-2">
                      <label className="text-xs font-medium text-muted-foreground">Teilnehmer</label>
                      {selectedMeeting.id && <InlineMeetingParticipantsEditor meetingId={selectedMeeting.id} />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main Content Area */}
        <ResizablePanel defaultSize={72}>
          <div className="h-full pl-4 overflow-y-auto">

      {/* Active Meeting View */}
      {activeMeeting && (
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">
              Aktive Besprechung: {activeMeeting.title}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsFocusMode(true)}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Fokus-Modus
              </Button>
              <Button variant="outline" onClick={stopMeeting}>
                Besprechung unterbrechen
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="default">
                    Besprechung beenden und archivieren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Besprechung archivieren</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sind Sie sicher, dass Sie die Besprechung "{activeMeeting.title}" beenden und archivieren möchten? 
                      Es werden automatisch Aufgaben für zugewiesene Punkte erstellt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => archiveMeeting(activeMeeting)}>
                      Archivieren
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
                  // Sort ALL items by order_index first - this is the order from drag & drop
                  const allItemsSorted = [...activeMeetingItems].sort((a, b) => a.order_index - b.order_index);
                  
                  const processedItems: any[] = [];

                  // Process items in their order_index sequence to maintain drag & drop order
                  allItemsSorted.forEach((item) => {
                    // Only process main items (no parent)
                    if (!item.parent_id && !item.parentLocalKey) {
                      // Find ALL sub-items that belong to this main item and sort by order_index
                      // Filter by is_visible: only show items where is_visible is true or undefined
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
                      
                      // Filter visible sub-items (is_visible !== false)
                      const visibleSubItems = subItems.filter(sub => sub.is_visible !== false);
                      // Hidden optional sub-items for toggle button
                      const hiddenOptionalSubItems = subItems.filter(sub => sub.is_visible === false && sub.is_optional);
                      
                      processedItems.push({ item, subItems: visibleSubItems, hiddenOptionalSubItems });
                    }
                  });

                  return processedItems.map(({ item, subItems: sortedSubItems, hiddenOptionalSubItems }, index) => {
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
                          <MultiUserAssignSelect
                            assignedTo={item.assigned_to}
                            profiles={profiles}
                            onChange={(userIds) => updateAgendaItem(
                              agendaItems.findIndex(i => i.id === item.id), 
                              'assigned_to', 
                              userIds.length > 0 ? userIds : null
                            )}
                            size="sm"
                          />
                        </div>
                      </div>
                      
                      {item.description && (
                        <div className="mb-3 ml-12">
                          <RichTextDisplay content={item.description} className="text-muted-foreground" />
                        </div>
                      )}

                      {/* Show system content as individual sub-items */}
                      {item.system_type === 'upcoming_appointments' && (
                        <div className="ml-12 mb-4 space-y-3">
                          {meetingUpcomingAppointments.length > 0 ? (
                            (() => {
                              const apptResults = (() => {
                                try { return JSON.parse(item.result_text || '{}'); } catch { return {}; }
                              })();
                              return meetingUpcomingAppointments.map((appt, apptIdx) => (
                                <div key={appt.id} className={cn(
                                  "pl-4 border-l-2 border-muted space-y-2",
                                  starredAppointmentIds.has(appt.id) && "bg-amber-50/50 dark:bg-amber-950/20"
                                )}>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 shrink-0"
                                      onClick={(e) => { e.stopPropagation(); toggleStarAppointment(appt); }}
                                    >
                                      <Star className={cn("h-3.5 w-3.5", starredAppointmentIds.has(appt.id) ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                                    </Button>
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {String.fromCharCode(97 + apptIdx)})
                                    </span>
                                    <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="text-sm font-medium">{appt.title}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground ml-8">
                                    {format(new Date(appt.start_time), "EEE dd.MM. HH:mm", { locale: de })}
                                    {appt.end_time && ` - ${format(new Date(appt.end_time), "HH:mm")}`}
                                    {appt.location && ` | ${appt.location}`}
                                  </p>
                                  {(apptResults[appt.id] || expandedApptNotes.has(appt.id)) ? (
                                    <div className="ml-8">
                                      <Textarea
                                        value={apptResults[appt.id] || ''}
                                        onChange={(e) => {
                                          const newResults = { ...apptResults, [appt.id]: e.target.value };
                                          updateAgendaItemResult(item.id!, 'result_text', JSON.stringify(newResults));
                                        }}
                                        placeholder="Notizen zu diesem Termin..."
                                        className="min-h-[60px] text-xs"
                                      />
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs text-muted-foreground ml-8"
                                      onClick={() => setExpandedApptNotes(prev => new Set(prev).add(appt.id))}
                                    >
                                      <MessageSquarePlus className="h-3 w-3 mr-1" />
                                      Notiz
                                    </Button>
                                  )}
                                </div>
                              ));
                            })()
                          ) : (
                            <p className="text-sm text-muted-foreground pl-4">Keine Termine in den nächsten 2 Wochen.</p>
                          )}
                        </div>
                      )}
                      
                      {item.system_type === 'quick_notes' && (
                        <div className="ml-12 mb-4 space-y-3">
                          {linkedQuickNotes.length > 0 ? (
                            linkedQuickNotes.map((note, noteIdx) => (
                              <div key={note.id} className="pl-4 border-l-2 border-muted space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {String.fromCharCode(97 + noteIdx)})
                                  </span>
                                  <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                                  <span className="text-sm font-medium">{note.title || `Notiz ${noteIdx + 1}`}</span>
                                </div>
                                <RichTextDisplay content={note.content} className="text-sm text-muted-foreground" />
                                {note.user_id && (() => {
                                  const profile = getProfile(note.user_id);
                                  return profile ? (
                                    <div className="flex items-center gap-1.5 ml-6 mt-1">
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage src={profile.avatar_url || undefined} />
                                        <AvatarFallback className="text-[10px]">
                                          {(profile.display_name || '?').charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs text-muted-foreground">{profile.display_name}</span>
                                    </div>
                                  ) : null;
                                })()}
                                <div>
                                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
                                  <Textarea
                                    value={note.meeting_result || ''}
                                    onChange={(e) => updateQuickNoteResult(note.id, e.target.value)}
                                    placeholder="Ergebnis für diese Notiz..."
                                    className="min-h-[60px] text-xs"
                                  />
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground pl-4">Keine Notizen vorhanden.</p>
                          )}
                        </div>
                      )}

                      {item.system_type === 'tasks' && (
                        <div className="ml-12 mb-4 space-y-3">
                          {meetingLinkedTasks.length > 0 ? (
                            (() => {
                              const taskResults = (() => {
                                try { return JSON.parse(item.result_text || '{}'); } catch { return {}; }
                              })();
                              return meetingLinkedTasks.map((task, taskIdx) => (
                                <div key={task.id} className="pl-4 border-l-2 border-muted space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {String.fromCharCode(97 + taskIdx)})
                                    </span>
                                    <ListTodo className="h-3.5 w-3.5 text-green-500" />
                                    <span className="text-sm font-medium">{task.title}</span>
                                  </div>
                                  {task.description && (
                                    <RichTextDisplay content={task.description} className="text-sm text-muted-foreground" />
                                  )}
                                  {task.user_id && (() => {
                                    const profile = getProfile(task.user_id);
                                    return profile ? (
                                      <div className="flex items-center gap-1.5 ml-6 mt-1">
                                        <Avatar className="h-5 w-5">
                                          <AvatarImage src={profile.avatar_url || undefined} />
                                          <AvatarFallback className="text-[10px]">
                                            {(profile.display_name || '?').charAt(0).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-muted-foreground">{profile.display_name}</span>
                                      </div>
                                    ) : null;
                                  })()}
                                  {task.due_date && (
                                    <p className="text-xs text-muted-foreground">
                                      Frist: {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}
                                    </p>
                                  )}
                                  <div>
                                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
                                    <Textarea
                                      value={taskResults[task.id] || ''}
                                      onChange={(e) => {
                                        const newResults = { ...taskResults, [task.id]: e.target.value };
                                        updateAgendaItemResult(item.id!, 'result_text', JSON.stringify(newResults));
                                      }}
                                      placeholder="Ergebnis für diese Aufgabe..."
                                      className="min-h-[60px] text-xs"
                                    />
                                  </div>
                                </div>
                              ));
                            })()
                          ) : (
                            <p className="text-sm text-muted-foreground pl-4">Keine Aufgaben vorhanden.</p>
                          )}
                        </div>
                      )}

                      {item.system_type === 'birthdays' && (
                        <div className="ml-12 mb-4">
                          <BirthdayAgendaItem
                            meetingDate={selectedMeeting?.meeting_date}
                            meetingId={selectedMeeting?.id}
                            resultText={item.result_text}
                            onUpdateResult={(result: string) => updateAgendaItemResult(item.id!, 'result_text', result)}
                            isEmbedded
                            className="border-l-0 shadow-none bg-transparent"
                          />
                        </div>
                      )}

                      {/* Note: Removed fallback for "Aktuelles aus dem Landtag" - system_type should be used exclusively */}

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
                       {(sortedSubItems.length > 0 || hiddenOptionalSubItems.length > 0) && (
                         <div className="ml-12 mb-3">
                           <div className="flex items-center justify-between mb-2">
                             <label className="text-sm font-medium">Unterpunkte</label>
                             {hiddenOptionalSubItems.length > 0 && (
                               <Popover>
                                 <PopoverTrigger asChild>
                                   <Button variant="outline" size="sm" className="h-6 text-xs">
                                     <Plus className="h-3 w-3 mr-1" />
                                     {hiddenOptionalSubItems.length} optional
                                   </Button>
                                 </PopoverTrigger>
                                 <PopoverContent className="w-64">
                                   <div className="space-y-2">
                                     <p className="text-sm font-medium">Optionale Unterpunkte aktivieren</p>
                                     {hiddenOptionalSubItems.map(subItem => (
                                       <Button 
                                         key={subItem.id}
                                         size="sm" 
                                         variant="ghost"
                                         className="w-full justify-start text-xs h-8"
                                         onClick={() => toggleOptionalItemVisibility(subItem.id!, false)}
                                       >
                                         <Eye className="h-3 w-3 mr-2" /> {subItem.title}
                                       </Button>
                                     ))}
                                   </div>
                                 </PopoverContent>
                               </Popover>
                             )}
                           </div>
                           <div className="space-y-2">
                                 {sortedSubItems.map((subItem, subIndex) => (
                                   <div key={subItem.id} className="pl-4 border-l-2 border-muted">
                                    {/* Render system items with individual sub-items */}
                                      {subItem.system_type === 'upcoming_appointments' ? (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-medium text-muted-foreground">
                                              {index + 1}.{subIndex + 1}
                                            </span>
                                            <CalendarDays className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm font-medium">Kommende Termine</span>
                                          </div>
                                          {meetingUpcomingAppointments.length > 0 ? (
                                            (() => {
                                              const apptResults = (() => {
                                                try { return JSON.parse(subItem.result_text || '{}'); } catch { return {}; }
                                              })();
                                              return meetingUpcomingAppointments.map((appt, apptIdx) => (
                                                <div key={appt.id} className={cn(
                                                  "pl-4 border-l-2 border-muted space-y-2 ml-4",
                                                  starredAppointmentIds.has(appt.id) && "bg-amber-50/50 dark:bg-amber-950/20"
                                                )}>
                                                  <div className="flex items-center gap-2">
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-6 w-6 p-0 shrink-0"
                                                      onClick={(e) => { e.stopPropagation(); toggleStarAppointment(appt); }}
                                                    >
                                                      <Star className={cn("h-3.5 w-3.5", starredAppointmentIds.has(appt.id) ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                                                    </Button>
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                      {String.fromCharCode(97 + apptIdx)})
                                                    </span>
                                                    <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                                                    <span className="text-sm font-medium">{appt.title}</span>
                                                  </div>
                                                  <p className="text-xs text-muted-foreground ml-8">
                                                    {format(new Date(appt.start_time), "EEE dd.MM. HH:mm", { locale: de })}
                                                    {appt.end_time && ` - ${format(new Date(appt.end_time), "HH:mm")}`}
                                                    {appt.location && ` | ${appt.location}`}
                                                  </p>
                                                  {(apptResults[appt.id] || expandedApptNotes.has(appt.id)) ? (
                                                    <div className="ml-8">
                                                      <Textarea
                                                        value={apptResults[appt.id] || ''}
                                                        onChange={(e) => {
                                                          const newResults = { ...apptResults, [appt.id]: e.target.value };
                                                          updateAgendaItemResult(subItem.id!, 'result_text', JSON.stringify(newResults));
                                                        }}
                                                        placeholder="Notizen zu diesem Termin..."
                                                        className="min-h-[60px] text-xs"
                                                      />
                                                    </div>
                                                  ) : (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-6 text-xs text-muted-foreground ml-8"
                                                      onClick={() => setExpandedApptNotes(prev => new Set(prev).add(appt.id))}
                                                    >
                                                      <MessageSquarePlus className="h-3 w-3 mr-1" />
                                                      Notiz
                                                    </Button>
                                                  )}
                                                </div>
                                              ));
                                            })()
                                          ) : (
                                            <p className="text-sm text-muted-foreground pl-4">Keine Termine in den nächsten 2 Wochen.</p>
                                          )}
                                        </div>
                                     ) : subItem.system_type === 'quick_notes' ? (
                                       <div className="space-y-2">
                                         <div className="flex items-center gap-2 mb-2">
                                           <span className="text-xs font-medium text-muted-foreground">
                                             {index + 1}.{subIndex + 1}
                                           </span>
                                           <StickyNote className="h-4 w-4 text-amber-500" />
                                           <span className="text-sm font-medium">Meine Notizen</span>
                                         </div>
                                         {linkedQuickNotes.length > 0 ? (
                                           linkedQuickNotes.map((note, noteIdx) => (
                                              <div key={note.id} className="pl-4 border-l-2 border-muted space-y-2 ml-4">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs font-medium text-muted-foreground">
                                                    {String.fromCharCode(97 + noteIdx)})
                                                  </span>
                                                  <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                                                  <span className="text-sm font-medium">{note.title || `Notiz ${noteIdx + 1}`}</span>
                                                </div>
                                <RichTextDisplay content={note.content} className="text-sm text-muted-foreground" />
                                {note.user_id && (() => {
                                  const profile = getProfile(note.user_id);
                                  return profile ? (
                                    <div className="flex items-center gap-1.5 ml-6 mt-1">
                                      <Avatar className="h-5 w-5">
                                        <AvatarImage src={profile.avatar_url || undefined} />
                                        <AvatarFallback className="text-[10px]">
                                          {(profile.display_name || '?').charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs text-muted-foreground">{profile.display_name}</span>
                                    </div>
                                  ) : null;
                                })()}
                                <div>
                                  <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
                                  <Textarea
                                    value={note.meeting_result || ''}
                                    onChange={(e) => updateQuickNoteResult(note.id, e.target.value)}
                                    placeholder="Ergebnis für diese Notiz..."
                                    className="min-h-[60px] text-xs"
                                  />
                                </div>
                              </div>
                           ))
                         ) : (
                           <p className="text-sm text-muted-foreground pl-4">Keine Notizen vorhanden.</p>
                         )}
                        </div>
                      ) : subItem.system_type === 'tasks' ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {index + 1}.{subIndex + 1}
                            </span>
                            <ListTodo className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium">Aufgaben</span>
                          </div>
                          {meetingLinkedTasks.length > 0 ? (
                            (() => {
                              const taskResults = (() => {
                                try { return JSON.parse(subItem.result_text || '{}'); } catch { return {}; }
                              })();
                              return meetingLinkedTasks.map((task, taskIdx) => (
                                <div key={task.id} className="pl-4 border-l-2 border-muted space-y-2 ml-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {String.fromCharCode(97 + taskIdx)})
                                    </span>
                                    <ListTodo className="h-3.5 w-3.5 text-green-500" />
                                    <span className="text-sm font-medium">{task.title}</span>
                                  </div>
                                  {task.description && (
                                    <RichTextDisplay content={task.description} className="text-sm text-muted-foreground" />
                                  )}
                                  {task.user_id && (() => {
                                    const profile = getProfile(task.user_id);
                                    return profile ? (
                                      <div className="flex items-center gap-1.5 ml-6 mt-1">
                                        <Avatar className="h-5 w-5">
                                          <AvatarImage src={profile.avatar_url || undefined} />
                                          <AvatarFallback className="text-[10px]">
                                            {(profile.display_name || '?').charAt(0).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-muted-foreground">{profile.display_name}</span>
                                      </div>
                                    ) : null;
                                  })()}
                                  {task.due_date && (
                                                    <p className="text-xs text-muted-foreground">
                                                      Frist: {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}
                                                    </p>
                                                  )}
                                                  <div>
                                                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Ergebnis</label>
                                                    <Textarea
                                                      value={taskResults[task.id] || ''}
                                                      onChange={(e) => {
                                                        const newResults = { ...taskResults, [task.id]: e.target.value };
                                                        updateAgendaItemResult(subItem.id!, 'result_text', JSON.stringify(newResults));
                                                      }}
                                                      placeholder="Ergebnis für diese Aufgabe..."
                                                      className="min-h-[60px] text-xs"
                                                    />
                                                  </div>
                                                </div>
                                              ));
                                            })()
                                          ) : (
                                            <p className="text-sm text-muted-foreground pl-4">Keine Aufgaben vorhanden.</p>
                                          )}
                                        </div>
                                      ) : subItem.system_type === 'birthdays' ? (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-medium text-muted-foreground">
                                              {index + 1}.{subIndex + 1}
                                            </span>
                                            <Cake className="h-4 w-4 text-pink-500" />
                                            <span className="text-sm font-medium">Geburtstage</span>
                                          </div>
                                          <BirthdayAgendaItem
                                            meetingDate={selectedMeeting?.meeting_date}
                                            meetingId={selectedMeeting?.id}
                                            resultText={subItem.result_text}
                                            onUpdateResult={(result: string) => updateAgendaItemResult(subItem.id!, 'result_text', result)}
                                            isEmbedded
                                            className="border-l-0 shadow-none bg-transparent"
                                          />
                                        </div>
                                      ) : (
                                   <>
                                   <div className="flex items-center gap-2 mb-2">
                                     <span className="text-xs font-medium text-muted-foreground">
                                       {index + 1}.{subIndex + 1}
                                     </span>
                                     <span className="text-sm font-medium flex-1">{subItem.title}</span>
                                     {subItem.is_optional && (
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         className="h-6 w-6 p-0"
                                         onClick={() => toggleOptionalItemVisibility(subItem.id!, true)}
                                         title="Ausblenden"
                                       >
                                         <EyeOff className="h-3 w-3 text-muted-foreground" />
                                       </Button>
                                     )}
                                      <MultiUserAssignSelect
                                        assignedTo={subItem.assigned_to}
                                        profiles={profiles}
                                        onChange={(userIds) => {
                                          const itemIndex = agendaItems.findIndex(i => i.id === subItem.id);
                                          if (itemIndex !== -1) {
                                            updateAgendaItem(itemIndex, 'assigned_to', userIds.length > 0 ? userIds : null);
                                          }
                                        }}
                                        size="sm"
                                      />
                                   </div>
                                    {subItem.description && (
                                      <div className="mb-2 bg-muted/20 p-2 rounded border-l-2 border-primary/20">
                                        <RichTextDisplay content={subItem.description} className="text-sm text-foreground" />
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
                                  </>
                                   )}
                                 </div>
                               ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Result section - hide for system items since results are per-sub-item */}
                      {!item.system_type && (
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
                      )}
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

                {/* Quick Notes Section */}
                {linkedQuickNotes.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-dashed">
                    <div className="flex items-center gap-2 mb-4">
                      <StickyNote className="h-5 w-5 text-amber-500" />
                      <h3 className="font-semibold text-lg">Quick Notes für dieses Meeting</h3>
                      <Badge variant="secondary">{linkedQuickNotes.length}</Badge>
                    </div>
                    <div className="space-y-4">
                      {linkedQuickNotes.map((note) => (
                        <Card key={note.id} className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-3">
                              <div>
                                {note.title && (
                                  <h4 className="font-medium mb-1">{note.title}</h4>
                                )}
                                <RichTextDisplay content={note.content} className="text-sm text-muted-foreground" />
                                <p className="text-xs text-muted-foreground mt-2">
                                  Erstellt: {format(new Date(note.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium mb-2 block">Ergebnis / Besprechungsnotiz</label>
                                <Textarea
                                  value={note.meeting_result || ''}
                                  onChange={(e) => updateQuickNoteResult(note.id, e.target.value)}
                                  placeholder="Ergebnis aus der Besprechung eintragen..."
                                  className="min-h-[80px] bg-background"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
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
                  Agenda: {selectedMeeting.title} am {format(new Date(selectedMeeting.meeting_date), "EEEE, d. MMMM", { locale: de })}
                  {selectedMeeting.meeting_time && ` um ${selectedMeeting.meeting_time.substring(0, 5)} Uhr`}
                </h2>
              {hasEditPermission && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={addAgendaItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Punkt
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarDays className="h-4 w-4 mr-2" />
                        System
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56">
                      <div className="space-y-2">
                        <p className="text-sm font-medium mb-2">Dynamischen Punkt hinzufügen</p>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400"
                          onClick={() => addSystemAgendaItem('upcoming_appointments')}
                          disabled={agendaItems.some(i => i.system_type === 'upcoming_appointments')}
                        >
                          <CalendarDays className="h-4 w-4 mr-2" />
                          Kommende Termine
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                          onClick={() => addSystemAgendaItem('quick_notes')}
                          disabled={agendaItems.some(i => i.system_type === 'quick_notes')}
                        >
                          <StickyNote className="h-4 w-4 mr-2" />
                          Meine Notizen
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start border-green-200 text-green-700 dark:border-green-800 dark:text-green-400"
                          onClick={() => addSystemAgendaItem('tasks')}
                          disabled={agendaItems.some(i => i.system_type === 'tasks')}
                        >
                          <ListTodo className="h-4 w-4 mr-2" />
                          Aufgaben
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start border-pink-200 text-pink-700 dark:border-pink-800 dark:text-pink-400"
                          onClick={() => addSystemAgendaItem('birthdays')}
                          disabled={agendaItems.some(i => i.system_type === 'birthdays')}
                        >
                          <Cake className="h-4 w-4 mr-2" />
                          Geburtstage
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button onClick={saveAgendaItems}>
                    <Save className="h-4 w-4 mr-2" />
                    Speichern
                  </Button>
                </div>
              )}
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
                            <>
                              {/* Render system items as SystemAgendaItem */}
                              {item.system_type ? (
                                <div 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={cn(
                                    item.parentLocalKey || item.parent_id ? 'ml-6' : '',
                                    "relative"
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing mt-2"
                                    >
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1">
                                      <SystemAgendaItem 
                                        systemType={item.system_type as 'upcoming_appointments' | 'quick_notes' | 'tasks' | 'birthdays'}
                                        meetingDate={selectedMeeting?.meeting_date}
                                        meetingId={selectedMeeting?.id}
                                        allowStarring={true}
                                        linkedQuickNotes={linkedQuickNotes}
                                        linkedTasks={meetingLinkedTasks}
                                        profiles={profiles}
                                        resultText={item.result_text}
                                        onUpdateResult={item.system_type === 'birthdays' ? (result: string) => updateAgendaItem(index, 'result_text', result) : undefined}
                                        isEmbedded={true}
                                        defaultCollapsed={item.system_type === 'upcoming_appointments'}
                                        onDelete={hasEditPermission ? () => deleteAgendaItem(item, index) : undefined}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                              <Card 
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  (item.parentLocalKey || item.parent_id) && 'ml-6 border-l border-border',
                                  snapshot.isDragging && 'shadow-glow',
                                  "hover:bg-muted/30 transition-colors"
                                )}
                              > 
                                <CardContent className="p-2">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                   
                                     <div className="flex-1 space-y-2">
                                       <div className="flex items-center gap-2">
                                         <Input
                                           value={item.title}
                                           onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                                           placeholder={(item.parentLocalKey || item.parent_id) ? 'Unterpunkt' : 'Agenda-Punkt Titel'}
                                           disabled={!hasEditPermission}
                                           className={cn(
                                             "flex-1 border-none shadow-none p-0 h-auto font-semibold text-base",
                                             "bg-transparent hover:bg-muted/50 focus:bg-muted/50 transition-colors",
                                             !hasEditPermission && "cursor-not-allowed opacity-60"
                                           )}
                                         />
                                          {/* Notes button for main agenda items (before Plus) */}
                                          {!(item.parentLocalKey || item.parent_id) && hasEditPermission && (
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button size="icon" variant="ghost" className="shrink-0" aria-label="Notizen bearbeiten">
                                                  <StickyNote className={cn("h-4 w-4", item.notes && "text-amber-500")} />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-80">
                                                <div className="space-y-2">
                                                  <div className="text-sm font-medium mb-2">Notizen</div>
                                                  <Textarea
                                                    value={item.notes || ''}
                                                    onChange={(e) => updateAgendaItem(index, 'notes', e.target.value)}
                                                    placeholder="Vorbereitungsnotizen, Hintergrundinformationen, Gesprächspunkte..."
                                                    className="min-h-[100px]"
                                                  />
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                          )}
                                          {/* Plus button for sub-items */}
                                          {!(item.parentLocalKey || item.parent_id) && hasEditPermission && (
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
                                                  {/* System items as sub-items */}
                                                  <div className="border-t pt-2 mt-2">
                                                    <p className="text-xs text-muted-foreground mb-1">System-Punkt als Unterpunkt:</p>
                                                    <Button 
                                                      variant="outline" 
                                                      className="w-full justify-start border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400"
                                                      onClick={() => addSystemAgendaItem('upcoming_appointments', item)}
                                                      disabled={agendaItems.some(i => i.system_type === 'upcoming_appointments')}
                                                    >
                                                      <CalendarDays className="h-4 w-4 mr-2" />
                                                      Kommende Termine
                                                    </Button>
                                                    <Button 
                                                      variant="outline" 
                                                      className="w-full justify-start border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                                                      onClick={() => addSystemAgendaItem('quick_notes', item)}
                                                      disabled={agendaItems.some(i => i.system_type === 'quick_notes')}
                                                    >
                                                      <StickyNote className="h-4 w-4 mr-2" />
                                                      Meine Notizen
                                                    </Button>
                                                    <Button 
                                                      variant="outline" 
                                                      className="w-full justify-start border-green-200 text-green-700 dark:border-green-800 dark:text-green-400"
                                                      onClick={() => addSystemAgendaItem('tasks', item)}
                                                      disabled={agendaItems.some(i => i.system_type === 'tasks')}
                                                    >
                                                      <ListTodo className="h-4 w-4 mr-2" />
                                                      Aufgaben
                                                    </Button>
                                                    <Button 
                                                      variant="outline" 
                                                      className="w-full justify-start border-pink-200 text-pink-700 dark:border-pink-800 dark:text-pink-400"
                                                      onClick={() => addSystemAgendaItem('birthdays', item)}
                                                      disabled={agendaItems.some(i => i.system_type === 'birthdays')}
                                                    >
                                                      <Cake className="h-4 w-4 mr-2" />
                                                      Geburtstage
                                                    </Button>
                                                  </div>
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                          )}
                                          {/* Task button */}
                                          {!(item.parentLocalKey || item.parent_id) && hasEditPermission && (
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
                                          {/* Delete button */}
                                          {hasEditPermission && (
                                            <Button size="icon" variant="ghost" className="shrink-0 text-destructive hover:text-destructive" 
                                              onClick={() => deleteAgendaItem(item, index)} aria-label="Punkt löschen">
                                              <Trash className="h-4 w-4" />
                                            </Button>
                                          )}
                                       </div>

                                       {(item.parentLocalKey || item.parent_id) && (
                                         <>
                                           {item.description && /<[a-z][\s\S]*>/i.test(item.description) ? (
                                             <RichTextDisplay content={item.description} className="text-sm text-muted-foreground" />
                                           ) : (
                                             <Textarea
                                               value={item.description || ''}
                                               onChange={(e) => updateAgendaItem(index, 'description', e.target.value)}
                                               placeholder="Beschreibung"
                                               className="min-h-[60px]"
                                             />
                                           )}
                                           {/* Assignment for sub-items */}
                                           <MultiUserAssignSelect
                                             assignedTo={item.assigned_to}
                                             profiles={profiles}
                                             onChange={(userIds) => updateAgendaItem(index, 'assigned_to', userIds.length > 0 ? userIds : null)}
                                             size="sm"
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
                            </>
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

              {/* Pending Jour Fixe Notes Preview */}
              <PendingJourFixeNotes className="mt-4" />

              {/* Upcoming Appointments Preview - NUR wenn nicht bereits in Agenda */}
              {!agendaItems.some(item => item.system_type === 'upcoming_appointments') && (
                <Card className="mt-4">
                  <CardContent className="p-4">
                    <UpcomingAppointmentsSection 
                      meetingDate={selectedMeeting.meeting_date}
                      meetingId={selectedMeeting.id}
                      defaultCollapsed={true}
                      allowStarring={true}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Quick Notes Preview - NUR wenn nicht bereits in Agenda */}
              {!agendaItems.some(item => item.system_type === 'quick_notes') && linkedQuickNotes.length > 0 && (
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <StickyNote className="h-5 w-5 text-amber-500" />
                      Quick Notes für dieses Meeting
                      <Badge variant="secondary">{linkedQuickNotes.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {linkedQuickNotes.map((note) => (
                        <div key={note.id} className="p-3 bg-muted/50 rounded-md">
                          {note.title && (
                            <h4 className="font-semibold text-sm mb-1">{note.title}</h4>
                          )}
                          <RichTextDisplay content={note.content} className="text-sm" />
                          {note.meeting_result && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Ergebnis: {note.meeting_result}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
