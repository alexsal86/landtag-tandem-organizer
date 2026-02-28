import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { ThemeProvider } from "next-themes";
import { Navigation } from "@/components/Navigation";
import { SidebarProvider } from "@/components/ui/sidebar";

interface Contact {
  id: string;
  contact_type?: "person" | "organization";
  name: string;
  role?: string;
  organization_id?: string;
  organization?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  category?: "citizen" | "colleague" | "lobbyist" | "media" | "business";
  priority?: "low" | "medium" | "high";
  notes?: string;
  industry?: string;
  main_contact_person?: string;
  avatar_url?: string;
}

export default function EditContact() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [contact, setContact] = useState<Contact>({
    id: "",
    contact_type: "person",
    name: "",
    role: "",
    organization_id: "",
    organization: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    category: "citizen",
    priority: "medium",
    notes: "",
    industry: "",
    main_contact_person: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (id && user && currentTenant) {
      fetchContact();
      fetchOrganizations();
    }
  }, [id, user, currentTenant]);

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("tenant_id", currentTenant.id)
      .eq("contact_type", "organization")
      .order("name");
    if (!error) setOrganizations(data || []);
  };

  const fetchContact = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", currentTenant.id)
      .single();
    if (error || !data) {
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht geladen werden.",
        variant: "destructive",
      });
      return;
    }

    setContact({
      id: data.id,
      contact_type:
        (data.contact_type as "person" | "organization") || "person",
      name: data.name || "",
      role: data.role || "",
      organization_id: data.organization_id || "",
      organization: data.organization || "",
      email: data.email || "",
      phone: data.phone || "",
      website: data.website || "",
      address: data.address || "",
      category: (data.category as Contact["category"]) || "citizen",
      priority: (data.priority as Contact["priority"]) || "medium",
      notes: data.notes || "",
      industry: data.industry || "",
      main_contact_person: data.main_contact_person || "",
      avatar_url: data.avatar_url || "",
    });
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file || !user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setContact({ ...contact, avatar_url: publicUrl });
      toast({ title: "Erfolg", description: "Profilbild wurde hochgeladen." });
    } catch {
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

    if (!contact.name) {
      toast({
        title: "Fehler",
        description: "Name ist ein Pflichtfeld.",
        variant: "destructive",
      });
      return;
    }

    if (!contact.email && !contact.phone) {
      toast({
        title: "Fehler",
        description:
          "Bitte hinterlegen Sie mindestens E-Mail oder Telefonnummer.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const organizationName =
        contact.contact_type === "person" && contact.organization_id
          ? organizations.find((org) => org.id === contact.organization_id)
              ?.name || null
          : null;

      const { error } = await supabase
        .from("contacts")
        .update({
          name: contact.name,
          role: contact.role || null,
          organization_id: contact.organization_id || null,
          organization: organizationName,
          email: contact.email || null,
          phone: contact.phone || null,
          website: contact.website || null,
          address: contact.address || null,
          category: contact.category,
          priority: contact.priority,
          notes: contact.notes || null,
          industry: contact.industry || null,
          main_contact_person: contact.main_contact_person || null,
          avatar_url: contact.avatar_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contact.id)
        .eq("tenant_id", currentTenant.id);

      if (error) throw error;

      toast({ title: "Erfolg", description: "Kontakt wurde aktualisiert." });
      navigate(`/contacts/${contact.id}`);
    } catch {
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  const handleSectionChange = (section: string) => {
    const path = section === "dashboard" ? "/" : `/${section}`;
    navigate(path);
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <Navigation
            activeSection="contacts"
            onSectionChange={handleSectionChange}
          />
          <main className="flex-1 p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center mb-6">
                <Button variant="outline" onClick={() => navigate("/contacts")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Zurück
                </Button>
              </div>

              <Card className="bg-card shadow-elegant border-border">
                <CardHeader>
                  <CardTitle className="text-2xl">
                    Kontakt bearbeiten (Büro-Ansicht)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={contact.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                          {getInitials(contact.name || "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Label htmlFor="avatar" className="cursor-pointer">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploading}
                            asChild
                          >
                            <span>
                              <Upload className="h-4 w-4 mr-2" />
                              {uploading
                                ? "Wird hochgeladen..."
                                : "Profilbild hochladen"}
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
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">Name *</Label>
                          <Input
                            id="name"
                            value={contact.name}
                            onChange={(e) =>
                              setContact({ ...contact, name: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="role">Rolle/Funktion</Label>
                          <Input
                            id="role"
                            value={contact.role || ""}
                            onChange={(e) =>
                              setContact({ ...contact, role: e.target.value })
                            }
                          />
                        </div>
                        {contact.contact_type === "person" && (
                          <div>
                            <Label htmlFor="organization_id">
                              Organisation
                            </Label>
                            <Select
                              value={contact.organization_id || "none"}
                              onValueChange={(value) =>
                                setContact({
                                  ...contact,
                                  organization_id:
                                    value === "none" ? "" : value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Organisation auswählen" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  Keine Zuordnung
                                </SelectItem>
                                {organizations.map((org) => (
                                  <SelectItem key={org.id} value={org.id}>
                                    {org.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {contact.contact_type === "organization" && (
                          <>
                            <div>
                              <Label htmlFor="industry">Branche</Label>
                              <Input
                                id="industry"
                                value={contact.industry || ""}
                                onChange={(e) =>
                                  setContact({
                                    ...contact,
                                    industry: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor="main_contact_person">
                                Ansprechperson
                              </Label>
                              <Input
                                id="main_contact_person"
                                value={contact.main_contact_person || ""}
                                onChange={(e) =>
                                  setContact({
                                    ...contact,
                                    main_contact_person: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </>
                        )}
                        <div>
                          <Label htmlFor="email">E-Mail</Label>
                          <Input
                            id="email"
                            type="email"
                            value={contact.email || ""}
                            onChange={(e) =>
                              setContact({ ...contact, email: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone">Telefon</Label>
                          <Input
                            id="phone"
                            value={contact.phone || ""}
                            onChange={(e) =>
                              setContact({ ...contact, phone: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="website">Website</Label>
                          <Input
                            id="website"
                            value={contact.website || ""}
                            onChange={(e) =>
                              setContact({
                                ...contact,
                                website: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="address">Adresse</Label>
                          <Input
                            id="address"
                            value={contact.address || ""}
                            onChange={(e) =>
                              setContact({
                                ...contact,
                                address: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="category">Kategorie</Label>
                          <Select
                            value={contact.category}
                            onValueChange={(value: any) =>
                              setContact({ ...contact, category: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="citizen">Bürger</SelectItem>
                              <SelectItem value="colleague">Kollege</SelectItem>
                              <SelectItem value="business">
                                Wirtschaft
                              </SelectItem>
                              <SelectItem value="media">Medien</SelectItem>
                              <SelectItem value="lobbyist">Lobbyist</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="priority">Priorität</Label>
                          <Select
                            value={contact.priority}
                            onValueChange={(value: any) =>
                              setContact({ ...contact, priority: value })
                            }
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

                    <div>
                      <Label htmlFor="notes">Notizen</Label>
                      <Textarea
                        id="notes"
                        rows={4}
                        value={contact.notes || ""}
                        onChange={(e) =>
                          setContact({ ...contact, notes: e.target.value })
                        }
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button type="submit" disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        {loading
                          ? "Wird gespeichert..."
                          : "Änderungen speichern"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(`/contacts/${contact.id}`)}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
