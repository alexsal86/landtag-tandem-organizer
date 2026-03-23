import type { ReactNode } from "react";
import type { AgendaItem, BirthdayItemData, CaseItemData, SystemItemData, UserProfileData } from "@/hooks/useMyWorkJourFixeSystemData";

export type JourFixeAgendaData = {
  items: AgendaItem[];
  loading: boolean;
  notes: SystemItemData[];
  tasks: SystemItemData[];
  decisions: SystemItemData[];
  birthdays: BirthdayItemData[];
  caseItems: CaseItemData[];
};

export type JourFixeSystemEntry = {
  id: string;
  icon: ReactNode;
  label: string;
  ownerLabel?: string | null;
};

export type JourFixeSystemDataMaps = {
  meetingQuickNotes: Record<string, SystemItemData[]>;
  meetingTasks: Record<string, SystemItemData[]>;
  meetingDecisions: Record<string, SystemItemData[]>;
  meetingBirthdays: Record<string, BirthdayItemData[]>;
  meetingCaseItems: Record<string, CaseItemData[]>;
  userProfiles: Record<string, UserProfileData>;
};
