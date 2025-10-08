import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Upload, Download, FileText, Check, X, AlertCircle, Settings2 } from "lucide-react";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import VCF from 'vcf';
import { isValidEmail } from "@/lib/utils";
import { findPotentialDuplicates } from "@/utils/duplicateDetection";
import { ContactImportDuplicateDialog } from "@/components/contacts/ContactImportDuplicateDialog";
import type { Contact, DuplicateMatch } from "@/utils/duplicateDetection";

interface ImportData {
  [key: string]: string;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

const FIELD_MAPPINGS = {
  // German field names to database columns
  'Nachname': 'last_name',
  'Vorname': 'first_name', 
  'Titel': 'title',
  'Firma': 'organization',
  'Abteilung': 'department',
  'Position': 'position',
  'Geschäftlich: Straße': 'business_street',
  'Geschäftlich: Hausnummer': 'business_house_number',
  'Geschäftlich: Postleitzahl': 'business_postal_code',
  'Geschäftlich: Ort': 'business_city',
  'Geschäftlich: Land': 'business_country',
  'Privat: Straße': 'private_street',
  'Privat: Hausnummer': 'private_house_number',
  'Privat: Postleitzahl': 'private_postal_code',
  'Privat: Ort': 'private_city',
  'Privat: Land': 'private_country',
  'Telefon geschäftlich': 'business_phone',
  'Telefon geschäftlich 2': 'business_phone_2',
  'Telefon (privat)': 'private_phone',
  'Telefon (privat 2)': 'private_phone_2',
  'Mobiltelefon': 'mobile_phone',
  'E-Mail 1': 'email',
  'E-Mail 2': 'email_2',
  'E-Mail 3': 'email_3',
  // English field names
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Company': 'organization',
  'Email': 'email',
  'Phone': 'phone',
  'Mobile': 'mobile_phone',
  'Address': 'address',
  'City': 'location'
};

const TARGET_FIELDS = [
  'first_name', 'last_name', 'title', 'organization', 'department', 'position',
  'business_street', 'business_house_number', 'business_postal_code', 'business_city', 'business_country',
  'private_street', 'private_house_number', 'private_postal_code', 'private_city', 'private_country',
  'business_phone', 'business_phone_2', 'private_phone', 'private_phone_2', 'mobile_phone',
  'email', 'email_2', 'email_3', 'phone', 'address', 'location', 'notes'
];

export function ContactImport() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportData[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [existingContacts, setExistingContacts] = useState<Contact[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  
  // Duplicate handling
  const [currentDuplicate, setCurrentDuplicate] = useState<{
    newContact: Contact;
    duplicates: DuplicateMatch[];
    rowIndex: number;
  } | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'ask' | 'skip' | 'import'>('ask');
  const [importQueue, setImportQueue] = useState<number[]>([]);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  // Fetch existing contacts when component mounts
  useEffect(() => {
    if (user && currentTenant) {
      fetchExistingContacts();
    }
  }, [user, currentTenant]);

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

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setData([]);
    setFieldMappings([]);
    setErrors([]);

    const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(uploadedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          setData(result.data as ImportData[]);
          autoMapFields(Object.keys(result.data[0] || {}));
          setStep('mapping');
        },
        error: (error) => {
          toast({
            title: "Fehler beim CSV-Import",
            description: error.message,
            variant: "destructive"
          });
        }
      });
    } else if (['xlsx', 'xls', 'ods'].includes(fileExtension || '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target?.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            toast({
              title: "Fehler",
              description: "Die Datei enthält keine gültigen Daten",
              variant: "destructive"
            });
            return;
          }

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];
          
          const parsedData = rows.map(row => {
            const obj: ImportData = {};
            headers.forEach((header, index) => {
              obj[header] = row[index]?.toString() || '';
            });
            return obj;
          });

          setData(parsedData);
          autoMapFields(headers);
          setStep('mapping');
        } catch (error) {
          toast({
            title: "Fehler beim Excel-Import",
            description: "Die Datei konnte nicht gelesen werden",
            variant: "destructive"
          });
        }
      };
      reader.readAsBinaryString(uploadedFile);
    } else if (fileExtension === 'vcf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const vcfText = e.target?.result as string;
          const vcards = VCF.parse(vcfText);
          
          const parsedData = vcards.map((vcard: any) => {
            const data: ImportData = {};
            
            // Name handling
            if (vcard.fn) data['Name'] = vcard.fn.valueOf();
            if (vcard.n) {
              const name = vcard.n.valueOf();
              if (Array.isArray(name)) {
                if (name[0]) data['Nachname'] = name[0];
                if (name[1]) data['Vorname'] = name[1];
                if (name[2]) data['Titel'] = name[2]; // Middle name as title
                if (name[3]) data['Titel'] = (data['Titel'] ? data['Titel'] + ' ' : '') + name[3]; // Prefix
              }
            }
            
            // Organization
            if (vcard.org) {
              const org = vcard.org.valueOf();
              if (Array.isArray(org)) {
                data['Firma'] = org[0];
                if (org[1]) data['Abteilung'] = org[1];
              } else {
                data['Firma'] = org;
              }
            }
            
            // Title/Position
            if (vcard.title) data['Position'] = vcard.title.valueOf();
            if (vcard.role) data['Position'] = vcard.role.valueOf();
            
            // Emails - handle multiple
            if (vcard.email) {
              const emails = Array.isArray(vcard.email) ? vcard.email : [vcard.email];
              emails.forEach((email: any, index: number) => {
                const emailValue = typeof email === 'object' ? email.valueOf() : email;
                if (index === 0) data['E-Mail 1'] = emailValue;
                else if (index === 1) data['E-Mail 2'] = emailValue;
                else if (index === 2) data['E-Mail 3'] = emailValue;
              });
            }
            
            // Phone numbers - handle multiple with types
            if (vcard.tel) {
              const phones = Array.isArray(vcard.tel) ? vcard.tel : [vcard.tel];
              let businessCount = 0;
              let privateCount = 0;
              
              phones.forEach((phone: any) => {
                const phoneValue = typeof phone === 'object' ? phone.valueOf() : phone;
                const phoneType = phone?.type || [];
                const types = Array.isArray(phoneType) ? phoneType : [phoneType];
                
                if (types.some((t: string) => t?.toLowerCase().includes('cell') || t?.toLowerCase().includes('mobile'))) {
                  data['Mobiltelefon'] = phoneValue;
                } else if (types.some((t: string) => t?.toLowerCase().includes('work') || t?.toLowerCase().includes('business'))) {
                  if (businessCount === 0) {
                    data['Telefon geschäftlich'] = phoneValue;
                    businessCount++;
                  } else {
                    data['Telefon geschäftlich 2'] = phoneValue;
                  }
                } else if (types.some((t: string) => t?.toLowerCase().includes('home'))) {
                  if (privateCount === 0) {
                    data['Telefon (privat)'] = phoneValue;
                    privateCount++;
                  } else {
                    data['Telefon (privat 2)'] = phoneValue;
                  }
                } else {
                  // Default to mobile if no type specified
                  if (!data['Mobiltelefon']) data['Mobiltelefon'] = phoneValue;
                }
              });
            }
            
            // Addresses
            if (vcard.adr) {
              const addresses = Array.isArray(vcard.adr) ? vcard.adr : [vcard.adr];
              
              addresses.forEach((address: any) => {
                const adrValue = address.valueOf();
                const adrType = address?.type || [];
                const types = Array.isArray(adrType) ? adrType : [adrType];
                
                if (Array.isArray(adrValue) && adrValue.length >= 7) {
                  const [poBox, extAddress, street, city, region, postalCode, country] = adrValue;
                  
                  if (types.some((t: string) => t?.toLowerCase().includes('work') || t?.toLowerCase().includes('business'))) {
                    if (street) data['Geschäftlich: Straße'] = street;
                    if (city) data['Geschäftlich: Ort'] = city;
                    if (postalCode) data['Geschäftlich: Postleitzahl'] = postalCode;
                    if (country) data['Geschäftlich: Land'] = country;
                  } else {
                    if (street) data['Privat: Straße'] = street;
                    if (city) data['Privat: Ort'] = city;
                    if (postalCode) data['Privat: Postleitzahl'] = postalCode;
                    if (country) data['Privat: Land'] = country;
                  }
                }
              });
            }
            
            // Birthday
            if (vcard.bday) {
              try {
                const bday = vcard.bday.valueOf();
                data['Geburtstag'] = bday;
              } catch (e) {
                console.warn('Could not parse birthday:', e);
              }
            }
            
            // Website
            if (vcard.url) data['Website'] = vcard.url.valueOf();
            
            // Notes
            if (vcard.note) data['Notizen'] = vcard.note.valueOf();
            
            return data;
          });

          setData(parsedData);
          autoMapFields(Object.keys(parsedData[0] || {}));
          setStep('mapping');
        } catch (error) {
          console.error('VCF parse error:', error);
          toast({
            title: "Fehler beim VCF-Import",
            description: "Die VCF-Datei konnte nicht gelesen werden",
            variant: "destructive"
          });
        }
      };
      reader.readAsText(uploadedFile);
    } else {
      toast({
        title: "Nicht unterstütztes Dateiformat",
        description: "Bitte verwenden Sie CSV, Excel, ODS oder VCF Dateien",
        variant: "destructive"
      });
    }
  }, [toast]);

  const autoMapFields = (sourceFields: string[]) => {
    const mappings: FieldMapping[] = sourceFields.map(sourceField => ({
      sourceField,
      targetField: FIELD_MAPPINGS[sourceField as keyof typeof FIELD_MAPPINGS] || ''
    }));
    setFieldMappings(mappings);
  };

  const updateFieldMapping = (index: number, targetField: string) => {
    const newMappings = [...fieldMappings];
    newMappings[index].targetField = targetField === 'none' ? '' : targetField;
    setFieldMappings(newMappings);
  };

  const proceedToPreview = () => {
    const validMappings = fieldMappings.filter(m => m.targetField);
    if (validMappings.length === 0) {
      toast({
        title: "Keine Feldzuordnung",
        description: "Bitte ordnen Sie mindestens ein Feld zu",
        variant: "destructive"
      });
      return;
    }
    setStep('preview');
  };

  const handleDuplicateSkip = () => {
    if (currentDuplicate) {
      setSkippedCount(prev => prev + 1);
      setDuplicateWarnings(prev => [
        ...prev,
        `Zeile ${currentDuplicate.rowIndex + 1}: ${currentDuplicate.newContact.name} übersprungen`
      ]);
      continueImport();
    }
  };

  const handleDuplicateImportAnyway = async () => {
    if (currentDuplicate) {
      await importContact(currentDuplicate.rowIndex);
      continueImport();
    }
  };

  const handleDuplicateApplyToAll = (action: 'skip' | 'import') => {
    setDuplicateStrategy(action);
    if (action === 'skip') {
      handleDuplicateSkip();
    } else {
      handleDuplicateImportAnyway();
    }
  };

  const continueImport = () => {
    setCurrentDuplicate(null);
    if (importQueue.length > 0) {
      const nextIndex = importQueue[0];
      setImportQueue(prev => prev.slice(1));
      processRow(nextIndex);
    } else {
      finishImport();
    }
  };

  const importContact = async (rowIndex: number) => {
    const row = data[rowIndex];
    const validMappings = fieldMappings.filter(m => m.targetField);
    
    try {
      const contactData: any = {
        user_id: user!.id,
        tenant_id: currentTenant!.id
      };

      // Map fields from source to target
      validMappings.forEach(mapping => {
        const value = row[mapping.sourceField];
        if (value && value.trim()) {
          contactData[mapping.targetField] = value.trim();
        }
      });

      // Combine first_name and last_name into name if not provided
      if ((contactData.first_name || contactData.last_name) && !contactData.name) {
        contactData.name = `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim();
      }

      // Handle organization creation and linking
      if (contactData.organization && contactData.organization.trim()) {
        const orgName = contactData.organization.trim();
        
        let existingOrg = existingContacts.find(
          c => c.organization === orgName || (c.name === orgName && !c.organization)
        );
        
        if (!existingOrg) {
          try {
            const { data: newOrg, error: orgError } = await supabase
              .from('contacts')
              .insert({
                user_id: user!.id,
                tenant_id: currentTenant!.id,
                name: orgName,
                contact_type: 'organization',
                category: 'organization'
              })
              .select('id, name')
              .single();

            if (!orgError && newOrg) {
              contactData.organization_id = newOrg.id;
              existingContacts.push({
                id: newOrg.id,
                name: newOrg.name,
                email: null,
                phone: null,
                organization: null
              });
            }
          } catch (orgCreateError) {
            console.warn('Could not create organization:', orgCreateError);
          }
        } else {
          contactData.organization_id = existingOrg.id;
        }
      }

      // Set default values
      if (!contactData.contact_type) contactData.contact_type = 'person';
      if (!contactData.category) contactData.category = 'citizen';
      if (!contactData.priority) contactData.priority = 'medium';

      const { error } = await supabase
        .from('contacts')
        .insert(contactData);

      if (error) {
        setErrors(prev => [...prev, `Zeile ${rowIndex + 1}: ${error.message}`]);
      } else {
        setImportedCount(prev => prev + 1);
        setExistingContacts(prev => [...prev, {
          id: 'temp-' + rowIndex,
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          organization: contactData.organization,
        }]);
      }
    } catch (error) {
      setErrors(prev => [...prev, `Zeile ${rowIndex + 1}: Unbekannter Fehler`]);
    }
  };

  const processRow = async (rowIndex: number) => {
    const row = data[rowIndex];
    const validMappings = fieldMappings.filter(m => m.targetField);
    
    const contactData: any = {};
    validMappings.forEach(mapping => {
      const value = row[mapping.sourceField];
      if (value && value.trim()) {
        contactData[mapping.targetField] = value.trim();
      }
    });

    // Combine first_name and last_name into name if not provided
    if ((contactData.first_name || contactData.last_name) && !contactData.name) {
      contactData.name = `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim();
    }

    // Skip if no name
    if (!contactData.name || contactData.name.trim() === '') {
      setErrors(prev => [...prev, `Zeile ${rowIndex + 1}: Kein Name angegeben`]);
      continueImport();
      return;
    }

    // Validate email if provided
    if (contactData.email && !isValidEmail(contactData.email)) {
      setErrors(prev => [...prev, `Zeile ${rowIndex + 1}: Ungültige E-Mail-Adresse (${contactData.email})`]);
      continueImport();
      return;
    }

    // Check for duplicates
    const currentContactData = {
      id: '',
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone,
      organization: contactData.organization,
    };
    
    const duplicates = findPotentialDuplicates(currentContactData, existingContacts);
    
    if (duplicates.length > 0 && duplicateStrategy === 'ask') {
      // Show duplicate dialog
      setCurrentDuplicate({
        newContact: currentContactData,
        duplicates,
        rowIndex
      });
      return;
    } else if (duplicates.length > 0 && duplicateStrategy === 'skip') {
      // Skip this contact
      setSkippedCount(prev => prev + 1);
      setDuplicateWarnings(prev => [
        ...prev,
        `Zeile ${rowIndex + 1}: ${contactData.name} übersprungen (Duplikat)`
      ]);
      continueImport();
      return;
    }

    // Import the contact (either no duplicates or strategy is 'import')
    await importContact(rowIndex);
    setProgress(((rowIndex + 1) / data.length) * 100);
    continueImport();
  };

  const startImport = async () => {
    if (!user || !currentTenant) {
      toast({
        title: "Fehler",
        description: "Sie müssen angemeldet sein, um Kontakte zu importieren",
        variant: "destructive"
      });
      return;
    }

    setStep('importing');
    setProgress(0);
    setImportedCount(0);
    setSkippedCount(0);
    setErrors([]);
    setDuplicateWarnings([]);

    // Create import queue
    const queue = data.map((_, index) => index);
    setImportQueue(queue);
    
    // Start processing first row
    if (queue.length > 0) {
      processRow(queue[0]);
      setImportQueue(queue.slice(1));
    }
  };

  const finishImport = () => {
    const message = `${importedCount} Kontakte erfolgreich importiert` +
      `${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}` +
      `${errors.length > 0 ? `, ${errors.length} Fehler` : ''}`;

    toast({
      title: "Import abgeschlossen",
      description: message,
      variant: errors.length > 0 ? "destructive" : "default"
    });

    setStep('complete');
  };

  const reset = () => {
    setFile(null);
    setData([]);
    setFieldMappings([]);
    setStep('upload');
    setProgress(0);
    setImportedCount(0);
    setSkippedCount(0);
    setErrors([]);
    setDuplicateWarnings([]);
    setCurrentDuplicate(null);
    setDuplicateStrategy('ask');
    setImportQueue([]);
  };

  const downloadTemplate = () => {
    const template = {
      'Nachname': 'Mustermann',
      'Vorname': 'Max',
      'Titel': 'Dr.',
      'Firma': 'Beispiel GmbH',
      'Abteilung': 'Vertrieb',
      'Position': 'Geschäftsführer',
      'Geschäftlich: Straße': 'Musterstraße',
      'Geschäftlich: Hausnummer': '123',
      'Geschäftlich: Postleitzahl': '12345',
      'Geschäftlich: Ort': 'Musterstadt',
      'Geschäftlich: Land': 'Deutschland',
      'Telefon geschäftlich': '+49 123 456789',
      'E-Mail 1': 'max.mustermann@beispiel.de'
    };

    const csv = Papa.unparse([template]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'kontakte_vorlage.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Kontakte importieren</h2>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Vorlage herunterladen
        </Button>
      </div>

      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Datei hochladen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Wählen Sie eine Datei aus</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls,.ods,.vcf"
                onChange={handleFileUpload}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Unterstützte Formate: CSV, Excel (XLSX, XLS), OpenDocument (ODS), vCard (VCF)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Feldzuordnung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ordnen Sie die Spalten aus Ihrer Datei den entsprechenden Feldern zu:
            </p>
            <div className="space-y-2">
              {fieldMappings.map((mapping, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="font-medium">{mapping.sourceField}</Label>
                  </div>
                  <div className="flex-1">
                    <Select
                      value={mapping.targetField || 'none'}
                      onValueChange={(value) => updateFieldMapping(index, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Feld auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nicht zuordnen</SelectItem>
                        {TARGET_FIELDS.map(field => (
                          <SelectItem key={field} value={field}>
                            {field.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={proceedToPreview}>Weiter zur Vorschau</Button>
              <Button variant="outline" onClick={reset}>Zurücksetzen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Vorschau</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {data.length} Kontakte werden importiert. Überprüfen Sie die ersten Einträge:
              </p>
              
              {/* Duplicate Strategy Selector */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Settings2 className="h-4 w-4" />
                  <Label className="font-semibold">Duplikat-Behandlung:</Label>
                </div>
                <Select value={duplicateStrategy} onValueChange={(v: any) => setDuplicateStrategy(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ask">Bei jedem Duplikat nachfragen</SelectItem>
                    <SelectItem value="skip">Alle Duplikate automatisch überspringen</SelectItem>
                    <SelectItem value="import">Alle Duplikate trotzdem importieren</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Legt fest, wie mit möglichen Duplikaten umgegangen werden soll.
                </p>
              </div>
            </div>
            <div className="border rounded-md max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {fieldMappings
                      .filter(m => m.targetField)
                      .map(mapping => (
                        <TableHead key={mapping.targetField}>
                          {mapping.targetField.replace(/_/g, ' ')}
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 5).map((row, index) => (
                    <TableRow key={index}>
                      {fieldMappings
                        .filter(m => m.targetField)
                        .map(mapping => (
                          <TableCell key={mapping.targetField}>
                            {row[mapping.sourceField] || '-'}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={startImport}>
                <FileText className="h-4 w-4 mr-2" />
                Import starten
              </Button>
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Zurück zur Zuordnung
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'importing' && (
        <Card>
          <CardHeader>
            <CardTitle>Importiere Kontakte...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              {importedCount} von {data.length} Kontakte importiert
            </p>
          </CardContent>
        </Card>
      )}

      {step === 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Check className="h-5 w-5 mr-2 text-green-600" />
              Import abgeschlossen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" className="text-sm py-1 px-3">
                ✓ {importedCount} importiert
              </Badge>
              {skippedCount > 0 && (
                <Badge variant="outline" className="text-sm py-1 px-3">
                  ⊘ {skippedCount} übersprungen
                </Badge>
              )}
              {errors.length > 0 && (
                <Badge variant="destructive" className="text-sm py-1 px-3">
                  ✗ {errors.length} Fehler
                </Badge>
              )}
            </div>
            
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div>
                    <p className="font-medium mb-2">{errors.length} Fehler beim Import:</p>
                    <div className="max-h-32 overflow-auto">
                      {errors.slice(0, 5).map((error, index) => (
                        <p key={index} className="text-sm">{error}</p>
                      ))}
                      {errors.length > 5 && (
                        <p className="text-sm">... und {errors.length - 5} weitere</p>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {duplicateWarnings.length > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <div>
                    <p className="font-medium mb-2 text-yellow-800">{duplicateWarnings.length} mögliche Duplikate gefunden:</p>
                    <div className="max-h-32 overflow-auto">
                      {duplicateWarnings.slice(0, 5).map((warning, index) => (
                        <p key={index} className="text-sm text-yellow-700">{warning}</p>
                      ))}
                      {duplicateWarnings.length > 5 && (
                        <p className="text-sm text-yellow-700">... und {duplicateWarnings.length - 5} weitere</p>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={reset}>
              Neuen Import starten
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Duplicate Dialog */}
      {currentDuplicate && (
        <ContactImportDuplicateDialog
          open={!!currentDuplicate}
          newContact={currentDuplicate.newContact}
          duplicates={currentDuplicate.duplicates}
          onSkip={handleDuplicateSkip}
          onOverwrite={(id) => {}} // Not implemented yet
          onMerge={(id) => {}} // Not implemented yet
          onImportAnyway={handleDuplicateImportAnyway}
          onApplyToAll={handleDuplicateApplyToAll}
        />
      )}
    </div>
  );
}