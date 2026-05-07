import { Briefcase, FileText, Mail, MessageSquare, Phone, UserRound, Users } from "lucide-react";
import type { TimelineDocumentAttachment, TimelineInteractionType } from "@/components/my-work/hooks/useCaseItemEdit";

export type TimelineEntry = {
  id: string;
  timestamp: string;
  title: string;
  note?: string;
  safeNoteHtml?: string;
  documents?: TimelineDocumentAttachment[];
  accentClass: string;
  icon?: typeof Phone;
  canDelete?: boolean;
  onDelete?: () => void;
};

export const sourceChannelMeta: Record<string, { icon: typeof Phone; label: string }> = {
  phone: { icon: Phone, label: "Telefon" },
  email: { icon: Mail, label: "E-Mail" },
  social: { icon: MessageSquare, label: "Social" },
  in_person: { icon: UserRound, label: "Vor Ort" },
  other: { icon: Briefcase, label: "Sonstiges" },
};

export const statusOptions = [
  { value: "neu", label: "Neu", dotColor: "bg-sky-500", badgeClass: "border-sky-500/40 text-sky-700 bg-sky-500/10" },
  { value: "in_klaerung", label: "In Klärung", dotColor: "bg-amber-500", badgeClass: "border-amber-500/40 text-amber-700 bg-amber-500/10" },
  { value: "antwort_ausstehend", label: "Antwort ausstehend", dotColor: "bg-violet-500", badgeClass: "border-violet-500/40 text-violet-700 bg-violet-500/10" },
  { value: "entscheidung_abwartend", label: "Entscheidung abwartend", dotColor: "bg-fuchsia-600", badgeClass: "border-fuchsia-500/40 text-fuchsia-700 bg-fuchsia-500/10" },
  { value: "erledigt", label: "Erledigt", dotColor: "bg-emerald-600", badgeClass: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10" },
] as const;

export const interactionTypeOptions: Array<{ value: TimelineInteractionType; label: string; icon: typeof Phone }> = [
  { value: "anruf", label: "Anruf", icon: Phone },
  { value: "mail", label: "Mail", icon: Mail },
  { value: "treffen", label: "Treffen", icon: Users },
  { value: "dokument", label: "Dokument", icon: FileText },
  { value: "notiz", label: "Notiz", icon: MessageSquare },
];

export const priorityOptions = [
  { value: "low", label: "Niedrig", color: "text-emerald-500" },
  { value: "medium", label: "Mittel", color: "text-amber-500" },
  { value: "high", label: "Hoch", color: "text-red-500" },
  { value: "urgent", label: "Dringend", color: "text-red-600" },
];
