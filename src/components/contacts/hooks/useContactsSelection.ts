import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Contact } from "@/hooks/useInfiniteContacts";

export interface UseContactsSelectionResult {
  selectedContactId: string | null;
  setSelectedContactId: Dispatch<SetStateAction<string | null>>;
  isSheetOpen: boolean;
  setIsSheetOpen: Dispatch<SetStateAction<boolean>>;
  isDuplicateSheetOpen: boolean;
  setIsDuplicateSheetOpen: Dispatch<SetStateAction<boolean>>;
  selectedContactIds: Set<string>;
  isSelectionMode: boolean;
  setIsSelectionMode: Dispatch<SetStateAction<boolean>>;
  toggleContactSelection: (contactId: string) => void;
  selectAllContacts: (contacts: Contact[]) => void;
  clearSelection: () => void;
}

export function useContactsSelection(): UseContactsSelectionResult {
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDuplicateSheetOpen, setIsDuplicateSheetOpen] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds((previous) => {
      const next = new Set(previous);

      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }

      return next;
    });
  };

  const selectAllContacts = (contacts: Contact[]) => {
    setSelectedContactIds(new Set(contacts.map((contact) => contact.id)));
  };

  const clearSelection = () => {
    setSelectedContactIds(new Set());
    setIsSelectionMode(false);
  };

  return {
    selectedContactId,
    setSelectedContactId,
    isSheetOpen,
    setIsSheetOpen,
    isDuplicateSheetOpen,
    setIsDuplicateSheetOpen,
    selectedContactIds,
    isSelectionMode,
    setIsSelectionMode,
    toggleContactSelection,
    selectAllContacts,
    clearSelection,
  };
}
