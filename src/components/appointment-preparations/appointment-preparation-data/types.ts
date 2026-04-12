import type { AppointmentPreparation, AppointmentConversationPartner } from "@/hooks/useAppointmentPreparation";

export type ConversationPartner = AppointmentConversationPartner;
export type Companion = NonNullable<AppointmentPreparation['preparation_data']['companions']>[number];
export type ProgramRow = NonNullable<AppointmentPreparation['preparation_data']['program']>[number];
export type QAPair = { id: string; question: string; answer: string };
export type TopicItem = { id: string; topic: string; background: string };
export type TalkingPointItem = { id: string; point: string; background: string };

export type ContactOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  position: string | null;
  organization: string | null;
  notes: string | null;
  avatar_url: string | null;
};

export interface ExtendedAppointmentPreparation extends AppointmentPreparation {
  contact_name?: string;
  contact_info?: string;
  contact_id?: string;
}

export interface AppointmentPreparationTabAppointmentDetails {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
}

export interface AppointmentPreparationDataTabProps {
  preparation: AppointmentPreparation;
  appointmentDetails: AppointmentPreparationTabAppointmentDetails | null;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
  onOpenAppointmentDetails?: () => void;
}

export type ExpandedSections = {
  anlass: boolean;
  gespraechspartner: boolean;
  begleitpersonen: boolean;
  logistik: boolean;
  programm: boolean;
  basics: boolean;
  people: boolean;
  materials: boolean;
  communication: boolean;
  framework: boolean;
};
