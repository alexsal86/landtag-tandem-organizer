import type { ContactOption } from "./types";
import { FIELD_SECTIONS } from "./constants";

export function getContactDetails(contact?: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  if (!contact) {
    return {
      contact_name: undefined,
      contact_info: undefined,
    };
  }

  const contactInfo = `${contact.email || ""}${contact.phone ? ` | ${contact.phone}` : ""}`
    .trim()
    .replace(/^\|/, '')
    .trim();

  return {
    contact_name: contact.name || undefined,
    contact_info: contactInfo || undefined,
  };
}

export function getPartnerInitials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

export function getPartnerSearchResults(
  contacts: ContactOption[],
  partnerSearchTexts: Record<string, string>,
  partnerId: string,
): ContactOption[] {
  const searchText = partnerSearchTexts[partnerId] || '';
  if (searchText.length < 2) return [];
  const lower = searchText.toLowerCase();
  return contacts.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 8);
}

export function getFilledFieldsCount(
  sectionKey: string,
  editData: Record<string, unknown>,
): string {
  const section = FIELD_SECTIONS[sectionKey as keyof typeof FIELD_SECTIONS];
  const filledCount = section.fields.filter((field) => {
    const val = editData[field.key];
    return typeof val === 'string' && val.trim();
  }).length;
  return `${filledCount}/${section.fields.length}`;
}
