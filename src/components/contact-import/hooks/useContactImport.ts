import { useState, useCallback, useEffect, useRef } from "react";
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
import type { TablesInsert } from "@/integrations/supabase/types";
import type { DuplicateMatch } from "@/utils/duplicateDetection";
import type { ParsedVCard, SpreadsheetRow } from "@/types/contactImport";
import { ImportData, FieldMapping, FIELD_MAPPINGS } from "../types";
import { resolveDuplicateContact, type DuplicateResolutionMode } from "../duplicateResolution";
import { parseDistributionListNames } from "../distributionListNames";
import { notify } from "@/lib/notify";
import { toast } from "@/hooks/use-toast";

export function useContactImport() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportData[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");
  const [progress, setProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [mergedCount, setMergedCount] = useState(0);
  const [overwrittenCount, setOverwrittenCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [existingContacts, setExistingContacts] = useState<ContactDuplicateCandidate[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  type PendingDuplicate = { newContact: ContactDuplicateCandidate; duplicates: DuplicateMatch[]; rowIndex: number };
  const [currentDuplicate, setCurrentDuplicate] = useState<PendingDuplicate | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"ask" | "skip" | "overwrite" | "merge" | "import">("ask");
  const [importQueue, setImportQueue] = useState<number[]>([]);

  // Authoritative counters: finishImport runs inside the async import loop, so
  // its closure would otherwise read the state values from before the run.
  const countsRef = useRef({ imported: 0, skipped: 0, merged: 0, overwritten: 0 });
  const errorListRef = useRef<string[]>([]);

  const countResult = (kind: keyof typeof countsRef.current) => {
    countsRef.current[kind] += 1;
    const value = countsRef.current[kind];
    if (kind === "imported") setImportedCount(value);
    else if (kind === "skipped") setSkippedCount(value);
    else if (kind === "merged") setMergedCount(value);
    else setOverwrittenCount(value);
  };

  const recordError = (message: string) => {
    errorListRef.current = [...errorListRef.current, message];
    setErrors(errorListRef.current);
  };

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
        error: (error) => { notify.error("Fehler beim CSV-Import", { description: error.message
}); },
      });
    } else if (["xlsx", "xls", "ods"].includes(ext || "")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" });
          const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          if (jsonData.length < 2) { notify.error("Fehler", { description: "Die Datei enthält keine gültigen Daten"
}); return; }
          const headers = jsonData[0] as string[];
          const parsed = (jsonData.slice(1) as SpreadsheetRow[]).map((row) => {
            const obj: ImportData = {};
            headers.forEach((h, i) => { obj[h] = toStringValue(row[i]); });
            return obj;
          });
          setData(parsed); autoMapFields(headers); setStep("mapping");
        } catch { notify.error("Fehler beim Excel-Import", { description: "Die Datei konnte nicht gelesen werden"
}); }
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
            if (vcard.url) d["Website"] = String(vcard.url.valueOf());
            if (vcard.note) d["Notizen"] = String(vcard.note.valueOf());
            return d;
          });
          setData(parsed); autoMapFields(Object.keys(parsed[0] || {})); setStep("mapping");
        } catch (error) { debugConsole.error("VCF parse error:", error); notify.error("Fehler beim VCF-Import", { description: "Die VCF-Datei konnte nicht gelesen werden"
}); }
      };
      reader.readAsText(uploadedFile);
    } else {
      notify.error("Nicht unterstütztes Dateiformat", { description: "Bitte verwenden Sie CSV, Excel, ODS oder VCF Dateien"
});
    }
  }, [toast]);

  const updateFieldMapping = (index: number, targetField: string) => {
    const newMappings = [...fieldMappings];
    newMappings[index].targetField = targetField === "none" ? "" : targetField;
    setFieldMappings(newMappings);
  };

  const proceedToPreview = () => {
    if (fieldMappings.filter((m) => m.targetField).length === 0) {
      notify.error("Keine Feldzuordnung", { description: "Bitte ordnen Sie mindestens ein Feld zu"
});
      return;
    }
    setStep("preview");
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
        recordError(`Zeile ${rowIndex + 1}: Verteiler "${listName}" konnte nicht zugeordnet werden (${message})`);
      }
    }
  };

  type RowPayload = {
    values: Record<string, string>;
    distributionListNames: string[];
  };

  /** Maps one import row to contact values and resolves its organization. */
  const buildRowPayload = async (rowIndex: number): Promise<RowPayload> => {
    const row = data[rowIndex];
    const values: Record<string, string> = {};
    fieldMappings.filter((m) => m.targetField).forEach((m) => {
      const v = row[m.sourceField];
      if (v && v.trim()) values[m.targetField] = v.trim();
    });
    const distributionListNames = parseDistributionListNames(values.distribution_list_names);
    delete values.distribution_list_names;
    if ((values.first_name || values.last_name) && !values.name) values.name = `${values.first_name || ""} ${values.last_name || ""}`.trim();

    if (values.organization && user && currentTenant) {
      const orgName = values.organization;
      let existingOrg = existingContacts.find((c) => c.organization === orgName || (c.name === orgName && !c.organization));
      if (!existingOrg) {
        try {
          const { data: newOrg, error: orgError } = await supabase.from("contacts").insert([{ user_id: user.id, tenant_id: currentTenant.id, name: orgName, contact_type: "organization", category: "organization" }]).select("id, name").single();
          if (!orgError && newOrg) {
            existingOrg = { id: newOrg.id, name: newOrg.name, email: null, phone: null, organization: null };
            setExistingContacts((prev) => [...prev, existingOrg as ContactDuplicateCandidate]);
          }
        } catch (e) { debugConsole.warn("Could not create organization:", e); }
      }
      if (existingOrg) values.organization_id = existingOrg.id;
    }

    return { values, distributionListNames };
  };

  const logResolutionActivity = async (contactId: string, title: string, description: string): Promise<void> => {
    if (!user || !currentTenant) return;
    try {
      const { error } = await supabase.from("contact_activities").insert([{
        contact_id: contactId,
        tenant_id: currentTenant.id,
        activity_type: "edit",
        title,
        description,
        created_by: user.id,
      }]);
      if (error) debugConsole.warn("Could not log import resolution:", error);
    } catch (error) {
      debugConsole.warn("Could not log import resolution:", error);
    }
  };

  /**
   * Duplicates are never inserted a second time: merge keeps the existing
   * values and fills gaps, overwrite replaces conflicting values.
   */
  const applyDuplicateResolution = async (
    rowIndex: number,
    contactId: string,
    mode: DuplicateResolutionMode,
  ): Promise<void> => {
    if (!user || !currentTenant) return;
    const { values, distributionListNames } = await buildRowPayload(rowIndex);
    const { data: existing, error } = await supabase
      .from("contacts")
      .select("id, name, email, phone, mobile_phone, business_phone, organization, organization_id, notes, tags, first_name, last_name, title, position, address, birthday, website, linkedin, facebook, instagram, business_street, business_house_number, business_postal_code, business_city, business_country")
      .eq("id", contactId)
      .eq("tenant_id", currentTenant.id)
      .maybeSingle();

    if (error || !existing) {
      recordError(`Zeile ${rowIndex + 1}: Bestehender Kontakt konnte nicht geladen werden (${error?.message ?? "nicht gefunden"})`);
      return;
    }

    const resolution = resolveDuplicateContact(existing, values, mode);
    const changedFields = Object.keys(resolution.payload);

    if (changedFields.length > 0) {
      const { error: updateError } = await supabase
        .from("contacts")
        .update(resolution.payload)
        .eq("id", contactId)
        .eq("tenant_id", currentTenant.id);

      if (updateError) {
        recordError(`Zeile ${rowIndex + 1}: ${updateError.message}`);
        return;
      }
    }

    await assignContactToDistributionLists(contactId, distributionListNames, rowIndex);

    const updated = resolution.payload;
    setExistingContacts((prev) => prev.map((c) => (c.id === contactId ? {
      ...c,
      name: updated.name ?? c.name,
      email: updated.email ?? c.email,
      phone: updated.phone ?? c.phone,
      organization: updated.organization ?? c.organization,
      organization_id: updated.organization_id ?? c.organization_id,
    } : c)));

    countResult(mode === "merge" ? "merged" : "overwritten");

    const action = mode === "merge" ? "zusammengeführt" : "überschrieben";
    setDuplicateWarnings((prev) => [...prev, `Zeile ${rowIndex + 1}: ${existing.name} ${action}${changedFields.length > 0 ? ` (${changedFields.join(", ")})` : " (keine Änderungen)"}`]);

    await logResolutionActivity(
      contactId,
      mode === "merge" ? "Kontakt aus Import zusammengeführt" : "Kontakt aus Import überschrieben",
      mode === "merge"
        ? `Beim Kontakt-Import wurden fehlende Angaben ergänzt; bestehende Werte von „${existing.name}" blieben erhalten.`
        : `Beim Kontakt-Import wurden bestehende Werte von „${existing.name}" mit den Importdaten überschrieben.`,
    );
  };

  const importContact = async (
    rowIndex: number,
    resolution?: { mode: DuplicateResolutionMode; contactId: string },
  ): Promise<void> => {
    if (!user || !currentTenant) return;
    try {
      if (resolution) {
        await applyDuplicateResolution(rowIndex, resolution.contactId, resolution.mode);
        return;
      }

      const { values, distributionListNames } = await buildRowPayload(rowIndex);
      // Field names come from the dynamic import mapping, so their values are
      // strings; name/tenant/user are set explicitly for the required columns.
      const contactData = {
        ...values,
        user_id: user.id,
        tenant_id: currentTenant.id,
        name: values.name ?? "",
        contact_type: values.contact_type || "person",
        category: values.category || "citizen",
        priority: values.priority || "medium",
      } as TablesInsert<"contacts">;
      const { data: insertedContact, error } = await supabase.from("contacts").insert([contactData]).select("id").single();
      if (error || !insertedContact) {
        recordError(`Zeile ${rowIndex + 1}: ${error?.message || "Kontakt konnte nicht gespeichert werden"}`);
      } else {
        await assignContactToDistributionLists(insertedContact.id, distributionListNames, rowIndex);
        countResult("imported");
        setExistingContacts((prev) => [...prev, { id: insertedContact.id, name: contactData.name || '', email: contactData.email, phone: contactData.phone, organization: contactData.organization }]);
      }
    } catch {
      recordError(`Zeile ${rowIndex + 1}: Unbekannter Fehler`);
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
    if (!contactData.name?.trim()) { recordError(`Zeile ${rowIndex + 1}: Kein Name angegeben`); continueImport(); return; }
    if (contactData.email && !isValidEmail(contactData.email)) { recordError(`Zeile ${rowIndex + 1}: Ungültige E-Mail-Adresse (${contactData.email})`); continueImport(); return; }
    const currentContactData = { id: "", name: contactData.name, email: contactData.email, phone: contactData.phone, organization: contactData.organization };
    const duplicates = findPotentialDuplicates(currentContactData, existingContacts);
    if (duplicates.length > 0) {
      const duplicateId = duplicates[0].contact.id;
      if (duplicateStrategy === "ask") { setCurrentDuplicate({ newContact: currentContactData, duplicates, rowIndex }); return; }
      if (duplicateStrategy === "skip") { countResult("skipped"); setDuplicateWarnings((prev) => [...prev, `Zeile ${rowIndex + 1}: ${contactData.name} übersprungen (Duplikat)`]); continueImport(); return; }
      if (duplicateStrategy === "merge" || duplicateStrategy === "overwrite") {
        await importContact(rowIndex, { mode: duplicateStrategy, contactId: duplicateId });
        setProgress(((rowIndex + 1) / data.length) * 100);
        continueImport();
        return;
      }
    }
    await importContact(rowIndex);
    setProgress(((rowIndex + 1) / data.length) * 100);
    continueImport();
  };

  const startImport = async (): Promise<void> => {
    if (!user || !currentTenant) { notify.error("Fehler", { description: "Sie müssen angemeldet sein"
}); return; }
    countsRef.current = { imported: 0, skipped: 0, merged: 0, overwritten: 0 };
    errorListRef.current = [];
    setStep("importing"); setProgress(0); setImportedCount(0); setSkippedCount(0); setMergedCount(0); setOverwrittenCount(0); setErrors([]); setDuplicateWarnings([]);
    const queue = data.map((_, i) => i);
    setImportQueue(queue);
    if (queue.length > 0) { processRow(queue[0]); setImportQueue(queue.slice(1)); }
  };

  const finishImport = (): void => {
    const { imported, merged, overwritten, skipped } = countsRef.current;
    const errorCount = errorListRef.current.length;
    notify.success("Import abgeschlossen", { description: `${imported} importiert${merged > 0 ? `, ${merged} zusammengeführt` : ""}${overwritten > 0 ? `, ${overwritten} überschrieben` : ""}${skipped > 0 ? `, ${skipped} übersprungen` : ""}${errorCount > 0 ? `, ${errorCount} Fehler` : ""}`
});
    setStep("complete");
  };

  const handleDuplicateSkip = () => { if (currentDuplicate) { countResult("skipped"); setDuplicateWarnings((p) => [...p, `Zeile ${currentDuplicate.rowIndex + 1}: ${currentDuplicate.newContact.name} übersprungen`]); continueImport(); } };
  const handleDuplicateImportAnyway = async () => { if (currentDuplicate) { await importContact(currentDuplicate.rowIndex); continueImport(); } };
  const handleDuplicateOverwrite = async (contactId: string) => {
    if (!currentDuplicate) return;
    const rowIndex = currentDuplicate.rowIndex;
    await importContact(rowIndex, { mode: "overwrite", contactId });
    setProgress(((rowIndex + 1) / data.length) * 100);
    continueImport();
  };
  const handleDuplicateMerge = async (contactId: string) => {
    if (!currentDuplicate) return;
    const rowIndex = currentDuplicate.rowIndex;
    await importContact(rowIndex, { mode: "merge", contactId });
    setProgress(((rowIndex + 1) / data.length) * 100);
    continueImport();
  };
  const handleDuplicateApplyToAll = (action: "skip" | "overwrite" | "merge" | "import") => {
    setDuplicateStrategy(action);
    if (action === "skip") {
      handleDuplicateSkip();
      return;
    }
    if (action === "overwrite" || action === "merge") {
      const topDuplicateId = currentDuplicate?.duplicates[0]?.contact.id;
      if (!topDuplicateId) {
        void handleDuplicateImportAnyway();
        return;
      }
      if (action === "overwrite") void handleDuplicateOverwrite(topDuplicateId);
      else void handleDuplicateMerge(topDuplicateId);
      return;
    }
    void handleDuplicateImportAnyway();
  };

  const reset = () => { countsRef.current = { imported: 0, skipped: 0, merged: 0, overwritten: 0 }; errorListRef.current = []; setFile(null); setData([]); setFieldMappings([]); setStep("upload"); setProgress(0); setImportedCount(0); setSkippedCount(0); setMergedCount(0); setOverwrittenCount(0); setErrors([]); setDuplicateWarnings([]); setCurrentDuplicate(null); setDuplicateStrategy("ask"); setImportQueue([]); };

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
    file, data, fieldMappings, step, progress, importedCount, skippedCount, mergedCount, overwrittenCount, errors,
    duplicateWarnings, currentDuplicate, duplicateStrategy, setDuplicateStrategy,
    handleFileUpload, updateFieldMapping, proceedToPreview, startImport, reset, downloadTemplate,
    handleDuplicateSkip, handleDuplicateOverwrite, handleDuplicateMerge, handleDuplicateImportAnyway, handleDuplicateApplyToAll,
  };
}
