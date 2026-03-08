export interface Letter {
  id: string;
  title: string;
  content: string;
  content_html?: string;
  recipient_name?: string;
  recipient_address?: string;
  template_id?: string;
  subject?: string;
  reference_number?: string;
  sender_info_id?: string;
  information_block_ids?: string[];
  letter_date?: string;
  status: string;
  sent_date?: string;
  created_at: string;
  show_pagination?: boolean;
}

export interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
  header_layout_type?: any;
  header_text_elements?: any;
  footer_blocks?: any;
}

export interface LetterPDFExportProps {
  letter: Letter;
  disabled?: boolean;
  debugMode?: boolean;
  showPagination?: boolean;
  variant?: 'default' | 'icon-only';
  size?: 'sm' | 'default';
  onPDFGenerated?: (pdfBlob: Blob, filename: string) => void;
}
