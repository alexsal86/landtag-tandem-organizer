import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Building, User, Filter, Grid3X3, List, Users, Archive, ChevronUp, Tag, Network, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactDetailPanel } from "./ContactDetailPanel";
import { ContactDetailSheet } from "./ContactDetailSheet";
import { InfiniteScrollTrigger } from "./InfiniteScrollTrigger";
import { ContactSkeleton } from "./ContactSkeleton";
import { StakeholderView } from "./StakeholderView";
import { DuplicateContactsSheet } from "./contacts/DuplicateContactsSheet";
import { BulkActionsToolbar } from "./contacts/BulkActionsToolbar";
import { StakeholderNetworkPage } from "@/components/contacts/StakeholderNetworkPage";

import { useContactsViewState } from "./contacts/hooks/useContactsViewState";
import { ContactGridCard } from "./contacts/ContactGridCard";
import { ContactListTable } from "./contacts/ContactListTable";
import { DistributionListsTab } from "./contacts/DistributionListsTab";
import { ArchiveTab } from "./contacts/ArchiveTab";
import { Card, CardContent } from "./ui/card";

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
    <div className="flex h-[calc(100vh-3.5rem)]">
      {s.selectedContactId && !s.isSheetOpen && (
        <div className="w-full md:w-3/5 lg:w-3/5 border-r border-border overflow-hidden bg-background">
          <ContactDetailPanel contactId={s.selectedContactId} onClose={() => s.setSelectedContactId(null)} onContactUpdate={s.refreshContacts} />
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto transition-all", s.selectedContactId && !s.isSheetOpen ? "hidden md:block md:w-2/5 lg:w-2/5" : "w-full")}>
        <div className="min-h-0 bg-gradient-subtle p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Kontakte & Organisationen</h1>
                <p className="text-muted-foreground">Verwalten Sie Ihre wichtigsten Kontakte, Organisationen und Beziehungen</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link to="/contacts/new"><Button className="gap-2"><Plus className="h-4 w-4" />Neuer Kontakt</Button></Link>
                {s.activeTab === "distribution-lists" && (
                  <Button variant="outline" className="gap-2" onClick={() => s.setCreatingDistribution(true)}><Plus className="h-4 w-4" />Neuer Verteiler</Button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto">
              <Button variant={s.activeTab === "contacts" ? "default" : "outline"} size="sm" onClick={() => { s.setActiveTab("contacts"); s.navigate("/contacts"); }} className="gap-2"><User className="h-4 w-4" />Kontakte ({s.contactsCount})</Button>
              <Button variant={s.activeTab === "stakeholders" ? "default" : "outline"} size="sm" onClick={() => s.navigate("/contacts/stakeholder")} className="gap-2"><Building className="h-4 w-4" />Stakeholder ({s.stakeholdersCount})</Button>
              <Button variant={s.activeTab === "stakeholder-network" ? "default" : "outline"} size="sm" onClick={() => s.navigate("/contacts/netzwerk")} className="gap-2"><Network className="h-4 w-4" />Netzwerk</Button>
              <Button variant={s.activeTab === "distribution-lists" ? "default" : "outline"} size="sm" onClick={() => { s.setActiveTab("distribution-lists"); s.navigate("/contacts"); }} className="gap-2"><Users className="h-4 w-4" />Verteiler ({s.distributionListsCount})</Button>
              <Button variant={s.activeTab === "archive" ? "default" : "outline"} size="sm" onClick={() => { s.setActiveTab("archive"); s.navigate("/contacts"); }} className="gap-2"><Archive className="h-4 w-4" />Archiv ({s.archiveCount})</Button>
            </div>

            {/* Search & View Toggle */}
            {s.activeTab !== "stakeholder-network" && (
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Kontakte durchsuchen..." value={s.searchTerm} onChange={(e) => s.setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                {s.selectedTagFilter && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md">
                    <Tag className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Tag: {s.selectedTagFilter}</span>
                    <Button variant="ghost" size="sm" onClick={() => s.setSelectedTagFilter("")} className="h-auto p-0 text-muted-foreground hover:text-foreground">×</Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="flex border border-border rounded-md">
                    <Button variant={currentViewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => s.setViewModeAndPersist("grid", s.activeTab)} className="rounded-r-none"><Grid3X3 className="h-4 w-4" /></Button>
                    <Button variant={currentViewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => s.setViewModeAndPersist("list", s.activeTab)} className="rounded-l-none"><List className="h-4 w-4" /></Button>
                  </div>
                  <Button variant={s.showFilters ? "default" : "outline"} className="gap-2" onClick={() => s.setShowFilters(!s.showFilters)}><Filter className="h-4 w-4" />Filter</Button>
                  {s.activeTab === "contacts" && (
                    <>
                      <Button variant={s.isSelectionMode ? "default" : "outline"} className="gap-2" onClick={() => { s.setIsSelectionMode(!s.isSelectionMode); if (s.isSelectionMode) s.clearSelection(); }}>
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
              </div>
            )}

            {/* Type & Category Filters */}
            {s.activeTab === "contacts" && s.showFilters && (
              <>
                <div className="flex gap-2 mb-4 overflow-x-auto">
                  {["all", "person", "organization"].map(t => (
                    <Button key={t} variant={s.selectedType === t ? "default" : "outline"} size="sm" onClick={() => s.setSelectedType(t)} className="whitespace-nowrap min-h-[44px]">
                      {t === "all" ? `Alle (${s.contacts.length})` : t === "person" ? `Personen (${s.contacts.filter(c => c.contact_type === "person").length})` : `Organisationen (${s.contacts.filter(c => c.contact_type === "organization").length})`}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2 overflow-x-auto">
                  {s.categories.map(cat => (
                    <Button key={cat.value} variant={s.selectedCategory === cat.value ? "default" : "outline"} size="sm" onClick={() => s.setSelectedCategory(cat.value)} className="whitespace-nowrap min-h-[44px]">
                      {cat.label} ({cat.count})
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>

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
                      documentCounts={s.documentCounts} expandedDocuments={s.expandedDocuments} toggleDocumentsExpanded={s.toggleDocumentsExpanded} />
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
