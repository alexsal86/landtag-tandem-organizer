import PostalMime from 'postal-mime';
import { debugConsole } from '@/utils/debugConsole';
import { hasOwnProperty, isRecord } from '@/utils/typeSafety';

export interface EmailMetadata {
  subject: string;
  from: string;
  to: string[];
  date: string;
  hasHtmlBody: boolean;
  attachmentCount: number;
}

export interface ParsedEmail {
  metadata: EmailMetadata;
  htmlBody: string | null;
  textBody: string | null;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: Uint8Array;
  size: number;
}

interface MsgRecipient {
  email?: string;
  name?: string;
}

interface MsgAttachment {
  fileName?: string;
  name?: string;
  mimeType?: string;
  contentLength?: number;
}

interface MsgPayload {
  subject?: string;
  senderEmail?: string;
  senderName?: string;
  recipients?: ReadonlyArray<MsgRecipient>;
  messageDeliveryTime?: string;
  clientSubmitTime?: string;
  creationTime?: string;
  htmlBody?: string;
  body?: string;
  compressedRtf?: string;
  rtfBody?: string;
  attachments?: ReadonlyArray<MsgAttachment>;
}

interface ParsedMailAddress {
  address?: string;
  name?: string;
}

interface ParsedMailAttachment {
  filename?: string;
  mimeType?: string;
  content?: string | ArrayBuffer | Uint8Array;
}

interface ParsedMail {
  from?: ParsedMailAddress;
  to?: ReadonlyArray<ParsedMailAddress>;
  subject?: string;
  date?: string;
  html?: string;
  text?: string;
  attachments?: ReadonlyArray<ParsedMailAttachment>;
}

export function isParsedMail(value: unknown): value is ParsedMail {
  if (!isRecord(value)) return false;

  if (hasOwnProperty(value, 'subject') && value.subject !== undefined && typeof value.subject !== 'string') return false;
  if (hasOwnProperty(value, 'date') && value.date !== undefined && typeof value.date !== 'string') return false;
  if (hasOwnProperty(value, 'html') && value.html !== undefined && typeof value.html !== 'string') return false;
  if (hasOwnProperty(value, 'text') && value.text !== undefined && typeof value.text !== 'string') return false;

  if (hasOwnProperty(value, 'from') && value.from !== undefined && value.from !== null) {
    if (!isRecord(value.from)) return false;
  }

  if (hasOwnProperty(value, 'to') && value.to !== undefined && value.to !== null) {
    if (!Array.isArray(value.to)) return false;
  }

  if (hasOwnProperty(value, 'attachments') && value.attachments !== undefined && value.attachments !== null) {
    if (!Array.isArray(value.attachments)) return false;
  }

  return true;
}

export function isAttachment(value: unknown): value is MsgAttachment {
  if (!isRecord(value)) return false;
  return Boolean(
    (hasOwnProperty(value, 'fileName') && typeof value.fileName === 'string') ||
    (hasOwnProperty(value, 'name') && typeof value.name === 'string'),
  );
}

function isMsgPayload(value: unknown): value is MsgPayload {
  if (!isRecord(value)) return false;

  if (hasOwnProperty(value, 'recipients') && value.recipients !== undefined && value.recipients !== null && !Array.isArray(value.recipients)) {
    return false;
  }
  if (hasOwnProperty(value, 'attachments') && value.attachments !== undefined && value.attachments !== null && !Array.isArray(value.attachments)) {
    return false;
  }
  return true;
}

export function isEmlFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.eml') || file.type === 'message/rfc822';
}

export function isMsgFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.msg') || file.type === 'application/vnd.ms-outlook';
}

export function isEmailFile(file: File): boolean {
  return isEmlFile(file) || isMsgFile(file);
}

export function getUploadContentType(file: File): string {
  if (isEmlFile(file)) {
    return 'message/rfc822';
  }

  if (isMsgFile(file)) {
    return 'application/vnd.ms-outlook';
  }

  return 'application/octet-stream';
}

export function getUploadContentTypeCandidates(file: File): string[] {
  const primaryType = getUploadContentType(file);

  if (isEmailFile(file) && primaryType !== 'application/octet-stream') {
    return [primaryType, 'application/octet-stream'];
  }

  return [primaryType];
}

/**
 * Strip RTF control words and return plain text.
 */
function stripRtf(rtf: string): string {
  // Remove RTF header/groups
  let text = rtf;
  // Remove {\rtfN ... } wrapper isn't needed; we strip tags inline
  // Remove \par and \line -> newlines
  text = text.replace(/\\par[d]?\s?/gi, '\n');
  text = text.replace(/\\line\s?/g, '\n');
  text = text.replace(/\\tab\s?/g, '\t');
  // Remove {\*\...} groups
  text = text.replace(/\{\\\*\\[^}]*\}/g, '');
  // Remove \uNNNN unicode escapes -> actual chars
  text = text.replace(/\\u(\d+)\??/g, (_, code) => String.fromCharCode(parseInt(code)));
  // Remove remaining control words like \b, \i, \fs24, etc.
  text = text.replace(/\\[a-z]+\d*\s?/gi, '');
  // Remove curly braces
  text = text.replace(/[{}]/g, '');
  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export async function parseEmlFile(file: File): Promise<ParsedEmail> {
  const arrayBuffer = await file.arrayBuffer();
  return parseEmlFromArrayBuffer(arrayBuffer);
}

export async function parseEmlFromArrayBuffer(buffer: unknown): Promise<ParsedEmail> {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error('Ungültiger EML-Buffer.');
  }
  const parser = new PostalMime();
  const rawEmail: unknown = await parser.parse(buffer);
  if (!isParsedMail(rawEmail)) {
    throw new Error('Ungültiges EML-Format.');
  }
  const email = rawEmail;

  const fromAddress = email.from?.address || email.from?.name || 'Unbekannt';
  const toAddresses = (email.to || []).map(t => t.address || t.name || '');

  const attachments: EmailAttachment[] = (email.attachments || []).map(att => {
    const buf = typeof att.content === 'string'
      ? new TextEncoder().encode(att.content)
      : new Uint8Array(att.content as ArrayBuffer);
    return {
      filename: att.filename || 'Anhang',
      mimeType: att.mimeType || 'application/octet-stream',
      content: buf,
      size: buf.byteLength,
    };
  });

  return {
    metadata: {
      subject: email.subject || '(Kein Betreff)',
      from: fromAddress,
      to: toAddresses,
      date: email.date || new Date().toISOString(),
      hasHtmlBody: !!email.html,
      attachmentCount: attachments.length,
    },
    htmlBody: email.html || null,
    textBody: email.text || null,
    attachments,
  };
}

export async function parseMsgFile(file: File): Promise<ParsedEmail> {
  const arrayBuffer = await file.arrayBuffer();
  return parseMsgFromArrayBuffer(arrayBuffer);
}

/**
 * Build a synthetic .eml File from Outlook HTML clipboard content.
 * Returns null if the HTML doesn't look like an Outlook email.
 */
export function buildEmlFromOutlookHtml(html: unknown): File | null {
  if (typeof html !== 'string') {
    return null;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Try to detect Outlook-specific patterns
    const bodyText = doc.body?.textContent?.trim() || '';
    if (!bodyText || bodyText.length < 20) return null;

    // Extract subject from <title> or first heading
    let subject = doc.title?.trim() || '';
    if (!subject) {
      const h1 = doc.querySelector('h1, h2, h3');
      if (h1) subject = h1.textContent?.trim() || '';
    }

    // Try to extract From/To/Date from Outlook header tables or patterns
    let from = '';
    let to = '';
    let date = '';

    // Outlook often renders headers in a table or with specific patterns
    const allText = doc.body?.innerHTML || '';

    // Pattern: "Von:" or "From:" in text
    const vonMatch = allText.match(/(?:Von|From)\s*:\s*(?:<[^>]*>)*\s*([^<\n]+)/i);
    if (vonMatch) from = vonMatch[1].trim();

    const anMatch = allText.match(/(?:An|To)\s*:\s*(?:<[^>]*>)*\s*([^<\n]+)/i);
    if (anMatch) to = anMatch[1].trim();

    const datumMatch = allText.match(/(?:Gesendet|Sent|Datum|Date)\s*:\s*(?:<[^>]*>)*\s*([^<\n]+)/i);
    if (datumMatch) date = datumMatch[1].trim();

    // If we couldn't extract meaningful email data, check if it at least looks like an email
    // (has Von/From pattern or Betreff/Subject pattern)
    const looksLikeEmail = vonMatch || anMatch ||
      /(?:Betreff|Subject)\s*:/i.test(allText) ||
      /(?:outlook|office|microsoft)/i.test(allText);

    if (!looksLikeEmail && !subject) return null;

    // Extract subject from Betreff/Subject line if not found yet
    if (!subject) {
      const betreffMatch = allText.match(/(?:Betreff|Subject)\s*:\s*(?:<[^>]*>)*\s*([^<\n]+)/i);
      if (betreffMatch) subject = betreffMatch[1].trim();
    }

    if (!subject) subject = 'Eingefügte E-Mail';
    if (!from) from = 'Unbekannt';
    if (!date) date = new Date().toUTCString();

    // Build RFC822 .eml content
    const emlContent = [
      `From: ${from}`,
      to ? `To: ${to}` : '',
      `Subject: ${subject}`,
      `Date: ${date}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([emlContent], { type: 'message/rfc822' });
    const safeName = subject.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '').slice(0, 80) || 'email';
    return new File([blob], `${safeName}.eml`, { type: 'message/rfc822', lastModified: Date.now() });
  } catch (e) {
    debugConsole.error('buildEmlFromOutlookHtml error:', e);
    return null;
  }
}

export async function parseMsgFromArrayBuffer(buffer: unknown): Promise<ParsedEmail> {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new Error('Ungültiger MSG-Buffer.');
  }
  const { default: MsgReader } = await import('@kenjiuno/msgreader');
  const msgReader = new MsgReader(buffer);
  const rawMsgData: unknown = msgReader.getFileData();
  if (!isMsgPayload(rawMsgData)) {
    throw new Error('Ungültiges MSG-Format.');
  }
  const msgData = rawMsgData;

  const subject = msgData.subject || '(Kein Betreff)';
  const from = msgData.senderEmail || msgData.senderName || 'Unbekannt';
  const toRaw = msgData.recipients || [];
  const toAddresses: string[] = toRaw.map((recipient) => recipient.email || recipient.name || '');
  const dateStr = msgData.messageDeliveryTime || msgData.clientSubmitTime || msgData.creationTime || '';
  const parsedDate = dateStr ? new Date(dateStr) : null;
  const date = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toISOString()
    : new Date().toISOString();

  // Body: prefer HTML > text > RTF stripped
  let bodyHtml: string | null = null;
  let bodyText: string | null = null;

  if (msgData.htmlBody) {
    bodyHtml = msgData.htmlBody;
  } else if (msgData.body) {
    bodyText = msgData.body;
  } else if (msgData.compressedRtf || msgData.rtfBody) {
    const rtf = msgData.rtfBody || msgData.compressedRtf || '';
    if (typeof rtf === 'string') {
      bodyText = stripRtf(rtf);
    }
  }

  // Attachments
  const rawAttachments = msgData.attachments || [];
  const attachments: EmailAttachment[] = rawAttachments
    .filter(isAttachment)
    .map((att) => {
      let content = new Uint8Array(0);
      try {
        const attData = msgReader.getAttachment(att as unknown as number);
        if (isRecord(attData) && hasOwnProperty(attData, 'content') && attData.content instanceof Uint8Array) {
          content = new Uint8Array(attData.content);
        } else if (isRecord(attData) && hasOwnProperty(attData, 'content') && attData.content instanceof ArrayBuffer) {
          content = new Uint8Array(attData.content);
        }
      } catch {
        // Attachment extraction may fail for some files
      }
      return {
        filename: att.fileName || att.name || 'Anhang',
        mimeType: att.mimeType || 'application/octet-stream',
        content,
        size: content.byteLength || att.contentLength || 0,
      };
    });

  return {
    metadata: {
      subject,
      from,
      to: toAddresses,
      date,
      hasHtmlBody: !!bodyHtml,
      attachmentCount: attachments.length,
    },
    htmlBody: bodyHtml,
    textBody: bodyText,
    attachments,
  };
}
