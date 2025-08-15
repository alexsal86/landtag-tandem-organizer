import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AgendaItem } from "@/types/meeting";
import { DropResult } from "@hello-pangea/dnd";

export function useAgenda() {
  const { toast } = useToast();
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);

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

  const addAgendaItem = () => {
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

  const updateAgendaItem = async (index: number, field: keyof AgendaItem, value: any, meetingId?: string) => {
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    setAgendaItems(updated);
    
    // Auto-save if item has an ID and we have a meeting
    if (updated[index].id && meetingId) {
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

  const saveAgendaItems = async (meetingId: string) => {
    try {
      // Always recompute order_index based on current order
      const ordered = agendaItems
        .filter((i) => i.title.trim())
        .map((it, idx) => ({ ...it, order_index: idx }));

      // Wipe existing items for this meeting
      await supabase.from('meeting_agenda_items').delete().eq('meeting_id', meetingId);

      // Split into parents and children
      const parents = ordered.filter((i) => !i.parentLocalKey);
      const children = ordered.filter((i) => i.parentLocalKey);

      // Insert parents first and capture returned ids in same order
      const parentInserts = parents.map((p) => ({
        meeting_id: meetingId,
        title: p.title,
        description: p.description,
        assigned_to: p.assigned_to === 'unassigned' ? null : p.assigned_to || null,
        notes: p.notes || null,
        is_completed: p.is_completed,
        is_recurring: p.is_recurring,
        task_id: p.task_id || null,
        order_index: p.order_index,
      }));

      if (parentInserts.length > 0) {
        const { data: parentResults, error: parentError } = await supabase
          .from('meeting_agenda_items')
          .insert(parentInserts)
          .select();

        if (parentError) throw parentError;

        // Map local keys to real IDs
        const localKeyToRealId: Record<string, string> = {};
        parents.forEach((p, i) => {
          if (p.localKey && parentResults?.[i]?.id) {
            localKeyToRealId[p.localKey] = parentResults[i].id;
          }
        });

        // Insert children with proper parent references
        if (children.length > 0) {
          const childInserts = children.map((c) => ({
            meeting_id: meetingId,
            title: c.title,
            description: c.description,
            assigned_to: c.assigned_to === 'unassigned' ? null : c.assigned_to || null,
            notes: c.notes || null,
            is_completed: c.is_completed,
            is_recurring: c.is_recurring,
            task_id: c.task_id || null,
            order_index: c.order_index,
            parent_id: c.parentLocalKey ? localKeyToRealId[c.parentLocalKey] || null : null,
          }));

          const { error: childError } = await supabase
            .from('meeting_agenda_items')
            .insert(childInserts);

          if (childError) throw childError;
        }
      }

      await loadAgendaItems(meetingId);

      toast({
        title: "Agenda gespeichert",
        description: "Alle Änderungen wurden erfolgreich gespeichert.",
      });
    } catch (error) {
      console.error('Error saving agenda items:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Die Agenda konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteAgendaItem = (index: number) => {
    const updated = agendaItems.filter((_, i) => i !== index);
    setAgendaItems(updated);
  };

  const addTaskToAgenda = (itemIndex: number, task: any) => {
    const updated = [...agendaItems];
    const parentKey = updated[itemIndex].localKey;
    
    const subTaskItem: AgendaItem = {
      title: task.title,
      description: task.description,
      assigned_to: task.assigned_to || "unassigned",
      notes: task.notes || "",
      is_completed: false,
      is_recurring: false,
      task_id: task.id,
      order_index: updated.length,
      localKey: `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      parentLocalKey: parentKey,
    };

    setAgendaItems([...updated, subTaskItem]);
  };

  const addSubItem = (parentIndex: number) => {
    const parentKey = agendaItems[parentIndex].localKey;
    const newSubItem: AgendaItem = {
      title: "",
      description: "",
      assigned_to: "unassigned",
      notes: "",
      is_completed: false,
      is_recurring: false,
      order_index: agendaItems.length,
      localKey: `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      parentLocalKey: parentKey,
    };

    setAgendaItems([...agendaItems, newSubItem]);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(agendaItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order indices
    const reorderedWithIndices = items.map((item, index) => ({
      ...item,
      order_index: index,
    }));

    setAgendaItems(reorderedWithIndices);
  };

  return {
    agendaItems,
    loadAgendaItems,
    addAgendaItem,
    updateAgendaItem,
    updateAgendaItemResult,
    saveAgendaItems,
    deleteAgendaItem,
    addTaskToAgenda,
    addSubItem,
    onDragEnd,
    setAgendaItems
  };
}