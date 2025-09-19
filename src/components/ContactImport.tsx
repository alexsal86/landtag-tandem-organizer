import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Upload, Download, FileText, Check, X, AlertCircle } from "lucide-react";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import VCF from 'vcf';
import { isValidEmail, findPotentialDuplicates, type Contact } from "@/lib/utils";

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
  const [errors, setErrors] = useState<string[]>([]);
  const [existingContacts, setExistingContacts] = useState<Contact[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  
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
            
            if (vcard.fn) data['Vorname'] = vcard.fn.valueOf();
            if (vcard.n) {
              const name = vcard.n.valueOf();
              if (name.length > 0) data['Nachname'] = name[0];
              if (name.length > 1) data['Vorname'] = name[1];
            }
            if (vcard.org) data['Firma'] = vcard.org.valueOf();
            if (vcard.email) data['E-Mail 1'] = vcard.email.valueOf();
            if (vcard.tel) data['Mobiltelefon'] = vcard.tel.valueOf();
            
            return data;
          });

          setData(parsedData);
          autoMapFields(Object.keys(parsedData[0] || {}));
          setStep('mapping');
        } catch (error) {
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
    setErrors([]);
    setDuplicateWarnings([]);

    const validMappings = fieldMappings.filter(m => m.targetField);
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const contactData: any = {
          user_id: user.id,
          tenant_id: currentTenant.id
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
          
          // Check if organization already exists
          let existingOrg = existingContacts.find(
            c => c.organization === orgName || (c.name === orgName && !c.organization)
          );
          
          if (!existingOrg) {
            // Create new organization contact
            try {
              const { data: newOrg, error: orgError } = await supabase
                .from('contacts')
                .insert({
                  user_id: user.id,
                  tenant_id: currentTenant.id,
                  name: orgName,
                  contact_type: 'organization',
                  category: 'organization'
                })
                .select('id, name')
                .single();

              if (!orgError && newOrg) {
                contactData.organization_id = newOrg.id;
                // Add to existing contacts to prevent duplicates in this session
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
            // Link to existing organization
            contactData.organization_id = existingOrg.id;
          }
        }

        // Skip if no name
        if (!contactData.name || contactData.name.trim() === '') {
          setErrors(prev => [...prev, `Zeile ${i + 1}: Kein Name angegeben`]);
          errorCount++;
          continue;
        }

        // Validate email if provided
        if (contactData.email && !isValidEmail(contactData.email)) {
          setErrors(prev => [...prev, `Zeile ${i + 1}: Ungültige E-Mail-Adresse (${contactData.email})`]);
          errorCount++;
          continue;
        }

        // Check for duplicates
        const currentContactData = {
          name: contactData.name,
          email: contactData.email,
          phone: contactData.phone,
          organization: contactData.organization,
        };
        
        const duplicates = findPotentialDuplicates(currentContactData, existingContacts);
        
        if (duplicates.length > 0) {
          const duplicateInfo = duplicates.map(dup => `${dup.contact.name} (${dup.matchType})`).join(', ');
          setDuplicateWarnings(prev => [...prev, `Zeile ${i + 1}: ${contactData.name} - Mögliche Duplikate: ${duplicateInfo}`]);
          duplicateCount++;
          // Continue with import despite duplicates
        }

        // Set default values
        if (!contactData.contact_type) contactData.contact_type = 'person';
        if (!contactData.category) contactData.category = 'citizen';
        if (!contactData.priority) contactData.priority = 'medium';

        const { error } = await supabase
          .from('contacts')
          .insert(contactData);

        if (error) {
          setErrors(prev => [...prev, `Zeile ${i + 1}: ${error.message}`]);
          errorCount++;
        } else {
          successCount++;
          // Add to existing contacts list for future duplicate checks
          setExistingContacts(prev => [...prev, {
            id: 'temp-' + i,
            name: contactData.name,
            email: contactData.email,
            phone: contactData.phone,
            organization: contactData.organization,
          }]);
        }
      } catch (error) {
        setErrors(prev => [...prev, `Zeile ${i + 1}: Unbekannter Fehler`]);
        errorCount++;
      }

      setProgress(((i + 1) / data.length) * 100);
      setImportedCount(successCount);
    }

    const message = `${successCount} Kontakte erfolgreich importiert` +
      `${errorCount > 0 ? `, ${errorCount} Fehler` : ''}` +
      `${duplicateCount > 0 ? `, ${duplicateCount} mögliche Duplikate` : ''}`;

    toast({
      title: "Import abgeschlossen",
      description: message,
      variant: errorCount > 0 ? "destructive" : duplicateCount > 0 ? "default" : "default"
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
    setErrors([]);
    setDuplicateWarnings([]);
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
            <p className="text-sm text-muted-foreground mb-4">
              {data.length} Kontakte werden importiert. Überprüfen Sie die ersten Einträge:
            </p>
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
            <p>{importedCount} Kontakte wurden erfolgreich importiert.</p>
            
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
    </div>
  );
}