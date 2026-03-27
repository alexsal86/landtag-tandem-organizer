import React from 'react';
import { ChevronUp, ChevronDown, Building, Mail, Phone, MapPin, Edit, Users, Star, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Contact } from '@/hooks/useInfiniteContacts';
import { Link } from 'react-router-dom';
import { TopicDisplay } from '@/components/topics/TopicSelector';

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
  children: React.ReactNode;
  sortKey: string;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (col: string) => void;
  className?: string;
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
  stakeholders,
  onToggleFavorite,
  onContactClick,
  getStakeholderContacts,
  sortColumn,
  sortDirection,
  onSort,
  getTopicIds,
  onDistributionClick,
}: StakeholderListViewProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Favorit</TableHead>
            <SortableTableHead sortKey="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort}>Name</SortableTableHead>
            <TableHead>Kontakte</TableHead>
            <TableHead>Adresse</TableHead>
            <TableHead className="w-32">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stakeholders.map((stakeholder) => {
            const stakeholderContacts = getStakeholderContacts(stakeholder.id);
            const topicIds = getTopicIds(stakeholder.id);
            const businessAddress = [stakeholder.business_street, stakeholder.business_house_number, stakeholder.business_postal_code, stakeholder.business_city]
              .filter(Boolean)
              .join(' ');
            const displayAddress = businessAddress || stakeholder.address;

            return (
              <TableRow key={stakeholder.id} className="hover:bg-muted/50">
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(stakeholder.id, !stakeholder.is_favorite);
                    }}
                    className="p-1 h-6 w-6"
                  >
                    <Star className={`h-3 w-3 transition-colors ${stakeholder.is_favorite ? 'text-yellow-500 fill-current' : 'text-muted-foreground hover:text-yellow-500'}`} />
                  </Button>
                </TableCell>
                <TableCell>
                  <HoverCard openDelay={150} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <button className="flex items-center gap-2 text-left">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <Building className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium underline-offset-2 hover:underline">{stakeholder.name}</div>
                          {stakeholder.role && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{stakeholder.role}</div>}
                        </div>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent align="start" className="w-96 space-y-3">
                      <div>
                        <p className="font-semibold">{stakeholder.name}</p>
                        {stakeholder.role && <p className="text-sm text-muted-foreground">{stakeholder.role}</p>}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">Themen</p>
                        {topicIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            <TopicDisplay topicIds={topicIds} maxDisplay={6} />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Keine Themen hinterlegt</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs uppercase text-muted-foreground">Kontakte</p>
                        {stakeholderContacts.length > 0 ? (
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {stakeholderContacts.slice(0, 5).map((contact) => (
                              <div key={contact.id} className="text-sm flex items-center justify-between gap-2">
                                <span className="truncate">{contact.name}</span>
                                {contact.role && <Badge variant="outline" className="text-[10px]">{contact.role}</Badge>}
                              </div>
                            ))}
                            {stakeholderContacts.length > 5 && (
                              <p className="text-xs text-muted-foreground">+{stakeholderContacts.length - 5} weitere Kontakte</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Keine Kontakte zugeordnet</p>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell>
                  <div className="text-sm space-y-1">
                    {stakeholder.email ? (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{stakeholder.email}</span>
                      </div>
                    ) : null}
                    {stakeholder.phone ? (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{stakeholder.phone}</span>
                      </div>
                    ) : null}
                    {!stakeholder.email && !stakeholder.phone && <span className="text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    {displayAddress ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate max-w-[260px]">{displayAddress}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onContactClick(stakeholder.id)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Link to={`/contacts/${stakeholder.id}/edit`}>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <Edit className="h-3 w-3" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onDistributionClick(stakeholder)}>
                      <Users className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
