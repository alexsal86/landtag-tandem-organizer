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
  { value: "neu", label: "Neu", dotColor: "bg-palette-blue", badgeClass: "border-palette-blue/40 text-palette-blue bg-palette-blue/10" },
  { value: "in_klaerung", label: "In Klärung", dotColor: "bg-palette-amber", badgeClass: "border-palette-amber/40 text-palette-amber bg-palette-amber/10" },
  { value: "antwort_ausstehend", label: "Antwort ausstehend", dotColor: "bg-palette-violet", badgeClass: "border-palette-violet/40 text-palette-violet bg-palette-violet/10" },
  { value: "entscheidung_abwartend", label: "Entscheidung abwartend", dotColor: "bg-palette-pink", badgeClass: "border-palette-pink/40 text-palette-pink bg-palette-pink/10" },
  { value: "erledigt", label: "Erledigt", dotColor: "bg-palette-green", badgeClass: "border-palette-green/40 text-palette-green bg-palette-green/10" },
] as const;

export const interactionTypeOptions: Array<{ value: TimelineInteractionType; label: string; icon: typeof Phone }> = [
  { value: "anruf", label: "Anruf", icon: Phone },
  { value: "mail", label: "Mail", icon: Mail },
  { value: "treffen", label: "Treffen", icon: Users },
  { value: "dokument", label: "Dokument", icon: FileText },
  { value: "notiz", label: "Notiz", icon: MessageSquare },
];

export const priorityOptions = [
  { value: "low", label: "Niedrig", color: "text-palette-green" },
  { value: "medium", label: "Mittel", color: "text-palette-amber" },
  { value: "high", label: "Hoch", color: "text-palette-red" },
  { value: "urgent", label: "Dringend", color: "text-palette-red" },
];
