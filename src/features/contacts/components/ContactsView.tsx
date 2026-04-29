import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Filter, Grid3X3, List, User, CheckSquare, Square, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactDetailSheet } from "@/features/contacts/components/ContactDetailSheet";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { ContactSkeleton } from "@/features/contacts/components/ContactSkeleton";
import { StakeholderView } from "@/features/contacts/components/StakeholderView";
import { DuplicateContactsSheet } from "@/components/contacts/DuplicateContactsSheet";
import { BulkActionsToolbar } from "@/components/contacts/BulkActionsToolbar";
import { StakeholderNetworkPage } from "@/components/contacts/StakeholderNetworkPage";
import { ContactsSidePanel } from "@/components/contacts/ContactsSidePanel";

import { useContactsViewState } from "@/components/contacts/hooks/useContactsViewState";
import { ContactGridCard } from "@/components/contacts/ContactGridCard";
import { ContactListTable } from "@/components/contacts/ContactListTable";
import { DistributionListsTab } from "@/components/contacts/DistributionListsTab";
import { ArchiveTab } from "@/components/contacts/ArchiveTab";
import { Card, CardContent } from "@/components/ui/card";

export function ContactsView() {
  const s = useContactsViewState();

  if (!s.user || s.tenantLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">System wird geladen...</p>
        </div>
      </div>
    );
  }

  if (!s.currentTenant) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-foreground mb-4">Kein Zugriff</h2>
          <p className="text-muted-foreground mb-6">Sie haben keinen Zugriff auf einen Mandanten.</p>
          <Button onClick={() => s.navigate("/auth")} variant="outline">Zurück zur Anmeldung</Button>
        </div>
      </div>
    );
  }

  if (s.loading && s.contacts.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Kontakte werden geladen...</p>
        </div>
      </div>
    );
  }

  const currentViewMode = s.activeTab === "contacts" ? s.viewMode : s.activeTab === "stakeholders" ? s.stakeholderViewMode : s.distributionViewMode;

  return (
    <div className="flex h-app-headerless">
      {/* Side Panel */}
      <ContactsSidePanel
        activeTab={s.activeTab}
        setActiveTab={s.setActiveTab}
        searchTerm={s.searchTerm}
        setSearchTerm={s.setSearchTerm}
        selectedTagFilter={s.selectedTagFilter}
        setSelectedTagFilter={s.setSelectedTagFilter}
        contactsCount={s.contactsCount}
        stakeholdersCount={s.stakeholdersCount}
        distributionListsCount={s.distributionListsCount}
        archiveCount={s.archiveCount}
        navigate={s.navigate}
        setCreatingDistribution={s.setCreatingDistribution}
        setIsDuplicateSheetOpen={s.setIsDuplicateSheetOpen}
        selectedContactId={s.selectedContactId}
        setSelectedContactId={s.setSelectedContactId}
        refreshContacts={s.refreshContacts}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-0 bg-gradient-subtle p-6">
          {/* Toolbar: View toggle, Filter, Select */}
          {s.activeTab !== "stakeholder-network" && (
            <div className="flex gap-2 mb-6 items-center flex-wrap">
              <div className="flex border border-border rounded-md">
                <Button variant={currentViewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => s.setViewModeAndPersist("grid", s.activeTab)} className="rounded-r-none"><Grid3X3 className="h-4 w-4" /></Button>
                <Button variant={currentViewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => s.setViewModeAndPersist("list", s.activeTab)} className="rounded-l-none"><List className="h-4 w-4" /></Button>
              </div>
              <Button variant={s.showFilters ? "default" : "outline"} size="sm" className="gap-2" onClick={() => s.setShowFilters(!s.showFilters)}><Filter className="h-4 w-4" />Filter</Button>
              {s.activeTab === "contacts" && (
                <>
                  <Button variant={s.isSelectionMode ? "default" : "outline"} size="sm" className="gap-2" onClick={() => { s.setIsSelectionMode(!s.isSelectionMode); if (s.isSelectionMode) s.clearSelection(); }}>
                    {s.isSelectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}Auswählen
                  </Button>
                  {s.isSelectionMode && (
                    <Button variant="outline" size="sm" onClick={() => s.selectedContactIds.size === s.contacts.length ? s.clearSelection() : s.selectAllContacts()}>
                      {s.selectedContactIds.size === s.contacts.length ? 'Alle abwählen' : 'Alle auswählen'}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Type & Category Filters */}
          {s.activeTab === "contacts" && s.showFilters && (
            <div className="mb-6 space-y-3">
              <div className="flex gap-2 overflow-x-auto">
                {["all", "person", "organization"].map(t => (
                  <Button key={t} variant={s.selectedType === t ? "default" : "outline"} size="sm" onClick={() => s.setSelectedType(t)} className="whitespace-nowrap">
                    {t === "all" ? `Alle (${s.contacts.length})` : t === "person" ? `Personen (${s.contacts.filter(c => c.contact_type === "person").length})` : `Organisationen (${s.contacts.filter(c => c.contact_type === "organization").length})`}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {s.categories.map(cat => (
                  <Button key={cat.value} variant={s.selectedCategory === cat.value ? "default" : "outline"} size="sm" onClick={() => s.setSelectedCategory(cat.value)} className="whitespace-nowrap">
                    {cat.label} ({cat.count})
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Tab Content */}
          {s.activeTab === "contacts" ? (
            <div className="space-y-6">
              {s.loading && s.contacts.length === 0 ? <ContactSkeleton count={12} viewMode={s.viewMode} /> : (
                <>
                  {s.viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {s.contacts.map(contact => (
                        <ContactGridCard key={contact.id} contact={contact} isSelectionMode={s.isSelectionMode} isSelected={s.selectedContactIds.has(contact.id)}
                          onSelect={() => s.toggleContactSelection(contact.id)} onClick={() => s.setSelectedContactId(contact.id)}
                          onToggleFavorite={s.toggleFavorite} onDelete={s.handleDeleteContact} />
                      ))}
                    </div>
                  ) : (
                    <ContactListTable contacts={s.contacts} sortColumn={s.sortColumn} sortDirection={s.sortDirection} onSort={s.handleSort}
                      onContactClick={(id) => s.setSelectedContactId(id)} onToggleFavorite={s.toggleFavorite}
                      isSelectionMode={s.isSelectionMode} selectedContactIds={s.selectedContactIds}
                      onToggleSelection={s.toggleContactSelection} />
                  )}
                  {s.loadingMore && <div className="py-8"><ContactSkeleton count={6} viewMode={s.viewMode} /></div>}
                  <InfiniteScrollTrigger onLoadMore={s.loadMore} loading={s.loadingMore} hasMore={s.hasMore} />
                  {!s.loadingMore && s.hasMore && s.contacts.length > 0 && (
                    <div className="text-center py-6"><Button variant="outline" onClick={s.loadMore} disabled={s.loadingMore} className="gap-2">Weitere Kontakte laden ({s.totalCount - s.contacts.length} verbleibend)</Button></div>
                  )}
                  {!s.hasMore && s.contacts.length > 0 && <div className="text-center py-6 text-muted-foreground"><p>Alle Kontakte wurden geladen.</p></div>}
                  {!s.loading && s.contacts.length === 0 && (
                    <Card className="bg-card shadow-card border-border"><CardContent className="text-center py-12">
                      <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Keine Kontakte gefunden</h3>
                      <p className="text-muted-foreground mb-4">{s.searchTerm || s.selectedCategory !== "all" || s.selectedType !== "all" ? "Versuchen Sie es mit anderen Suchkriterien." : "Erstellen Sie Ihren ersten Kontakt."}</p>
                      <Link to="/contacts/new"><Button className="gap-2"><Plus className="h-4 w-4" />Neuen Kontakt erstellen</Button></Link>
                    </CardContent></Card>
                  )}
                </>
              )}
            </div>
          ) : s.activeTab === "stakeholders" ? (
            <div className="space-y-6">
              {s.loading && s.contacts.length === 0 ? <ContactSkeleton count={6} viewMode="grid" /> : (
                <StakeholderView stakeholders={s.contacts} contacts={s.personContacts} viewMode={s.stakeholderViewMode}
                  onToggleFavorite={s.toggleFavorite} onContactClick={(id) => s.setSelectedContactId(id)} onRefresh={s.refreshContacts}
                  hasMore={s.hasMore} loadMore={s.loadMore} loadingMore={s.loadingMore}
                  sortColumn={s.stakeholderSortColumn} sortDirection={s.stakeholderSortDirection} onSort={s.handleStakeholderSort}
                  onTagClick={(tag) => s.setSelectedTagFilter(tag)} />
              )}
              {s.hasMore && !s.loading && <InfiniteScrollTrigger onLoadMore={s.loadMore} loading={s.loadingMore} hasMore={s.hasMore} />}
            </div>
          ) : s.activeTab === "stakeholder-network" ? (
            <StakeholderNetworkPage />
          ) : s.activeTab === "archive" ? (
            <ArchiveTab contacts={s.contacts} />
          ) : (
            <DistributionListsTab
              distributionLists={s.distributionLists} distributionListsLoading={s.distributionListsLoading}
              creatingDistribution={s.creatingDistribution} editingDistributionListId={s.editingDistributionListId}
              setCreatingDistribution={s.setCreatingDistribution} setEditingDistributionListId={s.setEditingDistributionListId}
              fetchDistributionLists={s.fetchDistributionLists} deleteDistributionList={s.deleteDistributionList}
              fetchDistributionListMembers={s.fetchDistributionListMembers}
              onContactClick={(id) => s.setSelectedContactId(id)} />
          )}

          {s.showScrollTop && <Button className="fixed bottom-6 right-6 rounded-full p-3 shadow-lg z-50" onClick={s.scrollToTop} size="sm"><ChevronUp className="h-4 w-4" /></Button>}

          <BulkActionsToolbar selectedContacts={s.contacts.filter(c => s.selectedContactIds.has(c.id))} onClearSelection={s.clearSelection}
            onActionComplete={() => { s.clearSelection(); s.refreshContacts(); }} allTags={s.allTags} />

          <ContactDetailSheet contactId={s.selectedContactId} isOpen={s.isSheetOpen}
            onClose={() => { s.setIsSheetOpen(false); s.setSelectedContactId(null); }} onContactUpdate={s.refreshContacts} />

          <DuplicateContactsSheet isOpen={s.isDuplicateSheetOpen} onClose={() => s.setIsDuplicateSheetOpen(false)} onDuplicatesResolved={s.refreshContacts} />
        </div>
      </div>
    </div>
  );
}
