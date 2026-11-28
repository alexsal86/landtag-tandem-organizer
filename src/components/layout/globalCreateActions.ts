import { CalendarClock, FilePenLine, MessageCircleQuestion } from "lucide-react";
import { openAppointmentRequestCreate } from "@/features/appointment-requests/events";
import { openKnowledgeQuestion, KNOWLEDGE_QUESTION_SHORTCUT } from "@/features/knowledge/globalQuestion";
import { openGlobalQuickNote, QUICK_NOTE_SHORTCUT } from "@/features/quick-notes/globalCapture";
import { useTenantModuleGate } from "@/hooks/useTenantFeatureFlag";
import { useActionPermission } from "@/hooks/useActionPermission";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

const actions = [
  {
    id: "quick-note",
    label: "Schnelle Notiz",
    destination: "notes",
    icon: FilePenLine,
    keywords: "Neue Notiz Notizen Quick Note",
    shortcut: QUICK_NOTE_SHORTCUT,
    ariaShortcut: "Control+. Meta+.",
    run: () => openGlobalQuickNote(),
  },
  {
    id: "appointment-request",
    label: "Terminanfrage vormerken",
    destination: "calendar",
    icon: CalendarClock,
    keywords: "Neue Terminanfrage Termin Anfrage Kalender",
    shortcut: "Strg/⌘ + Umschalt + .",
    ariaShortcut: "Control+Shift+. Meta+Shift+.",
    run: () => openAppointmentRequestCreate(),
  },
  {
    id: "knowledge-question",
    label: "Wissensfrage stellen",
    destination: "wissen",
    icon: MessageCircleQuestion,
    keywords: "Neue Wissensfrage Frage Wissen",
    shortcut: KNOWLEDGE_QUESTION_SHORTCUT,
    ariaShortcut: "Control+Alt+F Meta+Alt+F",
    run: (query?: string) => openKnowledgeQuestion(query),
  },
];

export function useGlobalCreateActions() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const moduleEnabled = useTenantModuleGate(false);
  const { allowed } = useActionPermission("knowledge.write");
  return user && currentTenant ? actions.filter(action => action.id !== "knowledge-question" || (allowed && moduleEnabled("module.knowledge"))) : [];
}
