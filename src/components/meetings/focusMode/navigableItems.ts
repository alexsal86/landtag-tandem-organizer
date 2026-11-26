import { orderSystemSubpoints } from "../agenda-editor/systemSubpoints";
import { parseMeetingResults } from "../platformAgendaRules";
import type {
  LinkedCaseItem,
  LinkedQuickNote,
  LinkedTask,
  MeetingUpcomingAppointment,
  RelevantDecision,
} from "../types";
import type { AgendaItem, NavigableItem } from "./types";

export interface NavigableItemsInput {
  agendaItems: AgendaItem[];
  linkedQuickNotes: LinkedQuickNote[];
  upcomingAppointments: MeetingUpcomingAppointment[];
  linkedTasks: LinkedTask[];
  linkedCaseItems: LinkedCaseItem[];
  relevantDecisions: RelevantDecision[];
  getPersistentSystemSubItemCompletion: (
    sourceType: NavigableItem["sourceType"],
    sourceData: unknown,
    parentItem?: AgendaItem | null,
  ) => boolean;
}

/**
 * Flache Fokus-Navigation: Hauptpunkte, Unterpunkte und generierte
 * Systemunterpunkte (Notizen/Termine/Aufgaben/Vorgänge/Entscheidungen) in
 * Anzeigereihenfolge.
 */
export function buildNavigableItems({
  agendaItems,
  linkedQuickNotes,
  upcomingAppointments,
  linkedTasks,
  linkedCaseItems,
  relevantDecisions,
  getPersistentSystemSubItemCompletion,
}: NavigableItemsInput): NavigableItem[] {
  const result: NavigableItem[] = [];

  // Helper to inject system children (notes/appointments/tasks) under a system item
  const injectSystemChildren = (
    systemItem: AgendaItem,
    parentForChildren: AgendaItem,
  ) => {
    const results = parseMeetingResults(systemItem.result_text);
    if (systemItem.system_type === "quick_notes" && linkedQuickNotes.length > 0) {
      orderSystemSubpoints(linkedQuickNotes, results).forEach((note, i) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion("quick_note", note, parentForChildren);
        result.push({
          item: {
            id: `note-${note.id}`,
            title: note.title || `Notiz ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: "quick_note_item",
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: note.id,
          sourceType: "quick_note",
          sourceData: note,
        });
      });
    }
    if (systemItem.system_type === "upcoming_appointments" && upcomingAppointments.length > 0) {
      orderSystemSubpoints(upcomingAppointments, results).forEach((appt, i) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion("appointment", appt, parentForChildren);
        result.push({
          item: {
            id: `appt-${appt.id}`,
            title: appt.title || `Termin ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: "appointment_item",
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: appt.id,
          sourceType: "appointment",
          sourceData: appt,
        });
      });
    }
    if (systemItem.system_type === "tasks" && linkedTasks.length > 0) {
      orderSystemSubpoints(linkedTasks, results).forEach((task, i) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion("task", task, parentForChildren);
        result.push({
          item: {
            id: `task-${task.id}`,
            title: task.title || `Aufgabe ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: "task_item",
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: task.id,
          sourceType: "task",
          sourceData: task,
        });
      });
    }
    if (systemItem.system_type === "case_items" && linkedCaseItems.length > 0) {
      orderSystemSubpoints(linkedCaseItems, results).forEach((ci: { id: string; subject?: string | null }, i: number) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion("task", ci, parentForChildren);
        result.push({
          item: {
            id: `caseitem-${ci.id}`,
            title: ci.subject || `Vorgang ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: "case_item_item",
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: ci.id,
          sourceType: "task",
          sourceData: ci,
        });
      });
    }
    if (systemItem.system_type === "decisions" && relevantDecisions.length > 0) {
      orderSystemSubpoints(relevantDecisions, results).forEach((decision, i) => {
        const persistedCompleted = getPersistentSystemSubItemCompletion("decision", decision, parentForChildren);
        result.push({
          item: {
            id: `decision-${decision.id}`,
            title: decision.title || `Entscheidung ${i + 1}`,
            is_completed: persistedCompleted,
            order_index: systemItem.order_index + i + 1,
            system_type: "decision_item",
          } as AgendaItem,
          isSubItem: true,
          parentItem: parentForChildren,
          globalIndex: -1,
          isSystemSubItem: true,
          sourceId: decision.id,
          sourceType: "decision",
          sourceData: decision,
        });
      });
    }
  };

  // Get main items (no parent)
  const mainItems = agendaItems.filter((item) => !item.parent_id && !item.parentLocalKey);

  mainItems.forEach((mainItem) => {
    const globalIndex = agendaItems.findIndex((i) => i.id === mainItem.id);
    result.push({
      item: mainItem,
      isSubItem: false,
      parentItem: null,
      globalIndex,
      isSystemSubItem: false,
    });

    // Get ALL sub-items for this main item (INCLUDING system_type)
    const allSubItems = agendaItems
      .filter((sub) => sub.parent_id === mainItem.id || sub.parentLocalKey === mainItem.id)
      .sort((a, b) => a.order_index - b.order_index);

    allSubItems.forEach((subItem) => {
      const subGlobalIndex = agendaItems.findIndex((i) => i.id === subItem.id);

      if (subItem.system_type) {
        // System sub-item: add as navigable point
        result.push({
          item: subItem,
          isSubItem: true,
          parentItem: mainItem,
          globalIndex: subGlobalIndex,
          isSystemSubItem: false,
        });
        // Then inject its children (notes/appointments/tasks)
        injectSystemChildren(subItem, subItem);
      } else {
        // Regular sub-item
        result.push({
          item: subItem,
          isSubItem: true,
          parentItem: mainItem,
          globalIndex: subGlobalIndex,
          isSystemSubItem: false,
        });
      }
    });

    // If the main item itself is a system type, inject children
    if (mainItem.system_type) {
      injectSystemChildren(mainItem, mainItem);
    }
  });

  return result;
}
