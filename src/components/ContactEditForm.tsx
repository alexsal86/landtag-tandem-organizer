import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isValidEmail, findPotentialDuplicates, DuplicateMatch, type Contact as UtilContact } from "@/lib/utils";
import { DuplicateWarning } from "@/components/DuplicateWarning";

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

interface ContactEditFormProps {
  contact: Contact;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContactEditForm({ contact, onSuccess, onCancel }: ContactEditFormProps) {
  const [formData, setFormData] = useState(contact);
  const [organizations, setOrganizations] = useState<{ id: string; name: string; }[]>([]);
  const [useCustomOrganization, setUseCustomOrganization] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingContacts, setExistingContacts] = useState<UtilContact[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [emailValidationError, setEmailValidationError] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (contact.contact_type === "person") {
      fetchOrganizations();
    }
    fetchExistingContacts();
  }, [contact.contact_type]);

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
        .select('name')
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
        .neq('id', contact.id) // Exclude current contact being edited
        .order('name');

      if (error) throw error;
      setExistingContacts(data?.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        organization: c.organization,
      })) || []);
    } catch (error) {
      console.error('Error fetching existing contacts:', error);
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

  const checkForDuplicates = (contactData: Omit<UtilContact, 'id'>) => {
    const matches = findPotentialDuplicates(contactData, existingContacts);
    setDuplicateMatches(matches);
    return matches;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    await performUpdate();
  };

  const performUpdate = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('contacts')
        .update(formData)
        .eq('id', contact.id);

      if (error) throw error;

      toast({
        title: "Kontakt aktualisiert",
        description: `${formData.name} wurde erfolgreich aktualisiert.`,
      });

      onSuccess();
    } catch (error) {
      console.error('Error updating contact:', error);
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setShowDuplicateWarning(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Duplicate Warning */}
      {duplicateMatches.length > 0 && (
        <DuplicateWarning
          duplicates={duplicateMatches}
          onContinueAnyway={performUpdate}
          onCancel={() => {
            setShowDuplicateWarning(false);
            setDuplicateMatches([]);
          }}
          showActions={showDuplicateWarning}
        />
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Grundlegende Informationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="contact_type">Kontakttyp</Label>
            <Select value={formData.contact_type} onValueChange={(value) => handleChange('contact_type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="person">Person</SelectItem>
                <SelectItem value="organization">Organisation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.contact_type === "person" && (
            <>
              <div>
                <Label htmlFor="role">Rolle/Position</Label>
                <Input
                  id="role"
                  value={formData.role || ''}
                  onChange={(e) => handleChange('role', e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Organisation</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUseCustomOrganization(!useCustomOrganization)}
                  >
                    {useCustomOrganization ? "Aus Liste wählen" : "Eigene eingeben"}
                  </Button>
                </div>
                
                {useCustomOrganization ? (
                  <Input
                    value={formData.organization || ''}
                    onChange={(e) => handleChange('organization', e.target.value)}
                    placeholder="Organisation eingeben"
                  />
                ) : (
                  <Select
                    value={formData.organization === "" || !organizations.some(org => org.name === formData.organization) ? "none" : formData.organization || "none"}
                    onValueChange={(value) => handleChange('organization', value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Organisation auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Organisation</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.name} value={org.name}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}

          {formData.contact_type === "organization" && (
            <>
              <div>
                <Label htmlFor="legal_form">Rechtsform</Label>
                <Input
                  id="legal_form"
                  value={formData.legal_form || ''}
                  onChange={(e) => handleChange('legal_form', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="industry">Branche</Label>
                <Input
                  id="industry"
                  value={formData.industry || ''}
                  onChange={(e) => handleChange('industry', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="main_contact_person">Hauptansprechpartner</Label>
                <Input
                  id="main_contact_person"
                  value={formData.main_contact_person || ''}
                  onChange={(e) => handleChange('main_contact_person', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="business_description">Geschäftsbeschreibung</Label>
                <Textarea
                  id="business_description"
                  value={formData.business_description || ''}
                  onChange={(e) => handleChange('business_description', e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="category">Kategorie</Label>
            <Select value={formData.category || 'citizen'} onValueChange={(value) => handleChange('category', value)}>
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
            <Select value={formData.priority || 'medium'} onValueChange={(value) => handleChange('priority', value)}>
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
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Kontaktinformationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className={emailValidationError ? 'border-destructive' : ''}
              aria-invalid={emailValidationError ? 'true' : 'false'}
              aria-describedby={emailValidationError ? 'email-error' : undefined}
            />
            {emailValidationError && (
              <p id="email-error" className="text-sm text-destructive mt-1" role="alert">
                {emailValidationError}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="location">Ort</Label>
            <Input
              id="location"
              value={formData.location || ''}
              onChange={(e) => handleChange('location', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="address">Adresse</Label>
            <Textarea
              id="address"
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website || ''}
              onChange={(e) => handleChange('website', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardHeader>
          <CardTitle>Social Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input
                id="linkedin"
                value={formData.linkedin || ''}
                onChange={(e) => handleChange('linkedin', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="twitter">Twitter</Label>
              <Input
                id="twitter"
                value={formData.twitter || ''}
                onChange={(e) => handleChange('twitter', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                value={formData.facebook || ''}
                onChange={(e) => handleChange('facebook', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={formData.instagram || ''}
                onChange={(e) => handleChange('instagram', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="xing">XING</Label>
              <Input
                id="xing"
                value={formData.xing || ''}
                onChange={(e) => handleChange('xing', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle>Zusätzliche Informationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.contact_type === "person" && (
            <div>
              <Label htmlFor="birthday">Geburtstag</Label>
              <Input
                id="birthday"
                type="date"
                value={formData.birthday || ''}
                onChange={(e) => handleChange('birthday', e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="additional_info">Zusätzliche Informationen</Label>
            <Textarea
              id="additional_info"
              value={formData.additional_info || ''}
              onChange={(e) => handleChange('additional_info', e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="last_contact">Letzter Kontakt</Label>
            <Input
              id="last_contact"
              value={formData.last_contact || ''}
              onChange={(e) => handleChange('last_contact', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Wird gespeichert..." : "Speichern"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Abbrechen
        </Button>
      </div>
    </form>
  );
}