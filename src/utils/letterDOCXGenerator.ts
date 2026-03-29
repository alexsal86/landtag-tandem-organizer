import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { debugConsole } from '@/utils/debugConsole';
import { buildVariableMap } from '@/lib/letterVariables';
import type { DbInformationBlock, DbSenderInformation, DbContact } from '@/components/letter-pdf/types';
import type { LetterPdfGenerationResult, LetterRecord, LetterTemplate } from '@/components/letter-pdf/types';
import { DEFAULT_DIN5008_LAYOUT, isLetterLayoutSettings, type LetterLayoutSettings } from '@/types/letterLayout';

// Convert HTML content to plain text for DOCX
function htmlToText(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
  
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  return text;
}

// Parse content into paragraphs
function parseContentToParagraphs(content: string, fontSizeHalfPt = 22): Paragraph[] {
  const text = htmlToText(content);
  const paragraphs: Paragraph[] = [];
  
  const lines = text.split('\n');
  let currentParagraph = '';
  
  for (const line of lines) {
    if (line.trim() === '') {
      if (currentParagraph.trim()) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: currentParagraph.trim(), size: fontSizeHalfPt })],
          spacing: { after: 200 }
        }));
        currentParagraph = '';
      }
    } else {
      if (currentParagraph) {
        currentParagraph += ' ';
      }
      currentParagraph += line.trim();
    }
  }
  
  if (currentParagraph.trim()) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: currentParagraph.trim(), size: fontSizeHalfPt })],
      spacing: { after: 200 }
    }));
  }
  
  return paragraphs;
}

export async function generateLetterDOCX(letter: LetterRecord): Promise<LetterPdfGenerationResult | null> {
  try {
    const DEFAULT_LAYOUT: LetterLayoutSettings = { ...DEFAULT_DIN5008_LAYOUT };
    let layoutSettings: LetterLayoutSettings = DEFAULT_LAYOUT;

    // Fetch template data
    let template: LetterTemplate | null = null;
    if (letter.template_id) {
      const { data: templateData } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('id', letter.template_id)
        .single();
      
      if (templateData) {
        template = templateData as LetterTemplate;
        if (isLetterLayoutSettings(templateData.layout_settings)) {
          layoutSettings = templateData.layout_settings;
        }
      }
    }

    // Fetch sender information
    let senderInfo: DbSenderInformation | null = null;
    if (letter.sender_info_id) {
      const { data: senderData } = await supabase
        .from('sender_information')
        .select('*')
        .eq('id', letter.sender_info_id)
        .single();
      senderInfo = senderData as DbSenderInformation | null;
    }

    // Fetch information blocks
    let informationBlocks: DbInformationBlock[] = [];
    if (letter.information_block_ids && letter.information_block_ids.length > 0) {
      const { data: blocksData } = await supabase
        .from('information_blocks')
        .select('*')
        .in('id', letter.information_block_ids);
      informationBlocks = blocksData ?? [];
    }

    // Fetch contact for variable substitution
    let contact: DbContact | null = null;
    if (letter.contact_id) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, name, gender, last_name, business_street, business_house_number, business_postal_code, business_city, business_country, title')
        .eq('id', letter.contact_id)
        .maybeSingle();
      contact = contactData as DbContact | null;
    }

    // Fetch attachments
    let attachments: Array<{ display_name: string | null; file_name: string }> = [];
    if (letter.id) {
      const { data: attachmentData } = await supabase
        .from('letter_attachments')
        .select('display_name, file_name')
        .eq('letter_id', letter.id)
        .order('created_at');
      attachments = attachmentData ?? [];
    }

    // Build variable map
    const recipientVarData = contact ? {
      name: contact.name,
      street: [contact.business_street, contact.business_house_number].filter(Boolean).join(' '),
      postal_code: contact.business_postal_code || '',
      city: contact.business_city || '',
      country: contact.business_country || '',
      gender: contact.gender || '',
      title: contact.title || '',
      last_name: contact.last_name || contact.name?.split(' ').pop() || '',
    } : letter.recipient_name ? { name: letter.recipient_name, street: '', postal_code: '', city: '', country: '' } : null;

    const senderVarData = senderInfo ? {
      name: senderInfo.name ?? undefined, organization: senderInfo.organization ?? undefined,
      landtag_street: senderInfo.landtag_street ?? undefined,
      landtag_house_number: senderInfo.landtag_house_number ?? undefined,
      landtag_postal_code: senderInfo.landtag_postal_code ?? undefined,
      landtag_city: senderInfo.landtag_city ?? undefined,
      wahlkreis_street: senderInfo.wahlkreis_street ?? undefined,
      wahlkreis_house_number: senderInfo.wahlkreis_house_number ?? undefined,
      wahlkreis_postal_code: senderInfo.wahlkreis_postal_code ?? undefined,
      wahlkreis_city: senderInfo.wahlkreis_city ?? undefined,
      phone: senderInfo.phone ?? undefined,
      wahlkreis_email: senderInfo.wahlkreis_email ?? undefined,
      landtag_email: senderInfo.landtag_email ?? undefined,
      return_address_line: senderInfo.return_address_line ?? undefined,
      website: senderInfo.website ?? undefined,
    } : null;

    const varMap = buildVariableMap(
      { subject: letter.subject || '', letterDate: letter.letter_date || undefined, referenceNumber: letter.reference_number || undefined },
      senderVarData, recipientVarData, null, []
    );

    // Prepare document content
    const documentChildren: Paragraph[] = [];
    const contentFontSize = Math.round((layoutSettings.content?.fontSize || 11) * 2);

    // Header with sender info
    if (senderInfo) {
      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: senderInfo.name, bold: true, size: 24 })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100 }
        })
      );

      const senderAddress = [
        senderInfo.return_address_line,
        [senderInfo.landtag_street, senderInfo.landtag_house_number].filter(Boolean).join(' '),
        [senderInfo.landtag_postal_code, senderInfo.landtag_city].filter(Boolean).join(' '),
      ].filter((line): line is string => Boolean(line && line.trim()));

      senderAddress.forEach(line => {
        documentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: line.trim(), size: 20 })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 50 }
          })
        );
      });

      // Also check wahlkreis address
      const wahlkreisAddress = [
        [senderInfo.wahlkreis_street, senderInfo.wahlkreis_house_number].filter(Boolean).join(' '),
        [senderInfo.wahlkreis_postal_code, senderInfo.wahlkreis_city].filter(Boolean).join(' '),
      ].filter((line): line is string => Boolean(line && line.trim()));
      
      if (wahlkreisAddress.length > 0) {
        documentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Wahlkreisbüro:', bold: true, size: 20 })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 50 }
          })
        );
        wahlkreisAddress.forEach(line => {
          documentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: line.trim(), size: 20 })],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 50 }
            })
          );
        });
      }

      if (senderInfo.phone || senderInfo.landtag_email) {
        documentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: [senderInfo.phone, senderInfo.landtag_email].filter(Boolean).join(' | '), size: 20 })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          })
        );
      }
    }

    // Recipient address
    if (letter.recipient_name || letter.recipient_address) {
      if (letter.recipient_name) {
        documentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: letter.recipient_name, size: contentFontSize })],
            spacing: { after: 50 }
          })
        );
      }

      if (letter.recipient_address) {
        letter.recipient_address.split('\n').forEach(line => {
          if (line.trim()) {
            documentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: line.trim(), size: contentFontSize })],
                spacing: { after: 50 }
              })
            );
          }
        });
      }

      documentChildren.push(
        new Paragraph({ children: [new TextRun({ text: '', size: contentFontSize })], spacing: { after: 300 } })
      );
    }

    // Information blocks (date, reference, etc.)
    informationBlocks.forEach(block => {
      if (block.block_type === 'date') {
        const dateStr = letter.letter_date || letter.created_at;
        const formattedDate = format(new Date(dateStr), 'd. MMMM yyyy', { locale: de });
        documentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: formattedDate, size: contentFontSize })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 }
          })
        );
      } else if (block.block_type === 'reference' && letter.reference_number) {
        documentChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Referenz: ', bold: true, size: 22 }),
              new TextRun({ text: letter.reference_number, size: 22 })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 }
          })
        );
      }
    });

    // Spacing before subject
    documentChildren.push(
      new Paragraph({ children: [new TextRun({ text: '', size: contentFontSize })], spacing: { after: 200 } })
    );

    // Subject
    if (letter.subject) {
      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: letter.subject, bold: true, size: Math.round((layoutSettings.subject?.fontSize || 13) * 2) })],
          spacing: { after: 300 }
        })
      );
    }

    // Salutation (with variable substitution)
    let salutationText = layoutSettings.salutation?.template || '';
    if (salutationText === '{{anrede}}') {
      salutationText = varMap['{{anrede}}'] || 'Sehr geehrte Damen und Herren,';
    } else if (salutationText.includes('{{')) {
      for (const [placeholder, value] of Object.entries(varMap)) {
        salutationText = salutationText.split(placeholder).join(value);
      }
    }
    if (salutationText) {
      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: salutationText, size: contentFontSize })],
          spacing: { after: 200 }
        })
      );
    }

    // Letter content
    const contentParagraphs = parseContentToParagraphs(letter.content || letter.content_html || '', contentFontSize);
    documentChildren.push(...contentParagraphs);

    // Closing formula (from layout settings, not hardcoded)
    const closingFormula = layoutSettings.closing?.formula || 'Mit freundlichen Grüßen';
    documentChildren.push(
      new Paragraph({ children: [new TextRun({ text: '', size: contentFontSize })], spacing: { after: 200 } })
    );
    documentChildren.push(
      new Paragraph({
        children: [new TextRun({ text: closingFormula, size: contentFontSize })],
        spacing: { after: 300 }
      })
    );

    // Signature name (from layout settings)
    const signatureName = layoutSettings.closing?.signatureName || senderInfo?.name;
    if (signatureName) {
      // Add gap for signature image
      if (layoutSettings.closing?.signatureImagePath) {
        documentChildren.push(
          new Paragraph({ children: [new TextRun({ text: '', size: contentFontSize })], spacing: { after: 600 } })
        );
      }
      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: signatureName, bold: true, size: contentFontSize })],
          spacing: { after: 100 }
        })
      );
    }

    // Signature title
    if (layoutSettings.closing?.signatureTitle) {
      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: layoutSettings.closing.signatureTitle, size: contentFontSize })],
          spacing: { after: 200 }
        })
      );
    }

    // Attachments list
    if (attachments.length > 0) {
      documentChildren.push(
        new Paragraph({ children: [new TextRun({ text: '', size: contentFontSize })], spacing: { after: 200 } })
      );
      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: 'Anlagen:', size: contentFontSize })],
          spacing: { after: 100 }
        })
      );
      attachments.forEach(a => {
        const name = a.display_name || a.file_name;
        documentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `  ${name}`, size: contentFontSize })],
            spacing: { after: 50 },
            indent: { left: 284 } // ~5mm indent
          })
        );
      });
    }

    // Convert mm to twip
    const convertMillimetersToTwip = (mm: number): number => Math.round(mm * 56.692913386);

    // Create the document
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(layoutSettings.pageWidth),
              height: convertMillimetersToTwip(layoutSettings.pageHeight),
            },
            margin: {
              top: convertMillimetersToTwip(layoutSettings.margins.top),
              right: convertMillimetersToTwip(layoutSettings.margins.right),
              bottom: convertMillimetersToTwip(layoutSettings.margins.bottom),
              left: convertMillimetersToTwip(layoutSettings.margins.left),
            }
          }
        },
        children: documentChildren
      }]
    });

    // Generate blob
    const blob = await Packer.toBlob(doc);
    
    // Generate filename
    const sanitizedTitle = (letter.title || 'Brief')
      .replace(/[<>:"/\\|?*]/g, '')
      .substring(0, 50);
    
    const dateStr = letter.letter_date || letter.created_at;
    const formattedDate = format(new Date(dateStr), 'yyyy-MM-dd');
    
    const filename = `${sanitizedTitle}_${formattedDate}.docx`;

    return { blob, filename };

  } catch (error) {
    debugConsole.error('Error generating DOCX:', error);
    return null;
  }
}