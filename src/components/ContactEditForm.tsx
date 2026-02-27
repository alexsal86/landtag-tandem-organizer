import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { isValidEmail, findPotentialDuplicates, DuplicateMatch, type Contact as UtilContact } from "@/lib/utils";
import { DuplicateWarning } from "@/components/DuplicateWarning";
import { TagInput } from "@/components/ui/tag-input";

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
  tags?: string[];
  business_street?: string;
  business_house_number?: string;
  business_postal_code?: string;
  business_city?: string;
  business_country?: string;
  gender?: string;
}

interface ContactEditFormProps {
  contact: Contact;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContactEditForm({ contact, onSuccess, onCancel }: ContactEditFormProps) {
  const [formData, setFormData] = useState({
    ...contact,
    tags: (contact as any).tags || [],
  });
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [useCustomOrganization, setUseCustomOrganization] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingContacts, setExistingContacts] = useState<UtilContact[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [emailValidationError, setEmailValidationError] = useState<string>('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [inheritedTags, setInheritedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  useEffect(() => {
    if (contact.contact_type === "person") {
      fetchOrganizations();
    }
    fetchExistingContacts();
    fetchAllTags();
    if (formData.organization_id) {
      fetchInheritedTags();
    }
  }, [contact.contact_type, formData.organization_id]);

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

  const fetchExistingContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, organization')
        .neq('id', contact.id)
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

  const fetchInheritedTags = async () => {
    if (!formData.organization_id) {
      setInheritedTags([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('tags')
        .eq('id', formData.organization_id)
        .single();

      if (error) throw error;
      
      setInheritedTags((data?.tags as string[]) || []);
    } catch (error) {
      console.error('Error fetching inherited tags:', error);
      setInheritedTags([]);
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
    
    console.log('Form submitted with data:', formData);
    console.log('User:', user?.id, 'Tenant:', currentTenant?.id);
    
    if (formData.email && !validateEmail(formData.email)) {
      console.log('Email validation failed');
      return;
    }

    const currentContactData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      organization: formData.organization,
    };
    
    const duplicates = checkForDuplicates(currentContactData);
    
    if (duplicates.length > 0 && !showDuplicateWarning) {
      console.log('Duplicate warning shown');
      setShowDuplicateWarning(true);
      return;
    }

    console.log('Proceeding with update');
    await performUpdate();
  };

  const performUpdate = async () => {
    // Early validation
    if (!user) {
      console.error('No user available');
      toast({
        title: "Fehler",
        description: "Benutzer nicht authentifiziert. Bitte melden Sie sich erneut an.",
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

    console.log('Starting update for contact:', contact.id, 'User:', user.id, 'Tenant:', currentTenant.id);
    
    setLoading(true);

    try {
      let updateData = { ...formData };
      
      // Handle organization creation if needed
      if (formData.contact_type === 'person' && !formData.organization_id && formData.organization && formData.organization.trim()) {
        try {
          console.log('Creating new organization:', formData.organization.trim());
          
          // Create new organization
          const { data: newOrg, error: orgError } = await supabase
            .from('contacts')
            .insert({
              user_id: user.id,
              tenant_id: currentTenant.id,
              name: formData.organization.trim(),
              contact_type: 'organization',
              category: 'business'
            })
            .select('id')
            .single();

          if (orgError) {
            console.error('Error creating organization:', orgError);
          } else if (newOrg) {
            console.log('Organization created successfully:', newOrg.id);
            updateData.organization_id = newOrg.id;
            updateData.organization = formData.organization.trim();
            // Refresh organizations list
            fetchOrganizations();
          }
        } catch (orgError) {
          console.warn('Could not create organization:', orgError);
        }
      }

      // Clear organization fields if no organization is selected
      if (formData.contact_type === 'person' && !formData.organization_id && !formData.organization) {
        updateData.organization_id = null;
        updateData.organization = null;
      }

      // Clean date fields - convert empty strings to null for database
      const cleanedUpdateData = { ...updateData };
      const dateFields = ['birthday', 'founding_date', 'contract_start_date', 'contract_end_date', 'gdpr_consent_date'];
      
      dateFields.forEach(field => {
        if (cleanedUpdateData[field] === '' || cleanedUpdateData[field] === undefined) {
          cleanedUpdateData[field] = null;
        }
      });

      const finalUpdateData = {
        ...cleanedUpdateData,
        tags: formData.tags.length > 0 ? formData.tags : null,
        tenant_id: currentTenant.id,
        updated_at: new Date().toISOString()
      };

      console.log('Updating contact with final data:', finalUpdateData);

      const { error, data } = await supabase
        .from('contacts')
        .update(finalUpdateData)
        .eq('id', contact.id)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        toast({
          title: "Fehler beim Speichern",
          description: `Fehler: ${error.message}${error.hint ? ' - ' + error.hint : ''}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Contact updated successfully:', data);

      toast({
        title: "Kontakt aktualisiert",
        description: `${formData.name} wurde erfolgreich aktualisiert.`,
      });

      // Trigger geocoding if business address exists
      const hasBusinessAddress = (formData.business_street && formData.business_street.trim() !== '') ||
                                  (formData.business_city && formData.business_city.trim() !== '');
      
      if (hasBusinessAddress) {
        supabase.functions.invoke('geocode-contact-address', {
          body: { contactId: contact.id }
        }).then(({ data, error }) => {
          if (!error && data?.coordinates) {
            console.log('✅ Geocoding erfolgreich:', data.coordinates);
          } else if (error) {
            console.error('❌ Geocoding fehlgeschlagen:', error);
          }
        });
      }

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

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'email') {
      validateEmail(value);
    }
    
    if (['name', 'email', 'phone', 'organization'].includes(field)) {
      const updatedData = { ...formData, [field]: value };
      if (updatedData.name) {
        checkForDuplicates({
          name: updatedData.name,
          email: updatedData.email,
          phone: updatedData.phone,
          organization: updatedData.organization,
        });
      }
    }

    // Fetch inherited tags when organization changes via direct field edit
    if (field === 'organization_id' && value !== formData.organization_id) {
      if (value) {
        fetchInheritedTags();
      } else {
        setInheritedTags([]);
      }
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
      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      
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

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Grundlegende Informationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={formData.avatar_url} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {getInitials(formData.name || "U")}
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
                <Label htmlFor="gender">Anrede</Label>
                <Select value={formData.gender || 'none'} onValueChange={(value) => handleChange('gender', value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Anrede wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Angabe</SelectItem>
                    <SelectItem value="m">Herr</SelectItem>
                    <SelectItem value="f">Frau</SelectItem>
                    <SelectItem value="d">Divers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="role">Rolle/Position</Label>
                <Input
                  id="role"
                  value={formData.role || ''}
                  onChange={(e) => handleChange('role', e.target.value)}
                />
              </div>

                <div>
                <Label htmlFor="organization_id">Organisation</Label>
                <div className="space-y-2">
                  <Select
                    value={formData.organization_id || 'none'}
                    onValueChange={(value) => {
                      if (value === 'create_new') {
                        // Show input for new organization
                        setFormData(prev => ({ 
                          ...prev, 
                          organization_id: '', 
                          organization: '' 
                        }));
                      } else if (value === 'none') {
                        // No organization selected - clear both fields
                        setFormData(prev => ({ 
                          ...prev, 
                          organization_id: '', 
                          organization: '' 
                        }));
                        setInheritedTags([]);
                      } else {
                        // Existing organization selected - set both ID and name
                        const selectedOrg = organizations.find(org => org.id === value);
                        setFormData(prev => ({ 
                          ...prev, 
                          organization_id: value, 
                          organization: selectedOrg?.name || '' 
                        }));
                        fetchInheritedTags();
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Organisation auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Organisation</SelectItem>
                      <SelectItem value="create_new">+ Neue Organisation erstellen</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {!formData.organization_id && (
                    <div>
                      <Label htmlFor="organization">Neue Organisation</Label>
                      <Input
                        id="organization"
                        placeholder="Name der Organisation eingeben"
                        value={formData.organization || ''}
                        onChange={(e) => handleChange('organization', e.target.value)}
                      />
                    </div>
                  )}
                </div>
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
            />
            {emailValidationError && (
              <p className="text-sm text-destructive mt-1">{emailValidationError}</p>
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

      {/* Business Address */}
      <Card>
        <CardHeader>
          <CardTitle>Geschäftsadresse</CardTitle>
          <CardDescription>
            Diese Adresse wird für die Kartenanzeige geocoded
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <Label htmlFor="business_street">Straße</Label>
              <Input
                id="business_street"
                value={formData.business_street || ''}
                onChange={(e) => handleChange('business_street', e.target.value)}
                placeholder="z.B. Hauptstraße"
              />
            </div>
            <div>
              <Label htmlFor="business_house_number">Hausnummer</Label>
              <Input
                id="business_house_number"
                value={formData.business_house_number || ''}
                onChange={(e) => handleChange('business_house_number', e.target.value)}
                placeholder="42"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="business_postal_code">PLZ</Label>
              <Input
                id="business_postal_code"
                value={formData.business_postal_code || ''}
                onChange={(e) => handleChange('business_postal_code', e.target.value)}
                placeholder="76137"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="business_city">Stadt</Label>
              <Input
                id="business_city"
                value={formData.business_city || ''}
                onChange={(e) => handleChange('business_city', e.target.value)}
                placeholder="Karlsruhe"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="business_country">Land</Label>
            <Input
              id="business_country"
              value={formData.business_country || 'Deutschland'}
              onChange={(e) => handleChange('business_country', e.target.value)}
              placeholder="Deutschland"
            />
          </div>
        </CardContent>
      </Card>

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
            <Label htmlFor="tags">Tags</Label>
            <TagInput
              tags={formData.tags}
              onTagsChange={(tags) => handleChange('tags', tags)}
              suggestions={allTags}
              showInherited={formData.contact_type === 'person' && inheritedTags.length > 0}
              inheritedTags={inheritedTags}
              placeholder="Tags hinzufügen..."
            />
            {inheritedTags.length > 0 && formData.contact_type === 'person' && (
              <p className="text-xs text-muted-foreground mt-1">
                Tags werden von der zugeordneten Organisation geerbt
              </p>
            )}
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