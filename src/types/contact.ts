export type ContactType = "person" | "organization" | "archive";

export type ContactCategory =
  | "citizen"
  | "colleague"
  | "business"
  | "media"
  | "organization"
  | "government"
  | "ngo"
  | "academia"
  | "healthcare"
  | "legal"
  | "other"
  | "lobbyist";

export type ContactPriority = "low" | "medium" | "high";

export interface ContactCommunicationFields {
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  xing?: string | null;
}

export interface ContactBase extends ContactCommunicationFields {
  id: string;
  contact_type: ContactType;
  name: string;
  role?: string | null;
  organization?: string | null;
  organization_id?: string | null;
  address?: string | null;
  birthday?: string | null;
  category?: ContactCategory | null;
  priority?: ContactPriority | null;
  last_contact?: string | null;
  avatar_url?: string | null;
  notes?: string | null;
  is_favorite?: boolean | null;
  gender?: string | null;
  tags?: string[] | null;
  business_street?: string | null;
  business_house_number?: string | null;
  business_postal_code?: string | null;
  business_city?: string | null;
  business_country?: string | null;
}

export interface PersonContact extends ContactBase {
  contact_type: "person";
}

export interface OrganizationContact extends ContactBase {
  contact_type: "organization";
}

export interface ArchivedContact extends ContactBase {
  contact_type: "archive";
}

export type Contact = PersonContact | OrganizationContact | ArchivedContact;

export type EditableContact = Omit<ContactBase, "contact_type"> & {
  contact_type: Exclude<ContactType, "archive">;
};

export type ContactDuplicateCandidate = Pick<
  ContactBase,
  "id" | "name" | "email" | "phone" | "organization" | "organization_id"
> & {
  contact_type?: ContactType | null;
};

export type ImportContact = Pick<ContactBase, "id" | "name" | "email" | "phone" | "organization">;

export type MergeContact = Contact & Record<string, unknown>;
