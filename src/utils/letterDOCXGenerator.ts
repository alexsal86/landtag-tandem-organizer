import { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, HeadingLevel, PageBreak } from 'docx';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Letter {
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
}

interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
}

interface SenderInfo {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

interface InformationBlock {
  id: string;
  block_type: string;
  block_data: any;
}

// Convert HTML content to plain text for DOCX
function htmlToText(html: string): string {
  // Remove HTML tags and convert basic formatting
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
  
  // Clean up multiple newlines
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return text;
}

// Parse content into paragraphs
function parseContentToParagraphs(content: string): Paragraph[] {
  const text = htmlToText(content);
  const paragraphs: Paragraph[] = [];
  
  const lines = text.split('\n');
  let currentParagraph = '';
  
  for (const line of lines) {
    if (line.trim() === '') {
      if (currentParagraph.trim()) {
        paragraphs.push(new Paragraph({
          children: [new TextRun(currentParagraph.trim())],
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
      children: [new TextRun(currentParagraph.trim())],
      spacing: { after: 200 }
    }));
  }
  
  return paragraphs;
}

export async function generateLetterDOCX(letter: Letter): Promise<{ blob: Blob; filename: string } | null> {
  try {
    // Default layout settings
    const DEFAULT_LAYOUT = {
      pageWidth: 210,
      pageHeight: 297,
      margins: { left: 25, right: 20, top: 45, bottom: 25 },
      header: { height: 45, marginBottom: 8.46 },
      addressField: { top: 46, left: 25, width: 85, height: 40 },
      infoBlock: { top: 50, left: 125, width: 75, height: 40 },
      subject: { top: 101.46, marginBottom: 8 },
      content: { top: 109.46, maxHeight: 161, lineHeight: 4.5 },
      footer: { top: 272, height: 18 },
      attachments: { top: 230 }
    };
    
    let layoutSettings = DEFAULT_LAYOUT;
    
    // Fetch template data
    let template: LetterTemplate | null = null;
    if (letter.template_id) {
      const { data: templateData } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('id', letter.template_id)
        .single();
      
      if (templateData) {
        template = templateData;
        // Parse layout_settings from jsonb
        if (templateData.layout_settings && typeof templateData.layout_settings === 'object') {
          layoutSettings = templateData.layout_settings as typeof DEFAULT_LAYOUT;
        }
      }
    }

    // Fetch sender information
    let senderInfo: SenderInfo | null = null;
    if (letter.sender_info_id) {
      const { data: senderData } = await supabase
        .from('sender_information')
        .select('*')
        .eq('id', letter.sender_info_id)
        .single();
      senderInfo = senderData;
    }

    // Fetch information blocks
    let informationBlocks: InformationBlock[] = [];
    if (letter.information_block_ids && letter.information_block_ids.length > 0) {
      const { data: blocksData } = await supabase
        .from('information_blocks')
        .select('*')
        .in('id', letter.information_block_ids);
      informationBlocks = blocksData || [];
    }

    // Prepare document content
    const documentChildren: (Paragraph | PageBreak)[] = [];

    // Header with sender info (if available)
    if (senderInfo) {
      documentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: senderInfo.name,
              bold: true,
              size: 24
            })
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100 }
        })
      );

      if (senderInfo.address) {
        const addressLines = senderInfo.address.split('\n');
        addressLines.forEach(line => {
          documentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: line.trim(), size: 20 })],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 50 }
            })
          );
        });
      }

      if (senderInfo.phone || senderInfo.email) {
        documentChildren.push(
          new Paragraph({
            children: [
              new TextRun({ 
                text: [senderInfo.phone, senderInfo.email].filter(Boolean).join(' | '), 
                size: 20 
              })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 }
          })
        );
      }
    }

    // Recipient address
    if (letter.recipient_name || letter.recipient_address) {
      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "An:", bold: true, size: 22 })],
          spacing: { after: 100 }
        })
      );

      if (letter.recipient_name) {
        documentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: letter.recipient_name, size: 22 })],
            spacing: { after: 50 }
          })
        );
      }

      if (letter.recipient_address) {
        const addressLines = letter.recipient_address.split('\n');
        addressLines.forEach(line => {
          if (line.trim()) {
            documentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: line.trim(), size: 22 })],
                spacing: { after: 50 }
              })
            );
          }
        });
      }

      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "", size: 22 })],
          spacing: { after: 300 }
        })
      );
    }

    // Information blocks (date, reference, etc.)
    informationBlocks.forEach(block => {
      if (block.block_type === 'date') {
        const dateStr = letter.letter_date || letter.created_at;
        const formattedDate = format(new Date(dateStr), 'd. MMMM yyyy', { locale: de });
        
        documentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: formattedDate, size: 22 })],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 }
          })
        );
      } else if (block.block_type === 'reference' && letter.reference_number) {
        documentChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Referenz: ", bold: true, size: 22 }),
              new TextRun({ text: letter.reference_number, size: 22 })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 }
          })
        );
      }
    });

    // Add spacing before subject
    documentChildren.push(
      new Paragraph({
        children: [new TextRun({ text: "", size: 22 })],
        spacing: { after: 200 }
      })
    );

    // Subject
    if (letter.subject) {
      documentChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Betreff: ", bold: true, size: 22 }),
            new TextRun({ text: letter.subject, bold: true, size: 22 })
          ],
          spacing: { after: 300 }
        })
      );
    }

    // Letter content
    const contentParagraphs = parseContentToParagraphs(letter.content || letter.content_html || '');
    documentChildren.push(...contentParagraphs);

    // Footer with sender information
    if (senderInfo) {
      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "", size: 22 })],
          spacing: { after: 400 }
        })
      );

      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "Mit freundlichen Grüßen", size: 22 })],
          spacing: { after: 300 }
        })
      );

      documentChildren.push(
        new Paragraph({
          children: [new TextRun({ text: senderInfo.name, bold: true, size: 22 })],
          spacing: { after: 200 }
        })
      );
    }

    // Helper function to convert mm to twip (1mm = ~56.7 twip)
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
        children: documentChildren.filter((child): child is Paragraph => child instanceof Paragraph)
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
    console.error('Error generating DOCX:', error);
    return null;
  }
}