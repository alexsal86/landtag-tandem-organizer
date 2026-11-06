import { supabase } from "@/integrations/supabase/client";

type ContactAddress = {
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  business_street: string | null;
  business_house_number: string | null;
  business_postal_code: string | null;
  business_city: string | null;
};

/** Empfänger-Anschrift aus einem Kontakt (Privatanschrift vor Geschäftsanschrift). */
export function formatRecipient(c: ContactAddress | null): { name: string; address: string } {
  if (!c) return { name: "", address: "" };
  const name = c.name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  const business = [
    [c.business_street, c.business_house_number].filter(Boolean).join(" ").trim(),
    [c.business_postal_code, c.business_city].filter(Boolean).join(" ").trim(),
  ].filter(Boolean).join("\n");
  return { name, address: c.address?.trim() || business };
}

export async function createLetterFromCase(params: {
  caseItemId: string;
  subject: string;
  tenantId: string;
  userId: string;
}): Promise<string> {
  const { data: item, error: itemError } = await supabase
    .from("case_items")
    .select("contact_id, case_file_id, source_reference")
    .eq("id", params.caseItemId)
    .single();
  if (itemError) throw itemError;

  let contact: ContactAddress | null = null;
  if (item.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select("name, first_name, last_name, address, business_street, business_house_number, business_postal_code, business_city")
      .eq("id", item.contact_id)
      .maybeSingle();
    contact = data;
  }
  const recipient = formatRecipient(contact);

  let reference = item.source_reference ?? null;
  if (item.case_file_id) {
    const { data: file } = await supabase.from("case_files").select("reference_number").eq("id", item.case_file_id).maybeSingle();
    reference = file?.reference_number || reference;
  }

  const id = crypto.randomUUID();
  const { error } = await supabase.from("letters").insert([{
    id,
    tenant_id: params.tenantId,
    created_by: params.userId,
    title: params.subject || "Neuer Brief",
    subject: params.subject || null,
    recipient_name: recipient.name || null,
    recipient_address: recipient.address || null,
    contact_id: item.contact_id ?? null,
    reference_number: reference,
    status: "draft",
  }]);
  if (error) throw error;

  if (item.case_file_id) {
    await supabase.from("case_file_letters").insert([{ case_file_id: item.case_file_id, letter_id: id }]);
  }
  return id;
}
