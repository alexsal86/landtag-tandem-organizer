import { supabase } from '@/integrations/supabase/client';

export interface Letter {
  id: string;
  title: string;
  content: string;
  content_html?: string;
  content_nodes?: any;
  recipient_name?: string;
  recipient_address?: string;
  contact_id?: string;
  template_id?: string;
  subject?: string;
  reference_number?: string;
  sender_info_id?: string;
  information_block_ids?: string[];
  letter_date?: string;
  status: 'draft' | 'review' | 'approved' | 'sent' | 'pending_approval' | 'revision_requested';
  sent_date?: string;
  sent_method?: 'post' | 'email' | 'both';
  expected_response_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  show_pagination?: boolean;
  submitted_for_review_at?: string;
  submitted_for_review_by?: string;
  submitted_to_user?: string;
  approved_at?: string;
  approved_by?: string;
  sent_at?: string;
  sent_by?: string;
  workflow_locked?: boolean;
  // Extended fields used in editor (cast via `as any` in original)
  salutation_override?: string;
  closing_formula?: string;
  closing_name?: string;
}

export interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
  is_default: boolean | null;
  is_active: boolean | null;
  default_sender_id?: string | null;
  default_info_blocks?: string[] | null;
  layout_settings?: any;
}

export interface Contact {
  id: string;
  name: string;
  organization?: string | null;
  gender?: string | null;
  last_name?: string | null;
  private_street?: string | null;
  private_house_number?: string | null;
  private_postal_code?: string | null;
  private_city?: string | null;
  private_country?: string | null;
  business_street?: string | null;
  business_house_number?: string | null;
  business_postal_code?: string | null;
  business_city?: string | null;
  business_country?: string | null;
}

export interface LetterCollaborator {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profiles: {
    display_name: string | null;
  };
}

export const DEFAULT_LETTER_FONT_STACK = 'Calibri, Carlito, "Segoe UI", Arial, sans-serif';

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  review: 'Zur Freigabe',
  pending_approval: 'Zur Freigabe',
  approved: 'Freigegeben',
  revision_requested: 'Überarbeitung',
  sent: 'Versendet',
};

export const SENT_METHOD_LABELS: Record<string, string> = {
  post: 'Post',
  email: 'E-Mail',
  both: 'Post & E-Mail',
};

export const STATUS_FLOW: Record<string, string> = {
  draft: 'pending_approval',
  pending_approval: 'approved',
  revision_requested: 'pending_approval',
  approved: 'sent',
  // Legacy mapping
  review: 'approved',
};

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval'],
  review: ['approved', 'revision_requested'], // legacy
  pending_approval: ['approved', 'revision_requested'],
  revision_requested: ['pending_approval'],
  approved: ['sent'],
  sent: [],
};

export const getNextStatus = (currentStatus: string) => STATUS_FLOW[currentStatus];

export const canTransitionStatus = (fromStatus: string, toStatus: string) =>
  ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus) || false;

export const findFontFamilyInLexicalNode = (node: any): string | null => {
  if (!node || typeof node !== 'object') return null;
  if (typeof node.style === 'string') {
    const match = node.style.match(/font-family\s*:\s*([^;]+)/i);
    if (match?.[1]) return match[1].trim();
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const childFont = findFontFamilyInLexicalNode(child);
      if (childFont) return childFont;
    }
  }
  return null;
};

export const extractFontFamilyFromContentNodes = (contentNodes?: unknown): string | null => {
  if (!contentNodes) return null;
  let parsed: any = contentNodes;
  if (typeof contentNodes === 'string') {
    try { parsed = JSON.parse(contentNodes); } catch { return null; }
  }
  return findFontFamilyInLexicalNode(parsed?.root || parsed);
};

export const formatContactAddress = (contact: Contact, useBusinessAddress = false) => {
  const street = useBusinessAddress ? contact.business_street : contact.private_street;
  const houseNumber = useBusinessAddress ? contact.business_house_number : contact.private_house_number;
  const postalCode = useBusinessAddress ? contact.business_postal_code : contact.private_postal_code;
  const city = useBusinessAddress ? contact.business_city : contact.private_city;
  const country = useBusinessAddress ? contact.business_country : contact.private_country;

  const addressParts = [
    contact.organization && useBusinessAddress ? contact.organization : null,
    contact.name,
    street && houseNumber ? `${street} ${houseNumber}` : (street || houseNumber),
    postalCode && city ? `${postalCode} ${city}` : (postalCode || city),
    country,
  ].filter(Boolean);

  return addressParts.join('\n');
};

export const getLetterAssetPublicUrl = (storagePath?: string | null): string | null => {
  if (!storagePath) return null;
  const { data } = supabase.storage.from('letter-assets').getPublicUrl(storagePath);
  return data?.publicUrl || null;
};
