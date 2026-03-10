import { useState } from "react";

export interface UseContactsDocumentsExpansionResult {
  expandedDocuments: Set<string>;
  toggleDocumentsExpanded: (contactId: string) => void;
}

export function useContactsDocumentsExpansion(): UseContactsDocumentsExpansionResult {
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());

  const toggleDocumentsExpanded = (contactId: string) => {
    setExpandedDocuments((previous) => {
      const next = new Set(previous);

      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }

      return next;
    });
  };

  return {
    expandedDocuments,
    toggleDocumentsExpanded,
  };
}
