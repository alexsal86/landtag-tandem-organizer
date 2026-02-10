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

export async function parseEmlFile(file: File): Promise<ParsedEmail> {
  const arrayBuffer = await file.arrayBuffer();
  const parser = new PostalMime();
  const email = await parser.parse(arrayBuffer);

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
