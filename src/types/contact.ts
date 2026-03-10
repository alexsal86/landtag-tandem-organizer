export type ContactType = "person" | "organization" | "archive";

export interface Contact {
  id: string;
  contact_type: ContactType;
  name: string;
  role?: string | null;
  organization?: string | null;
  organization_id?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  address?: string | null;
  birthday?: string | null;
  website?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  xing?: string | null;
  category?:
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
    | "lobbyist"
    | null;
  priority?: "low" | "medium" | "high" | null;
  last_contact?: string | null;
  avatar_url?: string | null;
  notes?: string | null;
  additional_info?: string | null;
  is_favorite?: boolean | null;
  gender?: string | null;
  legal_form?: string | null;
  industry?: string | null;
  main_contact_person?: string | null;
  business_description?: string | null;
  tags?: string[] | null;
  business_street?: string;
  business_house_number?: string;
  business_postal_code?: string;
  business_city?: string;
  business_country?: string;
}

export type ImportContact = Pick<Contact, "id" | "name" | "email" | "phone" | "organization">;

export type MergeContact = Contact & Record<string, unknown>;
