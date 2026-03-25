import { supabase } from "@/integrations/supabase/client";
import type { AgendaItem } from "@/components/meetings/types";
import type { MeetingsDataReturn } from "./useMeetingsData";
import type { DropResult } from "@hello-pangea/dnd";
import { debugConsole } from "@/utils/debugConsole";

type AgendaOpsDeps = Pick<MeetingsDataReturn,
  'selectedMeeting' | 'activeMeeting' | 'agendaItems' | 'setAgendaItems' | 'setActiveMeeting' |
  'user' | 'toast' | 'taskDocuments' | 'agendaDocuments' | 'setAgendaDocuments' |
  'profiles' | 'loadAgendaItems' | 'updateTimeouts' | 'uploadAgendaDocument'
>;

export function useAgendaOperations(deps: AgendaOpsDeps) {
  const {
    selectedMeeting, activeMeeting, agendaItems, setAgendaItems, setActiveMeeting,
    user, toast, taskDocuments, agendaDocuments, setAgendaDocuments,
    profiles, loadAgendaItems, updateTimeouts, uploadAgendaDocument,
  } = deps;

  const updateAgendaItemResult = async (itemId: string, field: 'carry_over_to_next' | 'result_text' | string, value: unknown) => {
    setAgendaItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
    if (['result_text', 'notes', 'description'].includes(field)) {
      const timeoutKey = `${itemId}-${field}`;
      if (updateTimeouts.current[timeoutKey]) clearTimeout(updateTimeouts.current[timeoutKey]);
      updateTimeouts.current[timeoutKey] = setTimeout(async () => {
        try {
          await supabase.from('meeting_agenda_items').update({ [field]: value }).eq('id', itemId);
        } catch (error) {
          debugConsole.error('Error updating agenda item:', error);
          toast({ title: "Fehler", description: "Die Änderung konnte nicht gespeichert werden.", variant: "destructive" });
        }
      }, 500);
    } else {
      try {
        await supabase.from('meeting_agenda_items').update({ [field]: value }).eq('id', itemId);
      } catch (error) {
        debugConsole.error('Error updating agenda item:', error);
        toast({ title: "Fehler", description: "Die Änderung konnte nicht gespeichert werden.", variant: "destructive" });
      }
    }
  };

  const addAgendaItem = () => {
    if (!selectedMeeting?.id) return;
    const localKey = `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const newItem: AgendaItem = {
      title: "", description: "", assigned_to: [], notes: "",
      is_completed: false, is_recurring: false, order_index: agendaItems.length, localKey,
    };
    const next = [...agendaItems, newItem].map((it, idx) => ({ ...it, order_index: idx }));
    setAgendaItems(next);
  };

  const addSystemAgendaItem = async (systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks' | 'birthdays' | 'decisions' | 'case_items', parentItem?: AgendaItem) => {
    if (!selectedMeeting?.id) return;
    if (agendaItems.some(i => i.system_type === systemType)) {
      toast({ title: "Bereits vorhanden", description: "Dieser dynamische Punkt ist bereits in der Agenda.", variant: "destructive" });
      return;
    }
    const titles: Record<string, string> = {
      'upcoming_appointments': 'Kommende Termine', 'quick_notes': 'Meine Notizen',
      'tasks': 'Aufgaben', 'birthdays': 'Geburtstage', 'decisions': 'Entscheidungen', 'case_items': 'Vorgänge'
    };
    try {
      let parentId: string | null = null;
      let parentIndex = -1;
      if (parentItem) {
        parentId = parentItem.id || null;
        parentIndex = agendaItems.findIndex(item => item.id === parentItem.id || item.localKey === parentItem.localKey);
        if (!parentId) {
          const { data: parentData, error: parentError } = await supabase
            .from('meeting_agenda_items').insert([{
              meeting_id: selectedMeeting.id, title: parentItem.title, description: parentItem.description || null,
              order_index: parentItem.order_index, is_completed: false, is_recurring: false,
            }]).select().single();
          if (parentError) throw parentError;
          parentId = parentData.id;
          const updatedItems = [...agendaItems];
          updatedItems[parentIndex] = { ...parentItem, id: parentId, localKey: parentId } as typeof parentItem;
          setAgendaItems(updatedItems);
        }
      }

      let insertIndex: number;
      if (parentItem && parentIndex !== -1) {
        insertIndex = parentIndex + 1;
        const parentKey = parentItem.id || parentItem.localKey;
        while (insertIndex < agendaItems.length && 
               (agendaItems[insertIndex].parent_id === parentId || agendaItems[insertIndex].parentLocalKey === parentKey)) {
          insertIndex++;
        }
      } else {
        insertIndex = agendaItems.length;
      }

      const { data: savedItem, error } = await supabase
        .from('meeting_agenda_items').insert([{
          meeting_id: selectedMeeting.id, title: titles[systemType], description: null,
          system_type: systemType, parent_id: parentId, order_index: insertIndex,
          is_completed: false, is_recurring: false, is_visible: true,
        }]).select().single();
      if (error) throw error;

      const newItem: AgendaItem = { ...savedItem, carry_over_to_next: savedItem.carry_over_to_next ?? undefined, localKey: savedItem.id, parentLocalKey: parentId || undefined };
      const next = [...agendaItems];
      next.splice(insertIndex, 0, newItem);
      const reindexed = next.map((it, idx) => ({ ...it, order_index: idx }));
      setAgendaItems(reindexed);

      for (const item of reindexed) {
        if (item.id && item.id !== savedItem.id) {
          await supabase.from('meeting_agenda_items').update({ order_index: item.order_index }).eq('id', item.id);
        }
      }
      toast({ title: "Dynamischer Punkt hinzugefügt", description: `"${titles[systemType]}" wurde zur Agenda hinzugefügt.` });
    } catch (error) {
      debugConsole.error('Error saving system agenda item:', error);
      toast({ title: "Fehler", description: "Der dynamische Punkt konnte nicht gespeichert werden.", variant: "destructive" });
    }
  };

  const updateAgendaItem = async (index: number, field: keyof AgendaItem, value: any) => {
    let normalizedValue = value;
    if (field === 'assigned_to' && Array.isArray(value)) normalizedValue = value.flat();

    const previousAgendaItems = [...agendaItems];
    const previousItem = previousAgendaItems[index] ? { ...previousAgendaItems[index] } : null;
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: normalizedValue };
    setAgendaItems(updated);

    if (updated[index].id && selectedMeeting?.id) {
      try {
        let dbValue = normalizedValue;
        if (field === 'assigned_to') {
          dbValue = normalizedValue && Array.isArray(normalizedValue) && normalizedValue.length > 0 ? normalizedValue.flat() : null;
        }

        const persistUpdate = async () => {
          const { error } = await supabase
            .from('meeting_agenda_items')
            .update({ [field]: dbValue })
            .eq('id', updated[index].id!);
          if (error) throw error;
        };

        let retries = 2;
        while (true) {
          try {
            await persistUpdate();
            break;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isRetryable = /failed to fetch|network|timeout|temporar/i.test(errorMessage);
            if (!isRetryable || retries === 0) throw error;
            const delayMs = (3 - retries) * 300;
            await new Promise(resolve => setTimeout(resolve, delayMs));
            retries -= 1;
          }
        }

        if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
          loadAgendaItems(selectedMeeting.id);
        }
      } catch (error) {
        debugConsole.error('Auto-save error:', error);
        if (previousItem) {
          const rollbackItems = [...previousAgendaItems];
          rollbackItems[index] = previousItem;
          setAgendaItems(rollbackItems);
        } else {
          setAgendaItems(previousAgendaItems);
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        const isConflictError = /conflict|409|stale/i.test(errorMessage);
        if (isConflictError) {
          await loadAgendaItems(selectedMeeting.id);
        }

        toast({
          title: 'Speichern fehlgeschlagen',
          description: isConflictError
            ? 'Die Agenda wurde zwischenzeitlich geändert. Wir haben die aktuellen Daten neu geladen.'
            : 'Die Änderung konnte nicht gespeichert werden. Lokale Änderungen wurden zurückgesetzt.',
          variant: 'destructive',
        });
      }
    }
  };

  const saveAgendaItems = async () => {
    if (!selectedMeeting?.id) return;

    const toDbPayload = (item: AgendaItem, orderIndex: number, parentId: string | null = null) => ({
      meeting_id: selectedMeeting.id!,
      title: item.title || '',
      description: item.description || null,
      assigned_to: Array.isArray(item.assigned_to) && item.assigned_to.length > 0 ? item.assigned_to.filter(Boolean) : null,
      notes: item.notes || null,
      is_completed: Boolean(item.is_completed),
      is_recurring: Boolean(item.is_recurring),
      task_id: item.task_id || null,
      order_index: orderIndex,
      parent_id: parentId,
      system_type: item.system_type || null,
      is_optional: Boolean(item.is_optional),
      is_visible: item.is_visible !== false,
    });

    try {
      const ordered = agendaItems
        .filter(item => item.title.trim())
        .map((item, index) => ({ ...item, order_index: index }));

      const { data: existingRows, error: existingError } = await supabase
        .from('meeting_agenda_items')
        .select('id')
        .eq('meeting_id', selectedMeeting.id);
      if (existingError) throw existingError;

      const existingIds = new Set<string>((existingRows || []).map((row: any) => row.id));
      const incomingIds = new Set<string>(ordered.map(item => item.id).filter((id): id is string => Boolean(id)));
      const idsToDelete = [...existingIds].filter(id => !incomingIds.has(id)) as string[];

      const getStableKey = (item: AgendaItem) => item.id || item.localKey || `${item.title}-${item.order_index}`;
      const parentItems = ordered.filter(item => !(item.parent_id || item.parentLocalKey));
      const childItems = ordered.filter(item => item.parent_id || item.parentLocalKey);
      const persistedIdByStableKey = new Map<string, string>();

      for (const parent of parentItems) {
        const payload = toDbPayload(parent, parent.order_index, null);
        if (parent.id) {
          const { data, error } = await supabase
            .from('meeting_agenda_items')
            .upsert({ id: parent.id, ...payload }, { onConflict: 'id' })
            .select('id')
            .single();
          if (error) throw error;
          persistedIdByStableKey.set(getStableKey(parent), data.id);
          persistedIdByStableKey.set(parent.id, data.id);
        } else {
          const { data, error } = await supabase
            .from('meeting_agenda_items')
            .insert(payload)
            .select('id')
            .single();
          if (error) throw error;
          persistedIdByStableKey.set(getStableKey(parent), data.id);
          if (parent.localKey) persistedIdByStableKey.set(parent.localKey, data.id);
        }
      }

      for (const child of childItems) {
        const parentRef = child.parent_id || child.parentLocalKey || null;
        const resolvedParentId = parentRef ? persistedIdByStableKey.get(parentRef) || child.parent_id || null : null;
        const payload = toDbPayload(child, child.order_index, resolvedParentId);

        if (child.id) {
          const { data, error } = await supabase
            .from('meeting_agenda_items')
            .upsert({ id: child.id, ...payload }, { onConflict: 'id' })
            .select('id')
            .single();
          if (error) throw error;
          persistedIdByStableKey.set(getStableKey(child), data.id);
          persistedIdByStableKey.set(child.id, data.id);
        } else {
          const { data, error } = await supabase
            .from('meeting_agenda_items')
            .insert(payload)
            .select('id')
            .single();
          if (error) throw error;
          persistedIdByStableKey.set(getStableKey(child), data.id);
          if (child.localKey) persistedIdByStableKey.set(child.localKey, data.id);
        }
      }

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('meeting_agenda_items')
          .delete()
          .in('id', idsToDelete);
        if (deleteError) throw deleteError;
      }

      toast({ title: 'Agenda gespeichert', description: 'Die Agenda wurde erfolgreich gespeichert.' });
      if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
        await loadAgendaItems(selectedMeeting.id);
      }
    } catch (error: unknown) {
      debugConsole.error('Error saving agenda:', error);
      const msg = error instanceof Error ? error.message : '';
      let errorMessage = 'Die Agenda konnte nicht gespeichert werden.';
      if (msg.includes('invalid input syntax for type json')) errorMessage = 'Ungültiges Datenformat. Bitte prüfen Sie die Eingaben.';
      else if (msg.includes('Failed to fetch')) errorMessage = 'Netzwerkfehler. Die Änderungen werden beim nächsten Laden synchronisiert.';
      toast({ title: 'Fehler beim Speichern', description: errorMessage, variant: 'destructive' });
    }
  };

  const addTaskToAgenda = async (task: any, parentItem: AgendaItem, parentIndex: number) => {
    if (!selectedMeeting?.id) return;
    const showTaskSelectorRef = { current: null };
    try {
      let parentId = parentItem.id;
      if (!parentId) {
        const { data: parentData, error: parentError } = await supabase
          .from('meeting_agenda_items').insert([{
            meeting_id: selectedMeeting.id, title: parentItem.title, description: parentItem.description || null,
            order_index: parentItem.order_index, is_completed: false, is_recurring: false,
          }]).select().single();
        if (parentError) throw parentError;
        parentId = parentData.id;
        const updatedItems = [...agendaItems];
        updatedItems[parentIndex] = { ...parentItem, id: parentId };
        setAgendaItems(updatedItems);
      }

      const taskDocs = taskDocuments[task.id] || [];
      let documentPath = taskDocs.length > 0 ? taskDocs[0].file_path : null;
      const taskOwner = task.assigned_to || task.user_id || user?.id;

      const { data: taskData, error: taskError } = await supabase
        .from('meeting_agenda_items').insert([{
          meeting_id: selectedMeeting.id, title: task.title, description: task.description || null,
          task_id: task.id, parent_id: parentId, order_index: parentIndex + 1,
          is_completed: false, is_recurring: false, file_path: documentPath,
          assigned_to: taskOwner ? [taskOwner] : null,
        }]).select().single();
      if (taskError) throw taskError;

      const newSubItem: AgendaItem = { ...taskData, carry_over_to_next: taskData.carry_over_to_next ?? undefined, localKey: taskData.id, parentLocalKey: parentId };
      const updatedItems = [...agendaItems];
      updatedItems.splice(parentIndex + 1, 0, newSubItem);
      const reindexedItems = updatedItems.map((item, idx) => ({ ...item, order_index: idx }));
      setAgendaItems(reindexedItems);

      for (const item of reindexedItems) {
        if (item.id && item.id !== taskData.id) {
          await supabase.from('meeting_agenda_items').update({ order_index: item.order_index }).eq('id', item.id);
        }
      }
      if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
        await loadAgendaItems(selectedMeeting.id);
      }
      toast({ title: "Aufgabe hinzugefügt", description: `"${task.title}" wurde als Unterpunkt zu "${parentItem.title}" hinzugefügt.` });
    } catch (error) {
      debugConsole.error('Error saving task to agenda:', error);
      toast({ title: "Fehler", description: "Aufgabe konnte nicht gespeichert werden.", variant: "destructive" });
    }
  };

  const addSubItem = async (parent: AgendaItem, title: string) => {
    if (!selectedMeeting?.id) return;
    try {
      let parentId = parent.id;
      const parentIndex = agendaItems.findIndex(item => item.localKey === parent.localKey || item.id === parent.id);
      if (!parentId) {
        const { data: parentData, error: parentError } = await supabase
          .from('meeting_agenda_items').insert([{
            meeting_id: selectedMeeting.id, title: parent.title, description: parent.description || null,
            order_index: parent.order_index, is_completed: false, is_recurring: false,
          }]).select().single();
        if (parentError) throw parentError;
        parentId = parentData.id;
        const updatedItems = [...agendaItems];
        updatedItems[parentIndex] = { ...parent, id: parentId };
        setAgendaItems(updatedItems);
      }

      const { data: subItemData, error: subItemError } = await supabase
        .from('meeting_agenda_items').insert([{
          meeting_id: selectedMeeting.id, title: title || '', description: null,
          parent_id: parentId, order_index: parentIndex + 1, is_completed: false, is_recurring: false,
          assigned_to: user?.id ? [user.id] : null,
        }]).select().single();
      if (subItemError) throw subItemError;

      const newSubItem: AgendaItem = { ...subItemData, localKey: subItemData.id, parentLocalKey: parentId };
      const updatedItems = [...agendaItems];
      updatedItems.splice(parentIndex + 1, 0, newSubItem);
      const reindexedItems = updatedItems.map((item, idx) => ({ ...item, order_index: idx }));
      setAgendaItems(reindexedItems);

      for (const item of reindexedItems) {
        if (item.id && item.id !== subItemData.id) {
          await supabase.from('meeting_agenda_items').update({ order_index: item.order_index }).eq('id', item.id);
        }
      }
      if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
        await loadAgendaItems(selectedMeeting.id);
      }
      toast({ title: "Unterpunkt hinzugefügt", description: `Unterpunkt wurde zu "${parent.title}" hinzugefügt.` });
    } catch (error) {
      debugConsole.error('Error saving sub-item:', error);
      toast({ title: "Fehler", description: "Unterpunkt konnte nicht gespeichert werden.", variant: "destructive" });
    }
  };

  const deleteAgendaItem = async (item: AgendaItem, index: number) => {
    if (!selectedMeeting?.id) return;
    const previousItems = [...agendaItems];
    const updatedItems = agendaItems.filter((_, i) => i !== index);
    const reindexedItems = updatedItems.map((it, idx) => ({ ...it, order_index: idx }));
    setAgendaItems(reindexedItems);

    if (item.id) {
      try {
        const { error } = await supabase.from('meeting_agenda_items').delete().eq('id', item.id);
        if (error) {
          const errorMessage = error.message || '';
          const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('TypeError');
          if (!isNetworkError) {
            setAgendaItems(previousItems);
            toast({ title: "Fehler beim Löschen", description: "Der Agenda-Punkt konnte nicht gelöscht werden.", variant: "destructive" });
            return;
          }
        }
        toast({ title: "Punkt gelöscht", description: "Der Agenda-Punkt wurde erfolgreich gelöscht." });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : '';
        const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('TypeError');
        if (!isNetworkError) {
          setAgendaItems(previousItems);
          toast({ title: "Fehler beim Löschen", description: "Der Agenda-Punkt konnte nicht gelöscht werden.", variant: "destructive" });
        }
      }
    }
  };

  const toggleOptionalItemVisibility = async (itemId: string, currentVisibility: boolean) => {
    try {
      const newVisibility = !currentVisibility;
      const { error } = await supabase.from('meeting_agenda_items').update({ is_visible: newVisibility }).eq('id', itemId);
      if (error) throw error;
      setAgendaItems(prev => prev.map(item => item.id === itemId ? { ...item, is_visible: newVisibility } : item));
      toast({
        title: newVisibility ? "Punkt aktiviert" : "Punkt ausgeblendet",
        description: newVisibility ? "Der optionale Punkt wird nun angezeigt." : "Der optionale Punkt wurde ausgeblendet.",
      });
    } catch (error) {
      debugConsole.error('Error toggling visibility:', error);
      toast({ title: "Fehler", description: "Sichtbarkeit konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    const previousItems = [...agendaItems];
    const allItems = [...agendaItems];
    const draggedItem = allItems[source.index];
    allItems.splice(source.index, 1);

    const findParentAbove = (items: AgendaItem[], startIndex: number) => {
      for (let i = startIndex - 1; i >= 0; i--) {
        const potentialParent = items[i];
        if (!potentialParent.parent_id && !potentialParent.parentLocalKey) {
          return potentialParent;
        }
      }
      return null;
    };

    const findParentBelow = (items: AgendaItem[], startIndex: number) => {
      for (let i = startIndex; i < items.length; i++) {
        const potentialParent = items[i];
        if (!potentialParent.parent_id && !potentialParent.parentLocalKey) {
          return potentialParent;
        }
      }
      return null;
    };

    const validateParentConsistency = (items: AgendaItem[]) => {
      const orderByKey = new Map<string, number>();
      items.forEach((item, index) => {
        const key = item.id || item.localKey;
        if (key) orderByKey.set(key, index);
      });

      return items.every((item, index) => {
        const parentKey = item.parent_id || item.parentLocalKey;
        if (!parentKey) return true;
        const parentIndex = orderByKey.get(parentKey);
        if (parentIndex === undefined || parentIndex >= index) return false;
        const parent = items[parentIndex];
        return !parent.parent_id && !parent.parentLocalKey;
      });
    };

    if (!draggedItem.parent_id && !draggedItem.parentLocalKey) {
      const draggedKey = draggedItem.id || draggedItem.localKey;
      const children = allItems.filter(item => item.parent_id === draggedItem.id || item.parentLocalKey === draggedKey);
      children.reverse().forEach(child => {
        const childIndex = allItems.findIndex(item => item.id === child.id || item.localKey === child.localKey);
        if (childIndex !== -1) allItems.splice(childIndex, 1);
      });
      allItems.splice(destination.index, 0, draggedItem);
      children.reverse().forEach((child, index) => { allItems.splice(destination.index + 1 + index, 0, child); });
    } else {
      let newParentItem = findParentAbove(allItems, destination.index);

      if (!newParentItem && destination.index === 0) {
        newParentItem = findParentBelow(allItems, destination.index);
      }

      if (!newParentItem) {
        setAgendaItems(previousItems);
        toast({
          title: "Ungültige Position",
          description: "Unterpunkte können nur unter einem Hauptpunkt abgelegt werden.",
          variant: "destructive"
        });
        return;
      }

      draggedItem.parent_id = newParentItem.id || null;
      draggedItem.parentLocalKey = (newParentItem.id || newParentItem.localKey) ?? undefined;
      allItems.splice(destination.index, 0, draggedItem);
    }

    const reorderedItems = allItems.map((item, index) => ({ ...item, order_index: index }));

    if (!validateParentConsistency(reorderedItems)) {
      setAgendaItems(previousItems);
      toast({
        title: "Ungültige Reihenfolge",
        description: "Die Verschiebung wurde zurückgesetzt, weil Unterpunkte ohne gültigen Hauptpunkt entstanden wären.",
        variant: "destructive"
      });
      return;
    }

    setAgendaItems(reorderedItems);

    if (activeMeeting?.id === selectedMeeting?.id) {
      setActiveMeeting(prev => prev ? {...prev} : prev);
    }

    if (selectedMeeting?.id) {
      try {
        const existingItems = reorderedItems.filter(item => item.id);
        if (existingItems.length > 0) {
          const { error } = await supabase.from('meeting_agenda_items').upsert(
            existingItems.map(item => ({
              id: item.id!, order_index: item.order_index, meeting_id: selectedMeeting.id!,
              title: item.title, description: item.description || '',
              assigned_to: Array.isArray(item.assigned_to) ? item.assigned_to : (item.assigned_to ? [item.assigned_to] : []),
              parent_id: item.parent_id, updated_at: new Date().toISOString()
            })),
            { onConflict: 'id' }
          );
          if (error) throw error;
        }
        if (activeMeeting && activeMeeting.id === selectedMeeting.id) {
          loadAgendaItems(selectedMeeting.id);
        }
      } catch (error) {
        debugConsole.error('Error updating order:', error);
        toast({ title: "Fehler", description: "Die neue Reihenfolge konnte nicht gespeichert werden.", variant: "destructive" });
      }
    }
  };

  return {
    updateAgendaItemResult,
    addAgendaItem,
    addSystemAgendaItem,
    updateAgendaItem,
    saveAgendaItems,
    addTaskToAgenda,
    addSubItem,
    deleteAgendaItem,
    toggleOptionalItemVisibility,
    onDragEnd,
  };
}
