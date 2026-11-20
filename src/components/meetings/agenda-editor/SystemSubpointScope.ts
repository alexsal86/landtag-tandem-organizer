import { createContext } from "react";

export type GeneratedAgendaEntry = { id: string; title: string; number?: string };

export const SystemSubpointScope = createContext<{
  parentKey: string;
  meetingId?: string;
  selectedKey: string | null;
  liveKey?: string;
  detailContainer?: HTMLElement | null;
  onSelect: (key: string) => void;
  onEntries: (parentKey: string, entries: GeneratedAgendaEntry[]) => void;
} | null>(null);
