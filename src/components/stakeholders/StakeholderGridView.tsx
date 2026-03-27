import React from 'react';
import { ChevronRight, Building, User, Mail, Phone, MapPin, Plus, Edit, Tag, Users, Star, FileText, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody } from '@/components/ui/table';
import { Contact } from '@/hooks/useInfiniteContacts';
import { Link } from 'react-router-dom';
import { TopicSelector, TopicDisplay } from '@/components/topics/TopicSelector';
import { ContactDocumentRows } from '../contacts/ContactDocumentRows';
import { ContactFundingsList } from '../contacts/ContactFundingsList';

interface StakeholderGridViewProps {
  stakeholders: Contact[];
  expandedStakeholders: Set<string>;
  expandedFundings: Set<string>;
  expandedDocuments: Set<string>;
  documentCounts: Record<string, { total: number }>;
  toggleExpanded: (id: string) => void;
  toggleFundingsExpanded: (id: string) => void;
  toggleDocumentsExpanded: (id: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onContactClick: (id: string) => void;
  getStakeholderContacts: (id: string) => Contact[];
  getInitials: (name: string) => string;
  getCategoryColor: (category: Contact['category']) => string;
  editingTopics: string | null;
  setEditingTopics: (id: string | null) => void;
  getTopicIds: (id: string) => string[];
  handleTopicsLocalChange: (id: string, topicIds: string[]) => void;
  handleSaveTopics: (id: string) => void;
  handleCancelTopics: (id: string) => void;
  localTopicUpdates: Record<string, string[]>;
  onDistributionClick: (stakeholder: Contact) => void;
}

export function StakeholderGridView({
  stakeholders, expandedStakeholders, expandedFundings, expandedDocuments,
  documentCounts, toggleExpanded, toggleFundingsExpanded, toggleDocumentsExpanded,
  onToggleFavorite, onContactClick, getStakeholderContacts, getInitials, getCategoryColor,
  editingTopics, setEditingTopics, getTopicIds, handleTopicsLocalChange,
  handleSaveTopics, handleCancelTopics, localTopicUpdates, onDistributionClick,
}: StakeholderGridViewProps) {
  return (
    <>
      {stakeholders.map((stakeholder) => {
        const currentTopicIds = getTopicIds(stakeholder.id);
        const stakeholderContacts = getStakeholderContacts(stakeholder.id);
        const isExpanded = expandedStakeholders.has(stakeholder.id);
        
        return (
          <Card key={stakeholder.id} className="bg-card shadow-card border-border">
            <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(stakeholder.id)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                        <Building className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg font-semibold truncate">{stakeholder.name}</CardTitle>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onToggleFavorite(stakeholder.id, !stakeholder.is_favorite); }} className="p-1 h-6 w-6 flex-shrink-0">
                            <Star className={`h-3 w-3 transition-colors ${stakeholder.is_favorite ? 'text-yellow-500 fill-current' : 'text-muted-foreground hover:text-yellow-500'}`} />
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {stakeholder.category && <Badge variant="outline" className={getCategoryColor(stakeholder.category)}>{stakeholder.category}</Badge>}
                          {stakeholder.role && <span className="truncate">{stakeholder.role}</span>}
                          <span className="text-xs">{stakeholderContacts.length} Kontakte</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {stakeholder.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" /><span className="truncate">{stakeholder.email}</span></div>}
                    {stakeholder.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /><span>{stakeholder.phone}</span></div>}
                    {(stakeholder.address || stakeholder.location) && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /><span className="truncate">{stakeholder.address || stakeholder.location}</span></div>}
                  </div>

                  <div className="pt-2">
                    {editingTopics === stakeholder.id ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <TopicSelector selectedTopicIds={localTopicUpdates[stakeholder.id] || currentTopicIds} onTopicsChange={(ids) => handleTopicsLocalChange(stakeholder.id, ids)} placeholder="Themen hinzufügen..." />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleSaveTopics(stakeholder.id); }}>Speichern</Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleCancelTopics(stakeholder.id); }}>Abbrechen</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <TopicDisplay topicIds={currentTopicIds} maxDisplay={3} />
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingTopics(stakeholder.id); }} className="h-6 px-2 text-xs gap-1">
                          <Tag className="h-3 w-3" />Themen bearbeiten
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onContactClick(stakeholder.id); }}>
                      <Eye className="h-3 w-3" />Details
                    </Button>
                    <Link to={`/contacts/${stakeholder.id}/edit`}><Button variant="outline" size="sm" className="gap-1"><Edit className="h-3 w-3" />Bearbeiten</Button></Link>
                    <Button variant="outline" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onDistributionClick(stakeholder); }}>
                      <Users className="h-3 w-3" />Verteiler erstellen
                    </Button>
                  </div>

                  {documentCounts[stakeholder.id]?.total > 0 && (
                    <div className="pt-3 border-t mt-3" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => toggleDocumentsExpanded(stakeholder.id)} className="w-full justify-start gap-2">
                        <FileText className="h-4 w-4" /><span>Dokumente ({documentCounts[stakeholder.id]?.total})</span>
                        <ChevronRight className={`h-4 w-4 transition-transform ml-auto ${expandedDocuments.has(stakeholder.id) ? 'rotate-90' : ''}`} />
                      </Button>
                    </div>
                  )}

                  <div className="pt-3 border-t mt-3" onClick={(e) => e.stopPropagation()}>
                    <ContactFundingsList contactId={stakeholder.id} isExpanded={expandedFundings.has(stakeholder.id)} onToggle={() => toggleFundingsExpanded(stakeholder.id)} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  {expandedDocuments.has(stakeholder.id) && (
                    <div className="border-t pt-4 mb-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2"><FileText className="h-4 w-4" />Dokumente</h4>
                      <div className="overflow-x-auto"><Table><TableBody><ContactDocumentRows contactId={stakeholder.id} contactTags={[]} /></TableBody></Table></div>
                    </div>
                  )}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2"><User className="h-4 w-4" />Zugeordnete Kontakte ({stakeholderContacts.length})</h4>
                    {stakeholderContacts.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {stakeholderContacts.map((contact) => (
                          <Card key={contact.id} className="bg-muted/50 cursor-pointer hover:bg-muted transition-colors" onClick={() => onContactClick(contact.id)}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Avatar className="h-10 w-10 flex-shrink-0"><AvatarImage src={contact.avatar_url ?? undefined} /><AvatarFallback className="bg-primary text-primary-foreground text-sm">{getInitials(contact.name)}</AvatarFallback></Avatar>
                                <div className="min-w-0 flex-1">
                                  <h5 className="font-medium text-sm truncate">{contact.name}</h5>
                                  {contact.role && <p className="text-xs text-muted-foreground truncate">{contact.role}</p>}
                                  <div className="flex flex-col gap-1 mt-1">
                                    {contact.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" /><span className="truncate">{contact.email}</span></div>}
                                    {contact.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /><span>{contact.phone}</span></div>}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <User className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Keine Kontakte zugeordnet</p>
                        <Link to={`/contacts/new?organization_id=${stakeholder.id}`}><Button variant="outline" size="sm" className="mt-2 gap-2"><Plus className="h-3 w-3" />Kontakt hinzufügen</Button></Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </>
  );
}
