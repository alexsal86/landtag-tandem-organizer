import { useState, useEffect } from "react";
import { Edit2, Trash2, Mail, Phone, MapPin, Building, User, Calendar, Globe, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ContactEditForm } from "./ContactEditForm";

interface Contact {
  id: string;
  contact_type: "person" | "organization";
  name: string;
  role?: string;
  organization?: string;
  organization_id?: string;
  email?: string;
  phone?: string;
  location?: string;
  address?: string;
  birthday?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  xing?: string;
  category?: "citizen" | "colleague" | "lobbyist" | "media" | "business";
  priority?: "low" | "medium" | "high";
  last_contact?: string;
  avatar_url?: string;
  notes?: string;
  additional_info?: string;
  legal_form?: string;
  industry?: string;
  main_contact_person?: string;
  business_description?: string;
}

interface ContactDetailSheetProps {
  contactId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onContactUpdate: () => void;
}

export function ContactDetailSheet({ contactId, isOpen, onClose, onContactUpdate }: ContactDetailSheetProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (contactId && isOpen) {
      fetchContact();
    }
  }, [contactId, isOpen]);

  const fetchContact = async () => {
    if (!contactId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (error) throw error;

      setContact({
        ...data,
        contact_type: data.contact_type as "person" | "organization",
        category: data.category as Contact["category"],
        priority: data.priority as Contact["priority"],
      });
    } catch (error) {
      console.error('Error fetching contact:', error);
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!contact) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contact.id);

      if (error) throw error;

      toast({
        title: "Kontakt gelöscht",
        description: `${contact.name} wurde erfolgreich gelöscht.`,
      });

      onContactUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
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

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
    fetchContact();
    onContactUpdate();
  };

  if (isEditing && contact) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Kontakt bearbeiten</SheetTitle>
            <SheetDescription>
              Bearbeiten Sie die Informationen für {contact.name}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ContactEditForm
              contact={contact}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[540px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : contact ? (
          <div className="space-y-6">
            <SheetHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={contact.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <SheetTitle className="text-2xl">{contact.name}</SheetTitle>
                    <Badge variant="outline">
                      {contact.contact_type === "organization" ? "Organisation" : "Person"}
                    </Badge>
                  </div>
                  <SheetDescription className="text-base">
                    {contact.contact_type === "organization" 
                      ? `${contact.legal_form ? contact.legal_form + " • " : ""}${contact.industry || contact.main_contact_person || ""}`
                      : contact.role
                    }
                  </SheetDescription>
                  <Badge className={`mt-2 ${getCategoryColor(contact.category)}`}>
                    {contact.category === "citizen" && "Bürger"}
                    {contact.category === "colleague" && "Kollege"}
                    {contact.category === "business" && "Wirtschaft"}
                    {contact.category === "media" && "Medien"}
                    {contact.category === "lobbyist" && "Lobbyist"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => setIsEditing(true)} className="flex-1">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </Button>
              </div>
            </SheetHeader>

            <Separator />

            {/* Contact Information */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <h3 className="font-semibold text-lg">Kontaktinformationen</h3>
                
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">E-Mail</p>
                      <p className="text-muted-foreground">{contact.email}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Telefon</p>
                      <p className="text-muted-foreground">{contact.phone}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {contact.contact_type === "person" && contact.organization && (
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Organisation</p>
                      <p className="text-muted-foreground">{contact.organization}</p>
                    </div>
                  </div>
                )}

                {(contact.location || contact.address) && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Adresse</p>
                      <p className="text-muted-foreground">
                        {contact.address || contact.location}
                      </p>
                    </div>
                  </div>
                )}

                {contact.birthday && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Geburtstag</p>
                      <p className="text-muted-foreground">{contact.birthday}</p>
                    </div>
                  </div>
                )}

                {contact.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Website</p>
                      <p className="text-muted-foreground">{contact.website}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={contact.website} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Social Media */}
            {(contact.linkedin || contact.twitter || contact.facebook || contact.instagram || contact.xing) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-4">Social Media</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {contact.linkedin && (
                      <div>
                        <p className="font-medium">LinkedIn</p>
                        <p className="text-muted-foreground text-sm">{contact.linkedin}</p>
                      </div>
                    )}
                    {contact.twitter && (
                      <div>
                        <p className="font-medium">Twitter</p>
                        <p className="text-muted-foreground text-sm">{contact.twitter}</p>
                      </div>
                    )}
                    {contact.facebook && (
                      <div>
                        <p className="font-medium">Facebook</p>
                        <p className="text-muted-foreground text-sm">{contact.facebook}</p>
                      </div>
                    )}
                    {contact.instagram && (
                      <div>
                        <p className="font-medium">Instagram</p>
                        <p className="text-muted-foreground text-sm">{contact.instagram}</p>
                      </div>
                    )}
                    {contact.xing && (
                      <div>
                        <p className="font-medium">XING</p>
                        <p className="text-muted-foreground text-sm">{contact.xing}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Organization Details */}
            {contact.contact_type === "organization" && contact.business_description && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-2">Geschäftsbeschreibung</h3>
                  <p className="text-muted-foreground">{contact.business_description}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {contact.notes && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-2">Notizen</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Additional Info */}
            {contact.additional_info && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-2">Zusätzliche Informationen</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{contact.additional_info}</p>
                </CardContent>
              </Card>
            )}

            {contact.last_contact && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-2">Letzter Kontakt</h3>
                  <p className="text-muted-foreground">{contact.last_contact}</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Kontakt nicht gefunden</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}