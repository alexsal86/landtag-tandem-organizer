import React from 'react';
import { ChevronRight, ChevronUp, ChevronDown, Building, User, Mail, Phone, MapPin, Edit, Tag, Users, Star, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contact } from '@/hooks/useInfiniteContacts';
import { Link } from 'react-router-dom';
import { TopicSelector, TopicDisplay } from '@/components/topics/TopicSelector';
import { ContactDocumentRows } from '../contacts/ContactDocumentRows';

interface StakeholderListViewProps {
  stakeholders: Contact[];
  expandedStakeholders: Set<string>;
  expandedDocuments: Set<string>;
  documentCounts: Record<string, { total: number }>;
  toggleExpanded: (id: string) => void;
  toggleDocumentsExpanded: (id: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onContactClick: (id: string) => void;
  getStakeholderContacts: (id: string) => Contact[];
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  editingTopics: string | null;
  setEditingTopics: (id: string | null) => void;
  getTopicIds: (id: string) => string[];
  handleTopicsLocalChange: (id: string, topicIds: string[]) => void;
  handleSaveTopics: (id: string) => void;
  handleCancelTopics: (id: string) => void;
  localTopicUpdates: Record<string, string[]>;
  onDistributionClick: (stakeholder: Contact) => void;
}

const SortableTableHead = ({ children, sortKey, sortColumn, sortDirection, onSort, className = '' }: {
  children: React.ReactNode; sortKey: string; sortColumn?: string | null; sortDirection?: 'asc' | 'desc'; onSort?: (col: string) => void; className?: string;
}) => (
  <TableHead className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`} onClick={() => onSort?.(sortKey)}>
    <div className="flex items-center gap-2">
      {children}
      <div className="flex flex-col gap-0">
        <ChevronUp className={`h-3 w-3 transition-colors ${sortColumn === sortKey && sortDirection === 'asc' ? 'text-primary' : 'text-muted-foreground/40'}`} />
        <ChevronDown className={`h-3 w-3 transition-colors -mt-0.5 ${sortColumn === sortKey && sortDirection === 'desc' ? 'text-primary' : 'text-muted-foreground/40'}`} />
      </div>
    </div>
  </TableHead>
);

export function StakeholderListView({
  stakeholders, expandedStakeholders, expandedDocuments, documentCounts,
  toggleExpanded, toggleDocumentsExpanded, onToggleFavorite, onContactClick,
  getStakeholderContacts, sortColumn, sortDirection, onSort,
  editingTopics, setEditingTopics, getTopicIds, handleTopicsLocalChange,
  handleSaveTopics, handleCancelTopics, localTopicUpdates, onDistributionClick,
}: StakeholderListViewProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Favorit</TableHead>
            <SortableTableHead sortKey="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Name</SortableTableHead>
            <TableHead>Adresse</TableHead>
            <TableHead>Kontakte</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Telefon</TableHead>
            <SortableTableHead sortKey="tags" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Themen</SortableTableHead>
            <TableHead className="w-32">Aktionen</TableHead>
            <TableHead className="text-center w-24">Dokumente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stakeholders.map((stakeholder) => {
            const currentTopicIds = getTopicIds(stakeholder.id);
            const stakeholderContacts = getStakeholderContacts(stakeholder.id);
            const isExpanded = expandedStakeholders.has(stakeholder.id);

            return (
              <React.Fragment key={stakeholder.id}>
                <TableRow className="hover:bg-muted/50">
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onToggleFavorite(stakeholder.id, !stakeholder.is_favorite); }} className="p-1 h-6 w-6">
                      <Star className={`h-3 w-3 transition-colors ${stakeholder.is_favorite ? 'text-yellow-500 fill-current' : 'text-muted-foreground hover:text-yellow-500'}`} />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-primary/10 rounded"><Building className="h-4 w-4 text-primary" /></div>
                      <div>
                        <div className="font-medium">{stakeholder.name}</div>
                        {stakeholder.industry && <div className="text-xs text-muted-foreground">{stakeholder.industry}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {(() => {
                        const businessAddress = [stakeholder.business_street, stakeholder.business_house_number, stakeholder.business_postal_code, stakeholder.business_city].filter(Boolean).join(' ');
                        const displayAddress = businessAddress || stakeholder.address || stakeholder.location;
                        return displayAddress ? (
                          <div className="flex items-center gap-1"><MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate">{displayAddress}</span></div>
                        ) : <span className="text-muted-foreground">—</span>;
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggleExpanded(stakeholder.id)} className="p-1 h-auto text-sm hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <span>{stakeholderContacts.length} Kontakte</span>
                      </div>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{stakeholder.email ? <div className="flex items-center gap-1"><Mail className="h-3 w-3" /><span className="truncate max-w-[150px]">{stakeholder.email}</span></div> : "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{stakeholder.phone ? <div className="flex items-center gap-1"><Phone className="h-3 w-3" /><span>{stakeholder.phone}</span></div> : "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
                      {editingTopics === stakeholder.id ? (
                        <div className="space-y-1 w-full" onClick={(e) => e.stopPropagation()}>
                          <TopicSelector selectedTopicIds={localTopicUpdates[stakeholder.id] || currentTopicIds} onTopicsChange={(ids) => handleTopicsLocalChange(stakeholder.id, ids)} placeholder="Themen..." compact />
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => handleSaveTopics(stakeholder.id)} className="h-6 px-2 text-xs">Speichern</Button>
                            <Button size="sm" variant="outline" onClick={() => handleCancelTopics(stakeholder.id)} className="h-6 px-2 text-xs">Abbrechen</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <TopicDisplay topicIds={currentTopicIds} maxDisplay={2} />
                          <Button variant="ghost" size="sm" onClick={() => setEditingTopics(stakeholder.id)} className="h-5 w-5 p-0 ml-1"><Tag className="h-3 w-3" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onContactClick(stakeholder.id)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Link to={`/contacts/${stakeholder.id}/edit`}><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Edit className="h-3 w-3" /></Button></Link>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onDistributionClick(stakeholder)}><Users className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {documentCounts[stakeholder.id]?.total > 0 ? (
                      <Button variant="ghost" size="sm" onClick={() => toggleDocumentsExpanded(stakeholder.id)} className="p-1 h-auto text-sm hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3" /><span>{documentCounts[stakeholder.id]?.total}</span>
                          <ChevronRight className={`h-3 w-3 transition-transform ${expandedDocuments.has(stakeholder.id) ? 'rotate-90' : ''}`} />
                        </div>
                      </Button>
                    ) : <span className="text-sm">—</span>}
                  </TableCell>
                </TableRow>
                {expandedDocuments.has(stakeholder.id) && <ContactDocumentRows contactId={stakeholder.id} contactTags={[]} />}
                {isExpanded && stakeholderContacts.map((contact) => (
                  <TableRow key={`contact-${contact.id}`} className="bg-muted/30 border-l-4 border-l-primary/30">
                    <TableCell></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 pl-8">
                        <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded"><User className="h-3 w-3 text-blue-600 dark:text-blue-300" /></div>
                        <div>
                          <div className="font-medium text-sm">{contact.name}</div>
                          {contact.role && <div className="text-xs text-muted-foreground">{contact.role}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => onContactClick(contact.id)} className="text-xs text-primary hover:bg-primary/10">Details</Button></TableCell>
                    <TableCell><div className="text-sm">{contact.email ? <div className="flex items-center gap-1"><Mail className="h-3 w-3" /><span className="truncate max-w-[150px]">{contact.email}</span></div> : "—"}</div></TableCell>
                    <TableCell><div className="text-sm">{contact.phone ? <div className="flex items-center gap-1"><Phone className="h-3 w-3" /><span>{contact.phone}</span></div> : "—"}</div></TableCell>
                    <TableCell>
                      {contact.tags && contact.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.slice(0, 2).map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                          {contact.tags.length > 2 && <Badge variant="outline" className="text-xs">+{contact.tags.length - 2}</Badge>}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
