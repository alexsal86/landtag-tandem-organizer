import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, User, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { isValidEmail, findPotentialDuplicates, DuplicateMatch, type Contact } from "@/lib/utils";
import { DuplicateWarning } from "@/components/DuplicateWarning";
import { TagInput } from "@/components/ui/tag-input";

interface ContactFormData {
  contact_type: "person" | "organization";
  name: string;
  role: string;
  organization_id: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  category: "citizen" | "colleague" | "lobbyist" | "media" | "business" | "";
  priority: "low" | "medium" | "high" | "";
  notes: string;
  tags: string[];
  industry: string;
  main_contact_person: string;
  added_reason: string;
  added_at: string;
}

const ADDED_REASON_OPTIONS = [
  { value: "veranstaltung", label: "Veranstaltung" },
  { value: "empfehlung", label: "Empfehlung" },
  { value: "eigeninitiative", label: "Eigeninitiative" },
  { value: "anfrage", label: "Anfrage (eingehend)" },
  { value: "presse", label: "Pressekontakt" },
  { value: "netzwerk", label: "Netzwerk-Treffen" },
  { value: "import", label: "Import aus anderem System" },
  { value: "sonstiges", label: "Sonstiges" },
];

export function CreateContact() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [formData, setFormData] = useState<ContactFormData>({
    contact_type: "person",
    name: "",
    role: "",
    organization_id: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    category: "",
    priority: "",
    notes: "",
    tags: [],
    industry: "",
    main_contact_person: "",
    added_reason: "",
    added_at: new Date().toISOString().split("T")[0],
  });

  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [existingContacts, setExistingContacts] = useState<Contact[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [emailValidationError, setEmailValidationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchOrganizations();
      fetchExistingContacts();
      fetchAllTags();
    }
  }, [user]);

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("contact_type", "organization")
      .order("name");

    if (!error) setOrganizations(data || []);
  };

  const fetchExistingContacts = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, email, phone, organization")
      .order("name");

    if (error) return;

    setExistingContacts(
      data?.map((contact) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        organization: contact.organization,
      })) || []
    );
  };

  const fetchAllTags = async () => {
    const { data, error } = await supabase.from("contacts").select("tags").not("tags", "is", null);
    if (error) return;

    const tagsSet = new Set<string>();
    data?.forEach((contact) => {
      if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags.forEach((tag: string) => tagsSet.add(tag));
      }
    });
    setAllTags(Array.from(tagsSet));
  };

  const validateEmail = (email: string) => {
    if (!email) {
      setEmailValidationError("");
      return true;
    }

    if (!isValidEmail(email)) {
      setEmailValidationError("Bitte geben Sie eine gültige E-Mail-Adresse ein (z.B. name@beispiel.de)");
      return false;
    }

    setEmailValidationError("");
    return true;
  };

  const checkForDuplicates = (contactData: Omit<Contact, "id">) => {
    const matches = findPotentialDuplicates(contactData, existingContacts);
    setDuplicateMatches(matches);
    return matches;
  };

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === "email") validateEmail(value);

    if (["name", "email", "phone"].includes(field)) {
      const updatedData = { ...formData, [field]: value };
      if (updatedData.name) {
        checkForDuplicates({
          name: updatedData.name,
          email: updatedData.email,
          phone: updatedData.phone,
          organization: undefined,
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requiredFields: Array<keyof ContactFormData> = ["name", "category", "priority"];
    const missingFields = requiredFields.filter((field) => !formData[field]);

    if (missingFields.length > 0) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.email && !formData.phone) {
      toast({
        title: "Fehlende Kontaktdaten",
        description: "Bitte hinterlegen Sie mindestens E-Mail oder Telefonnummer.",
        variant: "destructive",
      });
      return;
    }

    if (formData.email && !validateEmail(formData.email)) return;

    const duplicates = checkForDuplicates({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      organization: undefined,
    });

    if (duplicates.length > 0 && !showDuplicateWarning) {
      setShowDuplicateWarning(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    if (!user || !currentTenant) return;

    setIsSubmitting(true);

    try {
      const organizationName =
        formData.contact_type === "person" && formData.organization_id
          ? organizations.find((org) => org.id === formData.organization_id)?.name || null
          : null;

      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        tenant_id: currentTenant.id,
        contact_type: formData.contact_type,
        name: formData.name,
        role: formData.role || null,
        organization_id: formData.organization_id || null,
        organization: organizationName,
        email: formData.email || null,
        phone: formData.phone || null,
        website: formData.website || null,
        address: formData.address || null,
        category: formData.category as any,
        priority: formData.priority as any,
        notes: formData.notes || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        industry: formData.industry || null,
        main_contact_person: formData.main_contact_person || null,
        added_reason: formData.added_reason || null,
        added_at: formData.added_at || new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Kontakt erstellt",
        description: `${formData.name} wurde erfolgreich hinzugefügt.`,
      });
      navigate("/contacts");
    } catch {
      toast({
        title: "Fehler",
        description: "Der Kontakt konnte nicht erstellt werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowDuplicateWarning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="bg-card border-b border-border p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/contacts")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Zurück zu Kontakten
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Neuen Kontakt anlegen</h1>
          <p className="text-muted-foreground">Vereinfachte Erfassung für den Büroalltag.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Grunddaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Kontakt-Typ *</Label>
                    <Select
                      onValueChange={(value: "person" | "organization") =>
                        setFormData((prev) => ({ ...prev, contact_type: value, organization_id: "" }))
                      }
                      defaultValue="person"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kontakt-Typ wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="person">Person</SelectItem>
                        <SelectItem value="organization">Organisation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="role">Rolle/Funktion</Label>
                      <Input id="role" value={formData.role} onChange={(e) => handleInputChange("role", e.target.value)} />
                    </div>
                  </div>

                  {formData.contact_type === "person" && (
                    <div>
                      <Label htmlFor="organization_id">Organisation (optional)</Label>
                      <Select onValueChange={(value) => handleInputChange("organization_id", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Organisation auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.contact_type === "organization" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="industry">Branche</Label>
                        <Input id="industry" value={formData.industry} onChange={(e) => handleInputChange("industry", e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="main_contact_person">Ansprechperson</Label>
                        <Input
                          id="main_contact_person"
                          value={formData.main_contact_person}
                          onChange={(e) => handleInputChange("main_contact_person", e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">E-Mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className={emailValidationError ? "border-destructive" : ""}
                      />
                      {emailValidationError && <p className="text-sm text-destructive mt-1">{emailValidationError}</p>}
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefon</Label>
                      <Input id="phone" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Mindestens E-Mail oder Telefon ist erforderlich.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" value={formData.website} onChange={(e) => handleInputChange("website", e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="address">Adresse</Label>
                      <Input id="address" value={formData.address} onChange={(e) => handleInputChange("address", e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notizen</Label>
                    <Textarea id="notes" rows={4} value={formData.notes} onChange={(e) => handleInputChange("notes", e.target.value)} />
                  </div>

                  <div>
                    <Label>Tags</Label>
                    <TagInput
                      tags={formData.tags}
                      onTagsChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
                      suggestions={allTags}
                      placeholder="Tags hinzufügen..."
                    />
                  </div>
                </CardContent>
              </Card>

              {duplicateMatches.length > 0 && (
                <DuplicateWarning
                  duplicates={duplicateMatches}
                  onContinueAnyway={performSave}
                  onCancel={() => {
                    setShowDuplicateWarning(false);
                    setDuplicateMatches([]);
                  }}
                  showActions={showDuplicateWarning}
                />
              )}
            </div>

            <div className="space-y-6">
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

                  <div>
                    <Label htmlFor="added_reason">Grund der Aufnahme</Label>
                    <Select onValueChange={(value) => handleInputChange("added_reason", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Grund auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {ADDED_REASON_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="added_at">Aufnahmedatum</Label>
                    <Input id="added_at" type="date" value={formData.added_at} onChange={(e) => handleInputChange("added_at", e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card shadow-card border-border">
                <CardContent className="pt-6 space-y-3">
                  <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                    <Save className="h-4 w-4" />
                    {isSubmitting ? "Wird gespeichert..." : "Kontakt speichern"}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/contacts")}>
                    Abbrechen
                  </Button>
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
