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
  name: string;
  role?: string;
  organization?: string;
  email?: string;
  phone?: string;
  location?: string;
  category?: "citizen" | "colleague" | "lobbyist" | "media" | "business";
  priority?: "low" | "medium" | "high";
  notes?: string;
  avatar_url?: string;
}

export default function EditContact() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contact, setContact] = useState<Contact>({
    id: "",
    name: "",
    role: "",
    organization: "",
    email: "",
    phone: "",
    location: "",
    category: "citizen",
    priority: "medium",
    notes: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (id && user) {
      fetchContact();
    }
  }, [id, user]);

  const fetchContact = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;
      if (data) {
        setContact({
          id: data.id,
          name: data.name || "",
          role: data.role || "",
          organization: data.organization || "",
          email: data.email || "",
          phone: data.phone || "",
          location: data.location || "",
          category: (data.category as Contact["category"]) || "citizen",
          priority: (data.priority as Contact["priority"]) || "medium",
          notes: data.notes || "",
          avatar_url: data.avatar_url || "",
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

      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}_${contact.id}_${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setContact({ ...contact, avatar_url: publicUrl });
      
      toast({
        title: "Erfolg",
        description: "Profilbild wurde hochgeladen.",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Fehler",
        description: "Profilbild konnte nicht hochgeladen werden.",
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
      const { error } = await supabase
        .from('contacts')
        .update({
          name: contact.name,
          role: contact.role,
          organization: contact.organization,
          email: contact.email,
          phone: contact.phone,
          location: contact.location,
          category: contact.category,
          priority: contact.priority,
          notes: contact.notes,
          avatar_url: contact.avatar_url,
        })
        .eq('id', contact.id)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Kontakt wurde aktualisiert.",
      });
      
      navigate(`/contacts/${contact.id}`);
    } catch (error) {
      console.error('Error updating contact:', error);
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht aktualisiert werden.",
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

                  <div>
                    <Label htmlFor="organization">Organisation</Label>
                    <Input
                      id="organization"
                      value={contact.organization}
                      onChange={(e) => setContact({ ...contact, organization: e.target.value })}
                    />
                  </div>

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

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notizen</Label>
                <Textarea
                  id="notes"
                  value={contact.notes}
                  onChange={(e) => setContact({ ...contact, notes: e.target.value })}
                  rows={4}
                />
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