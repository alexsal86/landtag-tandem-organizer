import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Building, User, Mail, Phone, MapPin, Plus, Edit, Trash2, Tag, Users, Star, ChevronUp, FileText, Euro } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Contact } from "@/hooks/useInfiniteContacts";
import { Link } from "react-router-dom";
import { StakeholderToDistributionDialog } from "./StakeholderToDistributionDialog";
import { TagInput } from "@/components/ui/tag-input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTopicSuggestions } from "@/components/topics/TopicSelector";
import { useContactDocumentCounts } from "@/hooks/useContactDocumentCounts";
import { ContactDocumentRows } from "./contacts/ContactDocumentRows";
import { ContactFundingsList } from "./contacts/ContactFundingsList";

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
  stakeholders,
  contacts,
  viewMode,
  onToggleFavorite,
  onContactClick,
  onRefresh,
  hasMore = false,
  loadMore,
  loadingMore = false,
  sortColumn,
  sortDirection = "asc",
  onSort,
  onTagClick,
}: StakeholderViewProps) {
  const [expandedStakeholders, setExpandedStakeholders] = useState<Set<string>>(new Set());
  const [expandedFundings, setExpandedFundings] = useState<Set<string>>(new Set());
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());
  const [distributionDialogOpen, setDistributionDialogOpen] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Contact | null>(null);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [localTagUpdates, setLocalTagUpdates] = useState<Record<string, string[]>>({});
  const { toast } = useToast();
  const { topicSuggestions: tagSuggestions } = useTopicSuggestions();

  // Get document counts for stakeholders
  const stakeholderIds = stakeholders.map(s => s.id);
  const { counts: documentCounts } = useContactDocumentCounts(stakeholderIds);

  console.log('StakeholderView: Tag suggestions loaded:', tagSuggestions);

  const updateStakeholderTagsInDatabase = async (stakeholderId: string, tags: string[]) => {
    try {
      console.log('StakeholderView: Saving tags to database for stakeholder:', stakeholderId, 'with tags:', tags);
      
      const { error } = await supabase
        .from('contacts')
        .update({ tags })
        .eq('id', stakeholderId);

      if (error) {
        console.error('StakeholderView: Database error updating tags:', error);
        throw error;
      }

      console.log('StakeholderView: Tags saved successfully to database');

      // Clear local tag updates after successful save
      setLocalTagUpdates(prev => {
        const newState = { ...prev };
        delete newState[stakeholderId];
        return newState;
      });

      // Refresh data from parent to ensure consistency
      if (onRefresh) {
        console.log('StakeholderView: Calling onRefresh to update data');
        onRefresh();
      }

      toast({
        title: "Erfolg", 
        description: "Tags wurden erfolgreich gespeichert.",
      });

      setEditingTags(null);
    } catch (error) {
      console.error('StakeholderView: Error saving tags:', error);

      // Rollback local changes on error
      setLocalTagUpdates(prev => {
        const newState = { ...prev };
        delete newState[stakeholderId];
        return newState;
      });

      toast({
        title: "Fehler",
        description: "Tags konnten nicht gespeichert werden. Änderungen wurden rückgängig gemacht.",
        variant: "destructive",
      });
    }
  };

  const handleTagsLocalChange = (stakeholderId: string, newTags: string[]) => {
    console.log('StakeholderView: Updating local tags for stakeholder:', stakeholderId, 'with tags:', newTags);
    
    // Update local state immediately for optimistic UI updates
    setLocalTagUpdates(prev => ({
      ...prev,
      [stakeholderId]: newTags
    }));
  };

  const handleSaveTags = (stakeholderId: string) => {
    const pendingTags = localTagUpdates[stakeholderId];
    if (pendingTags) {
      updateStakeholderTagsInDatabase(stakeholderId, pendingTags);
    } else {
      setEditingTags(null);
    }
  };

  const handleCancelTags = (stakeholderId: string) => {
    console.log('StakeholderView: Canceling tag edits for stakeholder:', stakeholderId);
    
    // Remove local changes
    setLocalTagUpdates(prev => {
      const newState = { ...prev };
      delete newState[stakeholderId];
      return newState;
    });
    
    setEditingTags(null);
  };

  const toggleExpanded = (stakeholderId: string) => {
    const newExpanded = new Set(expandedStakeholders);
    if (newExpanded.has(stakeholderId)) {
      newExpanded.delete(stakeholderId);
    } else {
      newExpanded.add(stakeholderId);
    }
    setExpandedStakeholders(newExpanded);
  };

  const toggleFundingsExpanded = (stakeholderId: string) => {
    const newExpanded = new Set(expandedFundings);
    if (newExpanded.has(stakeholderId)) {
      newExpanded.delete(stakeholderId);
    } else {
      newExpanded.add(stakeholderId);
    }
    setExpandedFundings(newExpanded);
  };

  const toggleDocumentsExpanded = (stakeholderId: string) => {
    const newExpanded = new Set(expandedDocuments);
    if (newExpanded.has(stakeholderId)) {
      newExpanded.delete(stakeholderId);
    } else {
      newExpanded.add(stakeholderId);
    }
    setExpandedDocuments(newExpanded);
  };

  const getStakeholderContacts = (stakeholderId: string) => {
    const stakeholder = stakeholders.find(s => s.id === stakeholderId);
    if (!stakeholder) return [];
    
    return contacts.filter(contact => 
      contact.organization_id === stakeholderId || 
      (contact.organization && contact.organization.trim() === stakeholder.name.trim())
    );
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const getCategoryColor = (category: Contact["category"]) => {
    switch (category) {
      case "citizen":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "colleague":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "business":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "media":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "lobbyist":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Cache contact counts for performance optimization
  const contactCounts = useMemo(() => {
    const counts = new Map<string, number>();
    stakeholders.forEach(stakeholder => {
      const contactCount = getStakeholderContacts(stakeholder.id)?.length || 0;
      counts.set(stakeholder.id, contactCount);
    });
    return counts;
  }, [stakeholders, contacts]);

  const sortedStakeholders = useMemo(() => {
    const filtered = [...stakeholders];
    
    // Log for debugging duplicate issues
    console.log(`StakeholderView: Processing ${filtered.length} stakeholders for rendering, sortColumn: ${sortColumn}`);
    console.log(`First few stakeholders:`, filtered.slice(0, 3).map(s => ({ id: s.id, name: s.name, contact_type: s.contact_type })));
    
    return filtered.sort((a, b) => {
      if (!sortColumn || !onSort) return 0;
      
      let aValue: any;
      let bValue: any;
      
      switch (sortColumn) {
        case "name":
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
          break;
        case "contacts":
          // Disable client-side contact count sorting as it conflicts with server-side pagination
          return 0;
        case "tags":
          const aTags = (localTagUpdates[a.id] || (a as any).tags || []);
          const bTags = (localTagUpdates[b.id] || (b as any).tags || []);
          
          // Smart tag sorting: stakeholders with more common tags come first
          const aTagsArray = Array.isArray(aTags) ? aTags : [];
          const bTagsArray = Array.isArray(bTags) ? bTags : [];
          
          // Calculate tag similarity score
          const allTags = new Set([...aTagsArray, ...bTagsArray]);
          const aScore = aTagsArray.length;
          const bScore = bTagsArray.length;
          
          if (aScore !== bScore) {
            aValue = aScore;
            bValue = bScore;
          } else {
            aValue = aTagsArray.join(" ").toLowerCase();
            bValue = bTagsArray.join(" ").toLowerCase();
          }
          break;
        default:
          return 0;
      }
      
      // Primary sorting
      let result = 0;
      if (aValue < bValue) result = sortDirection === "asc" ? -1 : 1;
      else if (aValue > bValue) result = sortDirection === "asc" ? 1 : -1;
      
      // Secondary sort by name for stable sorting when primary values are equal
      if (result === 0) {
        const aName = a.name?.toLowerCase() || "";
        const bName = b.name?.toLowerCase() || "";
        result = aName < bName ? -1 : aName > bName ? 1 : 0;
      }
      
      return result;
    });
  }, [stakeholders, sortColumn, sortDirection, onSort, localTagUpdates]);

  const SortableTableHead = ({ children, sortKey, className = "" }: { 
    children: React.ReactNode; 
    sortKey: string; 
    className?: string; 
  }) => (
    <TableHead className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`} onClick={() => onSort?.(sortKey)}>
      <div className="flex items-center gap-2">
        {children}
        <div className="flex flex-col gap-0">
          <ChevronUp 
            className={`h-3 w-3 transition-colors ${
              sortColumn === sortKey && sortDirection === "asc" 
                ? "text-primary" 
                : "text-muted-foreground/40 hover:text-muted-foreground/60"
            }`} 
          />
          <ChevronDown 
            className={`h-3 w-3 transition-colors -mt-0.5 ${
              sortColumn === sortKey && sortDirection === "desc" 
                ? "text-primary" 
                : "text-muted-foreground/40 hover:text-muted-foreground/60"
            }`} 
          />
        </div>
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {viewMode === "grid" ? (
        // Grid View
        sortedStakeholders.map((stakeholder) => {
          const stakeholderTags = localTagUpdates[stakeholder.id] || (stakeholder as any).tags || [];
          const stakeholderContacts = getStakeholderContacts(stakeholder.id);
          const isExpanded = expandedStakeholders.has(stakeholder.id);
          
          return (
            <Card key={stakeholder.id} className="bg-card shadow-card border-border">
              <Collapsible 
                open={isExpanded} 
                onOpenChange={() => toggleExpanded(stakeholder.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                          <Building className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg font-semibold truncate">
                              {stakeholder.name}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(stakeholder.id, !stakeholder.is_favorite);
                              }}
                              className="p-1 h-6 w-6 flex-shrink-0"
                            >
                              <Star 
                                className={`h-3 w-3 transition-colors ${
                                  stakeholder.is_favorite 
                                    ? 'text-yellow-500 fill-current' 
                                    : 'text-muted-foreground hover:text-yellow-500'
                                }`} 
                              />
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            {stakeholder.category && (
                              <Badge variant="outline" className={getCategoryColor(stakeholder.category)}>
                                {stakeholder.category}
                              </Badge>
                            )}
                            {stakeholder.industry && (
                              <span className="truncate">{stakeholder.industry}</span>
                            )}
                            <span className="text-xs">
                              {stakeholderContacts.length} Kontakte
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ChevronRight 
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`} 
                        />
                      </div>
                    </div>
                    
                    {/* Contact Info Row */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {stakeholder.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{stakeholder.email}</span>
                        </div>
                      )}
                      {stakeholder.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{stakeholder.phone}</span>
                        </div>
                      )}
                      {(stakeholder.address || stakeholder.location) && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">
                            {stakeholder.address || stakeholder.location}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Tags Section */}
                    <div className="pt-2">
                      {editingTags === stakeholder.id ? (
                        <div className="space-y-2">
                           <TagInput
                            tags={stakeholderTags}
                            onTagsChange={(newTags) => {
                              console.log('StakeholderView: TagInput onChange triggered for stakeholder:', stakeholder.id, 'with tags:', newTags);
                              handleTagsLocalChange(stakeholder.id, newTags);
                            }}
                            placeholder="Tags hinzufügen..."
                            className="w-full"
                            suggestions={tagSuggestions}
                          />
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveTags(stakeholder.id);
                              }}
                            >
                              Speichern
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelTags(stakeholder.id);
                              }}
                            >
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                           {stakeholderTags.length > 0 ? (
                             stakeholderTags.map((tag) => (
                               <Badge 
                                 key={tag} 
                                 variant="secondary" 
                                 className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   onTagClick?.(tag);
                                 }}
                               >
                                 {tag}
                               </Badge>
                             ))
                           ) : (
                            <span className="text-muted-foreground text-xs">Keine Tags</span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTags(stakeholder.id);
                            }}
                            className="h-6 px-2 text-xs gap-1"
                          >
                            <Tag className="h-3 w-3" />
                            Tags bearbeiten
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Link to={`/contacts/${stakeholder.id}/edit`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Edit className="h-3 w-3" />
                          Bearbeiten
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStakeholder(stakeholder);
                          setDistributionDialogOpen(true);
                        }}
                      >
                        <Users className="h-3 w-3" />
                        Verteiler erstellen
                      </Button>
                    </div>

                    {/* Documents Section */}
                    {documentCounts[stakeholder.id]?.total > 0 && (
                      <div 
                        className="pt-3 border-t mt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDocumentsExpanded(stakeholder.id)}
                          className="w-full justify-start gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Dokumente ({documentCounts[stakeholder.id]?.total})</span>
                          <ChevronRight 
                            className={`h-4 w-4 transition-transform ml-auto ${
                              expandedDocuments.has(stakeholder.id) ? 'rotate-90' : ''
                            }`} 
                          />
                        </Button>
                      </div>
                    )}

                    {/* Fundings Section */}
                    <div 
                      className="pt-3 border-t mt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ContactFundingsList
                        contactId={stakeholder.id}
                        isExpanded={expandedFundings.has(stakeholder.id)}
                        onToggle={() => toggleFundingsExpanded(stakeholder.id)}
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {/* Expanded Documents */}
                    {expandedDocuments.has(stakeholder.id) && (
                      <div className="border-t pt-4 mb-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Dokumente
                        </h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableBody>
                              <ContactDocumentRows
                                contactId={stakeholder.id}
                                contactTags={stakeholderTags}
                              />
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Zugeordnete Kontakte ({stakeholderContacts.length})
                      </h4>
                      
                      {stakeholderContacts.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {stakeholderContacts.map((contact) => (
                            <Card key={contact.id} className="bg-muted/50 cursor-pointer hover:bg-muted transition-colors" onClick={() => onContactClick(contact.id)}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <Avatar className="h-10 w-10 flex-shrink-0">
                                    <AvatarImage src={contact.avatar_url} />
                                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                                      {getInitials(contact.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <h5 className="font-medium text-sm truncate">{contact.name}</h5>
                                    {contact.role && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {contact.role}
                                      </p>
                                    )}
                                    <div className="flex flex-col gap-1 mt-1">
                                      {contact.email && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Mail className="h-3 w-3" />
                                          <span className="truncate">{contact.email}</span>
                                        </div>
                                      )}
                                      {contact.phone && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Phone className="h-3 w-3" />
                                          <span>{contact.phone}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Keine Kontakte zugeordnet</p>
                          <Link to={`/contacts/new?organization_id=${stakeholder.id}`}>
                            <Button variant="outline" size="sm" className="mt-2 gap-2">
                              <Plus className="h-3 w-3" />
                              Kontakt hinzufügen
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })
      ) : (
        // List View
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Favorit</TableHead>
                <SortableTableHead sortKey="name">Name</SortableTableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Kontakte</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <SortableTableHead sortKey="tags">Tags</SortableTableHead>
                <TableHead className="w-32">Aktionen</TableHead>
                <TableHead className="text-center w-24">Dokumente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStakeholders.map((stakeholder) => {
                const stakeholderTags = localTagUpdates[stakeholder.id] || (stakeholder as any).tags || [];
                const stakeholderContacts = getStakeholderContacts(stakeholder.id);
                const isExpanded = expandedStakeholders.has(stakeholder.id);
                
                return (
                  <React.Fragment key={stakeholder.id}>
                    <TableRow className="hover:bg-muted/50">
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
                        <Star 
                          className={`h-3 w-3 transition-colors ${
                            stakeholder.is_favorite 
                              ? 'text-yellow-500 fill-current' 
                              : 'text-muted-foreground hover:text-yellow-500'
                          }`} 
                        />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-primary/10 rounded">
                          <Building className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{stakeholder.name}</div>
                          {stakeholder.industry && (
                            <div className="text-xs text-muted-foreground">{stakeholder.industry}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {(() => {
                          // Debug logging
                          if (stakeholder.name === 'Anne-Frank-Schule') {
                            console.log('Anne-Frank-Schule address data:', {
                              business_street: stakeholder.business_street,
                              business_house_number: stakeholder.business_house_number,
                              business_postal_code: stakeholder.business_postal_code,
                              business_city: stakeholder.business_city,
                              address: stakeholder.address,
                              location: stakeholder.location,
                              allFields: Object.keys(stakeholder)
                            });
                          }
                          
                          const businessAddress = [
                            stakeholder.business_street,
                            stakeholder.business_house_number,
                            stakeholder.business_postal_code,
                            stakeholder.business_city,
                          ].filter(Boolean).join(' ');
                          
                          const displayAddress = businessAddress || stakeholder.address || stakeholder.location;
                          
                          return displayAddress ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{displayAddress}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(stakeholder.id)}
                        className="p-1 h-auto text-sm hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight 
                            className={`h-3 w-3 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`} 
                          />
                          <span>{stakeholderContacts.length} Kontakte</span>
                        </div>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {stakeholder.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{stakeholder.email}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {stakeholder.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{stakeholder.phone}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
                         {editingTags === stakeholder.id ? (
                          <div className="space-y-1 w-full">
                            <TagInput
                              tags={stakeholderTags}
                              onTagsChange={(newTags) => {
                                handleTagsLocalChange(stakeholder.id, newTags);
                              }}
                              placeholder="Tags..."
                              className="w-full"
                              suggestions={tagSuggestions}
                            />
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                onClick={() => handleSaveTags(stakeholder.id)}
                                className="h-6 px-2 text-xs"
                              >
                                Speichern
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleCancelTags(stakeholder.id)}
                                className="h-6 px-2 text-xs"
                              >
                                Abbrechen
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                             {stakeholderTags.length > 0 ? (
                               stakeholderTags.slice(0, 2).map((tag) => (
                                 <Badge 
                                   key={tag} 
                                   variant="secondary" 
                                   className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     onTagClick?.(tag);
                                   }}
                                 >
                                   {tag}
                                 </Badge>
                               ))
                             ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                            {stakeholderTags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{stakeholderTags.length - 2}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingTags(stakeholder.id)}
                              className="h-5 w-5 p-0 ml-1"
                            >
                              <Tag className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link to={`/contacts/${stakeholder.id}/edit`}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setSelectedStakeholder(stakeholder);
                            setDistributionDialogOpen(true);
                          }}
                        >
                          <Users className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {documentCounts[stakeholder.id]?.total > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDocumentsExpanded(stakeholder.id)}
                          className="p-1 h-auto text-sm hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            <span>{documentCounts[stakeholder.id]?.total}</span>
                            <ChevronRight 
                              className={`h-3 w-3 transition-transform ${
                                expandedDocuments.has(stakeholder.id) ? 'rotate-90' : ''
                              }`} 
                            />
                          </div>
                        </Button>
                      ) : (
                        <span className="text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Collapsible document rows */}
                  {expandedDocuments.has(stakeholder.id) && (
                    <ContactDocumentRows
                      contactId={stakeholder.id}
                      contactTags={stakeholderTags}
                    />
                  )}
                  
                  {/* Collapsible contact rows */}
                  {isExpanded && stakeholderContacts.map((contact) => (
                    <TableRow 
                      key={`contact-${contact.id}`} 
                      className="bg-muted/30 border-l-4 border-l-primary/30"
                    >
                      <TableCell></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 pl-8">
                          <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded">
                            <User className="h-3 w-3 text-blue-600 dark:text-blue-300" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{contact.name}</div>
                            {contact.role && (
                              <div className="text-xs text-muted-foreground">{contact.role}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onContactClick(contact.id)}
                          className="text-xs text-primary hover:bg-primary/10"
                        >
                          Details
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {contact.email ? (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{contact.email}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {contact.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              <span>{contact.phone}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.tags && contact.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {contact.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {contact.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{contact.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
      )}

      {stakeholders.length === 0 && (
        <div className="text-center py-12">
          <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Keine Stakeholder gefunden
          </h3>
          <p className="text-muted-foreground mb-4">
            Erstellen Sie Ihren ersten Stakeholder, um Organisationen zu verwalten.
          </p>
          <Link to="/contacts/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Neuen Stakeholder erstellen
            </Button>
          </Link>
        </div>
      )}

      {/* Distribution List Dialog */}
      {selectedStakeholder && (
        <StakeholderToDistributionDialog
          isOpen={distributionDialogOpen}
          onClose={() => {
            setDistributionDialogOpen(false);
            setSelectedStakeholder(null);
          }}
          stakeholder={selectedStakeholder}
          associatedContacts={getStakeholderContacts(selectedStakeholder.id)}
        />
      )}
      
      {/* Note: InfiniteScrollTrigger is handled by ContactsView.tsx to prevent duplicates */}
    </div>
  );
}