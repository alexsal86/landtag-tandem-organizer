import { useState } from "react";
import { ChevronDown, ChevronRight, Building, User, Mail, Phone, MapPin, Plus, Edit, Trash2, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Contact } from "@/hooks/useInfiniteContacts";
import { Link } from "react-router-dom";

interface StakeholderViewProps {
  stakeholders: Contact[];
  contacts: Contact[];
  onToggleFavorite: (contactId: string, isFavorite: boolean) => void;
  onContactClick: (contactId: string) => void;
}

export function StakeholderView({
  stakeholders,
  contacts,
  onToggleFavorite,
  onContactClick,
}: StakeholderViewProps) {
  const [expandedStakeholders, setExpandedStakeholders] = useState<Set<string>>(new Set());

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
    // Find the stakeholder to get its name
    const stakeholder = stakeholders.find(s => s.id === stakeholderId);
    if (!stakeholder) return [];
    
    // Filter contacts by organization_id OR organization name match
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

  return (
    <div className="space-y-4">
      {stakeholders.map((stakeholder) => {
        const associatedContacts = getStakeholderContacts(stakeholder.id);
        const isExpanded = expandedStakeholders.has(stakeholder.id);

        return (
          <Card key={stakeholder.id} className="bg-card shadow-card border-border">
            <Collapsible>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={stakeholder.avatar_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Building className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{stakeholder.name}</CardTitle>
                        {stakeholder.is_favorite && (
                          <Badge variant="outline" className="text-xs">
                            ⭐ Favorit
                          </Badge>
                        )}
                        {stakeholder.category && (
                          <Badge className={`text-xs ${getCategoryColor(stakeholder.category)}`}>
                            {stakeholder.category}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        {stakeholder.industry && (
                          <div className="flex items-center gap-2">
                            <Tag className="h-3 w-3" />
                            <span>{stakeholder.industry}</span>
                          </div>
                        )}
                        {stakeholder.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            <span>{stakeholder.email}</span>
                          </div>
                        )}
                        {stakeholder.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <span>{stakeholder.phone}</span>
                          </div>
                        )}
                        {stakeholder.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            <span>{stakeholder.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {associatedContacts.length} Kontakt{associatedContacts.length !== 1 ? 'e' : ''}
                    </Badge>
                    
                    <Link to={`/contacts/${stakeholder.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>

                    {associatedContacts.length > 0 && (
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(stakeholder.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>
                </div>

                {stakeholder.business_description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {stakeholder.business_description}
                  </p>
                )}
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Zugeordnete Kontakte ({associatedContacts.length})
                    </h4>
                    
                    {associatedContacts.length > 0 ? (
                      <div className="space-y-2">
                        {associatedContacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center justify-between p-3 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => onContactClick(contact.id)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={contact.avatar_url} />
                                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                                  {getInitials(contact.name)}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div>
                                <div className="font-medium text-sm">{contact.name}</div>
                                {contact.role && (
                                  <div className="text-xs text-muted-foreground">{contact.role}</div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {contact.email && (
                                <Mail className="h-3 w-3 text-muted-foreground" />
                              )}
                              {contact.phone && (
                                <Phone className="h-3 w-3 text-muted-foreground" />
                              )}
                              {contact.category && (
                                <Badge className={`text-xs ${getCategoryColor(contact.category)}`}>
                                  {contact.category}
                                </Badge>
                              )}
                            </div>
                          </div>
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
      })}

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
    </div>
  );
}