import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from '@/utils/debugConsole';
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import VCF from "vcf";
import { isValidEmail } from "@/lib/utils";
import { findPotentialDuplicates } from "@/utils/duplicateDetection";
import type { ContactDuplicateCandidate } from "@/types/contact";
import type { DuplicateMatch } from "@/utils/duplicateDetection";
import type { ParsedVCard, SpreadsheetRow } from "@/types/contactImport";
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
  const [existingContacts, setExistingContacts] = useState<ContactDuplicateCandidate[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  type PendingDuplicate = { newContact: ContactDuplicateCandidate; duplicates: DuplicateMatch[]; rowIndex: number };
  const [currentDuplicate, setCurrentDuplicate] = useState<PendingDuplicate | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"ask" | "skip" | "overwrite" | "merge" | "import">("ask");
  const [importQueue, setImportQueue] = useState<number[]>([]);

  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const toStringValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value instanceof Date) return value.toISOString();
    return "";
  };

  useEffect(() => {
    if (user && currentTenant) fetchExistingContacts();
  }, [user, currentTenant]);

  const fetchExistingContacts = async () => {
    if (!currentTenant) return;
    try {
      const { data, error } = await supabase.from("contacts").select("id, name, email, phone, organization, organization_id").eq("tenant_id", currentTenant.id).order("name");
      if (error) throw error;
      setExistingContacts(data?.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, organization: c.organization, organization_id: c.organization_id })) || []);
    } catch (error) { debugConsole.error("Error fetching existing contacts:", error); }
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
          const parsed = (jsonData.slice(1) as SpreadsheetRow[]).map((row) => {
            const obj: ImportData = {};
            headers.forEach((h, i) => { obj[h] = toStringValue(row[i]); });
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
          const vcards = VCF.parse(e.target?.result as string) as ParsedVCard[];
          const parsed = vcards.map((vcard) => {
            const d: ImportData = {};
            if (vcard.fn) d["Name"] = String(vcard.fn.valueOf());
            if (vcard.n) { const n = vcard.n.valueOf(); if (Array.isArray(n)) { if (n[0]) d["Nachname"] = n[0]; if (n[1]) d["Vorname"] = n[1]; } }
            if (vcard.org) { const o = vcard.org.valueOf(); d["Firma"] = Array.isArray(o) ? o[0] : o; }
            if (vcard.title) d["Position"] = String(vcard.title.valueOf());
            if (vcard.email) { const emails = Array.isArray(vcard.email) ? vcard.email : [vcard.email]; emails.forEach((em, i: number) => { const v = typeof em === "object" ? em.valueOf() : em; if (i === 0) d["E-Mail 1"] = toStringValue(v); else if (i === 1) d["E-Mail 2"] = toStringValue(v); else if (i === 2) d["E-Mail 3"] = toStringValue(v); }); }
            if (vcard.tel) {
              const phones = Array.isArray(vcard.tel) ? vcard.tel : [vcard.tel];
              let bc = 0, pc = 0;
              phones.forEach((p) => {
                const v = typeof p === "object" ? p.valueOf() : p;
                const types = Array.isArray(p?.type) ? p.type : [p?.type || ''];
                if (types.some((t: string) => t?.toLowerCase().includes("cell") || t?.toLowerCase().includes("mobile"))) d["Mobiltelefon"] = toStringValue(v);
                else if (types.some((t: string) => t?.toLowerCase().includes("work"))) { if (bc === 0) { d["Telefon geschäftlich"] = toStringValue(v); bc++; } else d["Telefon geschäftlich 2"] = toStringValue(v); }
                else if (types.some((t: string) => t?.toLowerCase().includes("home"))) { if (pc === 0) { d["Telefon (privat)"] = toStringValue(v); pc++; } else d["Telefon (privat 2)"] = toStringValue(v); }
                else if (!d["Mobiltelefon"]) d["Mobiltelefon"] = toStringValue(v);
              });
            }
            if (vcard.adr) {
              const addrs = Array.isArray(vcard.adr) ? vcard.adr : [vcard.adr];
              addrs.forEach((addr) => {
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
            if ((vcard as any).url) d["Website"] = String((vcard as any).url.valueOf());
            if ((vcard as any).note) d["Notizen"] = String((vcard as any).note.valueOf());
            return d;
          });
          setData(parsed); autoMapFields(Object.keys(parsed[0] || {})); setStep("mapping");
        } catch (error) { debugConsole.error("VCF parse error:", error); toast({ title: "Fehler beim VCF-Import", description: "Die VCF-Datei konnte nicht gelesen werden", variant: "destructive" }); }
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

  const parseDistributionListNames = (rawValue: string | null | undefined): string[] => {
    if (!rawValue) return [];
    return rawValue
      .split(/[;,|]/)
      .map((name) => name.trim())
      .filter(Boolean);
  };

  const assignContactToDistributionLists = async (contactId: string, listNames: string[], rowIndex: number): Promise<void> => {
    if (!user || !currentTenant || listNames.length === 0) return;

    for (const listName of listNames) {
      try {
        const { data: existingList, error: listFetchError } = await supabase
          .from("distribution_lists")
          .select("id")
          .eq("tenant_id", currentTenant.id)
          .eq("name", listName)
          .maybeSingle();

        if (listFetchError) throw listFetchError;

        let distributionListId = existingList?.id;

        if (!distributionListId) {
          const { data: newList, error: createListError } = await supabase
            .from("distribution_lists")
            .insert([{ user_id: user.id, tenant_id: currentTenant.id, name: listName }])
            .select("id")
            .single();

          if (createListError) throw createListError;
          distributionListId = newList.id;
        }

        const { data: existingMembership, error: membershipFetchError } = await supabase
          .from("distribution_list_members")
          .select("id")
          .eq("distribution_list_id", distributionListId)
          .eq("contact_id", contactId)
          .maybeSingle();

        if (membershipFetchError) throw membershipFetchError;

        if (!existingMembership) {
          const { error: membershipInsertError } = await supabase
            .from("distribution_list_members")
            .insert([{ distribution_list_id: distributionListId, contact_id: contactId }]);

          if (membershipInsertError) throw membershipInsertError;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unbekannter Fehler bei Verteilerzuordnung";
        setErrors((prev) => [...prev, `Zeile ${rowIndex + 1}: Verteiler "${listName}" konnte nicht zugeordnet werden (${message})`]);
      }
    }
  };

  type ContactImportPayload = Record<string, string> & {
    user_id?: string;
    tenant_id?: string;
    distribution_list_names?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    organization?: string;
    organization_id?: string;
    contact_type?: string;
    category?: string;
    priority?: string;
    email?: string;
    phone?: string;
  };

  const importContact = async (rowIndex: number): Promise<void> => {
    if (!user || !currentTenant) return;
    const row = data[rowIndex];
    const validMappings = fieldMappings.filter((m) => m.targetField);
    try {
      const contactData: ContactImportPayload = { user_id: user.id, tenant_id: currentTenant.id };
      validMappings.forEach((m) => { const v = row[m.sourceField]; if (v && v.trim()) contactData[m.targetField] = v.trim(); });
      const distributionListNames = parseDistributionListNames(contactData.distribution_list_names);
      delete contactData.distribution_list_names;
      if ((contactData.first_name || contactData.last_name) && !contactData.name) contactData.name = `${contactData.first_name || ""} ${contactData.last_name || ""}`.trim();
      if (contactData.organization?.trim()) {
        const orgName = contactData.organization.trim();
        let existingOrg = existingContacts.find((c) => c.organization === orgName || (c.name === orgName && !c.organization));
        if (!existingOrg) {
          try {
            const { data: newOrg, error: orgError } = await supabase.from("contacts").insert([{ user_id: user.id, tenant_id: currentTenant.id, name: orgName, contact_type: "organization", category: "organization" }]).select("id, name").single();
            if (!orgError && newOrg) { contactData.organization_id = newOrg.id; setExistingContacts((prev) => [...prev, { id: newOrg.id, name: newOrg.name, email: null, phone: null, organization: null }]); }
          } catch (e) { debugConsole.warn("Could not create organization:", e); }
        } else { contactData.organization_id = existingOrg.id; }
      }
      if (!contactData.contact_type) contactData.contact_type = "person";
      if (!contactData.category) contactData.category = "citizen";
      if (!contactData.priority) contactData.priority = "medium";
      const { data: insertedContact, error } = await supabase.from("contacts").insert([contactData]).select("id").single();
      if (error || !insertedContact) {
        setErrors((prev) => [...prev, `Zeile ${rowIndex + 1}: ${error?.message || "Kontakt konnte nicht gespeichert werden"}`]);
      } else {
        await assignContactToDistributionLists(insertedContact.id, distributionListNames, rowIndex);
        setImportedCount((prev) => prev + 1);
        setExistingContacts((prev) => [...prev, { id: insertedContact.id, name: contactData.name, email: contactData.email, phone: contactData.phone, organization: contactData.organization }]);
      }
    } catch {
      setErrors((prev) => [...prev, `Zeile ${rowIndex + 1}: Unbekannter Fehler`]);
    }
  };

  const continueImport = (): void => {
    setCurrentDuplicate(null);
    if (importQueue.length > 0) { const next = importQueue[0]; setImportQueue((prev) => prev.slice(1)); processRow(next); }
    else finishImport();
  };

  const processRow = async (rowIndex: number): Promise<void> => {
    const row = data[rowIndex];
    const validMappings = fieldMappings.filter((m) => m.targetField);
    const contactData: ContactDuplicateCandidate = { id: "", name: "" };
    validMappings.forEach((m) => { const v = row[m.sourceField]; if (v && v.trim()) contactData[m.targetField] = v.trim(); });
    const nameParts = contactData as { first_name?: string; last_name?: string };
    if ((nameParts.first_name || nameParts.last_name) && !contactData.name) contactData.name = `${nameParts.first_name || ""} ${nameParts.last_name || ""}`.trim();
    if (!contactData.name?.trim()) { setErrors((prev) => [...prev, `Zeile ${rowIndex + 1}: Kein Name angegeben`]); continueImport(); return; }
    if (contactData.email && !isValidEmail(contactData.email)) { setErrors((prev) => [...prev, `Zeile ${rowIndex + 1}: Ungültige E-Mail-Adresse (${contactData.email})`]); continueImport(); return; }
    const currentContactData = { id: "", name: contactData.name, email: contactData.email, phone: contactData.phone, organization: contactData.organization };
    const duplicates = findPotentialDuplicates(currentContactData, existingContacts);
    if (duplicates.length > 0 && duplicateStrategy === "ask") { setCurrentDuplicate({ newContact: currentContactData, duplicates, rowIndex }); return; }
    if (duplicates.length > 0 && duplicateStrategy === "skip") { setSkippedCount((prev) => prev + 1); setDuplicateWarnings((prev) => [...prev, `Zeile ${rowIndex + 1}: ${contactData.name} übersprungen (Duplikat)`]); continueImport(); return; }
    if (duplicates.length > 0 && duplicateStrategy === "overwrite") { setDuplicateWarnings((prev) => [...prev, `Zeile ${rowIndex + 1}: ${contactData.name} als Überschreiben behandelt (noch nicht implementiert, importiert)`]); }
    if (duplicates.length > 0 && duplicateStrategy === "merge") { setDuplicateWarnings((prev) => [...prev, `Zeile ${rowIndex + 1}: ${contactData.name} als Zusammenführen behandelt (noch nicht implementiert, importiert)`]); }
    await importContact(rowIndex);
    setProgress(((rowIndex + 1) / data.length) * 100);
    continueImport();
  };

  const startImport = async (): Promise<void> => {
    if (!user || !currentTenant) { toast({ title: "Fehler", description: "Sie müssen angemeldet sein", variant: "destructive" }); return; }
    setStep("importing"); setProgress(0); setImportedCount(0); setSkippedCount(0); setErrors([]); setDuplicateWarnings([]);
    const queue = data.map((_, i) => i);
    setImportQueue(queue);
    if (queue.length > 0) { processRow(queue[0]); setImportQueue(queue.slice(1)); }
  };

  const finishImport = (): void => {
    toast({ title: "Import abgeschlossen", description: `${importedCount} importiert${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ""}${errors.length > 0 ? `, ${errors.length} Fehler` : ""}`, variant: errors.length > 0 ? "destructive" : "default" });
    setStep("complete");
  };

  const handleDuplicateSkip = () => { if (currentDuplicate) { setSkippedCount((p) => p + 1); setDuplicateWarnings((p) => [...p, `Zeile ${currentDuplicate.rowIndex + 1}: ${currentDuplicate.newContact.name} übersprungen`]); continueImport(); } };
  const handleDuplicateImportAnyway = async () => { if (currentDuplicate) { await importContact(currentDuplicate.rowIndex); continueImport(); } };
  const handleDuplicateOverwrite = async (_contactId: string) => {
    if (currentDuplicate) {
      setDuplicateWarnings((p) => [...p, `Zeile ${currentDuplicate.rowIndex + 1}: Überschreiben gewählt (noch nicht implementiert, importiert)`]);
      await importContact(currentDuplicate.rowIndex);
      continueImport();
    }
  };
  const handleDuplicateMerge = async (_contactId: string) => {
    if (currentDuplicate) {
      setDuplicateWarnings((p) => [...p, `Zeile ${currentDuplicate.rowIndex + 1}: Zusammenführen gewählt (noch nicht implementiert, importiert)`]);
      await importContact(currentDuplicate.rowIndex);
      continueImport();
    }
  };
  const handleDuplicateApplyToAll = (action: "skip" | "overwrite" | "merge" | "import") => {
    setDuplicateStrategy(action);
    if (action === "skip") {
      handleDuplicateSkip();
      return;
    }
    if (action === "overwrite") {
      const topDuplicateId = currentDuplicate?.duplicates[0]?.contact.id;
      if (topDuplicateId) {
        void handleDuplicateOverwrite(topDuplicateId);
      }
      return;
    }
    if (action === "merge") {
      const topDuplicateId = currentDuplicate?.duplicates[0]?.contact.id;
      if (topDuplicateId) {
        void handleDuplicateMerge(topDuplicateId);
      }
      return;
    }
    void handleDuplicateImportAnyway();
  };

  const reset = () => { setFile(null); setData([]); setFieldMappings([]); setStep("upload"); setProgress(0); setImportedCount(0); setSkippedCount(0); setErrors([]); setDuplicateWarnings([]); setCurrentDuplicate(null); setDuplicateStrategy("ask"); setImportQueue([]); };

  const downloadTemplate = () => {
    const template = { Nachname: "Mustermann", Vorname: "Max", Titel: "Dr.", Firma: "Beispiel GmbH", Abteilung: "Vertrieb", Position: "Geschäftsführer", "Geschäftlich: Straße": "Musterstraße", "Geschäftlich: Hausnummer": "123", "Geschäftlich: Postleitzahl": "12345", "Geschäftlich: Ort": "Musterstadt", "Geschäftlich: Land": "Deutschland", "Telefon geschäftlich": "+49 123 456789", "E-Mail 1": "max.mustermann@beispiel.de", Verteiler: "Presse; Umwelt" };
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
    handleDuplicateSkip, handleDuplicateOverwrite, handleDuplicateMerge, handleDuplicateImportAnyway, handleDuplicateApplyToAll,
  };
}
