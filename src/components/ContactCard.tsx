import React from "react";
import { Mail, Phone, MapPin, Building, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Contact } from "@/hooks/useInfiniteContacts";

interface ContactCardProps {
  contact: Contact;
  onContactClick: (contactId: string) => void;
  onToggleFavorite: (contactId: string, isFavorite: boolean) => void;
}

export const ContactCard = React.memo(({ contact, onContactClick, onToggleFavorite }: ContactCardProps) => {
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

  const getPriorityColor = (priority: Contact["priority"]) => {
    switch (priority) {
      case "high":
        return "border-l-4 border-l-destructive";
      case "medium":
        return "border-l-4 border-l-government-gold";
      case "low":
        return "border-l-4 border-l-muted-foreground";
      default:
        return "";
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  return (
    <Card
      className={`bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300 cursor-pointer ${getPriorityColor(
        contact.priority
      )}`}
      onClick={() => onContactClick(contact.id)}
      role="button"
      tabIndex={0}
      aria-label={`Kontakt ${contact.name} öffnen`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onContactClick(contact.id);
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={contact.avatar_url} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-lg mb-0">{contact.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {contact.contact_type === "organization" 
                  ? `${contact.legal_form ? contact.legal_form + " • " : ""}${contact.industry || contact.main_contact_person || ""}`
                  : contact.role
                }
              </p>                       
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(contact.id, !contact.is_favorite);
            }}
            className="p-2"
            aria-label={contact.is_favorite ? `${contact.name} aus Favoriten entfernen` : `${contact.name} zu Favoriten hinzufügen`}
          >
            <Star 
              className={`h-4 w-4 transition-colors ${
                contact.is_favorite 
                  ? 'text-yellow-500 fill-current' 
                  : 'text-muted-foreground hover:text-yellow-500'
              }`} 
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge className={getCategoryColor(contact.category)}>
              {contact.category === "citizen" && "Bürger"}
              {contact.category === "colleague" && "Kollege"}
              {contact.category === "business" && "Wirtschaft"}
              {contact.category === "media" && "Medien"}
              {contact.category === "lobbyist" && "Lobbyist"}
            </Badge>
            {contact.priority && (
              <Badge 
                variant={contact.priority === 'high' ? 'destructive' : contact.priority === 'medium' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {contact.priority === 'high' ? 'Hoch' : contact.priority === 'medium' ? 'Mittel' : 'Niedrig'}
              </Badge>
            )}
          </div>
          
          {contact.contact_type === "person" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building className="h-4 w-4" />
              <span className="truncate">{contact.organization || "Keine Organisation"}</span>
            </div>
          ) : contact.business_description ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building className="h-4 w-4" />
              <span className="truncate">{contact.business_description}</span>
            </div>
          ) : null}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="truncate">{contact.email || "Keine E-Mail"}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{contact.phone || "Keine Telefonnummer"}</span>
          </div>
          
          {contact.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{contact.location}</span>
            </div>
          )}

          {contact.address && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{contact.address}</span>
            </div>
          )}
          
          {contact.last_contact && (
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Letzter Kontakt: {contact.last_contact}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            disabled={!contact.email}
            onClick={(e) => {
              e.stopPropagation();
              if (contact.email) {
                window.location.href = `mailto:${contact.email}`;
              }
            }}
          >
            <Mail className="h-4 w-4 mr-1" />
            E-Mail
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            disabled={!contact.phone}
            onClick={(e) => {
              e.stopPropagation();
              if (contact.phone) {
                window.location.href = `tel:${contact.phone}`;
              }
            }}
          >
            <Phone className="h-4 w-4 mr-1" />
            Anrufen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

ContactCard.displayName = "ContactCard";