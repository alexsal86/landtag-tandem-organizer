import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

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

export const generateLetterPDF = async (letter: Letter): Promise<{ blob: Blob; filename: string } | null> => {
  try {
    // Create LetterPDFExport component's PDF generation logic inline
    // This ensures 100% identical PDFs by using the EXACT same code
    
    let template: any = null;
    let senderInfo: any = null;
    let informationBlock: any = null;
    let attachments: any[] = [];

    // Fetch template
    if (letter.template_id) {
      const { data: templateData, error: templateError } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('id', letter.template_id)
        .single();

      if (!templateError) {
        template = templateData;
      }
    }

    // Fetch sender info
    if (letter.sender_info_id) {
      const { data: senderData, error: senderError } = await supabase
        .from('sender_information')
        .select('*')
        .eq('id', letter.sender_info_id)
        .single();

      if (!senderError) {
        senderInfo = senderData;
      }
    }

    // Fetch information block
    if (letter.information_block_ids && letter.information_block_ids.length > 0) {
      const { data: blockData, error: blockError } = await supabase
        .from('information_blocks')
        .select('*')
        .eq('id', letter.information_block_ids[0])
        .single();

      if (!blockError) {
        informationBlock = blockData;
      }
    }

    // Fetch attachments
    if (letter.id) {
      const { data: attachmentData, error: attachmentError } = await supabase
        .from('letter_attachments')
        .select('*')
        .eq('letter_id', letter.id)
        .order('created_at');

      if (!attachmentError) {
        attachments = attachmentData || [];
      }
    }

    // HTML to text conversion (EXACT copy from LetterPDFExport)
    const convertHtmlToText = (html: string): string => {
      if (typeof document === 'undefined') return html; // Fallback for server-side
      
      const temp = document.createElement('div');
      temp.innerHTML = html;
      
      const processElement = (element: Element): string => {
        let text = '';
        
        for (const node of Array.from(element.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent || '';
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tagName = el.tagName.toLowerCase();
            
            switch (tagName) {
              case 'br':
                text += '\n';
                break;
              case 'p':
              case 'div':
                text += processElement(el) + '\n\n';
                break;
              case 'h1':
              case 'h2':
              case 'h3':
                text += '\n' + processElement(el).toUpperCase() + '\n\n';
                break;
              case 'li':
                text += '• ' + processElement(el) + '\n';
                break;
              case 'strong':
              case 'b':
                text += processElement(el).toUpperCase();
                break;
              case 'em':
              case 'i':
                text += '_' + processElement(el) + '_';
                break;
              default:
                text += processElement(el);
            }
          }
        }
        
        return text;
      };
      
      return processElement(temp)
        .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
        .trim();
    };

    // Create PDF with EXACT same logic as LetterPDFExport exportWithDIN5008Features function
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // DIN 5008 measurements in mm
    const pageWidth = 210;
    const pageHeight = 297;
    const leftMargin = 25;
    const rightMargin = 20;
    const headerHeight = 45;
    const addressFieldTop = 46;
    const addressFieldLeft = leftMargin;
    const addressFieldWidth = 85;
    const addressFieldHeight = 40;
    const infoBlockTop = 50;
    const infoBlockLeft = 125;
    const infoBlockWidth = 75;
    const contentTop = 98.46;
    
    // Debug helper function for consistent styling across all pages
    const drawDebugGuides = (pageNum: number) => {
      pdf.setLineWidth(0.2);
      
      if (pageNum === 1) {
        // Header line (45mm)
        pdf.setDrawColor(255, 0, 0); // Red
        pdf.line(0, headerHeight, pageWidth, headerHeight);
        pdf.setFontSize(8);
        pdf.setTextColor(255, 0, 0);
        pdf.text("45mm - Header Ende (DIN 5008)", 5, headerHeight - 3);
        
        // Address field with detailed measurements
        pdf.setDrawColor(255, 0, 0);
        pdf.rect(addressFieldLeft, addressFieldTop, addressFieldWidth, addressFieldHeight);
        pdf.text("Adressfeld: 85×40mm @ Position 46mm/25mm", addressFieldLeft, addressFieldTop - 3);
        
        // Address field - Rücksendeangaben 17.7mm-Zone
        pdf.setDrawColor(255, 100, 100);
        pdf.setLineWidth(0.1);
        pdf.rect(addressFieldLeft, addressFieldTop, addressFieldWidth, 17.7);
        pdf.setFontSize(6);
        pdf.text("Rücksendeangaben: 17.7mm Höhe", addressFieldLeft + 2, addressFieldTop + 15);
        
        // Info block
        pdf.setDrawColor(0, 0, 255); // Blue
        pdf.setLineWidth(0.2);
        pdf.rect(infoBlockLeft, infoBlockTop, infoBlockWidth, addressFieldHeight);
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 255);
        pdf.text("Info-Block: 75×40mm @ 50mm/125mm", infoBlockLeft, infoBlockTop - 3);
        
        // Content start line (98.46mm)
        pdf.setDrawColor(0, 255, 0); // Green
        pdf.line(leftMargin, contentTop, pageWidth - rightMargin, contentTop);
        pdf.setTextColor(0, 255, 0);
        pdf.text("98.46mm - Inhaltsbeginn (DIN 5008)", leftMargin, contentTop - 3);
        
        // Measurement annotations
        pdf.setFontSize(6);
        pdf.setTextColor(0, 0, 0);
        
        // Address field position arrows
        pdf.setDrawColor(255, 0, 0);
        pdf.line(0, addressFieldTop, addressFieldLeft - 2, addressFieldTop);
        pdf.text("46mm", 2, addressFieldTop + 2);
        
        // Info block position arrows
        pdf.setDrawColor(0, 0, 255);
        pdf.line(0, infoBlockTop, infoBlockLeft - 2, infoBlockTop);
        pdf.text("50mm", 2, infoBlockTop + 2);
        
        // Content position arrows  
        pdf.setDrawColor(0, 255, 0);
        pdf.line(0, contentTop, leftMargin - 2, contentTop);
        pdf.text("98.46mm", 2, contentTop + 2);
      }
      
      // Left margin guide (all pages)
      pdf.setDrawColor(255, 165, 0); // Orange
      pdf.line(leftMargin, 0, leftMargin, pageHeight);
      pdf.setTextColor(255, 165, 0);
      pdf.setFontSize(8);
      pdf.text("Linker Rand:", leftMargin + 2, 15);
      pdf.text("25mm", leftMargin + 2, 20);
      
      // Right margin guide (all pages)
      pdf.line(pageWidth - rightMargin, 0, pageWidth - rightMargin, pageHeight);
      pdf.text("Rechter Rand:", pageWidth - rightMargin - 25, 15);
      pdf.text("20mm", pageWidth - rightMargin - 15, 20);
      
      // Footer area (272mm from top, 7mm from bottom) (all pages)
      const footerTop = 272;
      const footerBottom = pageHeight - 7;
      
      // Footer box
      pdf.setDrawColor(128, 0, 128); // Purple
      pdf.rect(leftMargin, footerTop, pageWidth - leftMargin - rightMargin, footerBottom - footerTop);
      
      // Footer guide lines
      pdf.line(0, footerTop, pageWidth, footerTop);
      pdf.line(0, footerBottom, pageWidth, footerBottom);
      
      pdf.setTextColor(128, 0, 128);
      pdf.text("Fußzeile: 272mm", 5, footerTop - 2);
      pdf.text("Unterer Rand: 7mm", 5, footerBottom + 3);
      
      // Pagination position (4.23mm above footer)
      const paginationY = footerTop - 4.23;
      pdf.setDrawColor(255, 0, 255); // Magenta
      pdf.rect(leftMargin, paginationY - 2, pageWidth - leftMargin - rightMargin, 4);
      pdf.setTextColor(255, 0, 255);
      pdf.setFontSize(6);
      pdf.text("Paginierung: 4.23mm über Fußzeile", leftMargin + 2, paginationY + 1);
      
      // Page dimensions box
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);
      pdf.rect(pageWidth - 50, 5, 45, 25);
      pdf.setFontSize(7);
      pdf.setTextColor(0, 0, 0);
      pdf.text("DIN A4:", pageWidth - 48, 10);
      pdf.text("210×297mm", pageWidth - 48, 15);
      pdf.text("Font: Arial", pageWidth - 48, 20);
      pdf.text("Size: 11pt", pageWidth - 48, 25);
    };
    
    // Draw debug guides for page 1 (ALWAYS ENABLED for testing)
    drawDebugGuides(1);
    
    // Footer content from template
    const renderFooterBlocks = () => {
      if (!template?.footer_blocks) return;
      
      const footerY = 272 + 3;
      const availableWidth = 165; // 210mm - 25mm left - 20mm right margin
      let currentX = leftMargin;
      
      const footerBlocks = Array.isArray(template.footer_blocks) ? template.footer_blocks : [];
      const sortedBlocks = footerBlocks.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      
      sortedBlocks.forEach((block: any) => {
        if (!block.content) return;
        
        // Calculate width in mm from percentage
        const blockWidth = (block.widthPercent || 25) * availableWidth / 100;
        
        // Set font properties with proper size handling
        const fontSize = Math.max(6, Math.min(14, block.fontSize || 8)); // Clamp font size
        const lineHeight = (block.lineHeight || 1) * fontSize; // Apply line height multiplier
        pdf.setFontSize(fontSize);
        
        // Set font weight
        const fontWeight = block.fontWeight === 'bold' ? 'bold' : 'normal';
        pdf.setFont('helvetica', fontWeight);
        
        // Set color if specified
        if (block.color && block.color.startsWith('#')) {
          try {
            const hex = block.color.substring(1);
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            pdf.setTextColor(r, g, b);
          } catch (e) {
            pdf.setTextColor(0, 0, 0); // Fallback to black
          }
        } else {
          pdf.setTextColor(0, 0, 0);
        }
        
        let blockY = footerY;
        
        // Render block title in bold
        if (block.title) {
          pdf.setFont('helvetica', 'bold');
          const wrappedTitle = pdf.splitTextToSize(block.title, blockWidth - 2);
          wrappedTitle.forEach((titleLine: string) => {
            if (blockY <= 290) {
              pdf.text(titleLine, currentX + 1, blockY);
              blockY += lineHeight;
            }
          });
          blockY += 1; // Small gap after title
          
          // Reset to original font weight for content
          pdf.setFont('helvetica', fontWeight);
        }
        
        // Split content into lines and render within block width
        const lines = block.content.split('\n');
        
        lines.forEach((line: string) => {
          if (blockY > 290) return; // Don't go beyond page bounds
          
          // Use jsPDF's text wrapping for better word breaks
          const wrappedLines = pdf.splitTextToSize(line, blockWidth - 2);
          wrappedLines.forEach((wrappedLine: string) => {
            if (blockY <= 290) {
              pdf.text(wrappedLine, currentX + 1, blockY);
              blockY += lineHeight;
            }
          });
        });
        
        currentX += blockWidth;
      });
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);
    };
    
    renderFooterBlocks();
    
    // Reset colors for content
    pdf.setTextColor(0, 0, 0);
    pdf.setDrawColor(0, 0, 0);
    
    // Template letterhead (if available)
    if (template?.letterhead_html) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(template.name || 'Briefkopf', leftMargin, 20);
    }

    // Render structured header if available
    if (template?.header_layout_type === 'structured' && template?.header_text_elements) {
      // Render text elements
      const textElements = Array.isArray(template.header_text_elements) ? template.header_text_elements : [];
      textElements.forEach(element => {
        if (element.type === 'text' && element.content) {
          pdf.setFontSize(element.fontSize || 12);
          pdf.setFont('helvetica', element.fontWeight === 'bold' ? 'bold' : 'normal');
          
          // Convert hex color to RGB for jsPDF
          if (element.color && element.color.startsWith('#')) {
            const hex = element.color.substring(1);
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            pdf.setTextColor(r, g, b);
          }
          
          pdf.text(element.content, leftMargin + (element.x || 0) * 0.264583, 20 + (element.y || 0) * 0.264583);
        }
      });
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);

      // Render header image if available
      if (template?.header_image_url) {
        try {
          // For now, we'll indicate the image position but not render it directly
          // In a full implementation, you'd need to load and embed the image
          const imgPosition = template.header_image_position || { x: 0, y: 0, width: 200, height: 100 };
          pdf.setDrawColor(200, 200, 200);
          pdf.rect(
            leftMargin + imgPosition.x * 0.264583,
            20 + imgPosition.y * 0.264583,
            imgPosition.width * 0.264583,
            imgPosition.height * 0.264583
          );
          pdf.setFontSize(8);
          pdf.text('[Bild: ' + template.header_image_url.split('/').pop() + ']', 
                   leftMargin + imgPosition.x * 0.264583 + 2, 
                   20 + imgPosition.y * 0.264583 + 10);
        } catch (error) {
          console.warn('Error rendering header image:', error);
        }
      }
    } else if (template?.letterhead_html) {
      // Fallback to HTML/CSS letterhead
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(template.name || 'Briefkopf', leftMargin, 20);
    }
    
    // Return address line in address field - 17.7mm height
    let addressYPos = addressFieldTop + 17.7;
    if (senderInfo?.return_address_line) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(senderInfo.return_address_line, addressFieldLeft, addressYPos - 2);
      
      // Underline for return address
      const textWidth = pdf.getTextWidth(senderInfo.return_address_line);
      pdf.line(addressFieldLeft, addressYPos - 1, addressFieldLeft + textWidth, addressYPos - 1);
      addressYPos += 3;
    }
    
    // Recipient address
    if (letter.recipient_name || letter.recipient_address) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      if (letter.recipient_name) {
        pdf.text(letter.recipient_name, addressFieldLeft, addressYPos);
        addressYPos += 4;
      }
      
      if (letter.recipient_address) {
        const addressLines = letter.recipient_address.split('\n').filter(line => line.trim());
        addressLines.forEach(line => {
          if (addressYPos < addressFieldTop + addressFieldHeight - 2) {
            pdf.text(line.trim(), addressFieldLeft, addressYPos);
            addressYPos += 4;
          }
        });
      }
    }
    
    // Information block
    let infoYPos = infoBlockTop + 3;
    if (informationBlock) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(informationBlock.label || 'Information', infoBlockLeft, infoYPos);
      infoYPos += 5;
      
      pdf.setFont('helvetica', 'normal');
      
      switch (informationBlock.block_type) {
        case 'contact':
          if (informationBlock.block_data?.contact_name) {
            pdf.text(informationBlock.block_data.contact_name, infoBlockLeft, infoYPos);
            infoYPos += 4;
          }
          if (informationBlock.block_data?.contact_phone) {
            pdf.text(`Tel: ${informationBlock.block_data.contact_phone}`, infoBlockLeft, infoYPos);
            infoYPos += 4;
          }
          if (informationBlock.block_data?.contact_email) {
            pdf.text(informationBlock.block_data.contact_email, infoBlockLeft, infoYPos);
            infoYPos += 4;
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
          pdf.text(formatDate(date, informationBlock.block_data?.date_format || 'dd.mm.yyyy'), infoBlockLeft, infoYPos);
          infoYPos += 4;
          if (informationBlock.block_data?.show_time) {
            pdf.text(`${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`, infoBlockLeft, infoYPos);
            infoYPos += 4;
          }
          break;
        case 'reference':
          const refText = `${informationBlock.block_data?.reference_prefix || ''}${letter.reference_number || informationBlock.block_data?.reference_pattern || ''}`;
          pdf.text(refText, infoBlockLeft, infoYPos);
          infoYPos += 4;
          break;
        case 'custom':
          if (informationBlock.block_data?.custom_content) {
            const customLines = informationBlock.block_data.custom_content.split('\n');
            customLines.forEach(line => {
              if (infoYPos < addressFieldTop + addressFieldHeight - 5) {
                pdf.text(line, infoBlockLeft, infoYPos);
                infoYPos += 4;
              }
            });
          }
          break;
      }
    }
    
    // Letter date (ALWAYS show if available, regardless of information block)
    if (letter.letter_date) {
      const hasDateBlock = informationBlock?.block_type === 'date';
      if (!hasDateBlock) {
        if (infoYPos < infoBlockTop + infoBlockWidth - 10) {
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Datum', infoBlockLeft, infoYPos);
          infoYPos += 5;
          pdf.setFont('helvetica', 'normal');
          pdf.text(new Date(letter.letter_date).toLocaleDateString('de-DE'), infoBlockLeft, infoYPos);
          infoYPos += 4;
        }
      }
    }
    
    // Subject line
    if (letter.subject || letter.title) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const subjectText = letter.subject || letter.title;
      pdf.text(subjectText, leftMargin, contentTop + 3);
    }
    
    // Letter content
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    
    const contentText = letter.content_html ? convertHtmlToText(letter.content_html) : letter.content;
    const lineHeight = 4.5;
    
    // Add pagination tracking
    let currentPage = 1;
    let letterPages = 1; // Track only letter content pages
    
    // Function to render text with proper line breaking for each page
    const renderContentText = (text: string, startY: number) => {
      let currentY = startY;
      const paragraphs = text.split('\n\n').filter(p => p.trim());
      
      paragraphs.forEach((paragraph, paragIndex) => {
        // Calculate available width for current page (full width for all pages)
        const currentMaxWidth = pageWidth - leftMargin - rightMargin;
        
        const lines = pdf.splitTextToSize(paragraph.trim(), currentMaxWidth);
        
        lines.forEach((line: string, lineIndex: number) => {
          // Check if we need a new page (keep space for footer and pagination)
          if (currentY > 260) { // Changed from 250 to 260 for more content space
            pdf.addPage();
            letterPages++;
            currentPage++;
            
            // Draw debug guides for new pages
            drawDebugGuides(currentPage);
            
            // Add footer for new page using template footer blocks
            renderFooterBlocks();
            
            // Reset text settings for content
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(0, 0, 0);
            
            currentY = 30; // Start from top margin on new page
          }
          
          pdf.text(line, leftMargin, currentY);
          currentY += lineHeight;
        });
        
        // Add extra space between paragraphs
        if (paragIndex < paragraphs.length - 1) {
          currentY += lineHeight;
        }
      });
      
      return currentY;
    };
    
    // Render content starting after subject
    let contentStartY = contentTop + 12;
    if (letter.subject || letter.title) {
      contentStartY += 8;
    }
    
    const finalY = renderContentText(contentText, contentStartY);
    
    // Add pagination to all pages
    for (let page = 1; page <= letterPages; page++) {
      if (page > 1) {
        pdf.setPage(page);
      }
      
      const paginationY = 272 - 4.23;
      
      // Debug pagination box
      pdf.setFontSize(6);
      pdf.setDrawColor(255, 0, 255);
      pdf.setLineWidth(0.1);
      const pageText = `Seite ${page} von ${letterPages}`;
      const pageTextWidth = pdf.getTextWidth(pageText);
      const pageTextX = (pageWidth - pageTextWidth) / 2;
      pdf.rect(pageTextX - 2, paginationY - 3, pageTextWidth + 4, 5);
      pdf.setTextColor(255, 0, 255);
      pdf.setFontSize(6);
      pdf.text("Pagination: 4.23mm über Fußzeile", pageTextX, paginationY - 4);
      
      // Add page number
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      const pageTextFinal = `Seite ${page} von ${letterPages}`;
      const pageTextWidthFinal = pdf.getTextWidth(pageTextFinal);
      const pageTextXFinal = (pageWidth - pageTextWidthFinal) / 2; // Center horizontally
      pdf.text(pageTextFinal, pageTextXFinal, paginationY);
      pdf.setTextColor(0, 0, 0);
    }

    // Generate filename and return blob
    const fileName = `${letter.title || 'Brief'}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfBlob = pdf.output('blob');
    
    return { blob: pdfBlob, filename: fileName };

  } catch (error) {
    console.error('Error generating PDF:', error);
    return null;
  }
};
