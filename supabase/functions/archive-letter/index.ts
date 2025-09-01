import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { letterId } = await req.json();
    console.log('Processing letter archive for ID:', letterId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch letter with basic details first
    const { data: letter, error: letterError } = await supabase
      .from('letters')
      .select('*')
      .eq('id', letterId)
      .single();

    if (letterError || !letter) {
      console.error('Error fetching letter:', letterError);
      return new Response(
        JSON.stringify({ 
          error: 'Letter not found',
          details: letterError?.message || 'Unknown error'
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Letter fetched:', letter.title);

    // Fetch attachments separately
    const { data: attachments } = await supabase
      .from('letter_attachments')
      .select('*')
      .eq('letter_id', letterId);

    // Add attachments to letter object
    letter.letter_attachments = attachments || [];

    // Fetch additional data like LetterPDFExport component
    let template = null;
    let senderInfo = null;
    let informationBlock = null;

    if (letter.template_id) {
      const { data: templateData } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('id', letter.template_id)
        .single();
      template = templateData;
    }

    if (letter.sender_info_id) {
      const { data: senderData } = await supabase
        .from('sender_information')
        .select('*')
        .eq('id', letter.sender_info_id)
        .single();
      senderInfo = senderData;
    }

    if (letter.information_block_ids && letter.information_block_ids.length > 0) {
      const { data: blockData } = await supabase
        .from('information_blocks')
        .select('*')
        .eq('id', letter.information_block_ids[0])
        .single();
      informationBlock = blockData;
    }

    // Generate PDF using LetterPDFExport logic
    const pdfBuffer = await generateDIN5008PDF(letter, template, senderInfo, informationBlock, attachments);
    
    // Create document file name
    const documentFileName = `letter_${letter.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const filePath = `archived_letters/${documentFileName}`;
    
    // Upload the PDF content to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to upload PDF',
          details: uploadError.message
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('PDF uploaded successfully:', uploadData.path);
    
    // Create document record with PDF content
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert({
        user_id: letter.created_by,
        tenant_id: letter.tenant_id,
        title: `Brief: ${letter.title}`,
        description: `Archivierte Version des Briefes "${letter.title}"`,
        file_name: documentFileName,
        file_path: filePath,
        file_type: 'application/pdf',
        category: 'correspondence',
        tags: ['archiviert', 'brief'],
        status: 'archived',
        document_type: 'archived_letter',
        source_letter_id: letterId,
        archived_attachments: letter.letter_attachments || []
      })
      .select()
      .single();

    if (documentError) {
      console.error('Error creating document record:', documentError);
      throw new Error('Failed to create document record');
    }

    console.log('Document record created:', document.id);

    // Archive attachments as separate documents
    const archivedAttachmentIds = [];
    
    if (letter.letter_attachments && letter.letter_attachments.length > 0) {
      for (const attachment of letter.letter_attachments) {
        const { data: attachmentDoc, error: attachmentError } = await supabase
          .from('documents')
          .insert({
            user_id: letter.created_by,
            tenant_id: letter.tenant_id,
            title: `Anlage: ${attachment.display_name || attachment.file_name}`,
            description: `Anlage zum archivierten Brief "${letter.title}"`,
            file_name: attachment.file_name,
            file_path: attachment.file_path,
            file_type: attachment.file_type,
            file_size: attachment.file_size,
            category: 'correspondence',
            tags: ['anlage', 'archiviert'],
            status: 'archived',
            document_type: 'letter_attachment',
            source_letter_id: letterId
          })
          .select()
          .single();

        if (!attachmentError && attachmentDoc) {
          archivedAttachmentIds.push(attachmentDoc.id);
        }
      }
    }

    // Update letter with archived document reference but keep status as 'sent'
    const { error: updateError } = await supabase
      .from('letters')
      .update({
        archived_document_id: document.id,
        archived_at: new Date().toISOString(),
        archived_by: letter.created_by
      })
      .eq('id', letterId);

    if (updateError) {
      console.error('Error updating letter:', updateError);
      throw new Error('Failed to update letter');
    }

    console.log('Letter archived successfully');

    return new Response(
      JSON.stringify({
        success: true,
        documentId: document.id,
        archivedAttachments: archivedAttachmentIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in archive-letter function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Convert HTML to text (adapted from LetterPDFExport)
function convertHtmlToText(html: string): string {
  // Simple HTML to text conversion for Deno environment
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<strong[^>]*>|<\/strong>/gi, '')
    .replace(/<b[^>]*>|<\/b>/gi, '')
    .replace(/<em[^>]*>|<\/em>/gi, '_')
    .replace(/<i[^>]*>|<\/i>/gi, '_')
    .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .trim();
  
  return text;
}

// Generate DIN 5008 compliant PDF using pdf-lib (adapted from LetterPDFExport)
async function generateDIN5008PDF(letter: any, template: any, senderInfo: any, informationBlock: any, attachments: any[]): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Get standard font (Helvetica is close to Arial)
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // DIN 5008 measurements (converting mm to points: 1mm = 2.834645669291339 points)
  const mmToPoints = (mm: number) => mm * 2.834645669291339;
  
  const pageWidth = mmToPoints(210);  // A4 width
  const pageHeight = mmToPoints(297); // A4 height
  const leftMargin = mmToPoints(25);
  const rightMargin = mmToPoints(20);
  const headerHeight = mmToPoints(45);
  const addressFieldTop = mmToPoints(46);
  const addressFieldLeft = leftMargin;
  const addressFieldWidth = mmToPoints(85);
  const addressFieldHeight = mmToPoints(40);
  const infoBlockTop = mmToPoints(50);
  const infoBlockLeft = mmToPoints(125);
  const infoBlockWidth = mmToPoints(75);
  const contentTop = mmToPoints(98.46);
  const lineHeight = mmToPoints(4.5);
  
  // Add first page
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Template letterhead (if available)
  if (template?.letterhead_html) {
    page.drawText(template.name || 'Briefkopf', {
      x: leftMargin,
      y: pageHeight - mmToPoints(20),
      size: 12,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });
  }
  
  // Return address line in address field
  let addressYPos = pageHeight - addressFieldTop - mmToPoints(17.7);
  if (senderInfo?.return_address_line) {
    page.drawText(senderInfo.return_address_line, {
      x: addressFieldLeft,
      y: addressYPos - mmToPoints(2),
      size: 7,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    
    // Underline for return address
    const textWidth = helveticaFont.widthOfTextAtSize(senderInfo.return_address_line, 7);
    page.drawLine({
      start: { x: addressFieldLeft, y: addressYPos - mmToPoints(1) },
      end: { x: addressFieldLeft + textWidth, y: addressYPos - mmToPoints(1) },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    addressYPos -= mmToPoints(3);
  }
  
  // Recipient address
  if (letter.recipient_name || letter.recipient_address) {
    if (letter.recipient_name) {
      page.drawText(letter.recipient_name, {
        x: addressFieldLeft,
        y: addressYPos,
        size: 9,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      addressYPos -= mmToPoints(4);
    }
    
    if (letter.recipient_address) {
      const addressLines = letter.recipient_address.split('\n').filter((line: string) => line.trim());
      for (const line of addressLines) {
        if (addressYPos > pageHeight - addressFieldTop - addressFieldHeight + mmToPoints(2)) {
          page.drawText(line.trim(), {
            x: addressFieldLeft,
            y: addressYPos,
            size: 9,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
          addressYPos -= mmToPoints(4);
        }
      }
    }
  }
  
  // Information block
  let infoYPos = pageHeight - infoBlockTop - mmToPoints(3);
  if (informationBlock) {
    page.drawText(informationBlock.label || 'Information', {
      x: infoBlockLeft,
      y: infoYPos,
      size: 8,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });
    infoYPos -= mmToPoints(5);
    
    switch (informationBlock.block_type) {
      case 'contact':
        if (informationBlock.block_data?.contact_name) {
          page.drawText(informationBlock.block_data.contact_name, {
            x: infoBlockLeft,
            y: infoYPos,
            size: 8,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
          infoYPos -= mmToPoints(4);
        }
        if (informationBlock.block_data?.contact_phone) {
          page.drawText(`Tel: ${informationBlock.block_data.contact_phone}`, {
            x: infoBlockLeft,
            y: infoYPos,
            size: 8,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
          infoYPos -= mmToPoints(4);
        }
        if (informationBlock.block_data?.contact_email) {
          page.drawText(informationBlock.block_data.contact_email, {
            x: infoBlockLeft,
            y: infoYPos,
            size: 8,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
          infoYPos -= mmToPoints(4);
        }
        break;
      case 'date':
        const date = new Date();
        const formatDate = (date: Date, format: string) => {
          switch (format) {
            case 'dd.mm.yyyy': return date.toLocaleDateString('de-DE');
            case 'dd.mm.yy': return date.toLocaleDateString('de-DE', { year: '2-digit', month: '2-digit', day: '2-digit' });
            case 'yyyy-mm-dd': return date.toISOString().split('T')[0];
            default: return date.toLocaleDateString('de-DE');
          }
        };
        page.drawText(formatDate(date, informationBlock.block_data?.date_format || 'dd.mm.yyyy'), {
          x: infoBlockLeft,
          y: infoYPos,
          size: 8,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        infoYPos -= mmToPoints(4);
        if (informationBlock.block_data?.show_time) {
          page.drawText(`${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`, {
            x: infoBlockLeft,
            y: infoYPos,
            size: 8,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
          infoYPos -= mmToPoints(4);
        }
        break;
      case 'reference':
        const refText = `${informationBlock.block_data?.reference_prefix || ''}${letter.reference_number || informationBlock.block_data?.reference_pattern || ''}`;
        page.drawText(refText, {
          x: infoBlockLeft,
          y: infoYPos,
          size: 8,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        infoYPos -= mmToPoints(4);
        break;
      case 'custom':
        if (informationBlock.block_data?.custom_content) {
          const customLines = informationBlock.block_data.custom_content.split('\n');
          for (const line of customLines) {
            if (infoYPos > pageHeight - addressFieldTop - addressFieldHeight + mmToPoints(5)) {
              page.drawText(line, {
                x: infoBlockLeft,
                y: infoYPos,
                size: 8,
                font: helveticaFont,
                color: rgb(0, 0, 0),
              });
              infoYPos -= mmToPoints(4);
            }
          }
        }
        break;
    }
  }
  
  // Letter date (ALWAYS show if available, regardless of information block)
  if (letter.letter_date) {
    const hasDateBlock = informationBlock?.block_type === 'date';
    if (!hasDateBlock) {
      if (infoYPos > infoBlockTop + infoBlockWidth - mmToPoints(10)) {
        page.drawText('Datum', {
          x: infoBlockLeft,
          y: infoYPos,
          size: 8,
          font: helveticaBoldFont,
          color: rgb(0, 0, 0),
        });
        infoYPos -= mmToPoints(5);
        page.drawText(new Date(letter.letter_date).toLocaleDateString('de-DE'), {
          x: infoBlockLeft,
          y: infoYPos,
          size: 8,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        infoYPos -= mmToPoints(4);
      }
    }
  }
  
  // Subject line
  if (letter.subject || letter.title) {
    const subjectText = letter.subject || letter.title;
    page.drawText(subjectText, {
      x: leftMargin,
      y: pageHeight - contentTop - mmToPoints(3),
      size: 11,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });
  }
  
  // Letter content
  const contentText = letter.content_html ? convertHtmlToText(letter.content_html) : letter.content;
  let currentY = pageHeight - contentTop - mmToPoints(10);
  const paragraphs = contentText.split('\n\n').filter((p: string) => p.trim());
  
  // Split text into lines and handle pagination
  const maxWidth = pageWidth - leftMargin - rightMargin;
  
  for (let paragIndex = 0; paragIndex < paragraphs.length; paragIndex++) {
    const paragraph = paragraphs[paragIndex].trim();
    
    // Simple line breaking - split by max character count (approximation)
    const maxCharsPerLine = Math.floor(maxWidth / (helveticaFont.widthOfTextAtSize('M', 11)));
    const words = paragraph.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length > maxCharsPerLine && currentLine) {
        // Check if we need a new page
        if (currentY - lineHeight < mmToPoints(40)) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - mmToPoints(30);
        }
        
        // Draw current line
        page.drawText(currentLine, {
          x: leftMargin,
          y: currentY,
          size: 11,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        currentY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw remaining text in line
    if (currentLine) {
      // Check if we need a new page
      if (currentY - lineHeight < mmToPoints(40)) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - mmToPoints(30);
      }
      
      page.drawText(currentLine, {
        x: leftMargin,
        y: currentY,
        size: 11,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      currentY -= lineHeight;
    }
    
    // Add extra space between paragraphs
    if (paragIndex < paragraphs.length - 1) {
      currentY -= lineHeight / 2;
    }
  }
  
  // Add footer content to all pages
  const pages = pdfDoc.getPages();
  const footerY = mmToPoints(272 + 3);
  const footerText = "Fraktion GRÜNE im Landtag von Baden-Württemberg • Alexander Salomon • Konrad-Adenauer-Str. 12 • 70197 Stuttgart";
  
  for (let i = 0; i < pages.length; i++) {
    const currentPage = pages[i];
    
    currentPage.drawText(footerText, {
      x: leftMargin + mmToPoints(2),
      y: footerY,
      size: 8,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    
    currentPage.drawText("Tel: 0711 / 2063620", {
      x: leftMargin + mmToPoints(2),
      y: footerY - mmToPoints(4),
      size: 8,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    
    currentPage.drawText("E-Mail: Alexander.Salomon@gruene.landtag-bw.de", {
      x: leftMargin + mmToPoints(2),
      y: footerY - mmToPoints(8),
      size: 8,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    
    currentPage.drawText("Web: https://www.alexander-salomon.de", {
      x: leftMargin + mmToPoints(2),
      y: footerY - mmToPoints(12),
      size: 8,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    
    // Add page numbers (only to letter pages, not attachments)
    if (i < pages.length) { // Assuming all pages are letter pages for now
      const pageText = `Seite ${i + 1} von ${pages.length}`;
      const textWidth = helveticaFont.widthOfTextAtSize(pageText, 10);
      const pageTextX = (pageWidth - textWidth) / 2;
      const paginationY = mmToPoints(267.77);
      
      currentPage.drawText(pageText, {
        x: pageTextX,
        y: paginationY,
        size: 10,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }
  
  // Serialize the PDF document to bytes
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}