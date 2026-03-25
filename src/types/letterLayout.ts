import type { Database } from '@/integrations/supabase/types';

export type LetterAttachmentRecord = Database['public']['Tables']['letter_attachments']['Row'];
export type LetterTemplateRecord = Database['public']['Tables']['letter_templates']['Row'];
export type SenderInformationRecord = Database['public']['Tables']['sender_information']['Row'];
export type InformationBlockRecord = Database['public']['Tables']['information_blocks']['Row'];

export type MarginKey = 'top' | 'right' | 'bottom' | 'left';

export type TabRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface RecipientAddress {
  name?: string;
  address?: string;
  recipient_name?: string;
  recipient_address?: string;
  company?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

export type LayoutBlockKey =
  | 'header'
  | 'addressField'
  | 'returnAddress'
  | 'infoBlock'
  | 'subject'
  | 'content'
  | 'footer'
  | 'attachments'
  | 'pagination';

export type LayoutEditorTab =
  | 'canvas-designer'
  | 'header-designer'
  | 'footer-designer'
  | 'layout-settings'
  | 'general'
  | 'block-address'
  | 'block-info'
  | 'block-subject'
  | 'block-content'
  | 'block-attachments';

export interface LetterBlockLine {
  id: string;
  type: string;
  label?: string;
  value?: string;
  content?: string;
  isVariable?: boolean;
  labelBold?: boolean;
  valueBold?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  spacerHeight?: number;
  widthValue?: number;
  widthUnit?: string;
  prefixShape?: 'none' | 'line' | 'circle' | 'rectangle' | 'sunflower' | 'lion' | 'wappen';
}

export interface LineModeBlockData {
  mode: 'lines';
  lines: LetterBlockLine[];
}

export interface LetterCanvasElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'block';
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  blockContent?: string;
  imageUrl?: string;
  blobUrl?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  textLineHeight?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  isVariable?: boolean;
  variablePreviewText?: string;
  shapeType?: 'line' | 'circle' | 'rectangle' | 'sunflower' | 'lion' | 'wappen';
  rotation?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

export interface LetterLayoutBlockConfig {
  key: LayoutBlockKey;
  label: string;
  color: string;
  canMoveX?: boolean;
  canResize?: boolean;
  jumpTo: LayoutEditorTab;
  isCustom?: boolean;
}

export interface LetterLayoutCanvasState {
  selected: LayoutBlockKey;
  zoomLevel: number;
  showRuler: boolean;
  plainPreview: boolean;
}

export interface LetterLayoutToolActions {
  onLayoutChange: (settings: LetterLayoutSettings) => void;
  onJumpToTab?: (tab: LayoutEditorTab) => void;
}

export interface LetterLayoutSettings {
  pageWidth: number;
  pageHeight: number;
  margins: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  header: {
    height: number;
    marginBottom: number;
  };
  addressField: {
    top: number;
    left: number;
    width: number;
    height: number;
    returnAddressHeight?: number;
    addressZoneHeight?: number;
    returnAddressFontSize?: number;
    recipientFontSize?: number;
  };
  infoBlock: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  returnAddress: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  subject: {
    top: number;
    marginBottom: number;
    fontSize?: number;
    fontWeight?: string;
    integrated?: boolean;
    prefixShape?: 'none' | 'line' | 'circle' | 'rectangle' | 'sunflower' | 'lion' | 'wappen';
  };
  salutation?: {
    template: string;
    fontSize?: number;
  };
  content: {
    top: number;
    maxHeight: number;
    lineHeight: number;
    fontSize?: number;
    page2TopMm?: number;
    page2BottomMm?: number;
  };
  footer: {
    top: number;
    height: number;
  };
  attachments: {
    top: number;
  };
  foldHoleMarks?: {
    enabled: boolean;
    left: number;
    strokeWidthPt: number;
    foldMarkWidth: number;
    holeMarkWidth: number;
    topMarkY: number;
    holeMarkY: number;
    bottomMarkY: number;
  };
  pagination?: {
    enabled: boolean;
    top: number;
    align: 'left' | 'center' | 'right';
    fontSize?: number;
  };
  closing?: {
    formula: string;
    signatureName: string;
    signatureTitle?: string;
    signatureImagePath?: string;
    fontSize?: number;
  };
  blockContent?: Record<string, LetterCanvasElement[] | LineModeBlockData>;
  disabledBlocks?: LayoutBlockKey[];
  lockedBlocks?: LayoutBlockKey[];
}

export interface LetterTemplateDataModel extends Omit<LetterTemplateRecord, 'layout_settings' | 'default_info_blocks'> {
  default_info_blocks?: string[] | null;
  layout_settings?: LetterLayoutSettings | null;
}

export type LetterLayoutTemplateLike = {
  layout_settings?: LetterLayoutSettings;
  header_layout_type?: string | null;
  header_text_elements?: LetterCanvasElement[];
};

export const isLetterLayoutSettings = (value: unknown): value is LetterLayoutSettings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<LetterLayoutSettings>;
  return Boolean(
    candidate.pageWidth &&
    candidate.pageHeight &&
    candidate.margins &&
    candidate.header &&
    candidate.addressField &&
    candidate.infoBlock &&
    candidate.subject &&
    candidate.content &&
    candidate.footer &&
    candidate.attachments
  );
};

export const isLineModeBlockData = (value: unknown): value is LineModeBlockData => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<LineModeBlockData>;
  return candidate.mode === 'lines' && Array.isArray(candidate.lines);
};

export const DEFAULT_DIN5008_LAYOUT: LetterLayoutSettings = {
  pageWidth: 210,
  pageHeight: 297,
  margins: {
    left: 25,
    right: 20,
    top: 45,
    bottom: 25
  },
  header: {
    height: 45,
    marginBottom: 8.46
  },
  addressField: {
    top: 45,
    left: 25,
    width: 85,
    height: 45,
    returnAddressHeight: 17.7,
    addressZoneHeight: 27.3,
    returnAddressFontSize: 8,
    recipientFontSize: 10
  },
  infoBlock: {
    top: 50,
    left: 125,
    width: 75,
    height: 40
  },
  returnAddress: {
    top: 50,
    left: 25,
    width: 85,
    height: 17.7
  },
  subject: {
    top: 98.46,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: 'bold',
    integrated: true
  },
  salutation: {
    template: 'Sehr geehrte Damen und Herren,',
    fontSize: 11
  },
  content: {
    top: 98.46,
    maxHeight: 165,
    lineHeight: 4.5,
    fontSize: 11
  },
  footer: {
    top: 272,
    height: 18
  },
  attachments: {
    top: 230
  },
  foldHoleMarks: {
    enabled: true,
    left: 3,
    strokeWidthPt: 1,
    foldMarkWidth: 5,
    holeMarkWidth: 8,
    topMarkY: 105,
    holeMarkY: 148.5,
    bottomMarkY: 210
  },
  pagination: {
    enabled: true,
    top: 263.77,
    align: 'right',
    fontSize: 8
  },
  closing: {
    formula: 'Mit freundlichen Grüßen',
    signatureName: '',
    signatureTitle: '',
    signatureImagePath: '',
    fontSize: 11
  }
};
