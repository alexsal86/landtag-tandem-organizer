import type { HeaderElement, TextElement } from '@/components/canvas-engine/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface LetterData {
  subject?: string;
  letterDate?: string;
  referenceNumber?: string;
}

interface SenderData {
  name?: string;
  organization?: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  return_address_line?: string;
}

interface RecipientData {
  name?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

interface InfoBlockData {
  reference?: string;
  handler?: string;
  our_reference?: string;
}

interface AttachmentData {
  display_name?: string;
  file_name?: string;
}

/**
 * Builds a variable map from letter, sender, recipient, and info block data.
 * Keys are the placeholder strings like '{{betreff}}', values are the substituted strings.
 */
export function buildVariableMap(
  letter: LetterData,
  sender?: SenderData | null,
  recipient?: RecipientData | null,
  infoBlock?: InfoBlockData | null,
  attachments?: AttachmentData[] | null,
): Record<string, string> {
  const dateStr = letter.letterDate
    ? format(new Date(letter.letterDate), 'd. MMMM yyyy', { locale: de })
    : format(new Date(), 'd. MMMM yyyy', { locale: de });

  const map: Record<string, string> = {
    '{{betreff}}': letter.subject || '',
    '{{datum}}': dateStr,
    '{{aktenzeichen}}': letter.referenceNumber || infoBlock?.reference || '',
    '{{bearbeiter}}': infoBlock?.handler || sender?.name || '',
    '{{unser_zeichen}}': infoBlock?.our_reference || '',
  };

  // Sender
  if (sender) {
    map['{{absender_name}}'] = sender.name || '';
    map['{{absender_organisation}}'] = sender.organization || '';
    const senderStreet = [sender.street, sender.house_number].filter(Boolean).join(' ');
    map['{{absender_strasse}}'] = senderStreet;
    map['{{absender_plz_ort}}'] = [sender.postal_code, sender.city].filter(Boolean).join(' ');
    map['{{telefon}}'] = sender.phone || '';
    map['{{email}}'] = sender.email || '';
  }

  // Recipient
  if (recipient) {
    map['{{empfaenger_name}}'] = recipient.name || '';
    map['{{empfaenger_strasse}}'] = recipient.street || '';
    map['{{empfaenger_plz}}'] = recipient.postal_code || '';
    map['{{empfaenger_ort}}'] = recipient.city || '';
    map['{{empfaenger_land}}'] = recipient.country || '';
  }

  // Attachments
  if (attachments && attachments.length > 0) {
    map['{{anlagen_liste}}'] = attachments
      .map((a, i) => `${i + 1}. ${a.display_name || a.file_name || ''}`)
      .join('\n');
  } else {
    map['{{anlagen_liste}}'] = '';
  }

  return map;
}

/**
 * Substitutes variable placeholders in canvas elements with real data.
 * Returns a new array; original elements are not mutated.
 */
export function substituteVariables(
  elements: HeaderElement[],
  variableMap: Record<string, string>,
): HeaderElement[] {
  return elements.map(el => {
    if (el.type !== 'text') return el;
    const textEl = el as TextElement;
    if (!textEl.isVariable || !textEl.content) return el;
    const replacement = variableMap[textEl.content];
    if (replacement === undefined) return el;
    return {
      ...textEl,
      content: replacement,
      isVariable: false, // no longer a variable in the rendered output
    };
  });
}

/**
 * BlockLine type for line-based block editing (Info-Block, Address Field).
 */
export interface BlockLine {
  id: string;
  type: 'label-value' | 'spacer' | 'text-only';
  label?: string;
  value?: string;
  isVariable?: boolean;
  labelBold?: boolean;
  valueBold?: boolean;
  fontSize?: number;
  spacerHeight?: number;
}

export interface BlockLineData {
  mode: 'lines';
  lines: BlockLine[];
}

/** Check whether stored data is line-mode or legacy canvas */
export function isLineMode(data: any): data is BlockLineData {
  return data && typeof data === 'object' && data.mode === 'lines' && Array.isArray(data.lines);
}

/**
 * Substitutes variable placeholders in BlockLine[] with real data.
 * Returns a new array; original lines are not mutated.
 */
export function substituteBlockLines(
  lines: BlockLine[],
  variableMap: Record<string, string>,
): BlockLine[] {
  return lines.map(line => {
    if (line.type === 'spacer' || !line.value) return line;
    // Replace all {{...}} occurrences in the value
    let newValue = line.value;
    for (const [placeholder, replacement] of Object.entries(variableMap)) {
      newValue = newValue.split(placeholder).join(replacement);
    }
    if (newValue === line.value) return line;
    return { ...line, value: newValue, isVariable: false };
  });
}
