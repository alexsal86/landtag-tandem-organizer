import type { Json, Database } from '@/integrations/supabase/types';
import type { LetterLayoutSettings } from '@/types/letterLayout';

export type DbLetter = Database['public']['Tables']['letters']['Row'];
export type DbLetterAttachment = Database['public']['Tables']['letter_attachments']['Row'];
export type DbLetterTemplateRow = Database['public']['Tables']['letter_templates']['Row'];
export type DbSenderInformation = Database['public']['Tables']['sender_information']['Row'];
export type DbInformationBlock = Database['public']['Tables']['information_blocks']['Row'];

export type LetterStatus = DbLetter['status'];
export type LetterSentMethod = NonNullable<DbLetter['sent_method']>;


export interface HeaderImagePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InformationBlockData {
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  date_format?: string;
  show_time?: boolean;
  reference_prefix?: string;
  reference_pattern?: string;
  custom_content?: string;
}

export interface LetterRecord extends Pick<DbLetter,
  'id' | 'title' | 'content' | 'content_html' | 'recipient_name' | 'recipient_address' | 'template_id' | 'subject' | 'reference_number' | 'sender_info_id' | 'information_block_ids' | 'letter_date' | 'status' | 'sent_date' | 'created_at' | 'show_pagination' | 'contact_id' | 'expected_response_date' | 'created_by' | 'updated_at' | 'tenant_id'> {
  content_nodes?: Json | null;
  sent_method?: LetterSentMethod | null;
  user_id?: string;
  archived_at?: string | null;
}

export type Letter = LetterRecord;

export interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
  header_layout_type?: string | null;
  header_text_elements?: Json | null;
  footer_blocks?: Json | null;
  layout_settings?: LetterLayoutSettings | null;
  header_image_url?: string | null;
  header_image_position?: Json | HeaderImagePosition | null;
}


export interface LetterPdfGenerationResult {
  blob: Blob;
  filename: string;
}

export interface LetterPDFExportProps {
  letter: LetterRecord;
  disabled?: boolean;
  debugMode?: boolean;
  showPagination?: boolean;
  variant?: 'default' | 'icon-only';
  size?: 'sm' | 'default';
  onPDFGenerated?: (pdfBlob: Blob, filename: string) => void;
}

export interface PDFDataState {
  template: LetterTemplate | null;
  senderInfo: DbSenderInformation | null;
  informationBlock: DbInformationBlock | null;
  attachments: DbLetterAttachment[];
  contact: DbContact | null;
}

export type DbContact = {
  id: string;
  name: string;
  gender?: string | null;
  last_name?: string | null;
  business_street?: string | null;
  business_house_number?: string | null;
  business_postal_code?: string | null;
  business_city?: string | null;
  business_country?: string | null;
  title?: string | null;
};


export interface SenderInfoContract {
  name?: string | null;
  organization?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  wahlkreis_street?: string | null;
  wahlkreis_house_number?: string | null;
  wahlkreis_postal_code?: string | null;
  wahlkreis_city?: string | null;
  landtag_street?: string | null;
  landtag_house_number?: string | null;
  landtag_postal_code?: string | null;
  landtag_city?: string | null;
  phone?: string | null;
  email?: string | null;
  wahlkreis_email?: string | null;
  landtag_email?: string | null;
  return_address_line?: string | null;
  website?: string | null;
}

export interface InformationBlockContract {
  label?: string | null;
  block_type?: 'contact' | 'date' | 'reference' | 'custom' | string;
  block_data?: Record<string, unknown> | null;
}

export interface AttachmentContract {
  file_path: string;
  title?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}
