import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import VCF from "vcf";
import { isValidEmail } from "@/lib/utils";
import { findPotentialDuplicates } from "@/utils/duplicateDetection";
import type { Contact, DuplicateMatch } from "@/utils/duplicateDetection";
import { ImportData, FieldMapping, FIELD_MAPPINGS } from "../types";

export function useContactImport() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportData[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [existingContacts, setExistingContacts] = useState<Contact[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [currentDuplicate, setCurrentDuplicate] = useState<{ newContact: Contact; duplicates: DuplicateMatch[]; rowIndex: number } | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"ask" | "skip" | "import">("ask");
  const [importQueue, setImportQueue] = useState<number[]>([]);

  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  useEffect(() => {
    if (user && currentTenant) fetchExistingContacts();
  }, [user, currentTenant]);

  const fetchExistingContacts = async () => {
    try {
      const { data, error } = await supabase.from("contacts").select("id, name, email, phone, organization, organization_id").eq("tenant_id", currentTenant!.id).order("name");
      if (error) throw error;
      setExistingContacts(data?.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, organization: c.organization, organization_id: c.organization_id })) || []);
    } catch (error) { console.error("Error fetching existing contacts:", error); }
  };

  const autoMapFields = (sourceFields: string[]) => {
    setFieldMappings(sourceFields.map((sf) => ({ sourceField: sf, targetField: FIELD_MAPPINGS[sf] || "" })));
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile); setData([]); setFieldMappings([]); setErrors([]);
    const ext = uploadedFile.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse(uploadedFile, {
        header: true, skipEmptyLines: true,
        complete: (result) => { setData(result.data as ImportData[]); autoMapFields(Object.keys(result.data[0] || {})); setStep("mapping"); },
        error: (error) => { toast({ title: "Fehler beim CSV-Import", description: error.message, variant: "destructive" }); },
      });
    } else if (["xlsx", "xls", "ods"].includes(ext || "")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" });
          const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          if (jsonData.length < 2) { toast({ title: "Fehler", description: "Die Datei enthält keine gültigen Daten", variant: "destructive" }); return; }
          const headers = jsonData[0] as string[];
          const parsed = (jsonData.slice(1) as any[][]).map((row) => {
            const obj: ImportData = {};
            headers.forEach((h, i) => { obj[h] = row[i]?.toString() || ""; });
            return obj;
          });
          setData(parsed); autoMapFields(headers); setStep("mapping");
        } catch { toast({ title: "Fehler beim Excel-Import", description: "Die Datei konnte nicht gelesen werden", variant: "destructive" }); }
      };
      reader.readAsBinaryString(uploadedFile);
    } else if (ext === "vcf") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const vcards = VCF.parse(e.target?.result as string);
          const parsed = vcards.map((vcard: any) => {
            const d: ImportData = {};
            if (vcard.fn) d["Name"] = vcard.fn.valueOf();
            if (vcard.n) { const n = vcard.n.valueOf(); if (Array.isArray(n)) { if (n[0]) d["Nachname"] = n[0]; if (n[1]) d["Vorname"] = n[1]; } }
            if (vcard.org) { const o = vcard.org.valueOf(); d["Firma"] = Array.isArray(o) ? o[0] : o; }
            if (vcard.title) d["Position"] = vcard.title.valueOf();
            if (vcard.email) { const emails = Array.isArray(vcard.email) ? vcard.email : [vcard.email]; emails.forEach((em: any, i: number) => { const v = typeof em === "object" ? em.valueOf() : em; if (i === 0) d["E-Mail 1"] = v; else if (i === 1) d["E-Mail 2"] = v; else if (i === 2) d["E-Mail 3"] = v; }); }
            if (vcard.tel) {
              const phones = Array.isArray(vcard.tel) ? vcard.tel : [vcard.tel];
              let bc = 0, pc = 0;
              phones.forEach((p: any) => {
                const v = typeof p === "object" ? p.valueOf() : p;
                const types = Array.isArray(p?.type) ? p.type : [p?.type || ''];
                if (types.some((t: string) => t?.toLowerCase().includes("cell") || t?.toLowerCase().includes("mobile"))) d["Mobiltelefon"] = v;
                else if (types.some((t: string) => t?.toLowerCase().includes("work"))) { if (bc === 0) { d["Telefon geschäftlich"] = v; bc++; } else d["Telefon geschäftlich 2"] = v; }
                else if (types.some((t: string) => t?.toLowerCase().includes("home"))) { if (pc === 0) { d["Telefon (privat)"] = v; pc++; } else d["Telefon (privat 2)"] = v; }
                else if (!d["Mobiltelefon"]) d["Mobiltelefon"] = v;
              });
            }
            if (vcard.adr) {
              const addrs = Array.isArray(vcard.adr) ? vcard.adr : [vcard.adr];
              addrs.forEach((addr: any) => {
                const a = addr.valueOf(); const types = Array.isArray(addr?.type) ? addr.type : [addr?.type || ''];
                if (Array.isArray(a) && a.length >= 7) {
                  const [, , street, city, , postalCode, country] = a;
                  if (types.some((t: string) => t?.toLowerCase().includes("work"))) {
                    if (street) d["Geschäftlich: Straße"] = street; if (city) d["Geschäftlich: Ort"] = city;
                    if (postalCode) d["Geschäftlich: Postleitzahl"] = postalCode; if (country) d["Geschäftlich: Land"] = country;
                  } else {
                    if (street) d["Privat: Straße"] = street; if (city) d["Privat: Ort"] = city;
                    if (postalCode) d["Privat: Postleitzahl"] = postalCode; if (country) d["Privat: Land"] = country;
                  }
                }
              });
            }
            if (vcard.url) d["Website"] = vcard.url.valueOf();
            if (vcard.note) d["Notizen"] = vcard.note.valueOf();
            return d;
          });
          setData(parsed); autoMapFields(Object.keys(parsed[0] || {})); setStep("mapping");
        } catch (error) { console.error("VCF parse error:", error); toast({ title: "Fehler beim VCF-Import", description: "Die VCF-Datei konnte nicht gelesen werden", variant: "destructive" }); }
      };
      reader.readAsText(uploadedFile);
    } else {
      toast({ title: "Nicht unterstütztes Dateiformat", description: "Bitte verwenden Sie CSV, Excel, ODS oder VCF Dateien", variant: "destructive" });
    }
  }, [toast]);

  const updateFieldMapping = (index: number, targetField: string) => {
    const newMappings = [...fieldMappings];
    newMappings[index].targetField = targetField === "none" ? "" : targetField;
    setFieldMappings(newMappings);
  };

  const proceedToPreview = () => {
    if (fieldMappings.filter((m) => m.targetField).length === 0) {
      toast({ title: "Keine Feldzuordnung", description: "Bitte ordnen Sie mindestens ein Feld zu", variant: "destructive" });
      return;
    }
    setStep("preview");
  };

  const importContact = async (rowIndex: number) => {
    const row = data[rowIndex];
    const validMappings = fieldMappings.filter((m) => m.targetField);
    try {
      const contactData: any = { user_id: user!.id, tenant_id: currentTenant!.id };
      validMappings.forEach((m) => { const v = row[m.sourceField]; if (v && v.trim()) contactData[m.targetField] = v.trim(); });
      if ((contactData.first_name || contactData.last_name) && !contactData.name) contactData.name = `${contactData.first_name || ""} ${contactData.last_name || ""}`.trim();
      if (contactData.organization?.trim()) {
        const orgName = contactData.organization.trim();
        let existingOrg = existingContacts.find((c) => c.organization === orgName || (c.name === orgName && !c.organization));
        if (!existingOrg) {
          try {
            const { data: newOrg, error: orgError } = await supabase.from("contacts").insert({ user_id: user!.id, tenant_id: currentTenant!.id, name: orgName, contact_type: "organization", category: "organization" }).select("id, name").single();
            if (!orgError && newOrg) { contactData.organization_id = newOrg.id; existingContacts.push({ id: newOrg.id, name: newOrg.name, email: null, phone: null, organization: null }); }
          } catch (e) { console.warn("Could not create organization:", e); }
        } else { contactData.organization_id = existingOrg.id; }
      }
      if (!contactData.contact_type) contactData.contact_type = "person";
      if (!contactData.category) contactData.category = "citizen";
      if (!contactData.priority) contactData.priority = "medium";
      const { error } = await supabase.from("contacts").insert(contactData);
      if (error) { setErrors((prev) => [...prev, `Zeile ${rowIndex + 1}: ${error.message}`]); }
      else { setImportedCount((prev) => prev + 1); setExistingContacts((prev) => [...prev, { id: "temp-" + rowIndex, name: contactData.name, email: contactData.email, phone: contactData.phone, organization: contactData.organization }]); }
    } catch { setErrors((prev) => [...prev, `Zeile ${rowIndex + 1}: Unbekannter Fehler`]); }
  };

  const continueImport = () => {
    setCurrentDuplicate(null);
    if (importQueue.length > 0) { const next = importQueue[0]; setImportQueue((prev) => prev.slice(1)); processRow(next); }
    else finishImport();
  };

  const processRow = async (rowIndex: number) => {
    const row = data[rowIndex];
    const validMappings = fieldMappings.filter((m) => m.targetField);
    const contactData: any = {};
    validMappings.forEach((m) => { const v = row[m.sourceField]; if (v && v.trim()) contactData[m.targetField] = v.trim(); });
    if ((contactData.first_name || contactData.last_name) && !contactData.name) contactData.name = `${contactData.first_name || ""} ${contactData.last_name || ""}`.trim();
    if (!contactData.name?.trim()) { setErrors((prev) => [...prev, `Zeile ${rowIndex + 1}: Kein Name angegeben`]); continueImport(); return; }
    if (contactData.email && !isValidEmail(contactData.email)) { setErrors((prev) => [...prev, `Zeile ${rowIndex + 1}: Ungültige E-Mail-Adresse (${contactData.email})`]); continueImport(); return; }
    const currentContactData = { id: "", name: contactData.name, email: contactData.email, phone: contactData.phone, organization: contactData.organization };
    const duplicates = findPotentialDuplicates(currentContactData, existingContacts);
    if (duplicates.length > 0 && duplicateStrategy === "ask") { setCurrentDuplicate({ newContact: currentContactData, duplicates, rowIndex }); return; }
    if (duplicates.length > 0 && duplicateStrategy === "skip") { setSkippedCount((prev) => prev + 1); setDuplicateWarnings((prev) => [...prev, `Zeile ${rowIndex + 1}: ${contactData.name} übersprungen (Duplikat)`]); continueImport(); return; }
    await importContact(rowIndex);
    setProgress(((rowIndex + 1) / data.length) * 100);
    continueImport();
  };

  const startImport = async () => {
    if (!user || !currentTenant) { toast({ title: "Fehler", description: "Sie müssen angemeldet sein", variant: "destructive" }); return; }
    setStep("importing"); setProgress(0); setImportedCount(0); setSkippedCount(0); setErrors([]); setDuplicateWarnings([]);
    const queue = data.map((_, i) => i);
    setImportQueue(queue);
    if (queue.length > 0) { processRow(queue[0]); setImportQueue(queue.slice(1)); }
  };

  const finishImport = () => {
    toast({ title: "Import abgeschlossen", description: `${importedCount} importiert${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ""}${errors.length > 0 ? `, ${errors.length} Fehler` : ""}`, variant: errors.length > 0 ? "destructive" : "default" });
    setStep("complete");
  };

  const handleDuplicateSkip = () => { if (currentDuplicate) { setSkippedCount((p) => p + 1); setDuplicateWarnings((p) => [...p, `Zeile ${currentDuplicate.rowIndex + 1}: ${currentDuplicate.newContact.name} übersprungen`]); continueImport(); } };
  const handleDuplicateImportAnyway = async () => { if (currentDuplicate) { await importContact(currentDuplicate.rowIndex); continueImport(); } };
  const handleDuplicateApplyToAll = (action: "skip" | "import") => { setDuplicateStrategy(action); if (action === "skip") handleDuplicateSkip(); else handleDuplicateImportAnyway(); };

  const reset = () => { setFile(null); setData([]); setFieldMappings([]); setStep("upload"); setProgress(0); setImportedCount(0); setSkippedCount(0); setErrors([]); setDuplicateWarnings([]); setCurrentDuplicate(null); setDuplicateStrategy("ask"); setImportQueue([]); };

  const downloadTemplate = () => {
    const template = { Nachname: "Mustermann", Vorname: "Max", Titel: "Dr.", Firma: "Beispiel GmbH", Abteilung: "Vertrieb", Position: "Geschäftsführer", "Geschäftlich: Straße": "Musterstraße", "Geschäftlich: Hausnummer": "123", "Geschäftlich: Postleitzahl": "12345", "Geschäftlich: Ort": "Musterstadt", "Geschäftlich: Land": "Deutschland", "Telefon geschäftlich": "+49 123 456789", "E-Mail 1": "max.mustermann@beispiel.de" };
    const csv = Papa.unparse([template]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "kontakte_vorlage.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return {
    file, data, fieldMappings, step, progress, importedCount, skippedCount, errors,
    duplicateWarnings, currentDuplicate, duplicateStrategy, setDuplicateStrategy,
    handleFileUpload, updateFieldMapping, proceedToPreview, startImport, reset, downloadTemplate,
    handleDuplicateSkip, handleDuplicateImportAnyway, handleDuplicateApplyToAll,
  };
}
