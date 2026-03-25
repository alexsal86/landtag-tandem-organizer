import type { ContactCategory } from '@/types/contact';

export type ContactSelectableType = 'person' | 'organization';

export interface ContactListItem {
  id: string;
  user_id?: string;
  tenant_id?: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  contact_type: ContactSelectableType;
  category?: ContactCategory | string;
  avatar_url?: string;
  is_favorite?: boolean;
  usage_count?: number;
  last_used_at?: string;
  business_street?: string;
  business_house_number?: string;
  business_postal_code?: string;
  business_city?: string;
  business_country?: string;
  private_street?: string;
  private_house_number?: string;
  private_postal_code?: string;
  private_city?: string;
  private_country?: string;
  address?: string;
}

export interface ContactListItemWithAddress extends ContactListItem {
  formatted_address?: string;
}

export interface ContactUsageStat {
  contact_id: string;
  usage_count: number | null;
  last_used_at: string | null;
}
