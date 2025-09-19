import { useState } from "react";
import { ChevronDown, ChevronRight, Building, User, Mail, Phone, MapPin, Plus, Edit, Trash2, Tag, Users, Star, ChevronUp } from "lucide-react";
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
import { useTags } from "@/hooks/useTags";
import { InfiniteScrollTrigger } from "./InfiniteScrollTrigger";

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
}: StakeholderViewProps) {
  const [expandedStakeholders, setExpandedStakeholders] = useState<Set<string>>(new Set());
  const [distributionDialogOpen, setDistributionDialogOpen] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Contact | null>(null);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [localTagUpdates, setLocalTagUpdates] = useState<Record<string, string[]>>({});
  const { toast } = useToast();
  const { tagSuggestions } = useTags();

  const updateStakeholderTags = async (stakeholderId: string, tags: string[]) => {
    try {
      // Optimistically update local state
      setLocalTagUpdates(prev => ({
        ...prev,
        [stakeholderId]: tags
      }));

      const { error } = await supabase
        .from('contacts')
        .update({ tags })
        .eq('id', stakeholderId);

      if (error) throw error;

      // Refresh data from parent if callback is provided
      if (onRefresh) {
        onRefresh();
      }

      toast({
        title: "Erfolg",
        description: "Tags wurden erfolgreich aktualisiert.",
      });

      setEditingTags(null);
    } catch (error) {
      console.error('Error updating tags:', error);
      
      // Revert optimistic update on error
      setLocalTagUpdates(prev => {
        const newState = { ...prev };
        delete newState[stakeholderId];
        return newState;
      });

      toast({
        title: "Fehler",
        description: "Tags konnten nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
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

  const sortedStakeholders = [...stakeholders].sort((a, b) => {
    if (!sortColumn || !onSort) return 0;
    
    let aValue: any;
    let bValue: any;
    
    switch (sortColumn) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "contacts":
        aValue = getStakeholderContacts(a.id).length;
        bValue = getStakeholderContacts(b.id).length;
        break;
      case "tags":
        const aTags = (localTagUpdates[a.id] || (a as any).tags || []).join(" ").toLowerCase();
        const bTags = (localTagUpdates[b.id] || (b as any).tags || []).join(" ").toLowerCase();
        aValue = aTags;
        bValue = bTags;
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

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
                              updateStakeholderTags(stakeholder.id, newTags);
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
                                setEditingTags(null);
                              }}
                            >
                              Fertig
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          {stakeholderTags.length > 0 ? (
                            stakeholderTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
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
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
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
                <SortableTableHead sortKey="contacts">Kontakte</SortableTableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <SortableTableHead sortKey="tags">Tags</SortableTableHead>
                <TableHead className="w-32">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStakeholders.map((stakeholder) => {
                const stakeholderTags = localTagUpdates[stakeholder.id] || (stakeholder as any).tags || [];
                const stakeholderContacts = getStakeholderContacts(stakeholder.id);
                
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
                      <span className="text-sm">{stakeholderContacts.length} Kontakte</span>
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
                                updateStakeholderTags(stakeholder.id, newTags);
                              }}
                              placeholder="Tags..."
                              className="w-full"
                              suggestions={tagSuggestions}
                            />
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setEditingTags(null)}
                              className="h-6 px-2 text-xs"
                            >
                              Fertig
                            </Button>
                          </div>
                        ) : (
                          <>
                            {stakeholderTags.length > 0 ? (
                              stakeholderTags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
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
                  </TableRow>
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
      
      {hasMore && loadMore && (
        <InfiniteScrollTrigger
          onLoadMore={loadMore}
          loading={loadingMore}
          hasMore={hasMore}
        />
      )}
    </div>
  );
}