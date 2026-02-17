import PostalMime from 'postal-mime';

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

export async function parseEmlFromArrayBuffer(buffer: ArrayBuffer): Promise<ParsedEmail> {
  const parser = new PostalMime();
  const email = await parser.parse(buffer);

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

export async function parseMsgFromArrayBuffer(buffer: ArrayBuffer): Promise<ParsedEmail> {
  const { default: MsgReader } = await import('@kenjiuno/msgreader');
  const msgReader = new MsgReader(buffer);
  const msgData = msgReader.getFileData();

  const subject = (msgData as any).subject || '(Kein Betreff)';
  const from = (msgData as any).senderEmail || (msgData as any).senderName || 'Unbekannt';
  const toRaw = (msgData as any).recipients || [];
  const toAddresses: string[] = toRaw.map((r: any) => r.email || r.name || '');
  const dateStr = (msgData as any).messageDeliveryTime || (msgData as any).clientSubmitTime || (msgData as any).creationTime || '';
  const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

  // Body: prefer HTML > text > RTF stripped
  const htmlBody: string | null = (msgData as any).htmlBody || (msgData as any).body?.replace ? null : null;
  let bodyHtml: string | null = null;
  let bodyText: string | null = null;

  if ((msgData as any).htmlBody) {
    bodyHtml = (msgData as any).htmlBody;
  } else if ((msgData as any).body) {
    bodyText = (msgData as any).body;
  } else if ((msgData as any).compressedRtf || (msgData as any).rtfBody) {
    const rtf = (msgData as any).rtfBody || (msgData as any).compressedRtf || '';
    if (typeof rtf === 'string') {
      bodyText = stripRtf(rtf);
    }
  }

  // Attachments
  const rawAttachments = (msgData as any).attachments || [];
  const attachments: EmailAttachment[] = rawAttachments
    .filter((att: any) => att.fileName || att.name)
    .map((att: any) => {
      let content = new Uint8Array(0);
      try {
        const attData = msgReader.getAttachment(att);
        if (attData && (attData as any).content) {
          content = new Uint8Array((attData as any).content);
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
