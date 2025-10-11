import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Contact {
  id: string;
  contact_type?: "person" | "organization";
  name: string;
  role?: string;
  organization?: string;
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
  notes?: string;
  additional_info?: string;
  avatar_url?: string;
  // Organization specific fields
  legal_form?: string;
  industry?: string;
  main_contact_person?: string;
  business_description?: string;
}

export default function EditContact() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [useCustomOrganization, setUseCustomOrganization] = useState(false);
  const [contact, setContact] = useState<Contact>({
    id: "",
    contact_type: "person",
    name: "",
    role: "",
    organization: "",
    email: "",
    phone: "",
    location: "",
    address: "",
    birthday: "",
    website: "",
    linkedin: "",
    twitter: "",
    facebook: "",
    instagram: "",
    xing: "",
    category: "citizen",
    priority: "medium",
    notes: "",
    additional_info: "",
    avatar_url: "",
    legal_form: "",
    industry: "",
    main_contact_person: "",
    business_description: "",
  });

  useEffect(() => {
    if (id && user) {
      fetchContact();
      fetchOrganizations();
    }
  }, [id, user]);

  // Effect to check organization mode when both contact and organizations are loaded
  useEffect(() => {
    if (contact.organization && organizations.length > 0) {
      const isOrganizationInList = organizations.some(org => org.name === contact.organization);
      setUseCustomOrganization(!isOrganizationInList && contact.organization !== "");
    }
  }, [contact.organization, organizations]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('contact_type', 'organization')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const fetchContact = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setContact({
          id: data.id,
          contact_type: (data.contact_type as "person" | "organization") || "person",
          name: data.name || "",
          role: data.role || "",
          organization: data.organization || "",
          email: data.email || "",
          phone: data.phone || "",
          location: data.location || "",
          address: data.address || "",
          birthday: data.birthday || "",
          website: data.website || "",
          linkedin: data.linkedin || "",
          twitter: data.twitter || "",
          facebook: data.facebook || "",
          instagram: data.instagram || "",
          xing: data.xing || "",
          category: (data.category as Contact["category"]) || "citizen",
          priority: (data.priority as Contact["priority"]) || "medium",
          notes: data.notes || "",
          additional_info: data.additional_info || "",
          avatar_url: data.avatar_url || "",
          legal_form: data.legal_form || "",
          industry: data.industry || "",
          main_contact_person: data.main_contact_person || "",
          business_description: data.business_description || "",
        });
      }
    } catch (error) {
      console.error('Error fetching contact:', error);
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Ungültiger Dateityp",
          description: "Bitte wählen Sie eine Bilddatei aus.",
          variant: "destructive",
        });
        return;
      }

      if (!user) {
        toast({
          title: "Fehler",
          description: "Benutzer nicht authentifiziert.",
          variant: "destructive",
        });
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      console.log('Uploading avatar to:', filePath);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('Avatar uploaded successfully:', publicUrl);
      setContact({ ...contact, avatar_url: publicUrl });
      
      toast({
        title: "Erfolg",
        description: "Profilbild wurde hochgeladen.",
      });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Fehler",
        description: `Profilbild konnte nicht hochgeladen werden: ${error.message || 'Unbekannter Fehler'}`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sanitize date fields - convert empty strings to null
      const sanitizedContact = {
        name: contact.name,
        role: contact.role,
        organization: contact.organization,
        email: contact.email,
        phone: contact.phone,
        location: contact.location,
        address: contact.address,
        birthday: contact.birthday && contact.birthday.trim() !== '' ? contact.birthday : null,
        website: contact.website,
        linkedin: contact.linkedin,
        twitter: contact.twitter,
        facebook: contact.facebook,
        instagram: contact.instagram,
        xing: contact.xing,
        category: contact.category,
        priority: contact.priority,
        notes: contact.notes,
        additional_info: contact.additional_info,
        avatar_url: contact.avatar_url,
        legal_form: contact.legal_form,
        industry: contact.industry,
        main_contact_person: contact.main_contact_person,
        business_description: contact.business_description,
        updated_at: new Date().toISOString()
      };

      console.log('Updating contact with sanitized data:', sanitizedContact);

      const { error } = await supabase
        .from('contacts')
        .update(sanitizedContact)
        .eq('id', contact.id);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      toast({
        title: "Erfolg",
        description: "Kontakt wurde aktualisiert.",
      });
      
      // Trigger geocoding if address exists (old address field)
      if (contact.address && contact.address.trim() !== '') {
        supabase.functions.invoke('geocode-contact-address', {
          body: { contactId: contact.id }
        }).then(({ error }) => {
          if (error) {
            console.error('❌ Geocoding fehlgeschlagen:', error);
          } else {
            console.log('✅ Geocoding gestartet für Kontakt:', contact.id);
          }
        });
      }
      
      navigate(`/contacts/${contact.id}`);
    } catch (error: any) {
      console.error('Error updating contact:', error);
      toast({
        title: "Fehler",
        description: `Kontakt konnte nicht aktualisiert werden: ${error.message || 'Unbekannter Fehler'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/contacts/${id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
        </div>

        <Card className="bg-card shadow-elegant border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Kontakt bearbeiten</CardTitle>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={contact.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {getInitials(contact.name || "U")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Label htmlFor="avatar" className="cursor-pointer">
                    <Button type="button" variant="outline" disabled={uploading} asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? "Wird hochgeladen..." : "Profilbild hochladen"}
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={contact.name}
                      onChange={(e) => setContact({ ...contact, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="role">Rolle</Label>
                    <Input
                      id="role"
                      value={contact.role}
                      onChange={(e) => setContact({ ...contact, role: e.target.value })}
                    />
                  </div>

                  {contact.contact_type === "person" && (
                    <div>
                      <Label htmlFor="organization">Organisation</Label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={!useCustomOrganization ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setUseCustomOrganization(false);
                              setContact({ ...contact, organization: "" });
                            }}
                          >
                            Aus Liste wählen
                          </Button>
                          <Button
                            type="button"
                            variant={useCustomOrganization ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setUseCustomOrganization(true);
                              setContact({ ...contact, organization: "" });
                            }}
                          >
                            Eigene eingeben
                          </Button>
                        </div>
                        
                        {!useCustomOrganization ? (
                          <Select
                            value={contact.organization === "" ? "none" : contact.organization}
                            onValueChange={(value) => setContact({ 
                              ...contact, 
                              organization: value === "none" ? "" : value 
                            })}
                          >
                            <SelectTrigger className="bg-background border-input">
                              <SelectValue placeholder="Organisation auswählen..." />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border shadow-lg z-50">
                              <SelectItem value="none">Keine Organisation</SelectItem>
                              {organizations.map((org) => (
                                <SelectItem key={org.id} value={org.name}>
                                  {org.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="organization"
                            placeholder="Organisation eingeben..."
                            value={contact.organization}
                            onChange={(e) => setContact({ ...contact, organization: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {contact.contact_type === "organization" && (
                    <>
                      <div>
                        <Label htmlFor="legal_form">Rechtsform</Label>
                        <Input
                          id="legal_form"
                          value={contact.legal_form || ""}
                          onChange={(e) => setContact({ ...contact, legal_form: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="industry">Branche</Label>
                        <Input
                          id="industry"
                          value={contact.industry || ""}
                          onChange={(e) => setContact({ ...contact, industry: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="main_contact_person">Hauptansprechpartner</Label>
                        <Input
                          id="main_contact_person"
                          value={contact.main_contact_person || ""}
                          onChange={(e) => setContact({ ...contact, main_contact_person: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    />
                  </div>
                </div>

                {/* Contact Details */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="location">Standort</Label>
                    <Input
                      id="location"
                      value={contact.location}
                      onChange={(e) => setContact({ ...contact, location: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Adresse</Label>
                    <Input
                      id="address"
                      value={contact.address}
                      onChange={(e) => setContact({ ...contact, address: e.target.value })}
                    />
                  </div>

                  {contact.contact_type === "person" && (
                    <div>
                      <Label htmlFor="birthday">Geburtstag</Label>
                      <Input
                        id="birthday"
                        type="date"
                        value={contact.birthday}
                        onChange={(e) => setContact({ ...contact, birthday: e.target.value })}
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={contact.website}
                      onChange={(e) => setContact({ ...contact, website: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Kategorie</Label>
                    <Select
                      value={contact.category}
                      onValueChange={(value: any) => setContact({ ...contact, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="citizen">Bürger</SelectItem>
                        <SelectItem value="colleague">Kollege</SelectItem>
                        <SelectItem value="business">Wirtschaft</SelectItem>
                        <SelectItem value="media">Medien</SelectItem>
                        <SelectItem value="lobbyist">Lobbyist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priorität</Label>
                    <Select
                      value={contact.priority}
                      onValueChange={(value: any) => setContact({ ...contact, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Niedrig</SelectItem>
                        <SelectItem value="medium">Mittel</SelectItem>
                        <SelectItem value="high">Hoch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Social Media & Web</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      value={contact.linkedin}
                      onChange={(e) => setContact({ ...contact, linkedin: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="xing">XING</Label>
                    <Input
                      id="xing"
                      value={contact.xing}
                      onChange={(e) => setContact({ ...contact, xing: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="twitter">Twitter/X</Label>
                    <Input
                      id="twitter"
                      value={contact.twitter}
                      onChange={(e) => setContact({ ...contact, twitter: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input
                      id="facebook"
                      value={contact.facebook}
                      onChange={(e) => setContact({ ...contact, facebook: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      value={contact.instagram}
                      onChange={(e) => setContact({ ...contact, instagram: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notes">Notizen</Label>
                  <Textarea
                    id="notes"
                    value={contact.notes}
                    onChange={(e) => setContact({ ...contact, notes: e.target.value })}
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="additional_info">Weitere Informationen</Label>
                  <Textarea
                    id="additional_info"
                    value={contact.additional_info}
                    onChange={(e) => setContact({ ...contact, additional_info: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <Button type="submit" disabled={loading} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Wird gespeichert..." : "Speichern"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate(`/contacts/${id}`)}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}