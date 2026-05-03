import React, { useState, useMemo } from "react";
import { Building, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Contact } from "@/hooks/useInfiniteContacts";
import { Link } from "react-router-dom";
import { StakeholderToDistributionDialog } from "@/features/contacts/components/StakeholderToDistributionDialog";
import { useContactDocumentCounts } from "@/hooks/useContactDocumentCounts";
import { useStakeholderTopics } from "@/components/stakeholders/hooks/useStakeholderTopics";
import { StakeholderGridView } from "@/components/stakeholders/StakeholderGridView";
import { StakeholderListView } from "@/components/stakeholders/StakeholderListView";

interface StakeholderViewProps {
  stakeholders: Contact[];
  contacts: Contact[];
  viewMode: "grid" | "list";
  onToggleFavorite: (contactId: string, isFavorite: boolean) => void;
  onContactClick: (contactId: string) => void;
  onRefresh?: () => void;
  hasMore?: boolean;
  loadMore?: () => void;
  loadingMore?: boolean;
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  onTagClick?: (tag: string) => void;
}

export function StakeholderView({
  stakeholders, contacts, viewMode, onToggleFavorite, onContactClick,
  onRefresh, sortColumn, sortDirection = "asc", onSort,
}: StakeholderViewProps) {
  const [expandedStakeholders, setExpandedStakeholders] = useState<Set<string>>(new Set());
  const [expandedFundings, setExpandedFundings] = useState<Set<string>>(new Set());
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());
  const [distributionDialogOpen, setDistributionDialogOpen] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Contact | null>(null);

  const stakeholderIds = stakeholders.map(s => s.id);
  const { counts: documentCounts } = useContactDocumentCounts(stakeholderIds);
  const topicsHook = useStakeholderTopics(stakeholders, onRefresh);

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const getStakeholderContacts = (stakeholderId: string) => {
    const stakeholder = stakeholders.find(s => s.id === stakeholderId);
    if (!stakeholder) return [];
    return contacts.filter(c => c.organization_id === stakeholderId || (c.organization && c.organization.trim() === stakeholder.name.trim()));
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase();

  const getCategoryColor = (category: Contact["category"]) => {
    switch (category) {
      case "citizen": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "colleague": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "business": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "media": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "lobbyist": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const sortedStakeholders = useMemo(() => {
    const filtered = [...stakeholders];
    return filtered.sort((a, b) => {
      if (!sortColumn || !onSort) return 0;
      let aValue: string | number = "", bValue: string | number = "";
      switch (sortColumn) {
        case "name": aValue = a.name?.toLowerCase() || ""; bValue = b.name?.toLowerCase() || ""; break;
        case "contacts": return 0;
        case "tags": {
          const aTopics = topicsHook.getTopicIds(a.id);
          const bTopics = topicsHook.getTopicIds(b.id);
          if (aTopics.length !== bTopics.length) { aValue = aTopics.length; bValue = bTopics.length; }
          else { aValue = aTopics.join(" ").toLowerCase(); bValue = bTopics.join(" ").toLowerCase(); }
          break;
        }
        default: return 0;
      }
      let result = 0;
      if (aValue < bValue) result = sortDirection === "asc" ? -1 : 1;
      else if (aValue > bValue) result = sortDirection === "asc" ? 1 : -1;
      if (result === 0) { const aN = a.name?.toLowerCase() || ""; const bN = b.name?.toLowerCase() || ""; result = aN < bN ? -1 : aN > bN ? 1 : 0; }
      return result;
    });
  }, [stakeholders, sortColumn, sortDirection, onSort, topicsHook]);

  const onDistributionClick = (stakeholder: Contact) => {
    setSelectedStakeholder(stakeholder);
    setDistributionDialogOpen(true);
  };

  const sharedProps = {
    expandedStakeholders, expandedDocuments, documentCounts,
    toggleExpanded: (id: string) => toggleSet(setExpandedStakeholders, id),
    toggleDocumentsExpanded: (id: string) => toggleSet(setExpandedDocuments, id),
    onToggleFavorite, onContactClick, getStakeholderContacts,
    editingTopics: topicsHook.editingTopics, setEditingTopics: topicsHook.setEditingTopics,
    getTopicIds: topicsHook.getTopicIds, handleTopicsLocalChange: topicsHook.handleTopicsLocalChange,
    handleSaveTopics: topicsHook.handleSaveTopics, handleCancelTopics: topicsHook.handleCancelTopics,
    localTopicUpdates: topicsHook.localTopicUpdates, onDistributionClick,
  };

  return (
    <div className="space-y-4">
      {viewMode === "grid" ? (
        <StakeholderGridView
          {...sharedProps}
          stakeholders={sortedStakeholders}
          expandedFundings={expandedFundings}
          toggleFundingsExpanded={(id: string) => toggleSet(setExpandedFundings, id)}
          getInitials={getInitials}
          getCategoryColor={getCategoryColor}
        />
      ) : (
        <StakeholderListView
          {...sharedProps}
          stakeholders={sortedStakeholders}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
        />
      )}

      {stakeholders.length === 0 && (
        <div className="text-center py-12">
          <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-foreground mb-2">Keine Stakeholder gefunden</h3>
          <p className="text-muted-foreground mb-4">Erstellen Sie Ihren ersten Stakeholder, um Organisationen zu verwalten.</p>
          <Link to="/contacts/new"><Button className="gap-2"><Plus className="h-4 w-4" />Neuen Stakeholder erstellen</Button></Link>
        </div>
      )}

      {selectedStakeholder && (
        <StakeholderToDistributionDialog
          isOpen={distributionDialogOpen}
          onClose={() => { setDistributionDialogOpen(false); setSelectedStakeholder(null); }}
          stakeholder={selectedStakeholder}
          associatedContacts={getStakeholderContacts(selectedStakeholder.id)}
        />
      )}
    </div>
  );
}
