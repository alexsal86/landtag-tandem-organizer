import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  X, Keyboard, ChevronDown, ChevronUp, CheckCircle, 
  ArrowUp, ArrowDown, CornerDownRight, StickyNote,
  Maximize2, Users, Archive, CalendarDays, ListTodo, Star, MessageSquarePlus, Scale
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';

import type { LinkedQuickNote, LinkedTask, LinkedCaseItem, RelevantDecision, MeetingUpcomingAppointment } from './types';

interface AgendaItem {
  id?: string;
  title: string;
  description?: string | null;
  assigned_to?: string[] | null;
  notes?: string | null;
  is_completed: boolean;
  result_text?: string | null;
  carry_over_to_next?: boolean | null;
  order_index: number;
  parent_id?: string | null;
  parentLocalKey?: string;
  system_type?: string | null;
}

interface Meeting {
  id?: string;
  title: string;
  meeting_date: string | Date;
  meeting_time?: string | null;
}

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

interface NavigableItem {
  item: AgendaItem;
  isSubItem: boolean;
  parentItem: AgendaItem | null;
  globalIndex: number;
  isSystemSubItem?: boolean;
  sourceId?: string;
  sourceType?: 'quick_note' | 'appointment' | 'task' | 'decision';
  sourceData?: unknown;
}

type SystemSubItemResultEntry = string | { result?: string; completed?: boolean };

interface FocusModeViewProps {
  meeting: Meeting;
  agendaItems: AgendaItem[];
  profiles: Profile[];
  linkedQuickNotes?: LinkedQuickNote[];
  linkedTasks?: LinkedTask[];
  linkedCaseItems?: LinkedCaseItem[];
  relevantDecisions?: RelevantDecision[];
  upcomingAppointments?: MeetingUpcomingAppointment[];
  starredAppointmentIds?: Set<string>;
  onToggleStar?: (appt: MeetingUpcomingAppointment) => void;
  onClose: () => void;
  onUpdateItem: (index: number, field: keyof AgendaItem, value: unknown) => void;
  onUpdateResult: (itemId: string, field: 'result_text' | 'carry_over_to_next', value: unknown) => void;
  onUpdateNoteResult?: (noteId: string, result: string) => void;
  onArchive: () => void;
}

// Helper function to format time without seconds
const formatMeetingTime = (time: string | undefined) => {
  if (!time) return null;
  return time.substring(0, 5);
};

export function FocusModeView({
  meeting,
  agendaItems,
  profiles,
  linkedQuickNotes = [],
  linkedTasks = [],
  linkedCaseItems = [],
  relevantDecisions = [],
  upcomingAppointments = [],
  starredAppointmentIds = new Set(),
  onToggleStar,
  onClose,
  onUpdateItem,
  onUpdateResult,
  onUpdateNoteResult,
  onArchive
}: FocusModeViewProps) {
  const [flatFocusIndex, setFlatFocusIndex] = useState(0);
  const [showLegend, setShowLegend] = useState(false);
  const [optimisticSystemSubItemCompletion, setOptimisticSystemSubItemCompletion] = useState<Record<string, boolean>>({});
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  // Ref to track when dialog just closed to prevent Enter from marking items
  const justClosedDialogRef = useRef(false);
  const showAssignDialogRef = useRef(showAssignDialog);

  const parseSystemSubItemResults = useCallback((resultText?: string | null): Record<string, SystemSubItemResultEntry> => {
    if (!resultText) return {};
    try {
      const parsed = JSON.parse(resultText);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, SystemSubItemResultEntry>) : {};
    } catch {
      return {};
    }
  }, []);

  const getSystemResultText = useCallback((entry: SystemSubItemResultEntry | undefined): string => {
    if (typeof entry === 'string') return entry;
    return entry?.result || '';
  }, []);

  const getPersistentSystemSubItemCompletion = useCallback((sourceType: NavigableItem['sourceType'], sourceData: unknown, parentItem?: AgendaItem | null) => {
    const src = sourceData as Record<string, unknown> | undefined;
    const sourceId = src?.id as string | undefined;
    if (!sourceId) return false;

    if (sourceType === 'quick_note') {
      return Boolean((src?.meeting_result as string | null | undefined)?.trim());
    }

    if (sourceType === 'task' && (src?.meeting_result as string | null | undefined)) {
      return Boolean((src?.meeting_result as string).trim());
    }

    if (!parentItem) return false;

    const entry = parseSystemSubItemResults(parentItem.result_text)[sourceId];
    if (typeof entry === 'string') return Boolean(entry.trim());
    return Boolean(entry?.completed ?? entry?.result?.trim());
  }, [parseSystemSubItemResults]);

  // Build flat list of all navigable items (main items + sub-items + system sub-items)
  const allNavigableItems: NavigableItem[] = useMemo(() => {
    const result: NavigableItem[] = [];
  // Helper to inject system children (notes/appointments/tasks) under a system item
  const injectSystemChildren = (
    result: NavigableItem[],
    systemItem: AgendaItem,
    parentForChildren: AgendaItem
  ) => {
    if (systemItem.system_type === 'quick_notes' && linkedQuickNotes.length > 0) {
      linkedQuickNotes.forEach((note, i) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion('quick_note', note, parentForChildren);
        result.push({
          item: {
            id: `note-${note.id}`,
            title: note.title || `Notiz ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: 'quick_note_item',
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: note.id,
          sourceType: 'quick_note',
          sourceData: note
        });
      });
    }
    if (systemItem.system_type === 'upcoming_appointments' && upcomingAppointments.length > 0) {
      upcomingAppointments.forEach((appt, i) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion('appointment', appt, parentForChildren);
        result.push({
          item: {
            id: `appt-${appt.id}`,
            title: appt.title || `Termin ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: 'appointment_item',
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: appt.id,
          sourceType: 'appointment',
          sourceData: appt
        });
      });
    }
    if (systemItem.system_type === 'tasks' && linkedTasks.length > 0) {
      linkedTasks.forEach((task, i) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion('task', task, parentForChildren);
        result.push({
          item: {
            id: `task-${task.id}`,
            title: task.title || `Aufgabe ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: 'task_item',
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: task.id,
          sourceType: 'task',
          sourceData: task
        });
      });
    }
    if (systemItem.system_type === 'case_items' && linkedCaseItems.length > 0) {
      linkedCaseItems.forEach((ci: { id: string; subject?: string | null }, i: number) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion('task', ci, parentForChildren);
        result.push({
          item: {
            id: `caseitem-${ci.id}`,
            title: ci.subject || `Vorgang ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: 'case_item_item',
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: ci.id,
          sourceType: 'task',
          sourceData: ci
        });
      });
    }
    if (systemItem.system_type === 'decisions' && relevantDecisions.length > 0) {
      relevantDecisions.forEach((decision, i) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion('decision', decision, parentForChildren);
        result.push({
          item: {
            id: `decision-${decision.id}`,
            title: decision.title || `Entscheidung ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: 'decision_item',
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: decision.id,
          sourceType: 'decision',
          sourceData: decision
        });
      });
    }
  };
    
    // Get main items (no parent)
    const mainItems = agendaItems.filter(item => !item.parent_id && !item.parentLocalKey);
    
    mainItems.forEach((mainItem) => {
      const globalIndex = agendaItems.findIndex(i => i.id === mainItem.id);
      result.push({ 
        item: mainItem, 
        isSubItem: false, 
        parentItem: null,
        globalIndex,
        isSystemSubItem: false
      });
      
      // Get ALL sub-items for this main item (INCLUDING system_type)
      const allSubItems = agendaItems.filter(sub => 
        sub.parent_id === mainItem.id || sub.parentLocalKey === mainItem.id
      ).sort((a, b) => a.order_index - b.order_index);
      
      allSubItems.forEach(subItem => {
        const subGlobalIndex = agendaItems.findIndex(i => i.id === subItem.id);
        
        if (subItem.system_type) {
          // System sub-item: add as navigable point
          result.push({
            item: subItem,
            isSubItem: true,
            parentItem: mainItem,
            globalIndex: subGlobalIndex,
            isSystemSubItem: false
          });
          // Then inject its children (notes/appointments/tasks)
          injectSystemChildren(result, subItem, subItem);
        } else {
          // Regular sub-item
          result.push({ 
            item: subItem, 
            isSubItem: true, 
            parentItem: mainItem,
            globalIndex: subGlobalIndex,
            isSystemSubItem: false
          });
        }
      });
      
      // If the main item itself is a system type, inject children
      if (mainItem.system_type) {
        injectSystemChildren(result, mainItem, mainItem);
      }
    });
    
    return result;
  }, [agendaItems, getPersistentSystemSubItemCompletion, linkedQuickNotes, upcomingAppointments, linkedTasks, linkedCaseItems, relevantDecisions]);

  useEffect(() => {
    setOptimisticSystemSubItemCompletion(prev => {
      const next: Record<string, boolean> = {};
      allNavigableItems.forEach(n => {
        if (!n.isSystemSubItem || !n.item.id) return;
        if (Object.prototype.hasOwnProperty.call(prev, n.item.id)) {
          next[n.item.id] = prev[n.item.id];
        }
      });
      return next;
    });
  }, [allNavigableItems]);

  // Get current focused navigable item
  const currentNavigable = allNavigableItems[flatFocusIndex];
  const currentItem = currentNavigable?.item;
  const currentGlobalIndex = currentNavigable?.globalIndex ?? -1;

  // Calculate progress based on main items only
  const mainItems = agendaItems.filter(item => !item.parent_id && !item.parentLocalKey);
  const completedCount = mainItems.filter(item => item.is_completed).length;
  const totalCount = mainItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Handle dialog close with protection against subsequent Enter key
  const handleAssignDialogClose = (open: boolean) => {
    if (!open) {
      justClosedDialogRef.current = true;
      setTimeout(() => { justClosedDialogRef.current = false; }, 150);
    }
    setShowAssignDialog(open);
  };

  // Auto-complete parent when all sub-items are completed
  const handleItemComplete = useCallback((navigable: NavigableItem, isCompleted: boolean) => {
    if (navigable.isSystemSubItem) {
      if (navigable.item.id) {
        setOptimisticSystemSubItemCompletion(prev => ({ ...prev, [navigable.item.id!]: isCompleted }));
      }

      const source = navigable.sourceData as Record<string, unknown> | undefined;
      const sourceId = source?.id as string | undefined;
      if (sourceId && navigable.parentItem?.id && (navigable.sourceType === 'appointment' || navigable.sourceType === 'task')) {
        const results = parseSystemSubItemResults(navigable.parentItem.result_text);
        const previousEntry = results[sourceId];
        const nextResult = typeof previousEntry === 'string' ? previousEntry : previousEntry?.result || '';
        results[sourceId] = {
          result: nextResult,
          completed: isCompleted,
        };
        onUpdateResult(navigable.parentItem.id, 'result_text', JSON.stringify(results));
      }
      
      // Check if all system siblings under the same parent are now complete
      if (isCompleted && navigable.parentItem) {
        const parentId = navigable.parentItem.id;
        const siblings = allNavigableItems.filter(n =>
          n.isSystemSubItem && n.parentItem?.id === parentId
        );
        const allSiblingsComplete = siblings.every(s =>
          s.item.id === navigable.item.id
            ? true
            : Boolean(s.item.id ? (optimisticSystemSubItemCompletion[s.item.id] ?? s.item.is_completed) : s.item.is_completed)
        );
        if (allSiblingsComplete && !navigable.parentItem.is_completed) {
          const parentGlobalIndex = agendaItems.findIndex(i => i.id === parentId);
          if (parentGlobalIndex !== -1) {
            onUpdateItem(parentGlobalIndex, 'is_completed', true);
          }
        }
      }
      return;
    }
    
    // Update the item itself
    onUpdateItem(navigable.globalIndex, 'is_completed', isCompleted);
    
    // If this is a sub-item being marked complete, check if all siblings are now complete
    if (navigable.isSubItem && navigable.parentItem && isCompleted) {
      const parentItem = navigable.parentItem;
      const allSubItems = agendaItems.filter(sub => 
        sub.parent_id === parentItem.id || sub.parentLocalKey === parentItem.id
      );
      
      // Check if all sub-items will be completed after this update
      const allSubsWillBeCompleted = allSubItems.every(sub => 
        sub.id === navigable.item.id ? true : sub.is_completed
      );
      
      if (allSubsWillBeCompleted && !parentItem.is_completed) {
        const parentGlobalIndex = agendaItems.findIndex(i => i.id === parentItem.id);
        if (parentGlobalIndex !== -1) {
          onUpdateItem(parentGlobalIndex, 'is_completed', true);
        }
      }
    }
  }, [agendaItems, allNavigableItems, onUpdateItem, onUpdateResult, optimisticSystemSubItemCompletion, parseSystemSubItemResults]);

  // Check if all items are completed
  const checkAllCompleted = useCallback(() => {
    const mainItemsAfter = agendaItems.filter(item => !item.parent_id && !item.parentLocalKey);
    return mainItemsAfter.every(item => item.is_completed);
  }, [agendaItems]);

  const keyboardContextRef = useRef({
    flatFocusIndex,
    allNavigableItems,
    currentNavigable,
    currentItem,
    currentGlobalIndex,
    optimisticSystemSubItemCompletion,
  });
  const handleItemCompleteRef = useRef(handleItemComplete);
  const checkAllCompletedRef = useRef(checkAllCompleted);

  useEffect(() => {
    showAssignDialogRef.current = showAssignDialog;
    keyboardContextRef.current = {
      flatFocusIndex,
      allNavigableItems,
      currentNavigable,
      currentItem,
      currentGlobalIndex,
      optimisticSystemSubItemCompletion,
    };
    handleItemCompleteRef.current = handleItemComplete;
    checkAllCompletedRef.current = checkAllCompleted;
  }, [
    flatFocusIndex,
    showAssignDialog,
    allNavigableItems,
    currentNavigable,
    currentItem,
    currentGlobalIndex,
    optimisticSystemSubItemCompletion,
    handleItemComplete,
    checkAllCompleted,
  ]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
      const {
        flatFocusIndex,
        allNavigableItems,
        currentNavigable,
        currentItem,
        currentGlobalIndex,
        optimisticSystemSubItemCompletion,
      } = keyboardContextRef.current;

      // If assignment dialog is open OR just closed, block keyboard events
      if (showAssignDialogRef.current || justClosedDialogRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowAssignDialog(false);
        }
        // Ignore all other keys when dialog is open or just closed
        return;
      }
      
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          setFlatFocusIndex(prev => Math.min(prev + 1, allNavigableItems.length - 1));
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          setFlatFocusIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'PageDown':
        case 'd':
          e.preventDefault();
          // Scroll within the current item (for long items)
          mainContainerRef.current?.scrollBy({ top: 200, behavior: 'smooth' });
          break;
        case 'PageUp':
        case 'u':
          e.preventDefault();
          // Scroll within the current item (for long items)
          mainContainerRef.current?.scrollBy({ top: -200, behavior: 'smooth' });
          break;
        case 'a':
          e.preventDefault();
          // Open assignment dialog
          setShowAssignDialog(true);
          break;
        case 'Enter':
          e.preventDefault();
          if (currentNavigable) {
            // Check if current item has navigable children
            const childrenInNav = allNavigableItems.filter((n, idx) => 
              idx > flatFocusIndex && n.parentItem?.id === currentItem.id
            );
            
            if (childrenInNav.length > 0) {
              const firstUncompleted = childrenInNav.find(n => {
                if (n.isSystemSubItem) return !(n.item.id ? (optimisticSystemSubItemCompletion[n.item.id] ?? n.item.is_completed) : n.item.is_completed);
                return !n.item.is_completed;
              });
              if (firstUncompleted) {
                const childIdx = allNavigableItems.indexOf(firstUncompleted);
                setFlatFocusIndex(childIdx);
                return;
              }
            }
            
            // Toggle completion
            if (currentNavigable.isSystemSubItem) {
              const isNowCompleted = !(currentItem.id ? (optimisticSystemSubItemCompletion[currentItem.id] ?? currentItem.is_completed) : currentItem.is_completed);
              handleItemCompleteRef.current(currentNavigable, isNowCompleted);
              if (isNowCompleted) {
                setTimeout(() => {
                  if (checkAllCompletedRef.current()) {
                    setShowArchiveConfirm(true);
                  } else {
                    setFlatFocusIndex(prev => Math.min(prev + 1, allNavigableItems.length - 1));
                  }
                }, 50);
              }
            } else if (currentGlobalIndex !== -1) {
              const isNowCompleted = !currentItem.is_completed;
              handleItemCompleteRef.current(currentNavigable, isNowCompleted);
              if (isNowCompleted) {
                setTimeout(() => {
                  if (checkAllCompletedRef.current()) {
                    setShowArchiveConfirm(true);
                  } else {
                    setFlatFocusIndex(prev => Math.min(prev + 1, allNavigableItems.length - 1));
                  }
                }, 50);
              }
            }
          }
          break;
        case ' ':
        case 'r':
          e.preventDefault();
          // Focus the result textarea
          const textarea = document.querySelector(`#result-input-${currentItem?.id}`) as HTMLTextAreaElement;
          if (textarea) {
            textarea.focus();
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          break;
        case 'c':
          e.preventDefault();
          if (currentItem?.id) {
            onUpdateResult(currentItem.id, 'carry_over_to_next', !currentItem.carry_over_to_next);
          }
          break;
        case 's':
          e.preventDefault();
          // Toggle star on current appointment
          if (currentNavigable?.sourceType === 'appointment' && onToggleStar && currentNavigable.sourceData) {
            onToggleStar(currentNavigable.sourceData as MeetingUpcomingAppointment);
          }
          break;
        case 'n':
          e.preventDefault();
          {
            // Jump to next appointment
            const nextApptIdx = allNavigableItems.findIndex(
              (nav, i) => i > flatFocusIndex && nav.sourceType === 'appointment'
            );
            if (nextApptIdx !== -1) setFlatFocusIndex(nextApptIdx);
          }
          break;
        case 'p':
          e.preventDefault();
          {
            // Jump to previous appointment
            for (let i = flatFocusIndex - 1; i >= 0; i--) {
              if (allNavigableItems[i].sourceType === 'appointment') {
                setFlatFocusIndex(i);
                break;
              }
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case '?':
          e.preventDefault();
          setShowLegend(true);
          break;
      }
    }, [onClose, onToggleStar, onUpdateResult]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-scroll to focused item
  useEffect(() => {
    if (itemRefs.current[flatFocusIndex]) {
      itemRefs.current[flatFocusIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [flatFocusIndex]);

  const getDisplayName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.display_name || 'Unbekannt';
  };

  const formatMeetingDate = () => {
    const date = new Date(meeting.meeting_date);
    const dateStr = format(date, "EEEE, d. MMMM yyyy", { locale: de });
    if (meeting.meeting_time) {
      return `${dateStr} um ${formatMeetingTime(meeting.meeting_time)} Uhr`;
    }
    return dateStr;
  };

  // Get border color for system sub-items
  const getSystemSubItemBorderColor = (sourceType?: 'quick_note' | 'appointment' | 'task' | 'decision') => {
    switch (sourceType) {
      case 'quick_note': return 'border-l-amber-500';
      case 'appointment': return 'border-l-blue-500';
      case 'task': return 'border-l-green-500';
      case 'decision': return 'border-l-violet-500';
      default: return 'border-l-primary/30';
    }
  };

  // Render a single navigable item
  const renderNavigableItem = (navigable: NavigableItem, navIndex: number) => {
    const { item, isSubItem, parentItem, isSystemSubItem, sourceType, sourceData } = navigable;
    const isFocused = navIndex === flatFocusIndex;
    
    // Render system sub-items (individual notes, appointments, tasks) as autonomous items
    if (isSystemSubItem && sourceData) {
      const src = sourceData as Record<string, unknown>;
      const getSubItemResult = () => {
        if (sourceType === 'quick_note') return (src.meeting_result as string) || '';
        if (sourceType === 'appointment' && parentItem) {
          const results = parseSystemSubItemResults(parentItem.result_text);
          return getSystemResultText(results[src.id as string]);
        }
        if ((sourceType === 'task' || sourceType === 'decision') && parentItem) {
          const results = parseSystemSubItemResults(parentItem.result_text);
          return getSystemResultText(results[src.id as string]);
        }
        return '';
      };

      const updateSubItemResult = (value: string) => {
        if (sourceType === 'quick_note' && onUpdateNoteResult) {
          onUpdateNoteResult(src.id as string, value);
        } else if ((sourceType === 'task' || sourceType === 'appointment' || sourceType === 'decision') && parentItem?.id) {
          const results = parseSystemSubItemResults(parentItem.result_text);
          const sourceId = src.id as string;
          const previousEntry = results[sourceId];
          const completed = typeof previousEntry === 'string'
            ? Boolean(previousEntry.trim())
            : Boolean(previousEntry?.completed ?? previousEntry?.result?.trim());

          results[sourceId] = {
            result: value,
            completed,
          };
          onUpdateResult(parentItem.id, 'result_text', JSON.stringify(results));
        }
      };

      const isItemCompleted = Boolean(item.id ? (optimisticSystemSubItemCompletion[item.id] ?? item.is_completed) : item.is_completed);

      return (
        <div
          key={item.id || navIndex}
          ref={el => { itemRefs.current[navIndex] = el; }}
          className={cn(
            "p-4 rounded-lg border border-l-4 ml-8 transition-all duration-300",
            getSystemSubItemBorderColor(sourceType),
            isFocused && "ring-2 ring-primary bg-primary/5 scale-[1.01] shadow-lg",
            isItemCompleted && "bg-muted/50",
            !isFocused && !isItemCompleted && "bg-card hover:bg-muted/30"
          )}
          onClick={() => setFlatFocusIndex(navIndex)}
        >
          <div className="flex items-start gap-4">
            <Checkbox
              checked={isItemCompleted}
              onCheckedChange={(checked) => handleItemComplete(navigable, !!checked)}
              className="mt-0.5 h-4 w-4"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {sourceType === 'appointment' && onToggleStar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={(e) => { e.stopPropagation(); onToggleStar(sourceData as MeetingUpcomingAppointment); }}
                  >
                    <Star className={cn("h-3.5 w-3.5", starredAppointmentIds.has(src.id as string) ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                  </Button>
                )}
                {sourceType === 'quick_note' && <StickyNote className="h-3.5 w-3.5 text-amber-500" />}
                {sourceType === 'appointment' && <CalendarDays className="h-3.5 w-3.5 text-blue-500" />}
                {sourceType === 'task' && <ListTodo className="h-3.5 w-3.5 text-green-500" />}
                {sourceType === 'decision' && <Scale className="h-3.5 w-3.5 text-violet-500" />}
                <span className={cn("text-sm font-medium", isItemCompleted && "line-through text-muted-foreground")}>{item.title}</span>
                {isItemCompleted && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Besprochen
                  </Badge>
                )}
              </div>
              {sourceType === 'quick_note' && (src.content as string) && (
                <div className="mt-1">
                  <RichTextDisplay content={src.content as string} className="text-sm text-muted-foreground line-clamp-2" />
                </div>
              )}
              {sourceType === 'task' && (
                <div className="mt-1">
                  {(src.description as string) && (
                    <RichTextDisplay content={src.description as string} className="text-sm text-muted-foreground" />
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {(src.due_date as string) && (
                      <span className="text-xs text-muted-foreground">
                        Frist: {format(new Date(src.due_date as string), "dd.MM.yyyy", { locale: de })}
                      </span>
                    )}
                    {(src.priority as string) && (
                      <Badge variant="outline" className="text-xs">
                        {src.priority as string}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {(sourceType === 'quick_note' || sourceType === 'task' || sourceType === 'decision') && (src.user_id as string || src.created_by as string) && (() => {
                const userId = (src.user_id as string) || (src.created_by as string);
                const profile = profiles.find(p => p.user_id === userId);
                return profile ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(profile.display_name || '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{profile.display_name}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">von {getDisplayName(userId)}</span>
                );
              })()}
              {sourceType === 'decision' && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {(src.response_deadline as string) && <span>Frist: {format(new Date(src.response_deadline as string), "dd.MM.yyyy", { locale: de })}</span>}
                  {(src.status as string) && <Badge variant="outline" className="text-xs">{src.status as string}</Badge>}
                </div>
              )}
              {sourceType === 'appointment' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(src.start_time as string) && format(new Date(src.start_time as string), "dd.MM.yyyy HH:mm", { locale: de })}
                  {(src.location as string) && ` • ${src.location as string}`}
                </p>
              )}

              {/* Result input - show when focused or when result exists */}
              {(isFocused || getSubItemResult()) && (sourceType === 'quick_note' || sourceType === 'task' || sourceType === 'appointment' || sourceType === 'decision') && (
                <div className="mt-4 pt-3 border-t">
                  <label className="text-sm font-medium block mb-2">Ergebnis / Notizen</label>
                  <Textarea
                    id={`result-input-${item.id}`}
                    value={getSubItemResult()}
                    onChange={(e) => updateSubItemResult(e.target.value)}
                    placeholder="Was wurde besprochen? Was sind die nächsten Schritte?"
                    className="min-h-[80px]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    // Get regular sub-items for display (only for main items that are NOT sub-items themselves)
    const regularSubItems = !isSubItem ? agendaItems.filter(sub => 
      (sub.parent_id === item.id || sub.parentLocalKey === item.id) &&
      !sub.system_type
    ) : [];

    return (
      <div
        key={item.id || navIndex}
        ref={el => { itemRefs.current[navIndex] = el; }}
        className={cn(
          "p-6 rounded-xl border transition-all duration-300",
          isSubItem && !item.system_type && "ml-8 border-l-4 border-l-primary/30",
          isSubItem && item.system_type === 'upcoming_appointments' && "ml-8 border-l-4 border-l-blue-500",
          isSubItem && item.system_type === 'quick_notes' && "ml-8 border-l-4 border-l-amber-500",
          isSubItem && item.system_type === 'tasks' && "ml-8 border-l-4 border-l-green-500",
          isSubItem && item.system_type === 'decisions' && "ml-8 border-l-4 border-l-violet-500",
          isFocused && "ring-2 ring-primary bg-primary/5 scale-[1.01] shadow-lg",
          item.is_completed && "bg-muted/50",
          !isFocused && !item.is_completed && "bg-card hover:bg-muted/30"
        )}
        onClick={() => setFlatFocusIndex(navIndex)}
      >
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <Checkbox
            checked={item.is_completed}
            onCheckedChange={(checked) => {
              handleItemComplete(navigable, !!checked);
            }}
            className="mt-1.5 h-5 w-5"
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isSubItem && !item.system_type && (
                <CornerDownRight className="h-4 w-4 text-muted-foreground" />
              )}
              {item.system_type === 'upcoming_appointments' && (
                <CalendarDays className="h-4 w-4 text-blue-500" />
              )}
              {item.system_type === 'quick_notes' && (
                <StickyNote className="h-4 w-4 text-amber-500" />
              )}
              {item.system_type === 'tasks' && (
                <ListTodo className="h-4 w-4 text-green-500" />
              )}
              {item.system_type === 'decisions' && (
                <Scale className="h-4 w-4 text-violet-500" />
              )}
              <span className={cn(
                isSubItem ? "text-base" : "text-lg font-semibold",
                item.is_completed && "line-through text-muted-foreground"
              )}>
                {!isSubItem && `${allNavigableItems.filter((n, i) => !n.isSubItem && i <= navIndex).length}. `}
                {item.title}
              </span>
              {item.is_completed && (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Besprochen
                </Badge>
              )}
              {item.carry_over_to_next && (
                <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                  Übertragen
                </Badge>
              )}
            </div>

            {/* Description */}
            {item.description && (
              <div className="mt-2">
                <RichTextDisplay content={item.description} className="text-muted-foreground" />
              </div>
            )}

            {/* Notes */}
            {item.notes && (
              <div className="mt-2 p-3 bg-muted/50 rounded-lg border-l-2 border-primary/30">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                  <StickyNote className="h-3 w-3" />
                  Notizen
                </div>
                <p className="text-sm">{item.notes}</p>
              </div>
            )}

            {/* System content: Upcoming Appointments - show count info */}
            {item.system_type === 'upcoming_appointments' && upcomingAppointments.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                {upcomingAppointments.length} {upcomingAppointments.length === 1 ? 'Termin' : 'Termine'} — einzeln navigierbar
              </div>
            )}

            {/* System content: Quick Notes - show count info, items are rendered as separate navigable entries */}
            {item.system_type === 'quick_notes' && linkedQuickNotes.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground">
                {linkedQuickNotes.length} {linkedQuickNotes.length === 1 ? 'Notiz' : 'Notizen'} — einzeln navigierbar
              </div>
            )}

            {/* System content: Tasks - show count info, items are rendered as separate navigable entries */}
            {item.system_type === 'tasks' && linkedTasks.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground">
                {linkedTasks.length} {linkedTasks.length === 1 ? 'Aufgabe' : 'Aufgaben'} — einzeln navigierbar
              </div>
            )}

            {/* System content: Decisions - show count info */}
            {item.system_type === 'decisions' && relevantDecisions.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
                <Scale className="h-4 w-4 text-violet-500" />
                {relevantDecisions.length} {relevantDecisions.length === 1 ? 'Entscheidung' : 'Entscheidungen'} — einzeln navigierbar
              </div>
            )}

            {/* Assigned users */}
            {item.assigned_to && item.assigned_to.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {item.assigned_to.flat().map(getDisplayName).join(', ')}
                </span>
              </div>
            )}

            {/* Show sub-item count for main items */}
            {!isSubItem && regularSubItems.length > 0 && (
              <div className="mt-3 text-sm text-muted-foreground">
                {regularSubItems.filter(s => s.is_completed).length} von {regularSubItems.length} Unterpunkten besprochen
              </div>
            )}

            {/* Result input (expanded for focused item) - hide for system items with sub-items */}
            {isFocused && !item.system_type && (
              <div className="mt-4 pt-4 border-t">
                <label className="text-sm font-medium block mb-2">Ergebnis / Notizen</label>
                <Textarea
                  id={`result-input-${item.id}`}
                  value={item.result_text || ''}
                  onChange={(e) => {
                    if (item.id) {
                      onUpdateResult(item.id, 'result_text', e.target.value);
                    }
                  }}
                  placeholder="Was wurde besprochen? Was sind die nächsten Schritte?"
                  className="min-h-[100px]"
                />
                <div className="flex items-center gap-2 mt-3">
                  <Checkbox
                    id={`carryover-${item.id}`}
                    checked={item.carry_over_to_next || false}
                    onCheckedChange={(checked) => {
                      if (item.id) {
                        onUpdateResult(item.id, 'carry_over_to_next', checked);
                      }
                    }}
                  />
                  <label htmlFor={`carryover-${item.id}`} className="text-sm cursor-pointer">
                    Auf nächste Besprechung übertragen
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 border-b bg-card shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{meeting.title}</h1>
            <p className="text-sm text-muted-foreground">{formatMeetingDate()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowLegend(true)}>
              <Keyboard className="h-4 w-4 mr-2" />
              Tastenkürzel
            </Button>
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Beenden
            </Button>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b bg-muted/30 py-3">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-4">
            <Progress value={progressPercent} className="flex-1 h-2" />
            <span className="text-sm font-medium whitespace-nowrap">
              {completedCount} von {totalCount} Punkten besprochen
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main ref={mainContainerRef} className="flex-1 overflow-auto py-8">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          {allNavigableItems.map((navigable, index) => renderNavigableItem(navigable, index))}
        </div>
      </main>

      {/* Navigation hint footer */}
      <footer className="border-t bg-card py-3">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">↑</kbd>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">↓</kbd>
            <span>Navigation</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Enter</kbd>
            <span>Abhaken</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Space</kbd>
            <span>Ergebnis</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">?</kbd>
            <span>Alle Kürzel</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Esc</kbd>
            <span>Beenden</span>
          </div>
        </div>
      </footer>

      {/* Keyboard shortcuts legend */}
      <Dialog open={showLegend} onOpenChange={setShowLegend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Tastenkürzel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">↓</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">j</kbd>
                </div>
                <span className="text-sm">Nächster Punkt</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">↑</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">k</kbd>
                </div>
                <span className="text-sm">Vorheriger Punkt</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">PgDn</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">d</kbd>
                </div>
                <span className="text-sm">Im Punkt nach unten</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">PgUp</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">u</kbd>
                </div>
                <span className="text-sm">Im Punkt nach oben</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">Enter</kbd>
                <span className="text-sm">Als besprochen markieren</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">Space</kbd>
                  <span className="text-muted-foreground">/</span>
                  <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">r</kbd>
                </div>
                <span className="text-sm">Ergebnis eingeben</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">c</kbd>
                <span className="text-sm">Übertragen toggle</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">a</kbd>
                <span className="text-sm">Punkt zuweisen</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">s</kbd>
                <span className="text-sm">Termin markieren (Stern)</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">n</kbd>
                <span className="text-sm">Nächster Termin</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">p</kbd>
                <span className="text-sm">Vorheriger Termin</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">?</kbd>
                <span className="text-sm">Diese Hilfe anzeigen</span>
              </div>
              <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
                <kbd className="px-2 py-1 bg-background rounded text-xs font-mono border">Esc</kbd>
                <span className="text-sm">Fokus-Modus beenden</span>
              </div>
            </div>
            
            
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Alle Punkte besprochen!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sie haben alle Tagesordnungspunkte als besprochen markiert. 
              Möchten Sie die Besprechung jetzt beenden und archivieren?
              Es werden automatisch Aufgaben für zugewiesene Punkte erstellt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter bearbeiten</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowArchiveConfirm(false);
              onArchive();
            }}>
              Archivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assignment dialog */}
      <Dialog open={showAssignDialog} onOpenChange={handleAssignDialogClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Punkt zuweisen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wählen Sie ein Teammitglied für: <strong>{currentItem?.title}</strong>
            </p>
            <Select
              value={currentItem?.assigned_to?.flat()[0] || ''}
              onValueChange={(value) => {
                if (currentItem?.id && currentGlobalIndex !== -1) {
                  onUpdateItem(currentGlobalIndex, 'assigned_to', value && value !== '__none__' ? [value] : null);
                }
                handleAssignDialogClose(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Teammitglied auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nicht zugewiesen</SelectItem>
                {profiles.map(profile => (
                  <SelectItem key={profile.user_id} value={profile.user_id}>
                    {profile.display_name || 'Unbekannt'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentItem?.assigned_to && currentItem.assigned_to.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (currentItem?.id && currentGlobalIndex !== -1) {
                    onUpdateItem(currentGlobalIndex, 'assigned_to', null);
                  }
                  handleAssignDialogClose(false);
                }}
              >
                Zuweisung entfernen
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
