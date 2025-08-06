import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, User, Building, Mail, Phone, MapPin, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ContactFormData {
  name: string;
  role: string;
  organization: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  birthday: string;
  website: string;
  linkedin: string;
  twitter: string;
  facebook: string;
  instagram: string;
  xing: string;
  category: "citizen" | "colleague" | "lobbyist" | "media" | "business" | "";
  priority: "low" | "medium" | "high" | "";
  notes: string;
  additional_info: string;
}

export function CreateContact() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<ContactFormData>({
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
    category: "",
    priority: "",
    notes: "",
    additional_info: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.category || !formData.priority) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um einen Kontakt zu erstellen.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name: formData.name,
          role: formData.role || null,
          organization: formData.organization || null,
          email: formData.email,
          phone: formData.phone || null,
          location: formData.location || null,
          address: formData.address || null,
          birthday: formData.birthday || null,
          website: formData.website || null,
          linkedin: formData.linkedin || null,
          twitter: formData.twitter || null,
          facebook: formData.facebook || null,
          instagram: formData.instagram || null,
          xing: formData.xing || null,
          category: formData.category as any,
          priority: formData.priority as any,
          notes: formData.notes || null,
          additional_info: formData.additional_info || null,
        });

      if (error) throw error;

      toast({
        title: "Kontakt erstellt",
        description: `${formData.name} wurde erfolgreich als neuer Kontakt hinzugefügt.`,
      });
      
      navigate("/contacts");
    } catch (error) {
      console.error('Error creating contact:', error);
      toast({
        title: "Fehler",
        description: "Der Kontakt konnte nicht erstellt werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-card border-b border-border p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/contacts")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück zu Kontakte
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Neuen Kontakt erstellen</h1>
            <p className="text-muted-foreground">
              Fügen Sie einen neuen Kontakt zu Ihrem Netzwerk hinzu
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Grunddaten */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Grunddaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        placeholder="Max Mustermann"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Position/Rolle</Label>
                      <Input
                        id="role"
                        placeholder="Geschäftsführer, Bürger, etc."
                        value={formData.role}
                        onChange={(e) => handleInputChange("role", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="organization">Organisation/Unternehmen</Label>
                    <Input
                      id="organization"
                      placeholder="Bürgerinitiative, Firma XY, etc."
                      value={formData.organization}
                      onChange={(e) => handleInputChange("organization", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Kontaktdaten */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Kontaktdaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">E-Mail-Adresse *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="max@beispiel.de"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefonnummer</Label>
                      <Input
                        id="phone"
                        placeholder="+49 123 456789"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="location">Standort</Label>
                    <Input
                      id="location"
                      placeholder="München, Berlin, etc."
                      value={formData.location}
                      onChange={(e) => handleInputChange("location", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Adresse</Label>
                    <Input
                      id="address"
                      placeholder="Musterstraße 123, 12345 Musterstadt"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="birthday">Geburtstag</Label>
                      <Input
                        id="birthday"
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => handleInputChange("birthday", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        placeholder="https://beispiel.de"
                        value={formData.website}
                        onChange={(e) => handleInputChange("website", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Social Media & Zusatzinformationen */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Social Media & Web
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="linkedin">LinkedIn</Label>
                      <Input
                        id="linkedin"
                        placeholder="https://linkedin.com/in/username"
                        value={formData.linkedin}
                        onChange={(e) => handleInputChange("linkedin", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="xing">XING</Label>
                      <Input
                        id="xing"
                        placeholder="https://xing.com/profile/username"
                        value={formData.xing}
                        onChange={(e) => handleInputChange("xing", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="twitter">Twitter/X</Label>
                      <Input
                        id="twitter"
                        placeholder="https://twitter.com/username"
                        value={formData.twitter}
                        onChange={(e) => handleInputChange("twitter", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="facebook">Facebook</Label>
                      <Input
                        id="facebook"
                        placeholder="https://facebook.com/username"
                        value={formData.facebook}
                        onChange={(e) => handleInputChange("facebook", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input
                        id="instagram"
                        placeholder="https://instagram.com/username"
                        value={formData.instagram}
                        onChange={(e) => handleInputChange("instagram", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notizen */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Zusätzliche Informationen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="notes">Notizen</Label>
                    <Textarea
                      id="notes"
                      placeholder="Wichtige Informationen, Interessen, Hintergrund..."
                      rows={4}
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="additional_info">Weitere Informationen</Label>
                    <Textarea
                      id="additional_info"
                      placeholder="Weitere wichtige Details..."
                      rows={3}
                      value={formData.additional_info}
                      onChange={(e) => handleInputChange("additional_info", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Kategorisierung */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-primary" />
                    Kategorisierung
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="category">Kategorie *</Label>
                    <Select onValueChange={(value) => handleInputChange("category", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Kategorie wählen" />
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
                    <Label htmlFor="priority">Priorität *</Label>
                    <Select onValueChange={(value) => handleInputChange("priority", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Priorität wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Hoch</SelectItem>
                        <SelectItem value="medium">Mittel</SelectItem>
                        <SelectItem value="low">Niedrig</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card className="bg-card shadow-card border-border">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Button 
                      type="submit" 
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      <Save className="h-4 w-4" />
                      {isSubmitting ? "Wird gespeichert..." : "Kontakt speichern"}
                    </Button>
                    
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate("/contacts")}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Help */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Hinweise</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <ul className="space-y-2">
                    <li>• Felder mit * sind Pflichtfelder</li>
                    <li>• Die Kategorisierung hilft bei der Organisation</li>
                    <li>• Notizen können später bearbeitet werden</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateContact;