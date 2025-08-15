import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Calendar as CalendarIcon, Users, FileText, Trash2, Check, X, Upload, Clock, Edit2, MapPin, GripVertical, MessageCircle, Paperclip, ListTodo, Send, Download } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface EventPlanning {
  id: string;
  title: string;
  description?: string;
  location?: string;
  contact_person?: string;
  background_info?: string;
  confirmed_date?: string;
  is_private: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface EventPlanningDate {
  id: string;
  event_planning_id: string;
  date_time: string;
  is_confirmed: boolean;
  appointment_id?: string;
}

interface ChecklistItem {
  id: string;
  event_planning_id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
  type?: string;
  sub_items?: Array<{
    title: string;
    is_completed: boolean;
  }>;
}

interface PlanningSubtask {
  id: string;
  planning_item_id: string;
  user_id: string;
  description: string;
  assigned_to?: string;
  due_date?: string;
  is_completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  result_text?: string;
  completed_at?: string;
}

interface PlanningComment {
  id: string;
  planning_item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
  };
}

interface PlanningDocument {
  id: string;
  planning_item_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

interface Collaborator {
  id: string;
  event_planning_id: string;
  user_id: string;
  can_edit: boolean;
  profiles?: {
    display_name?: string;
    avatar_url?: string;
  };
}

interface Profile {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
}

export function EventPlanningView() {
  console.log('=== EventPlanningView component loaded ===');
  const { user } = useAuth();
  const { toast } = useToast();
  const [plannings, setPlannings] = useState<EventPlanning[]>([]);
  const [selectedPlanning, setSelectedPlanning] = useState<EventPlanning | null>(null);
  const [planningDates, setPlanningDates] = useState<EventPlanningDate[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCollaboratorDialogOpen, setIsCollaboratorDialogOpen] = useState(false);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [newPlanningTitle, setNewPlanningTitle] = useState("");
  const [newPlanningIsPrivate, setNewPlanningIsPrivate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [planningTemplates, setPlanningTemplates] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemComments, setItemComments] = useState<{ [itemId: string]: PlanningComment[] }>({});
  const [itemSubtasks, setItemSubtasks] = useState<{ [itemId: string]: PlanningSubtask[] }>({});
  const [itemDocuments, setItemDocuments] = useState<{ [itemId: string]: PlanningDocument[] }>({});
  const [newComment, setNewComment] = useState("");
  const [newSubtask, setNewSubtask] = useState({ description: '', assigned_to: 'unassigned', due_date: '' });
  const [uploading, setUploading] = useState(false);
  const [editingComment, setEditingComment] = useState<{ [commentId: string]: string }>({});
  const [editingSubtask, setEditingSubtask] = useState<{ [id: string]: Partial<PlanningSubtask> }>({});
  const [expandedItems, setExpandedItems] = useState<{ [itemId: string]: { subtasks: boolean; comments: boolean; documents: boolean } }>({});
  const [showItemSubtasks, setShowItemSubtasks] = useState<{ [itemId: string]: boolean }>({});
  const [showItemComments, setShowItemComments] = useState<{ [itemId: string]: boolean }>({});
  const [showItemDocuments, setShowItemDocuments] = useState<{ [itemId: string]: boolean }>({});

  useEffect(() => {
    console.log('EventPlanningView mounted, user:', user);
    fetchPlannings();
    fetchAllProfiles();
    fetchPlanningTemplates();
  }, [user]);

  const fetchPlanningTemplates = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("planning_templates")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching planning templates:", error);
      return;
    }

    setPlanningTemplates(data || []);
  };

  useEffect(() => {
    if (selectedPlanning) {
      fetchPlanningDetails(selectedPlanning.id);
      loadAllItemCounts(); // Load counts for all items
    }
  }, [selectedPlanning]);

  const fetchPlannings = async () => {
    console.log('fetchPlannings called, user:', user);
    if (!user) {
      console.log('No user found, returning early');
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching plannings from Supabase...');
      const { data, error } = await supabase
        .from("event_plannings")
        .select("*")
        .order("created_at", { ascending: false });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Error fetching plannings:', error);
        toast({
          title: "Fehler",
          description: `Planungen konnten nicht geladen werden: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Successfully fetched plannings:', data);
      setPlannings(data || []);
      
      // Also fetch all collaborators for all plannings
      if (data && data.length > 0) {
        await fetchAllCollaborators(data.map(p => p.id));
      }
    } catch (err) {
      console.error('Unexpected error in fetchPlannings:', err);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCollaborators = async (planningIds: string[]) => {
    const { data: collabs } = await supabase
      .from("event_planning_collaborators")
      .select("*")
      .in("event_planning_id", planningIds);

    if (collabs) {
      // Fetch profile data separately
      const collabsWithProfiles = await Promise.all(
        collabs.map(async (collab) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", collab.user_id)
            .single();
          
          return {
            ...collab,
            profiles: profile
          };
        })
      );
      
      setCollaborators(collabsWithProfiles);
    } else {
      setCollaborators([]);
    }
  };

  const fetchAllProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url");

    if (error) {
      console.error("Error fetching profiles:", error);
      return;
    }

    setAllProfiles(data || []);
  };

  const fetchPlanningDetails = async (planningId: string) => {
    // Fetch dates
    const { data: dates } = await supabase
      .from("event_planning_dates")
      .select("*")
      .eq("event_planning_id", planningId)
      .order("date_time");

    setPlanningDates(dates || []);

    // Fetch checklist items
    const { data: checklist } = await supabase
      .from("event_planning_checklist_items")
      .select("*")
      .eq("event_planning_id", planningId)
      .order("order_index");

    // Transform the data to match our interface
    const transformedChecklist = (checklist || []).map((item: any) => ({
      ...item,
      sub_items: Array.isArray(item.sub_items) ? item.sub_items : 
                 (item.sub_items ? JSON.parse(item.sub_items as string) : [])
    }));
    setChecklistItems(transformedChecklist);
    loadAllItemCounts(transformedChecklist); // Load counts after checklist is loaded

    // Fetch collaborators
    const { data: collabs } = await supabase
      .from("event_planning_collaborators")
      .select("*")
      .eq("event_planning_id", planningId);

    if (collabs) {
      // Fetch profile data separately
      const collabsWithProfiles = await Promise.all(
        collabs.map(async (collab) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", collab.user_id)
            .single();
          
          return {
            ...collab,
            profiles: profile
          };
        })
      );
      
      setCollaborators(collabsWithProfiles);
    } else {
      setCollaborators([]);
    }
  };

  // Utility function for debouncing
  function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }) as T;
  }

  // Debounced auto-save function
  const debouncedUpdate = useCallback(
    debounce(async (field: string, value: any, planningId: string) => {
      const { error } = await supabase
        .from("event_plannings")
        .update({ [field]: value })
        .eq("id", planningId);

      if (error) {
        toast({
          title: "Fehler",
          description: "Änderung konnte nicht gespeichert werden.",
          variant: "destructive",
        });
      }
    }, 500),
    []
  );

  const updatePlanningField = async (field: string, value: any) => {
    if (!selectedPlanning) return;

    // Update local state immediately
    setSelectedPlanning({ ...selectedPlanning, [field]: value });
    
    // Debounced save to database
    debouncedUpdate(field, value, selectedPlanning.id);
  };

  const createPlanning = async () => {
    console.log('createPlanning called, user:', user, 'title:', newPlanningTitle);
    if (!user || !newPlanningTitle.trim()) return;

    const { data, error } = await supabase
      .from("event_plannings")
      .insert({
        title: newPlanningTitle,
        user_id: user.id,
        is_private: newPlanningIsPrivate,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Planung konnte nicht erstellt werden.",
        variant: "destructive",
      });
      return;
    }

    // Create checklist items based on selected template
    const templateParam = selectedTemplateId === "none" ? null : selectedTemplateId;
    await supabase.rpc("create_default_checklist_items", {
      planning_id: data.id,
      template_id_param: templateParam,
    });

    setNewPlanningTitle("");
    setNewPlanningIsPrivate(false);
    setSelectedTemplateId("none");
    setIsCreateDialogOpen(false);
    fetchPlannings();
    setSelectedPlanning(data);

    toast({
      title: "Erfolg",
      description: "Planung wurde erfolgreich erstellt.",
    });
  };

  const deletePlanning = async (planningId: string) => {
    const { error } = await supabase
      .from("event_plannings")
      .delete()
      .eq("id", planningId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Planung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
      return;
    }

    fetchPlannings();
    if (selectedPlanning?.id === planningId) {
      setSelectedPlanning(null);
    }

    toast({
      title: "Erfolg",
      description: "Planung wurde gelöscht.",
    });
  };

  const addPlanningDate = async () => {
    if (!selectedPlanning || !selectedDate) return;

    const dateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(":").map(Number);
    dateTime.setHours(hours, minutes);

    const { data, error } = await supabase
      .from("event_planning_dates")
      .insert({
        event_planning_id: selectedPlanning.id,
        date_time: dateTime.toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Termin konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    // Create blocked appointment and store appointment_id
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        user_id: user?.id,
        title: `Geplant: ${selectedPlanning.title}`,
        start_time: dateTime.toISOString(),
        end_time: new Date(dateTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        category: "blocked",
        status: "planned",
      })
      .select()
      .single();

    if (!appointmentError && appointment) {
      // Update the planning date with the appointment_id
      await supabase
        .from("event_planning_dates")
        .update({ appointment_id: appointment.id })
        .eq("id", data.id);
    }

    fetchPlanningDetails(selectedPlanning.id);
    setSelectedDate(undefined);
    setIsDateDialogOpen(false);

    toast({
      title: "Erfolg",
      description: "Termin wurde hinzugefügt und im Kalender geblockt.",
    });
  };

  const confirmDate = async (dateId: string) => {
    if (!selectedPlanning) return;

    // First, unconfirm all other dates
    await supabase
      .from("event_planning_dates")
      .update({ is_confirmed: false })
      .eq("event_planning_id", selectedPlanning.id);

    // Confirm the selected date
    const { data, error } = await supabase
      .from("event_planning_dates")
      .update({ is_confirmed: true })
      .eq("id", dateId)
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Termin konnte nicht bestätigt werden.",
        variant: "destructive",
      });
      return;
    }

    // Update planning with confirmed date
    await updatePlanningField("confirmed_date", data.date_time);

    // Update the appointment to be confirmed instead of blocked
    const confirmedDate = planningDates.find(d => d.id === dateId);
    if (confirmedDate?.appointment_id) {
      await supabase
        .from("appointments")
        .update({
          title: selectedPlanning.title,
          category: "appointment",
          status: "confirmed",
        })
        .eq("id", confirmedDate.appointment_id);
    }

    // Delete all other planning dates and their appointments
    const otherDates = planningDates.filter(d => d.id !== dateId);
    for (const date of otherDates) {
      if (date.appointment_id) {
        await supabase
          .from("appointments")
          .delete()
          .eq("id", date.appointment_id);
      }
    }

    await supabase
      .from("event_planning_dates")
      .delete()
      .eq("event_planning_id", selectedPlanning.id)
      .neq("id", dateId);

    fetchPlanningDetails(selectedPlanning.id);

    toast({
      title: "Erfolg",
      description: "Termin wurde bestätigt und andere Termine entfernt.",
    });
  };

  const updateConfirmedDate = async (dateId: string, newDateTime: string) => {
    if (!selectedPlanning) return;

    const { error } = await supabase
      .from("event_planning_dates")
      .update({ date_time: newDateTime })
      .eq("id", dateId);

    if (error) {
      toast({
        title: "Fehler", 
        description: "Termin konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    // Update the associated appointment
    const dateToUpdate = planningDates.find(d => d.id === dateId);
    if (dateToUpdate?.appointment_id) {
      const newDate = new Date(newDateTime);
      await supabase
        .from("appointments")
        .update({
          start_time: newDate.toISOString(),
          end_time: new Date(newDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", dateToUpdate.appointment_id);
    }

    // Update planning confirmed date
    await updatePlanningField("confirmed_date", newDateTime);
    
    fetchPlanningDetails(selectedPlanning.id);

    toast({
      title: "Erfolg",
      description: "Termin wurde aktualisiert.",
    });
  };

  const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ is_completed: !isCompleted })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Checkliste konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, is_completed: !isCompleted } : item
      )
    );
  };

  const updateChecklistItemTitle = async (itemId: string, title: string) => {
    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ title })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Checkliste konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, title } : item
      )
    );
  };

  const addChecklistItem = async () => {
    if (!selectedPlanning || !newChecklistItem.trim()) return;

    const maxOrder = Math.max(...checklistItems.map(item => item.order_index), -1);
    
    // Determine if it's a separator (starts with ---)
    const itemType = newChecklistItem.startsWith('---') ? 'separator' : 'item';
    const title = itemType === 'separator' ? newChecklistItem.replace(/^---\s*/, '') : newChecklistItem;

    const { data, error } = await supabase
      .from("event_planning_checklist_items")
      .insert({
        event_planning_id: selectedPlanning.id,
        title: title,
        order_index: maxOrder + 1,
        type: itemType,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Fehler",
        description: "Checklisten-Punkt konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    // Transform the new data to match our interface
    const transformedData = {
      ...data,
      sub_items: Array.isArray(data.sub_items) ? data.sub_items : 
                 (data.sub_items ? JSON.parse(data.sub_items as string) : [])
    };
    setChecklistItems([...checklistItems, transformedData]);
    setNewChecklistItem("");
  };

  const addCollaborator = async (userId: string, canEdit: boolean) => {
    if (!selectedPlanning) return;

    const { error } = await supabase
      .from("event_planning_collaborators")
      .insert({
        event_planning_id: selectedPlanning.id,
        user_id: userId,
        can_edit: canEdit,
      });

    if (error) {
      toast({
        title: "Fehler",
        description: "Mitarbeiter konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    fetchPlanningDetails(selectedPlanning.id);
    setIsCollaboratorDialogOpen(false);

    toast({
      title: "Erfolg",
      description: "Mitarbeiter wurde hinzugefügt.",
    });
  };

  const updateCollaboratorPermission = async (collaboratorId: string, canEdit: boolean) => {
    const { error } = await supabase
      .from("event_planning_collaborators")
      .update({ can_edit: canEdit })
      .eq("id", collaboratorId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Berechtigung konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setCollaborators(collaborators.map(collab =>
      collab.id === collaboratorId ? { ...collab, can_edit: canEdit } : collab
    ));

    toast({
      title: "Erfolg",
      description: "Berechtigung wurde aktualisiert.",
    });
  };

  const removeCollaborator = async (collaboratorId: string) => {
    const { error } = await supabase
      .from("event_planning_collaborators")
      .delete()
      .eq("id", collaboratorId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Mitarbeiter konnte nicht entfernt werden.",
        variant: "destructive",
      });
      return;
    }

    setCollaborators(collaborators.filter(collab => collab.id !== collaboratorId));

    toast({
      title: "Erfolg",
      description: "Mitarbeiter wurde entfernt.",
    });
  };

  const addSubItem = async (itemId: string) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem) return;

    const currentSubItems = currentItem.sub_items || [];
    const newSubItems = [...currentSubItems, { title: '', is_completed: false }];

    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ sub_items: newSubItems })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Unterpunkt konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, sub_items: newSubItems } : item
      )
    );
  };

  const toggleSubItem = async (itemId: string, subItemIndex: number, isCompleted: boolean) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;

    const updatedSubItems = currentItem.sub_items.map((subItem: any, index: number) =>
      index === subItemIndex ? { ...subItem, is_completed: !isCompleted } : subItem
    );

    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ sub_items: updatedSubItems })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Unterpunkt konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, sub_items: updatedSubItems } : item
      )
    );
  };

  const updateSubItemTitle = async (itemId: string, subItemIndex: number, title: string) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;

    const updatedSubItems = currentItem.sub_items.map((subItem: any, index: number) =>
      index === subItemIndex ? { ...subItem, title } : subItem
    );

    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ sub_items: updatedSubItems })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Unterpunkt konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, sub_items: updatedSubItems } : item
      )
    );
  };

  const removeSubItem = async (itemId: string, subItemIndex: number) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;

    const updatedSubItems = currentItem.sub_items.filter((_: any, index: number) => index !== subItemIndex);

    const { error } = await supabase
      .from("event_planning_checklist_items")
      .update({ sub_items: updatedSubItems })
      .eq("id", itemId);

    if (error) {
      toast({
        title: "Fehler",
        description: "Unterpunkt konnte nicht entfernt werden.",
        variant: "destructive",
      });
      return;
    }

    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, sub_items: updatedSubItems } : item
      )
    );
  };

  // Drag and drop functionality
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(checklistItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately
    setChecklistItems(items);

    // Update order_index for all items
    const updates = items.map((item, index) => ({
      id: item.id,
      order_index: index,
    }));

    try {
      for (const update of updates) {
        await supabase
          .from("event_planning_checklist_items")
          .update({ order_index: update.order_index })
          .eq("id", update.id);
      }
    } catch (error) {
      console.error('Error updating item order:', error);
      toast({
        title: "Fehler",
        description: "Reihenfolge konnte nicht gespeichert werden.",
        variant: "destructive",
      });
      // Revert local state on error
      fetchPlanningDetails(selectedPlanning!.id);
    }
  };

  // Load item details when item is selected
  useEffect(() => {
    if (selectedItemId) {
      loadItemComments(selectedItemId);
      loadItemSubtasks(selectedItemId);
      loadItemDocuments(selectedItemId);
    }
  }, [selectedItemId]);

  const loadItemComments = async (itemId: string) => {
    try {
      const { data: comments, error } = await supabase
        .from('planning_item_comments')
        .select('*')
        .eq('planning_item_id', itemId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        
        profiles = profilesData || [];
      }

      const formattedComments: PlanningComment[] = (comments || []).map(comment => ({
        id: comment.id,
        planning_item_id: comment.planning_item_id,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        profile: profiles.find(p => p.user_id === comment.user_id) || null,
      }));

      setItemComments(prev => ({ ...prev, [itemId]: formattedComments }));
    } catch (error) {
      console.error('Error loading item comments:', error);
    }
  };

  const loadItemSubtasks = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('planning_item_subtasks')
        .select('*')
        .eq('planning_item_id', itemId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setItemSubtasks(prev => ({ ...prev, [itemId]: data || [] }));
    } catch (error) {
      console.error('Error loading item subtasks:', error);
    }
  };

  const loadItemDocuments = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('planning_item_documents')
        .select('*')
        .eq('planning_item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItemDocuments(prev => ({ ...prev, [itemId]: data || [] }));
    } catch (error) {
      console.error('Error loading item documents:', error);
    }
  };

  const addItemComment = async () => {
    if (!newComment.trim() || !selectedItemId || !user) return;

    try {
      const { error } = await supabase
        .from('planning_item_comments')
        .insert({
          planning_item_id: selectedItemId,
          user_id: user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      loadItemComments(selectedItemId);
      loadAllItemCounts(); // Refresh counts

      toast({
        title: "Kommentar hinzugefügt",
        description: "Ihr Kommentar wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const addItemSubtask = async () => {
    if (!newSubtask.description.trim() || !selectedItemId || !user) return;

    try {
      const currentSubtasks = itemSubtasks[selectedItemId] || [];
      const nextOrderIndex = Math.max(...currentSubtasks.map(s => s.order_index), -1) + 1;
      
      const { error } = await supabase
        .from('planning_item_subtasks')
        .insert({
          planning_item_id: selectedItemId,
          user_id: user.id,
          description: newSubtask.description.trim(),
          assigned_to: newSubtask.assigned_to === 'unassigned' ? null : newSubtask.assigned_to,
          due_date: newSubtask.due_date || null,
          order_index: nextOrderIndex,
        });

      if (error) throw error;

      setNewSubtask({ description: '', assigned_to: 'unassigned', due_date: '' });
      loadItemSubtasks(selectedItemId);
      loadAllItemCounts(); // Refresh counts

      toast({
        title: "Unteraufgabe hinzugefügt",
        description: "Die Unteraufgabe wurde erfolgreich erstellt.",
      });
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast({
        title: "Fehler",
        description: "Unteraufgabe konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const addItemCommentForItem = async (itemId: string, comment: string) => {
    if (!comment.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('planning_item_comments')
        .insert({
          planning_item_id: itemId,
          user_id: user.id,
          content: comment.trim(),
        });

      if (error) throw error;

      loadItemComments(itemId);
      loadAllItemCounts(); // Refresh counts

      toast({
        title: "Kommentar hinzugefügt",
        description: "Ihr Kommentar wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  // Load counts for all items
  const loadAllItemCounts = async (items?: ChecklistItem[]) => {
    if (!selectedPlanning) return;

    try {
      // Get all item IDs - use provided items or current state
      const currentItems = items || checklistItems;
      const itemIds = currentItems.map(item => item.id);
      if (itemIds.length === 0) return;

      // Load subtasks counts
      const { data: subtasksData } = await supabase
        .from('planning_item_subtasks')
        .select('planning_item_id, id, description, is_completed, assigned_to, due_date, order_index, created_at, updated_at, result_text, completed_at, user_id')
        .in('planning_item_id', itemIds);

      const subtasksMap: { [itemId: string]: PlanningSubtask[] } = {};
      (subtasksData || []).forEach(subtask => {
        if (!subtasksMap[subtask.planning_item_id]) {
          subtasksMap[subtask.planning_item_id] = [];
        }
        subtasksMap[subtask.planning_item_id].push({
          ...subtask,
          user_id: subtask.user_id || user?.id || ''
        });
      });
      setItemSubtasks(subtasksMap);

      // Load comments counts
      const { data: commentsData } = await supabase
        .from('planning_item_comments')
        .select('planning_item_id, id, content, user_id, created_at')
        .in('planning_item_id', itemIds);

      // Get profile data for comments
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        profiles = profilesData || [];
      }

      const commentsMap: { [itemId: string]: PlanningComment[] } = {};
      (commentsData || []).forEach(comment => {
        if (!commentsMap[comment.planning_item_id]) {
          commentsMap[comment.planning_item_id] = [];
        }
        commentsMap[comment.planning_item_id].push({
          ...comment,
          profile: profiles.find(p => p.user_id === comment.user_id) || null,
        });
      });
      setItemComments(commentsMap);

      // Load documents counts
      const { data: documentsData } = await supabase
        .from('planning_item_documents')
        .select('planning_item_id, id, file_name, file_path, file_size, file_type, created_at, user_id')
        .in('planning_item_id', itemIds);

      const documentsMap: { [itemId: string]: PlanningDocument[] } = {};
      (documentsData || []).forEach(doc => {
        if (!documentsMap[doc.planning_item_id]) {
          documentsMap[doc.planning_item_id] = [];
        }
        documentsMap[doc.planning_item_id].push({
          ...doc,
          user_id: doc.user_id || user?.id || ''
        });
      });
      setItemDocuments(documentsMap);
    } catch (error) {
      console.error('Error loading item counts:', error);
    }
  };

  const handleItemFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExtension}`;
      const filePath = `planning-items/${user.id}/${itemId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('planning-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('planning_item_documents')
        .insert({
          planning_item_id: itemId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
        });

      if (dbError) throw dbError;

      loadItemDocuments(itemId);
      loadAllItemCounts(); // Refresh counts
      
      toast({
        title: "Dokument hochgeladen",
        description: "Das Dokument wurde erfolgreich hinzugefügt.",
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Fehler",
        description: "Das Dokument konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const deleteItemDocument = async (doc: PlanningDocument) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('planning-documents')
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('planning_item_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      loadItemDocuments(selectedItemId!);
      loadAllItemCounts(); // Refresh counts
      
      toast({
        title: "Dokument gelöscht",
        description: "Das Dokument wurde erfolgreich entfernt.",
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Fehler",
        description: "Das Dokument konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const downloadItemDocument = async (doc: PlanningDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('planning-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Fehler",
        description: "Das Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const deleteItemComment = async (comment: PlanningComment) => {
    if (!user || comment.user_id !== user.id) return;

    try {
      const { error } = await supabase
        .from('planning_item_comments')
        .delete()
        .eq('id', comment.id);

      if (error) throw error;

      loadItemComments(comment.planning_item_id);
      loadAllItemCounts();

      toast({
        title: "Kommentar gelöscht",
        description: "Der Kommentar wurde erfolgreich entfernt.",
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const updateItemComment = async (commentId: string, newContent: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('planning_item_comments')
        .update({ content: newContent, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('user_id', user.id); // Ensure user can only edit their own comments

      if (error) throw error;

      // Find the comment to get the planning_item_id
      const comment = Object.values(itemComments).flat().find(c => c.id === commentId);
      if (comment) {
        loadItemComments(comment.planning_item_id);
        loadAllItemCounts();
      }

      setEditingComment(prev => ({ ...prev, [commentId]: '' }));

      toast({
        title: "Kommentar aktualisiert",
        description: "Der Kommentar wurde erfolgreich bearbeitet.",
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht bearbeitet werden.",
        variant: "destructive",
      });
    }
  };


  if (!selectedPlanning) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Veranstaltungsplanung</h1>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Neue Planung
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Veranstaltungsplanung</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Titel</Label>
                    <Input
                      id="title"
                      value={newPlanningTitle}
                      onChange={(e) => setNewPlanningTitle(e.target.value)}
                      placeholder="Veranstaltungstitel eingeben..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="template">Template</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Template auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein Template</SelectItem>
                        {planningTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="private"
                      checked={newPlanningIsPrivate}
                      onCheckedChange={setNewPlanningIsPrivate}
                    />
                    <Label htmlFor="private">Nur für mich sichtbar</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createPlanning}>Erstellen</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plannings.map((planning) => {
              // Get collaborators for this planning
              const planningCollaborators = collaborators.filter(c => c.event_planning_id === planning.id);
              
              return (
                <Card
                  key={planning.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedPlanning(planning)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {planning.title}
                      {planning.is_private && (
                        <Badge variant="secondary">Privat</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {planning.description && (
                      <p className="text-sm text-muted-foreground">
                        {planning.description}
                      </p>
                    )}
                    
                    {planning.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{planning.location}</span>
                      </div>
                    )}

                    {planning.confirmed_date && (
                      <p className="text-sm font-medium text-primary">
                        Bestätigter Termin: {format(new Date(planning.confirmed_date), "dd.MM.yyyy HH:mm", { locale: de })}
                      </p>
                    )}

                    {(planningCollaborators.length > 0 || planning.user_id) && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Bearbeiter:</span>
                        <div className="flex -space-x-2">
                          {/* Show creator first */}
                          {planning.user_id && (
                            <Avatar className="h-6 w-6 border-2 border-background">
                              <AvatarImage src={allProfiles.find(p => p.user_id === planning.user_id)?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {allProfiles.find(p => p.user_id === planning.user_id)?.display_name?.charAt(0) || 'E'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {/* Then show other collaborators */}
                          {planningCollaborators.filter(c => c.user_id !== planning.user_id).slice(0, planning.user_id ? 2 : 3).map((collaborator) => (
                            <Avatar key={collaborator.id} className="h-6 w-6 border-2 border-background">
                              <AvatarImage src={collaborator.profiles?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {collaborator.profiles?.display_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {(planningCollaborators.filter(c => c.user_id !== planning.user_id).length + (planning.user_id ? 1 : 0)) > 3 && (
                            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">+{(planningCollaborators.filter(c => c.user_id !== planning.user_id).length + (planning.user_id ? 1 : 0)) - 3}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">
                      Erstellt am {format(new Date(planning.created_at), "dd.MM.yyyy", { locale: de })}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setSelectedPlanning(null)}>
              ← Zurück
            </Button>
            <h1 className="text-3xl font-bold text-foreground">
              Veranstaltungsplanung
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Planung löschen</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sind Sie sicher, dass Sie diese Planung löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletePlanning(selectedPlanning.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grunddaten */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle>Grunddaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Titel der Veranstaltung</Label>
                <div className="flex items-center space-x-2">
                  {editingTitle ? (
                    <Input
                      value={tempTitle}
                      onChange={(e) => setTempTitle(e.target.value)}
                      onBlur={() => {
                        updatePlanningField("title", tempTitle);
                        setEditingTitle(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updatePlanningField("title", tempTitle);
                          setEditingTitle(false);
                        }
                        if (e.key === "Escape") {
                          setTempTitle(selectedPlanning.title);
                          setEditingTitle(false);
                        }
                      }}
                      className="flex-1"
                      autoFocus
                    />
                  ) : (
                    <Input
                      value={selectedPlanning.title}
                      onClick={() => {
                        setTempTitle(selectedPlanning.title);
                        setEditingTitle(true);
                      }}
                      readOnly
                      className="flex-1 cursor-pointer"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTempTitle(selectedPlanning.title);
                      setEditingTitle(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={selectedPlanning.description || ""}
                  onChange={(e) => updatePlanningField("description", e.target.value)}
                  placeholder="Beschreibung der Veranstaltung..."
                />
              </div>
              <div>
                <Label htmlFor="location">Ort</Label>
                <Input
                  id="location"
                  value={selectedPlanning.location || ""}
                  onChange={(e) => updatePlanningField("location", e.target.value)}
                  placeholder="Veranstaltungsort..."
                />
              </div>
              <div>
                <Label htmlFor="contact">Ansprechperson vor Ort</Label>
                <Input
                  id="contact"
                  value={selectedPlanning.contact_person || ""}
                  onChange={(e) => updatePlanningField("contact_person", e.target.value)}
                  placeholder="Name und Kontaktdaten..."
                />
              </div>
              <div>
                <Label htmlFor="background">Hintergründe</Label>
                <Textarea
                  id="background"
                  value={selectedPlanning.background_info || ""}
                  onChange={(e) => updatePlanningField("background_info", e.target.value)}
                  placeholder="Hintergrundinformationen..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Mitarbeiter */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Mitarbeiter
                <Dialog open={isCollaboratorDialogOpen} onOpenChange={setIsCollaboratorDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Users className="mr-2 h-4 w-4" />
                      Hinzufügen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Mitarbeiter hinzufügen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {allProfiles
                        .filter(profile => 
                          profile.user_id !== user?.id && 
                          !collaborators.some(c => c.user_id === profile.user_id)
                        )
                        .map((profile) => (
                          <div key={profile.user_id} className="flex items-center justify-between">
                            <span>{profile.display_name || 'Unbenannt'}</span>
                            <div className="space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addCollaborator(profile.user_id, false)}
                              >
                                Nur ansehen
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => addCollaborator(profile.user_id, true)}
                              >
                                Bearbeiten
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {collaborators.length > 0 ? (
                <div className="space-y-2">
                  {collaborators.map((collaborator) => (
                    <div key={collaborator.id} className="flex items-center justify-between p-2 rounded-md border">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={collaborator.profiles?.avatar_url} />
                          <AvatarFallback>
                            {collaborator.profiles?.display_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span>{collaborator.profiles?.display_name || 'Unbenannt'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Select
                          value={collaborator.can_edit ? "edit" : "view"}
                          onValueChange={(value) => updateCollaboratorPermission(collaborator.id, value === "edit")}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">Ansehen</SelectItem>
                            <SelectItem value="edit">Bearbeiten</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCollaborator(collaborator.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Mitarbeiter hinzugefügt</p>
              )}
            </CardContent>
          </Card>

          {/* Termine */}
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Termine
                {!planningDates.some(d => d.is_confirmed) && (
                  <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Termin hinzufügen
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Neuen Termin hinzufügen</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Datum</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !selectedDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "dd.MM.yyyy", { locale: de }) : "Datum wählen"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label htmlFor="time">Uhrzeit</Label>
                          <Input
                            id="time"
                            type="time"
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={addPlanningDate}>Hinzufügen</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {planningDates.map((date) => (
                  <div key={date.id}>
                    {date.is_confirmed ? (
                      <div className="flex items-center justify-between p-3 rounded-md border bg-primary/10 border-primary">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <input
                            type="datetime-local"
                            value={new Date(date.date_time).toISOString().slice(0, 16)}
                            onChange={(e) => updateConfirmedDate(date.id, new Date(e.target.value).toISOString())}
                            className="bg-transparent border-none outline-none font-medium"
                          />
                          <Badge variant="default">Bestätigt</Badge>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-md border">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {format(new Date(date.date_time), "dd.MM.yyyy HH:mm", { locale: de })}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => confirmDate(date.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {planningDates.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Noch keine Termine hinzugefügt
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Checkliste */}
          <Card className="lg:col-span-2 bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle>Checkliste</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="checklist">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {checklistItems.map((item: any, index: number) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "group",
                                  snapshot.isDragging && "z-50"
                                )}
                              >
                                {item.type === 'separator' ? (
                                  <div className="flex items-center gap-2 py-3">
                                    <div {...provided.dragHandleProps} className="text-muted-foreground">
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 border-t border-dashed border-border"></div>
                                    <Input
                                      value={item.title || 'Trenner'}
                                      onChange={(e) => updateChecklistItemTitle(item.id, e.target.value)}
                                      className="text-muted-foreground italic text-sm px-2 border-none bg-transparent text-center w-32"
                                      placeholder="Trenner-Text eingeben..."
                                    />
                                    <div className="flex-1 border-t border-dashed border-border"></div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2 p-3 border border-border rounded-md bg-background hover:bg-muted/50 transition-colors">
                                      <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-foreground">
                                        <GripVertical className="h-4 w-4" />
                                      </div>
                                      <Checkbox
                                        checked={item.is_completed}
                                        onCheckedChange={() => toggleChecklistItem(item.id, item.is_completed)}
                                      />
                                      <Input
                                        value={item.title}
                                        onChange={(e) => updateChecklistItemTitle(item.id, e.target.value)}
                                        className={cn(
                                          "flex-1 border-none bg-transparent focus:bg-background",
                                          item.is_completed && "line-through text-muted-foreground"
                                        )}
                                      />
                                      <div className="flex items-center space-x-1">
                                        {/* Clickable badges to expand sections */}
                                        {(itemSubtasks[item.id]?.length || 0) > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowItemSubtasks(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                            className="h-auto p-1"
                                          >
                                            <Badge variant="secondary" className="text-xs">
                                              <ListTodo className="h-3 w-3 mr-1" />
                                              {itemSubtasks[item.id].length}
                                            </Badge>
                                          </Button>
                                        )}
                                        {(itemComments[item.id]?.length || 0) > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowItemComments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                            className="h-auto p-1"
                                          >
                                            <Badge variant="secondary" className="text-xs">
                                              <MessageCircle className="h-3 w-3 mr-1" />
                                              {itemComments[item.id].length}
                                            </Badge>
                                          </Button>
                                        )}
                                        {(itemDocuments[item.id]?.length || 0) > 0 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowItemDocuments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                            className="h-auto p-1"
                                          >
                                            <Badge variant="secondary" className="text-xs">
                                              <Paperclip className="h-3 w-3 mr-1" />
                                              {itemDocuments[item.id].length}
                                            </Badge>
                                          </Button>
                                        )}
                                        
                                         {/* Add new subtask/comment/document buttons - always visible when there are items */}
                                         <Button 
                                           variant="ghost" 
                                           size="sm"
                                           onClick={() => setShowItemSubtasks(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                           className="text-muted-foreground hover:text-foreground transition-opacity"
                                           title="Unteraufgabe hinzufügen"
                                         >
                                           <ListTodo className="h-3 w-3" />
                                         </Button>
                                         <Button 
                                           variant="ghost" 
                                           size="sm"
                                           onClick={() => setShowItemComments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                           className="text-muted-foreground hover:text-foreground transition-opacity"
                                           title="Kommentar hinzufügen"
                                         >
                                           <MessageCircle className="h-3 w-3" />
                                         </Button>
                                         <Button 
                                           variant="ghost" 
                                           size="sm"
                                           onClick={() => setShowItemDocuments(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                           className="text-muted-foreground hover:text-foreground transition-opacity"
                                           title="Dokument hinzufügen"
                                         >
                                          <Paperclip className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Expanded Subtasks */}
                                    {showItemSubtasks[item.id] && (
                                      <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                                        <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                                          <ListTodo className="h-4 w-4" />
                                          Unteraufgaben
                                        </div>
                                         {itemSubtasks[item.id]?.map((subtask) => (
                                           <div key={subtask.id} className="space-y-2 p-2 border border-border rounded bg-muted/30">
                                             <div className="flex items-center space-x-2">
                                               <Checkbox
                                                 checked={subtask.is_completed}
                                                 onCheckedChange={() => {
                                                   supabase
                                                     .from('planning_item_subtasks')
                                                     .update({ 
                                                       is_completed: !subtask.is_completed,
                                                       completed_at: !subtask.is_completed ? new Date().toISOString() : null
                                                     })
                                                     .eq('id', subtask.id)
                                                     .then(() => {
                                                       loadItemSubtasks(item.id);
                                                       loadAllItemCounts();
                                                     });
                                                 }}
                                               />
                                               <Input
                                                 value={subtask.description}
                                                 onChange={(e) => {
                                                   supabase
                                                     .from('planning_item_subtasks')
                                                     .update({ description: e.target.value })
                                                     .eq('id', subtask.id)
                                                     .then(() => {
                                                       loadItemSubtasks(item.id);
                                                     });
                                                 }}
                                                 className={cn(
                                                   "flex-1 text-sm border-none bg-transparent focus:bg-background",
                                                   subtask.is_completed && "line-through text-muted-foreground"
                                                 )}
                                               />
                                               <Select
                                                 value={subtask.assigned_to || 'unassigned'}
                                                 onValueChange={(value) => {
                                                   supabase
                                                     .from('planning_item_subtasks')
                                                     .update({ assigned_to: value === 'unassigned' ? null : value })
                                                     .eq('id', subtask.id)
                                                     .then(() => {
                                                       loadItemSubtasks(item.id);
                                                     });
                                                 }}
                                               >
                                                 <SelectTrigger className="w-[140px] h-8 text-xs">
                                                   <SelectValue placeholder="Zuweisen..." />
                                                 </SelectTrigger>
                                                 <SelectContent>
                                                   <SelectItem value="unassigned">Niemand</SelectItem>
                                                   {allProfiles.map((profile) => (
                                                     <SelectItem key={profile.user_id} value={profile.user_id}>
                                                       {profile.display_name || 'Unbekannt'}
                                                     </SelectItem>
                                                   ))}
                                                 </SelectContent>
                                               </Select>
                                               <Input
                                                 type="date"
                                                 value={subtask.due_date ? format(new Date(subtask.due_date), "yyyy-MM-dd") : ''}
                                                 onChange={(e) => {
                                                   supabase
                                                     .from('planning_item_subtasks')
                                                     .update({ due_date: e.target.value || null })
                                                     .eq('id', subtask.id)
                                                     .then(() => {
                                                       loadItemSubtasks(item.id);
                                                     });
                                                 }}
                                                 className="w-[130px] h-8 text-xs"
                                                 placeholder="Frist..."
                                               />
                                               <Button
                                                 variant="ghost"
                                                 size="sm"
                                                 onClick={() => {
                                                   supabase
                                                     .from('planning_item_subtasks')
                                                     .delete()
                                                     .eq('id', subtask.id)
                                                     .then(() => {
                                                       loadItemSubtasks(item.id);
                                                       loadAllItemCounts();
                                                     });
                                                 }}
                                                 className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                               >
                                                 <Trash2 className="h-3 w-3" />
                                               </Button>
                                             </div>
                                           </div>
                                         ))}
                                         {/* Add new subtask form */}
                                         <div className="space-y-2 pt-2">
                                           <Input
                                             placeholder="Neue Unteraufgabe..."
                                             className="text-sm"
                                             onKeyPress={(e) => {
                                               if (e.key === 'Enter') {
                                                 const input = e.target as HTMLInputElement;
                                                 if (input.value.trim() && user) {
                                                   setNewSubtask({ 
                                                     description: input.value.trim(), 
                                                     assigned_to: 'unassigned', 
                                                     due_date: '' 
                                                   });
                                                   setSelectedItemId(item.id);
                                                    addItemSubtask();
                                                   input.value = '';
                                                 }
                                               }
                                             }}
                                           />
                                           {/* Quick assignment dropdown */}
                                           <div className="flex gap-2">
                                             <Select
                                               value=""
                                               onValueChange={(value) => {
                                                 const description = (document.querySelector(`input[placeholder="Neue Unteraufgabe..."]`) as HTMLInputElement)?.value;
                                                 if (description?.trim() && user) {
                                                   setNewSubtask({ 
                                                     description: description.trim(), 
                                                     assigned_to: value === 'unassigned' ? '' : value, 
                                                     due_date: '' 
                                                   });
                                                   setSelectedItemId(item.id);
                                                   addItemSubtask();
                                                   (document.querySelector(`input[placeholder="Neue Unteraufgabe..."]`) as HTMLInputElement).value = '';
                                                 }
                                               }}
                                             >
                                               <SelectTrigger className="w-[200px] h-8 text-xs">
                                                 <SelectValue placeholder="Schnell zuweisen..." />
                                               </SelectTrigger>
                                               <SelectContent>
                                                 <SelectItem value="unassigned">Niemand</SelectItem>
                                                 {allProfiles.map((profile) => (
                                                   <SelectItem key={profile.user_id} value={profile.user_id}>
                                                     {profile.display_name || 'Unbekannt'}
                                                   </SelectItem>
                                                 ))}
                                               </SelectContent>
                                             </Select>
                                           </div>
                                         </div>
                                      </div>
                                    )}

                                    {/* Expanded Comments */}
                                    {showItemComments[item.id] && (
                                      <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                                        <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                                          <MessageCircle className="h-4 w-4" />
                                          Kommentare
                                        </div>
                                         {itemComments[item.id]?.map((comment) => (
                                           <div key={comment.id} className="p-2 border border-border rounded bg-muted/30">
                                             <div className="flex items-center justify-between mb-1">
                                               <div className="flex items-center space-x-2">
                                                 <span className="text-xs font-medium">
                                                   {comment.profile?.display_name || 'Unbekannt'}
                                                 </span>
                                                 <span className="text-xs text-muted-foreground">
                                                   {format(new Date(comment.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                                                 </span>
                                               </div>
                                               {comment.user_id === user?.id && (
                                                 <div className="flex space-x-1">
                                                   <Button
                                                     variant="ghost"
                                                     size="sm"
                                                     onClick={() => {
                                                       setEditingComment(prev => ({ 
                                                         ...prev, 
                                                         [comment.id]: comment.content 
                                                       }));
                                                     }}
                                                     className="h-6 w-6 p-0"
                                                   >
                                                     <Edit2 className="h-3 w-3" />
                                                   </Button>
                                                   <Button
                                                     variant="ghost"
                                                     size="sm"
                                                     onClick={() => deleteItemComment(comment)}
                                                     className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                                   >
                                                     <Trash2 className="h-3 w-3" />
                                                   </Button>
                                                 </div>
                                               )}
                                             </div>
                                             {editingComment[comment.id] !== undefined ? (
                                               <div className="space-y-2">
                                                 <Input
                                                   value={editingComment[comment.id]}
                                                   onChange={(e) => setEditingComment(prev => ({
                                                     ...prev,
                                                     [comment.id]: e.target.value
                                                   }))}
                                                   className="text-sm"
                                                   onKeyPress={(e) => {
                                                     if (e.key === 'Enter') {
                                                       updateItemComment(comment.id, editingComment[comment.id]);
                                                     }
                                                     if (e.key === 'Escape') {
                                                       setEditingComment(prev => {
                                                         const newState = { ...prev };
                                                         delete newState[comment.id];
                                                         return newState;
                                                       });
                                                     }
                                                   }}
                                                 />
                                                 <div className="flex space-x-2">
                                                   <Button
                                                     size="sm"
                                                     onClick={() => updateItemComment(comment.id, editingComment[comment.id])}
                                                     className="h-6 text-xs"
                                                   >
                                                     Speichern
                                                   </Button>
                                                   <Button
                                                     size="sm"
                                                     variant="outline"
                                                     onClick={() => {
                                                       setEditingComment(prev => {
                                                         const newState = { ...prev };
                                                         delete newState[comment.id];
                                                         return newState;
                                                       });
                                                     }}
                                                     className="h-6 text-xs"
                                                   >
                                                     Abbrechen
                                                   </Button>
                                                 </div>
                                               </div>
                                             ) : (
                                               <p className="text-sm">{comment.content}</p>
                                             )}
                                           </div>
                                         ))}
                                        {/* Add new comment form */}
                                        <div className="pt-2">
                                          <Input
                                            placeholder="Kommentar hinzufügen..."
                                            className="text-sm"
                                            onKeyPress={(e) => {
                                              if (e.key === 'Enter') {
                                                const input = e.target as HTMLInputElement;
                                                if (input.value.trim()) {
                                                  addItemCommentForItem(item.id, input.value);
                                                  input.value = '';
                                                }
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Expanded Documents */}
                                    {showItemDocuments[item.id] && (
                                      <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
                                        <div className="flex items-center space-x-2 text-sm font-medium text-muted-foreground">
                                          <Paperclip className="h-4 w-4" />
                                          Dokumente
                                        </div>
                                        {itemDocuments[item.id]?.map((doc) => (
                                          <div key={doc.id} className="flex items-center justify-between p-2 border border-border rounded bg-muted/30">
                                            <div className="flex items-center space-x-2">
                                              <Paperclip className="h-3 w-3" />
                                              <span className="text-sm truncate">{doc.file_name}</span>
                                            </div>
                                            <div className="flex space-x-1">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => downloadItemDocument(doc)}
                                              >
                                                <Download className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteItemDocument(doc)}
                                                className="text-destructive hover:text-destructive"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                        {/* Add new document form */}
                                        <div className="pt-2">
                                          <Input
                                            type="file"
                                            onChange={(e) => handleItemFileUpload(e, item.id)}
                                            className="text-sm"
                                            disabled={uploading}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Legacy sub-items (will be migrated to new system) */}
                                    {item.sub_items && Array.isArray(item.sub_items) && item.sub_items.length > 0 && (
                                      <div className="ml-12 space-y-1">
                                        {item.sub_items.map((subItem: any, index: number) => (
                                          <div key={index} className="flex items-center space-x-2">
                                            <Checkbox
                                              checked={subItem.is_completed || false}
                                              onCheckedChange={() => toggleSubItem(item.id, index, subItem.is_completed || false)}
                                            />
                                            <Input
                                              value={subItem.title || ''}
                                              onChange={(e) => updateSubItemTitle(item.id, index, e.target.value)}
                                              className={cn(
                                                "flex-1 text-sm",
                                                subItem.is_completed && "line-through text-muted-foreground"
                                              )}
                                              placeholder="Unterpunkt..."
                                            />
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => removeSubItem(item.id, index)}
                                              className="text-muted-foreground hover:text-destructive"
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
                
                <div className="flex items-center space-x-2 mt-4">
                  <Input
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="Neuen Punkt hinzufügen (--- für Trenner)..."
                    onKeyPress={(e) => e.key === "Enter" && addChecklistItem()}
                  />
                  <Button onClick={addChecklistItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}