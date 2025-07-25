import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Trash2, Mail, Phone, MapPin, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  role: string;
  organization: string;
  email: string;
  phone: string;
  location?: string;
  category: "citizen" | "colleague" | "lobbyist" | "media" | "business";
  priority: "low" | "medium" | "high";
  lastContact?: string;
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Mock data - in real app this would come from API/database
  const contacts: Contact[] = [
    {
      id: "1",
      name: "Dr. Maria Schmidt",
      role: "Bürgerin",
      organization: "Bürgerinitiative Verkehr",
      email: "m.schmidt@email.de",
      phone: "+49 123 456789",
      location: "Hauptstadt",
      category: "citizen",
      priority: "high",
      lastContact: "vor 2 Tagen",
    },
    {
      id: "2",
      name: "Thomas Weber",
      role: "MdL",
      organization: "Fraktion ABC",
      email: "t.weber@landtag.de",
      phone: "+49 123 456790",
      category: "colleague",
      priority: "medium",
      lastContact: "vor 1 Woche",
    },
    {
      id: "3",
      name: "Sarah Müller",
      role: "Geschäftsführerin",
      organization: "Wirtschaftsverband XY",
      email: "s.mueller@wirtschaft.de",
      phone: "+49 123 456791",
      location: "München",
      category: "business",
      priority: "medium",
      lastContact: "vor 3 Tagen",
    },
    {
      id: "4",
      name: "Jan Hoffmann",
      role: "Redakteur",
      organization: "Lokalzeitung",
      email: "j.hoffmann@zeitung.de",
      phone: "+49 123 456792",
      category: "media",
      priority: "low",
      lastContact: "vor 1 Monat",
    },
  ];

  const contact = contacts.find(c => c.id === id);

  if (!contact) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <Card className="bg-card shadow-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold mb-2">Kontakt nicht gefunden</h3>
              <p className="text-muted-foreground">Der angeforderte Kontakt existiert nicht.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
    }
  };

  const getPriorityLabel = (priority: Contact["priority"]) => {
    switch (priority) {
      case "high": return "Hoch";
      case "medium": return "Mittel";
      case "low": return "Niedrig";
    }
  };

  const getCategoryLabel = (category: Contact["category"]) => {
    switch (category) {
      case "citizen": return "Bürger";
      case "colleague": return "Kollege";
      case "business": return "Wirtschaft";
      case "media": return "Medien";
      case "lobbyist": return "Lobbyist";
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const handleDelete = () => {
    toast({
      title: "Kontakt gelöscht",
      description: `${contact.name} wurde erfolgreich gelöscht.`,
    });
    navigate("/");
  };

  const handleEdit = () => {
    navigate(`/contacts/${id}/edit`);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Bearbeiten
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </Button>
          </div>
        </div>

        {/* Contact Detail Card */}
        <Card className={`bg-card shadow-elegant border-border ${getPriorityColor(contact.priority)}`}>
          <CardHeader className="pb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl mb-2">{contact.name}</CardTitle>
                  <p className="text-lg text-muted-foreground mb-2">{contact.role}</p>
                  <div className="flex gap-2">
                    <Badge className={getCategoryColor(contact.category)}>
                      {getCategoryLabel(contact.category)}
                    </Badge>
                    <Badge variant="outline">
                      Priorität: {getPriorityLabel(contact.priority)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-3">Kontaktinformationen</h3>
                
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Organisation</p>
                    <p className="text-muted-foreground">{contact.organization}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">E-Mail</p>
                    <p className="text-muted-foreground">{contact.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Telefon</p>
                    <p className="text-muted-foreground">{contact.phone}</p>
                  </div>
                </div>
                
                {contact.location && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Standort</p>
                      <p className="text-muted-foreground">{contact.location}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-3">Weitere Informationen</h3>
                
                {contact.lastContact && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="font-medium mb-1">Letzter Kontakt</p>
                    <p className="text-muted-foreground">{contact.lastContact}</p>
                  </div>
                )}
                
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="font-medium mb-1">Kategorie</p>
                  <p className="text-muted-foreground">{getCategoryLabel(contact.category)}</p>
                </div>
                
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="font-medium mb-1">Priorität</p>
                  <p className="text-muted-foreground">{getPriorityLabel(contact.priority)}</p>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-4 mt-8 pt-6 border-t border-border">
              <Button className="flex-1">
                <Mail className="h-4 w-4 mr-2" />
                E-Mail senden
              </Button>
              <Button variant="outline" className="flex-1">
                <Phone className="h-4 w-4 mr-2" />
                Anrufen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}