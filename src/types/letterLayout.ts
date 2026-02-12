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
  };
  infoBlock: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  subject: {
    top: number;
    marginBottom: number;
  };
  content: {
    top: number;
    maxHeight: number;
    lineHeight: number;
  };
  footer: {
    top: number;
  };
  attachments: {
    top: number;
  };
  disabledBlocks?: Array<'addressField' | 'infoBlock' | 'subject' | 'content' | 'footer' | 'attachments'>;
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
    top: 46,
    left: 25,
    width: 85,
    height: 40
  },
  infoBlock: {
    top: 50,
    left: 125,
    width: 75,
    height: 40
  },
  subject: {
    top: 101.46,
    marginBottom: 8
  },
  content: {
    top: 109.46,
    maxHeight: 161,
    lineHeight: 4.5
  },
  footer: {
    top: 272
  },
  attachments: {
    top: 230
  }
};
