import type React from 'react';
import type {
  InformationBlockRecord,
  LetterBlockLine,
  LetterCanvasElement,
  LetterAttachmentRecord,
  LetterLayoutTemplateLike,
  LetterLayoutSettings,
  RecipientAddress,
  SenderInformationRecord,
} from '@/types/letterLayout';

export interface DIN5008LetterLayoutProps {
  template?: LetterLayoutTemplateLike;
  senderInfo?: SenderInformationRecord | null;
  informationBlock?: InformationBlockRecord[] | null;
  recipientAddress?: RecipientAddress | string;
  content: string;
  subject?: string;
  letterDate?: string;
  referenceNumber?: string;
  attachments?: LetterAttachmentRecord[];
  className?: string;
  debugMode?: boolean;
  showPagination?: boolean;
  layoutSettings?: LetterLayoutSettings;
  salutation?: string;
  hideClosing?: boolean;
  // Canvas-based block elements (substituted)
  addressFieldElements?: LetterCanvasElement[];
  returnAddressElements?: LetterCanvasElement[];
  infoBlockElements?: LetterCanvasElement[];
  subjectElements?: LetterCanvasElement[];
  attachmentElements?: LetterCanvasElement[];
  footerTextElements?: LetterCanvasElement[];
  // Line-mode block data (substituted)
  addressFieldLines?: LetterBlockLine[];
  returnAddressLines?: LetterBlockLine[];
  infoBlockLines?: LetterBlockLine[];
  // Multi-page support
  allowContentOverflow?: boolean;
  contentRef?: React.Ref<HTMLDivElement>;
}
