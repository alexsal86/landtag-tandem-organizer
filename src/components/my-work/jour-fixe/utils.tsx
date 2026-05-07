import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Briefcase, Cake, Calendar, ListTodo, Scale, StickyNote } from "lucide-react";
import type { AgendaItem, BirthdayItemData, CaseItemData, SystemItemData, UserProfileData } from "@/hooks/useMyWorkJourFixeSystemData";
import type { JourFixeSystemEntry } from "./types";

export const getInitials = (name: string | null | undefined) => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const getOwnerLabel = (userProfiles: Record<string, UserProfileData>, userId?: string) => {
  if (!userId) return null;
  const displayName = userProfiles[userId]?.display_name;
  return displayName ? `von ${displayName}` : "von unbekannt";
};

export const getSystemItemIcon = (systemType: string | null | undefined) => {
  if (systemType === "quick_notes") return <StickyNote className="h-3 w-3 text-palette-amber" />;
  if (systemType === "upcoming_appointments") return <Calendar className="h-3 w-3 text-palette-blue" />;
  if (systemType === "tasks") return <ListTodo className="h-3 w-3 text-palette-green" />;
  if (systemType === "decisions") return <Scale className="h-3 w-3 text-palette-violet" />;
  if (systemType === "birthdays") return <Cake className="h-3 w-3 text-palette-pink" />;
  if (systemType === "case_items") return <Briefcase className="h-3 w-3 text-palette-teal" />;
  return null;
};

export const getSystemEntries = ({
  systemType,
  notes,
  tasks,
  decisions,
  birthdays,
  caseItems,
  userProfiles,
}: {
  systemType: AgendaItem["system_type"];
  notes: SystemItemData[];
  tasks: SystemItemData[];
  decisions: SystemItemData[];
  birthdays: BirthdayItemData[];
  caseItems: CaseItemData[];
  userProfiles: Record<string, UserProfileData>;
}): JourFixeSystemEntry[] => {
  if (systemType === "quick_notes") {
    return notes.map((note, index) => ({
      id: note.id,
      icon: <StickyNote className="h-2.5 w-2.5 text-palette-amber" />,
      label: note.title || `Notiz ${index + 1}`,
      ownerLabel: getOwnerLabel(userProfiles, note.user_id),
    }));
  }

  if (systemType === "tasks") {
    return tasks.map((task) => ({
      id: task.id,
      icon: <ListTodo className="h-2.5 w-2.5 text-palette-green" />,
      label: task.title || "Ohne Titel",
      ownerLabel: getOwnerLabel(userProfiles, task.user_id),
    }));
  }

  if (systemType === "decisions") {
    return decisions.map((decision) => ({
      id: decision.id,
      icon: <Scale className="h-2.5 w-2.5 text-palette-violet" />,
      label: decision.title || "Ohne Titel",
      ownerLabel: getOwnerLabel(userProfiles, decision.user_id),
    }));
  }

  if (systemType === "birthdays") {
    return birthdays.map((birthday) => ({
      id: birthday.id,
      icon: <Cake className="h-2.5 w-2.5 text-palette-pink" />,
      label: `${birthday.name} (geb. ${format(birthday.birthDate, "dd.MM.yyyy", { locale: de })}, ${birthday.age} Jahre)`,
    }));
  }

  if (systemType === "case_items") {
    return caseItems.map((caseItem) => ({
      id: caseItem.id,
      icon: <Briefcase className="h-2.5 w-2.5 text-palette-teal" />,
      label: caseItem.subject || "Ohne Betreff",
      ownerLabel: getOwnerLabel(userProfiles, caseItem.owner_user_id ?? undefined),
    }));
  }

  return [];
};
