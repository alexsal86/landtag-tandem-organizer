import { useState, useEffect } from "react";
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
import { useTenant } from "@/hooks/useTenant";
import { isValidEmail, findPotentialDuplicates, DuplicateMatch, type Contact } from "@/lib/utils";
import { DuplicateWarning } from "@/components/DuplicateWarning";
import { TagInput } from "@/components/ui/tag-input";

interface ContactFormData {
  contact_type: "person" | "organization";
  name: string;
  role: string;
  organization: string;
  organization_id: string;
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
  // Organization-specific fields
  legal_form: string;
  tax_number: string;
  vat_number: string;
  industry: string;
  company_size: string;
  business_description: string;
  main_contact_person: string;
  billing_address: string;
  iban: string;
  tags: string[];
  customer_number: string;
  supplier_number: string;
  commercial_register_number: string;
  business_street: string;
  business_house_number: string;
  business_postal_code: string;
  business_city: string;
  business_country: string;
}

export function CreateContact() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  const [formData, setFormData] = useState<ContactFormData>({
    contact_type: "person",
    name: "",
    role: "",
    organization: "",
    organization_id: "",
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
    legal_form: "",
    tax_number: "",
    vat_number: "",
    industry: "",
    company_size: "",
    business_description: "",
    main_contact_person: "",
    billing_address: "",
    iban: "",
    tags: [],
    customer_number: "",
    supplier_number: "",
    commercial_register_number: "",
    business_street: "",
    business_house_number: "",
    business_postal_code: "",
    business_city: "",
    business_country: "Deutschland",
  });

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [existingContacts, setExistingContacts] = useState<Contact[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [emailValidationError, setEmailValidationError] = useState<string>('');
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

  const fetchExistingContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, organization')
        .order('name');

      if (error) throw error;
      setExistingContacts(data?.map(contact => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        organization: contact.organization,
      })) || []);
    } catch (error) {
      console.error('Error fetching existing contacts:', error);
    }
  };

  const fetchAllTags = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('tags')
        .not('tags', 'is', null);

      if (error) throw error;
      
      const tagsSet = new Set<string>();
      data?.forEach(contact => {
        if (contact.tags && Array.isArray(contact.tags)) {
          contact.tags.forEach((tag: string) => tagsSet.add(tag));
        }
      });
      setAllTags(Array.from(tagsSet));
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const validateEmail = (email: string) => {
    if (!email) {
      setEmailValidationError('');
      return true;
    }
    
    if (!isValidEmail(email)) {
      setEmailValidationError('Bitte geben Sie eine gültige E-Mail-Adresse ein (z.B. name@beispiel.de)');
      return false;
    }
    
    setEmailValidationError('');
    return true;
  };

  const checkForDuplicates = (contactData: Omit<Contact, 'id'>) => {
    const matches = findPotentialDuplicates(contactData, existingContacts);
    setDuplicateMatches(matches);
    return matches;
  };

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Validate email on change
    if (field === 'email') {
      validateEmail(value);
    }
    
    // Check for duplicates when key fields change
    if (['name', 'email', 'phone', 'organization'].includes(field)) {
      const updatedData = { ...formData, [field]: value };
      if (updatedData.name) { // Only check if name is present
        checkForDuplicates({
          name: updatedData.name,
          email: updatedData.email,
          phone: updatedData.phone,
          organization: updatedData.organization,
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const requiredFields = formData.contact_type === "organization" 
      ? ['name', 'category', 'priority']
      : ['name', 'email', 'category', 'priority'];
    
    const missingFields = requiredFields.filter(field => !formData[field as keyof ContactFormData]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }

    // Validate email if provided
    if (formData.email && !validateEmail(formData.email)) {
      return;
    }

    // Check for duplicates before saving
    const currentContactData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      organization: formData.organization,
    };
    
    const duplicates = checkForDuplicates(currentContactData);
    
    if (duplicates.length > 0 && !showDuplicateWarning) {
      setShowDuplicateWarning(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    if (!user) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um einen Kontakt zu erstellen.",
        variant: "destructive",
      });
      return;
    }

    if (!currentTenant) {
      console.error('No tenant available');
      toast({
        title: "Fehler",
        description: "Mandant nicht verfügbar. Bitte wählen Sie einen Mandanten aus.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    console.log('Creating contact:', {
      user_id: user.id,
      tenant_id: currentTenant.id,
      contact_type: formData.contact_type,
      name: formData.name
    });
    
    try {
      const { error, data } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          contact_type: formData.contact_type,
          name: formData.name,
          role: formData.role || null,
          organization: formData.organization || null,
          organization_id: formData.organization_id || null,
          email: formData.email || null,
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
          legal_form: formData.legal_form || null,
          tax_number: formData.tax_number || null,
          vat_number: formData.vat_number || null,
          industry: formData.industry || null,
          company_size: formData.company_size || null,
          business_description: formData.business_description || null,
          main_contact_person: formData.main_contact_person || null,
          billing_address: formData.billing_address || null,
          iban: formData.iban || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        tenant_id: currentTenant.id
        })
        .select('id');

      if (error) throw error;

      const insertedContactId = data?.[0]?.id;

      // Trigger geocoding if business address exists
      const hasBusinessAddress = (formData.business_street && formData.business_street.trim() !== '') ||
                                  (formData.business_city && formData.business_city.trim() !== '');
      
      if (insertedContactId && hasBusinessAddress) {
        supabase.functions.invoke('geocode-contact-address', {
          body: { contactId: insertedContactId }
        }).then(({ error }) => {
          if (error) {
            console.error('❌ Geocoding fehlgeschlagen:', error);
          } else {
            console.log('✅ Geocoding gestartet für Kontakt:', insertedContactId);
          }
        });
      }

      toast({
        title: "Kontakt erstellt",
        description: `${formData.name} wurde erfolgreich als ${formData.contact_type === 'organization' ? 'Organisation' : 'Kontakt'} hinzugefügt.`,
      });
      
      navigate("/");
    } catch (error) {
      console.error('Error creating contact:', error);
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
      {/* Header */}
      <div className="bg-card border-b border-border p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück zum Dashboard
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {formData.contact_type === 'organization' ? 'Neue Organisation erstellen' : 'Neuen Kontakt erstellen'}
            </h1>
            <p className="text-muted-foreground">
              {formData.contact_type === 'organization' 
                ? 'Fügen Sie eine neue Organisation zu Ihrem Netzwerk hinzu'
                : 'Fügen Sie einen neuen Kontakt zu Ihrem Netzwerk hinzu'
              }
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
              {/* Contact Type Selection */}
              <Card className="bg-card shadow-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Kontakt-Typ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Kontakt-Typ *</Label>
                    <Select onValueChange={(value: "person" | "organization") => {
                      setFormData(prev => ({ 
                        ...prev, 
                        contact_type: value,
                        // Reset organization-specific fields when switching to person
                        ...(value === "person" && {
                          legal_form: "",
                          tax_number: "",
                          vat_number: "",
                          industry: "",
                          company_size: "",
                          business_description: "",
                          main_contact_person: "",
                          billing_address: "",
                          iban: "",
                          tags: []
                        })
                      }));
                    }} defaultValue="person">
                      <SelectTrigger>
                        <SelectValue placeholder="Kontakt-Typ wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="person">Person</SelectItem>
                        <SelectItem value="organization">Organisation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Duplicate Warning */}
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
                      <Label htmlFor="name">
                        {formData.contact_type === 'organization' ? 'Organisationsname' : 'Name'} *
                      </Label>
                      <Input
                        id="name"
                        placeholder={formData.contact_type === 'organization' ? 'Firma XY GmbH' : 'Max Mustermann'}
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        required
                      />
                    </div>
                    {formData.contact_type === 'person' && (
                      <div>
                        <Label htmlFor="role">Position/Rolle</Label>
                        <Input
                          id="role"
                          placeholder="Geschäftsführer, Bürger, etc."
                          value={formData.role}
                          onChange={(e) => handleInputChange("role", e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  
                  {formData.contact_type === 'person' && (
                    <div>
                      <Label htmlFor="organization_id">Zugehörige Organisation</Label>
                      <Select onValueChange={(value) => handleInputChange("organization_id", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Organisation auswählen (optional)" />
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

                  {formData.contact_type === 'organization' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="legal_form">Rechtsform</Label>
                          <Input
                            id="legal_form"
                            placeholder="GmbH, AG, e.V., etc."
                            value={formData.legal_form}
                            onChange={(e) => handleInputChange("legal_form", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="industry">Branche</Label>
                          <Input
                            id="industry"
                            placeholder="IT, Automotive, Gesundheit, etc."
                            value={formData.industry}
                            onChange={(e) => handleInputChange("industry", e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="tax_number">Steuernummer</Label>
                          <Input
                            id="tax_number"
                            placeholder="12345/67890"
                            value={formData.tax_number}
                            onChange={(e) => handleInputChange("tax_number", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="vat_number">USt-IdNr.</Label>
                          <Input
                            id="vat_number"
                            placeholder="DE123456789"
                            value={formData.vat_number}
                            onChange={(e) => handleInputChange("vat_number", e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="main_contact_person">Hauptansprechpartner</Label>
                        <Input
                          id="main_contact_person"
                          placeholder="Max Mustermann"
                          value={formData.main_contact_person}
                          onChange={(e) => handleInputChange("main_contact_person", e.target.value)}
                        />
                      </div>
                    </>
                  )}
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
                      <Label htmlFor="email">
                        E-Mail-Adresse {formData.contact_type === 'person' ? '*' : ''}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="max@beispiel.de"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required={formData.contact_type === 'person'}
                        className={emailValidationError ? 'border-destructive' : ''}
                      />
                      {emailValidationError && (
                        <p className="text-sm text-destructive mt-1">{emailValidationError}</p>
                      )}
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
                    
                    {formData.contact_type === 'organization' && (
                      <div>
                        <Label htmlFor="billing_address">Rechnungsadresse</Label>
                        <Input
                          id="billing_address"
                          placeholder="Falls abweichend von Adresse"
                          value={formData.billing_address}
                          onChange={(e) => handleInputChange("billing_address", e.target.value)}
                        />
                      </div>
                    )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.contact_type === 'person' && (
                      <div>
                        <Label htmlFor="birthday">Geburtstag</Label>
                        <Input
                          id="birthday"
                          type="date"
                          value={formData.birthday}
                          onChange={(e) => handleInputChange("birthday", e.target.value)}
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        placeholder="https://beispiel.de"
                        value={formData.website}
                        onChange={(e) => handleInputChange("website", e.target.value)}
                      />
                    </div>
                    {formData.contact_type === 'organization' && (
                      <>
                        <div>
                          <Label htmlFor="company_size">Unternehmensgröße</Label>
                          <Select onValueChange={(value) => handleInputChange("company_size", value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Größe auswählen" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="startup">Startup (1-10)</SelectItem>
                              <SelectItem value="small">Klein (11-50)</SelectItem>
                              <SelectItem value="medium">Mittel (51-250)</SelectItem>
                              <SelectItem value="large">Groß (251-1000)</SelectItem>
                              <SelectItem value="enterprise">Konzern (1000+)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="iban">IBAN</Label>
                          <Input
                            id="iban"
                            placeholder="DE89 3704 0044 0532 0130 00"
                            value={formData.iban}
                            onChange={(e) => handleInputChange("iban", e.target.value)}
                          />
                        </div>
                      </>
                    )}
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
                  {formData.contact_type === 'organization' && (
                    <div>
                      <Label htmlFor="business_description">Geschäftsbeschreibung</Label>
                      <Textarea
                        id="business_description"
                        placeholder="Beschreibung der Geschäftstätigkeit..."
                        rows={3}
                        value={formData.business_description}
                        onChange={(e) => handleInputChange("business_description", e.target.value)}
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="notes">Notizen</Label>
                    <Textarea
                      id="notes"
                      placeholder={formData.contact_type === 'organization' ? "Wichtige Informationen, Besonderheiten, Zusammenarbeit..." : "Wichtige Informationen, Interessen, Hintergrund..."}
                      rows={4}
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tags">Tags</Label>
                    <TagInput
                      tags={formData.tags}
                      onTagsChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                      suggestions={allTags}
                      placeholder="Tags hinzufügen..."
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
                      {isSubmitting ? "Wird gespeichert..." : 
                        formData.contact_type === 'organization' ? "Organisation speichern" : "Kontakt speichern"}
                    </Button>
                    
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate("/")}
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
                    <li>• {formData.contact_type === 'organization' ? 'Organisationen' : 'Kontakte'} können später bearbeitet werden</li>
                    {formData.contact_type === 'person' && (
                      <li>• Personen können Organisationen zugeordnet werden</li>
                    )}
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