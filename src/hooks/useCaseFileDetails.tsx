import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { CaseFile } from "./useCaseFiles";

export interface CaseFileContact {
  id: string;
  case_file_id: string;
  contact_id: string;
  role: string;
  notes: string | null;
  created_at: string;
  contact?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    organization: string | null;
    position: string | null;
    avatar_url: string | null;
  };
}

export interface CaseFileDocument {
  id: string;
  case_file_id: string;
  document_id: string;
  relevance: string;
  notes: string | null;
  created_at: string;
  document?: {
    id: string;
    title: string;
    file_name: string;
    file_type: string | null;
    created_at: string;
  };
}

export interface CaseFileTask {
  id: string;
  case_file_id: string;
  task_id: string;
  notes: string | null;
  created_at: string;
  task?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
  };
}

export interface CaseFileAppointment {
  id: string;
  case_file_id: string;
  appointment_id: string;
  notes: string | null;
  created_at: string;
  appointment?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    location: string | null;
    status: string | null;
  };
}

export interface CaseFileLetter {
  id: string;
  case_file_id: string;
  letter_id: string;
  notes: string | null;
  created_at: string;
  letter?: {
    id: string;
    title: string;
    subject: string | null;
    status: string;
    created_at: string;
  };
}

export interface CaseFileNote {
  id: string;
  case_file_id: string;
  user_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CaseFileTimelineEntry {
  id: string;
  case_file_id: string;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  source_type: string | null;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
}

export const CONTACT_ROLES = [
  { value: 'initiator', label: 'Initiator' },
  { value: 'stakeholder', label: 'Stakeholder' },
  { value: 'expert', label: 'Experte' },
  { value: 'supporter', label: 'Unterstützer' },
  { value: 'opponent', label: 'Gegner' },
  { value: 'witness', label: 'Zeuge' },
  { value: 'other', label: 'Sonstiges' },
];

export const DOCUMENT_RELEVANCE = [
  { value: 'primary', label: 'Primär' },
  { value: 'supporting', label: 'Unterstützend' },
  { value: 'reference', label: 'Referenz' },
];

export const useCaseFileDetails = (caseFileId: string | null) => {
  const [caseFile, setCaseFile] = useState<CaseFile | null>(null);
  const [contacts, setContacts] = useState<CaseFileContact[]>([]);
  const [documents, setDocuments] = useState<CaseFileDocument[]>([]);
  const [tasks, setTasks] = useState<CaseFileTask[]>([]);
  const [appointments, setAppointments] = useState<CaseFileAppointment[]>([]);
  const [letters, setLetters] = useState<CaseFileLetter[]>([]);
  const [notes, setNotes] = useState<CaseFileNote[]>([]);
  const [timeline, setTimeline] = useState<CaseFileTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCaseFile = useCallback(async () => {
    if (!caseFileId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('case_files')
        .select('*')
        .eq('id', caseFileId)
        .single();

      if (error) throw error;
      setCaseFile(data);
    } catch (error) {
      console.error('Error fetching case file:', error);
    }
  }, [caseFileId]);

  const fetchContacts = useCallback(async () => {
    if (!caseFileId) return;

    try {
      const { data, error } = await supabase
        .from('case_file_contacts')
        .select(`
          *,
          contact:contacts(id, name, email, phone, organization, position, avatar_url)
        `)
        .eq('case_file_id', caseFileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts((data || []) as CaseFileContact[]);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  }, [caseFileId]);

  const fetchDocuments = useCallback(async () => {
    if (!caseFileId) return;

    try {
      const { data, error } = await supabase
        .from('case_file_documents')
        .select(`
          *,
          document:documents(id, title, file_name, file_type, created_at)
        `)
        .eq('case_file_id', caseFileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments((data || []) as CaseFileDocument[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  }, [caseFileId]);

  const fetchTasks = useCallback(async () => {
    if (!caseFileId) return;

    try {
      const { data, error } = await supabase
        .from('case_file_tasks')
        .select(`
          *,
          task:tasks(id, title, status, priority, due_date)
        `)
        .eq('case_file_id', caseFileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks((data || []) as CaseFileTask[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, [caseFileId]);

  const fetchAppointments = useCallback(async () => {
    if (!caseFileId) return;

    try {
      const { data, error } = await supabase
        .from('case_file_appointments')
        .select(`
          *,
          appointment:appointments(id, title, start_time, end_time, location, status)
        `)
        .eq('case_file_id', caseFileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAppointments((data || []) as CaseFileAppointment[]);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  }, [caseFileId]);

  const fetchLetters = useCallback(async () => {
    if (!caseFileId) return;

    try {
      const { data, error } = await supabase
        .from('case_file_letters')
        .select(`
          *,
          letter:letters(id, title, subject, status, created_at)
        `)
        .eq('case_file_id', caseFileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLetters((data || []) as CaseFileLetter[]);
    } catch (error) {
      console.error('Error fetching letters:', error);
    }
  }, [caseFileId]);

  const fetchNotes = useCallback(async () => {
    if (!caseFileId) return;

    try {
      const { data, error } = await supabase
        .from('case_file_notes')
        .select('*')
        .eq('case_file_id', caseFileId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes((data || []) as CaseFileNote[]);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  }, [caseFileId]);

  const fetchTimeline = useCallback(async () => {
    if (!caseFileId) return;

    try {
      const { data, error } = await supabase
        .from('case_file_timeline')
        .select('*')
        .eq('case_file_id', caseFileId)
        .order('event_date', { ascending: false });

      if (error) throw error;
      setTimeline((data || []) as CaseFileTimelineEntry[]);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  }, [caseFileId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchCaseFile(),
      fetchContacts(),
      fetchDocuments(),
      fetchTasks(),
      fetchAppointments(),
      fetchLetters(),
      fetchNotes(),
      fetchTimeline(),
    ]);
    setLoading(false);
  }, [fetchCaseFile, fetchContacts, fetchDocuments, fetchTasks, fetchAppointments, fetchLetters, fetchNotes, fetchTimeline]);

  // Helper to create timeline entry
  const createTimelineEntry = async (
    eventType: string,
    title: string,
    sourceType: string,
    sourceId: string
  ) => {
    if (!caseFileId || !user) return;
    
    try {
      await supabase.from('case_file_timeline').insert({
        case_file_id: caseFileId,
        event_date: new Date().toISOString(),
        event_type: eventType,
        title,
        source_type: sourceType,
        source_id: sourceId,
        created_by: user.id,
      });
      await fetchTimeline();
    } catch (error) {
      console.error('Error creating timeline entry:', error);
    }
  };

  // Add functions
  const addContact = async (contactId: string, role: string = 'stakeholder', notes?: string, contactName?: string) => {
    if (!caseFileId) return false;

    try {
      const { error } = await supabase
        .from('case_file_contacts')
        .insert({
          case_file_id: caseFileId,
          contact_id: contactId,
          role,
          notes,
        });

      if (error) throw error;
      await fetchContacts();
      
      // Create automatic timeline entry
      await createTimelineEntry(
        'note',
        `Kontakt verknüpft: ${contactName || 'Unbekannt'} (${role})`,
        'contact',
        contactId
      );
      
      toast({ title: "Kontakt hinzugefügt" });
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: "Kontakt bereits verknüpft", variant: "destructive" });
      } else {
        toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
      }
      return false;
    }
  };

  const removeContact = async (id: string) => {
    try {
      const { error } = await supabase.from('case_file_contacts').delete().eq('id', id);
      if (error) throw error;
      await fetchContacts();
      toast({ title: "Kontakt entfernt" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Entfernen", variant: "destructive" });
      return false;
    }
  };

  const addDocument = async (documentId: string, relevance: string = 'supporting', notes?: string, documentTitle?: string) => {
    if (!caseFileId) return false;

    try {
      const { error } = await supabase
        .from('case_file_documents')
        .insert({
          case_file_id: caseFileId,
          document_id: documentId,
          relevance,
          notes,
        });

      if (error) throw error;
      await fetchDocuments();
      
      // Create automatic timeline entry
      await createTimelineEntry(
        'document',
        `Dokument hinzugefügt: ${documentTitle || 'Unbekannt'}`,
        'document',
        documentId
      );
      
      toast({ title: "Dokument hinzugefügt" });
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: "Dokument bereits verknüpft", variant: "destructive" });
      } else {
        toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
      }
      return false;
    }
  };

  const removeDocument = async (id: string) => {
    try {
      const { error } = await supabase.from('case_file_documents').delete().eq('id', id);
      if (error) throw error;
      await fetchDocuments();
      toast({ title: "Dokument entfernt" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Entfernen", variant: "destructive" });
      return false;
    }
  };

  const addTask = async (taskId: string, notes?: string, taskTitle?: string) => {
    if (!caseFileId) return false;

    try {
      const { error } = await supabase
        .from('case_file_tasks')
        .insert({
          case_file_id: caseFileId,
          task_id: taskId,
          notes,
        });

      if (error) throw error;
      await fetchTasks();
      
      // Create automatic timeline entry
      await createTimelineEntry(
        'note',
        `Aufgabe verknüpft: ${taskTitle || 'Unbekannt'}`,
        'task',
        taskId
      );
      
      toast({ title: "Aufgabe hinzugefügt" });
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: "Aufgabe bereits verknüpft", variant: "destructive" });
      } else {
        toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
      }
      return false;
    }
  };

  const removeTask = async (id: string) => {
    try {
      const { error } = await supabase.from('case_file_tasks').delete().eq('id', id);
      if (error) throw error;
      await fetchTasks();
      toast({ title: "Aufgabe entfernt" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Entfernen", variant: "destructive" });
      return false;
    }
  };

  const addAppointment = async (appointmentId: string, notes?: string, appointmentTitle?: string) => {
    if (!caseFileId) return false;

    try {
      const { error } = await supabase
        .from('case_file_appointments')
        .insert({
          case_file_id: caseFileId,
          appointment_id: appointmentId,
          notes,
        });

      if (error) throw error;
      await fetchAppointments();
      
      // Create automatic timeline entry
      await createTimelineEntry(
        'meeting',
        `Termin verknüpft: ${appointmentTitle || 'Unbekannt'}`,
        'appointment',
        appointmentId
      );
      
      toast({ title: "Termin hinzugefügt" });
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: "Termin bereits verknüpft", variant: "destructive" });
      } else {
        toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
      }
      return false;
    }
  };

  const removeAppointment = async (id: string) => {
    try {
      const { error } = await supabase.from('case_file_appointments').delete().eq('id', id);
      if (error) throw error;
      await fetchAppointments();
      toast({ title: "Termin entfernt" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Entfernen", variant: "destructive" });
      return false;
    }
  };

  const addLetter = async (letterId: string, notes?: string, letterTitle?: string) => {
    if (!caseFileId) return false;

    try {
      const { error } = await supabase
        .from('case_file_letters')
        .insert({
          case_file_id: caseFileId,
          letter_id: letterId,
          notes,
        });

      if (error) throw error;
      await fetchLetters();
      
      // Create automatic timeline entry
      await createTimelineEntry(
        'correspondence',
        `Brief verknüpft: ${letterTitle || 'Unbekannt'}`,
        'letter',
        letterId
      );
      
      toast({ title: "Brief hinzugefügt" });
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: "Brief bereits verknüpft", variant: "destructive" });
      } else {
        toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
      }
      return false;
    }
  };

  const removeLetter = async (id: string) => {
    try {
      const { error } = await supabase.from('case_file_letters').delete().eq('id', id);
      if (error) throw error;
      await fetchLetters();
      toast({ title: "Brief entfernt" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Entfernen", variant: "destructive" });
      return false;
    }
  };

  const addNote = async (content: string) => {
    if (!caseFileId || !user) return false;

    try {
      const { error } = await supabase
        .from('case_file_notes')
        .insert({
          case_file_id: caseFileId,
          user_id: user.id,
          content,
        });

      if (error) throw error;
      await fetchNotes();
      toast({ title: "Notiz hinzugefügt" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
      return false;
    }
  };

  const updateNote = async (id: string, content: string, isPinned?: boolean) => {
    try {
      const updates: any = { content };
      if (isPinned !== undefined) updates.is_pinned = isPinned;

      const { error } = await supabase
        .from('case_file_notes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchNotes();
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Aktualisieren", variant: "destructive" });
      return false;
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase.from('case_file_notes').delete().eq('id', id);
      if (error) throw error;
      await fetchNotes();
      toast({ title: "Notiz gelöscht" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
      return false;
    }
  };

  const addTimelineEntry = async (entry: Omit<CaseFileTimelineEntry, 'id' | 'case_file_id' | 'created_at' | 'created_by'>) => {
    if (!caseFileId || !user) return false;

    try {
      const { error } = await supabase
        .from('case_file_timeline')
        .insert({
          ...entry,
          case_file_id: caseFileId,
          created_by: user.id,
        });

      if (error) throw error;
      await fetchTimeline();
      toast({ title: "Ereignis hinzugefügt" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Hinzufügen", variant: "destructive" });
      return false;
    }
  };

  const deleteTimelineEntry = async (id: string) => {
    try {
      const { error } = await supabase.from('case_file_timeline').delete().eq('id', id);
      if (error) throw error;
      await fetchTimeline();
      toast({ title: "Ereignis gelöscht" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
      return false;
    }
  };

  const updateCurrentStatus = async (note: string) => {
    if (!caseFileId) return false;

    try {
      const { error } = await supabase
        .from('case_files')
        .update({
          current_status_note: note,
          current_status_updated_at: new Date().toISOString(),
        } as any)
        .eq('id', caseFileId);

      if (error) throw error;
      await fetchCaseFile();
      toast({ title: "Aktueller Stand aktualisiert" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Aktualisieren", variant: "destructive" });
      return false;
    }
  };

  const updateRisksOpportunities = async (data: { risks: string[]; opportunities: string[] }) => {
    if (!caseFileId) return false;

    try {
      const { error } = await supabase
        .from('case_files')
        .update({ risks_and_opportunities: data } as any)
        .eq('id', caseFileId);

      if (error) throw error;
      await fetchCaseFile();
      toast({ title: "Risiken & Chancen aktualisiert" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Aktualisieren", variant: "destructive" });
      return false;
    }
  };

  const completeTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);

      if (error) throw error;
      await fetchTasks();
      toast({ title: "Aufgabe abgeschlossen" });
      return true;
    } catch (error) {
      toast({ title: "Fehler beim Abschließen", variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    if (caseFileId) {
      fetchAll();
    }
  }, [caseFileId, fetchAll]);

  return {
    caseFile,
    contacts,
    documents,
    tasks,
    appointments,
    letters,
    notes,
    timeline,
    loading,
    refresh: fetchAll,
    addContact,
    removeContact,
    addDocument,
    removeDocument,
    addTask,
    removeTask,
    addAppointment,
    removeAppointment,
    addLetter,
    removeLetter,
    addNote,
    updateNote,
    deleteNote,
    addTimelineEntry,
    deleteTimelineEntry,
    updateCurrentStatus,
    updateRisksOpportunities,
    completeTask,
  };
};
