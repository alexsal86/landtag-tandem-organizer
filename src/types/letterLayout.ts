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
  };
  footer: {
    top: number;
    height: number;
  };
  attachments: {
    top: number;
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
  blockContent?: Record<string, Array<{ id: string; type?: string; content?: string; x?: number; y?: number; width?: number; height?: number }>>;
  disabledBlocks?: Array<'header' | 'addressField' | 'infoBlock' | 'subject' | 'content' | 'footer' | 'attachments'>;
  lockedBlocks?: Array<'header' | 'addressField' | 'infoBlock' | 'subject' | 'content' | 'footer' | 'attachments'>;
}

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
    addressZoneHeight: 27.3
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
    top: 98.64,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: 'bold',
    integrated: true
  },
  salutation: {
    template: 'Sehr geehrte Damen und Herren,',
    fontSize: 11
  },
  content: {
    top: 106.64,
    maxHeight: 161,
    lineHeight: 4.5
  },
  footer: {
    top: 272,
    height: 18
  },
  attachments: {
    top: 230
  },
  pagination: {
    enabled: true,
    top: 267.77,
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
