import React, { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

interface LetterPDFExportProps {
  letter: Letter;
  disabled?: boolean;
  debugMode?: boolean;
  showPagination?: boolean;
}

const LetterPDFExport: React.FC<LetterPDFExportProps> = ({
  letter,
  disabled = false,
  debugMode = false,
  showPagination = false
}) => {
  const { toast } = useToast();
  const [template, setTemplate] = useState<LetterTemplate | null>(null);
  const [senderInfo, setSenderInfo] = useState<any>(null);
  const [informationBlock, setInformationBlock] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);

  // Fetch template and DIN 5008 data when letter changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch template
        if (letter.template_id) {
          const { data: templateData, error: templateError } = await supabase
            .from('letter_templates')
            .select('*')
            .eq('id', letter.template_id)
            .single();

          if (templateError) throw templateError;
          setTemplate(templateData);
        } else {
          setTemplate(null);
        }

        // Fetch sender info
        if (letter.sender_info_id) {
          const { data: senderData, error: senderError } = await supabase
            .from('sender_information')
            .select('*')
            .eq('id', letter.sender_info_id)
            .single();

          if (senderError) throw senderError;
          setSenderInfo(senderData);
        } else {
          setSenderInfo(null);
        }

        // Fetch information block
        if (letter.information_block_ids && letter.information_block_ids.length > 0) {
          const { data: blockData, error: blockError } = await supabase
            .from('information_blocks')
            .select('*')
            .eq('id', letter.information_block_ids[0])
            .single();

          if (blockError) throw blockError;
          setInformationBlock(blockData);
        } else {
          setInformationBlock(null);
        }

        // Fetch attachments
        if (letter.id) {
          const { data: attachmentData, error: attachmentError } = await supabase
            .from('letter_attachments')
            .select('*')
            .eq('letter_id', letter.id)
            .order('created_at');

          if (attachmentError) throw attachmentError;
          setAttachments(attachmentData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [letter.template_id, letter.sender_info_id, letter.information_block_ids, letter.id]);

  const convertHtmlToText = (html: string): string => {
    // Create temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Convert common HTML elements to text equivalents
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

  const exportToPDF = async () => {
    try {
      // Use enhanced DIN 5008 export if we have DIN fields or prefer simple export
      if (letter.subject || letter.reference_number || senderInfo || informationBlock) {
        await exportWithDIN5008Features();
      } else if (template) {
        await exportWithTemplate();
      } else {
        await exportWithoutTemplate();
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export-Fehler",
        description: "Der Brief konnte nicht als PDF exportiert werden.",
        variant: "destructive",
      });
    }
  };

  const exportWithDIN5008Features = async () => {
    try {
      // Create PDF with DIN 5008 compliant layout using text
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // DIN 5008 measurements in mm
      const pageWidth = 210;
      const pageHeight = 297;
      const leftMargin = 25;
      const rightMargin = 20;
      const headerHeight = 45;
      const addressFieldTop = 46; // Adressfeld bei 46mm 
      const addressFieldLeft = leftMargin;
      const addressFieldWidth = 85;
      const addressFieldHeight = 40;
      const infoBlockTop = 50; // Info-Block bei 50mm
      const infoBlockLeft = 125;
      const infoBlockWidth = 75;
      const contentTop = 98.46; // Betreff/Inhalt beginnt bei 98.46mm
      
      // Debug mode: Draw comprehensive DIN 5008 guides (ALWAYS ENABLED for testing)
      if (true) { // Force debug mode ON
        pdf.setLineWidth(0.2);
        
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
        
        // Left margin guide
        pdf.setDrawColor(255, 165, 0); // Orange
        pdf.line(leftMargin, 0, leftMargin, pageHeight);
        pdf.setTextColor(255, 165, 0);
        pdf.text("Linker Rand:", leftMargin + 2, 15);
        pdf.text("25mm", leftMargin + 2, 20);
        
        // Right margin guide
        pdf.line(pageWidth - rightMargin, 0, pageWidth - rightMargin, pageHeight);
        pdf.text("Rechter Rand:", pageWidth - rightMargin - 25, 15);
        pdf.text("20mm", pageWidth - rightMargin - 15, 20);
        
        // Footer area (272mm from top, 7mm from bottom)
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
        
        // Footer content
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        const footerY = footerTop + 3;
        pdf.text("Fraktion GRÜNE im Landtag von Baden-Württemberg • Alexander Salomon • Konrad-Adenauer-Str. 12 • 70197 Stuttgart", leftMargin + 2, footerY);
        pdf.text("Tel: 0711 / 2063620", leftMargin + 2, footerY + 4);
        pdf.text("E-Mail: Alexander.Salomon@gruene.landtag-bw.de", leftMargin + 2, footerY + 8);
        pdf.text("Web: https://www.alexander-salomon.de", leftMargin + 2, footerY + 12);
        
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
      
      // Reset colors for content
      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(0, 0, 0);
      
      // Template letterhead (if available)
      if (template?.letterhead_html) {
        // For template, we'll add a simple header text
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(template.name || 'Briefkopf', leftMargin, 20);
      }
      
      // Return address line in address field - 17.7mm height
      let addressYPos = addressFieldTop + 17.7; // Rücksendeangaben sind 17.7mm hoch
      if (senderInfo?.return_address_line) {
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        // Position text at bottom of 17.7mm area
        pdf.text(senderInfo.return_address_line, addressFieldLeft, addressYPos - 2);
        
        // Underline for return address
        const textWidth = pdf.getTextWidth(senderInfo.return_address_line);
        pdf.line(addressFieldLeft, addressYPos - 1, addressFieldLeft + textWidth, addressYPos - 1);
        addressYPos += 3; // Small gap after return address
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
        // Always show date if we don't have a date information block
        const hasDateBlock = informationBlock?.block_type === 'date';
        if (!hasDateBlock) {
          // Ensure we have space in info block
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
          // Calculate available width for current page
          const currentMaxWidth = pageWidth - leftMargin - rightMargin; // Always use full width
          
          // Split paragraph into lines that fit the current page width
          const lines = pdf.splitTextToSize(paragraph.trim(), currentMaxWidth);
          
          lines.forEach((line: string) => {
            // Check if we need a new page
            if (currentY > pageHeight - 50) {
              // Add pagination to current page
              addPagination(currentPage);
              
              // Create new page
              pdf.addPage();
              currentPage++;
              
              // Add debug margins to new page  
              addDebugMargins(currentPage);
              
              // Reset Y position for new page (25mm header on page 2+)
              currentY = 25 + 5; // 5mm spacing after header
            }
            
            // Draw the line
            pdf.text(line, leftMargin, currentY);
            currentY += lineHeight;
          });
          
          // Add spacing between paragraphs
          if (paragIndex < paragraphs.length - 1) {
            currentY += lineHeight * 0.5;
          }
        });
        
        return currentY;
      };
      
      // Calculate letter pages before rendering
      const tempPdf = new jsPDF('p', 'mm', 'a4');
      tempPdf.setFontSize(11);
      const tempMaxWidth = pageWidth - leftMargin - rightMargin;
      const tempLines = tempPdf.splitTextToSize(contentText, tempMaxWidth);
      const availableContentHeight1 = pageHeight - contentTop - 50;
      const availableContentHeightOther = pageHeight - 25 - 50;
      const linesOnPage1 = Math.floor(availableContentHeight1 / lineHeight);
      
      if (tempLines.length <= linesOnPage1) {
        letterPages = 1;
      } else {
        const remainingLines = tempLines.length - linesOnPage1;
        const linesPerOtherPage = Math.floor(availableContentHeightOther / lineHeight);
        letterPages = 1 + Math.ceil(remainingLines / linesPerOtherPage);
      }
      
      // Account for attachments list
      if (attachments.length > 0) {
        const attachmentLines = attachments.length + 2; // Header + items + spacing
        const attachmentHeight = attachmentLines * lineHeight + 15;
        if (attachmentHeight > 50) {
          letterPages++;
        }
      }
      
      // Add debug margins to all pages function
      const addDebugMargins = (pageNum: number) => {
        if (debugMode || true) { // Force debug mode for testing
          pdf.setLineWidth(0.2);
          
          // Header line - different heights for different pages
          pdf.setDrawColor(255, 0, 0);
          if (pageNum === 1) {
            // Page 1: Header ends at 45mm
            pdf.line(0, headerHeight, pageWidth, headerHeight);
            pdf.setFontSize(8);
            pdf.setTextColor(255, 0, 0);
            pdf.text(`45mm - Header Ende (Seite ${pageNum})`, 5, headerHeight - 3);
          } else {
            // Page 2+: Header ends at 25mm
            const page2HeaderHeight = 25;
            pdf.line(0, page2HeaderHeight, pageWidth, page2HeaderHeight);
            pdf.setFontSize(8);
            pdf.setTextColor(255, 0, 0);
            pdf.text(`25mm - Header Ende (Seite ${pageNum})`, 5, page2HeaderHeight - 3);
            
            // Content start line for page 2+ (immediately after header at 25mm)
            pdf.setDrawColor(0, 255, 0);
            pdf.line(leftMargin, page2HeaderHeight, pageWidth - rightMargin, page2HeaderHeight);
            pdf.setTextColor(0, 255, 0);
            pdf.text(`Inhaltsbeginn Seite ${pageNum}`, leftMargin, page2HeaderHeight + 3);
          }
          
          // Left margin guide
          pdf.setDrawColor(255, 165, 0);
          pdf.line(leftMargin, 0, leftMargin, pageHeight);
          pdf.setTextColor(255, 165, 0);
          pdf.text("25mm", leftMargin + 2, 15);
          
          // Right margin guide
          pdf.line(pageWidth - rightMargin, 0, pageWidth - rightMargin, pageHeight);
          pdf.text("20mm", pageWidth - rightMargin - 15, 20);
          
          // Footer area
          const footerTop = 272;
          const footerBottom = pageHeight - 7;
          
          pdf.setDrawColor(128, 0, 128);
          pdf.rect(leftMargin, footerTop, pageWidth - leftMargin - rightMargin, footerBottom - footerTop);
          pdf.line(0, footerTop, pageWidth, footerTop);
          pdf.line(0, footerBottom, pageWidth, footerBottom);
          
          pdf.setTextColor(128, 0, 128);
          pdf.text("Fußzeile: 272mm", 5, footerTop - 2);
          pdf.text("Unterer Rand: 7mm", 5, footerBottom + 3);
          
          // Reset colors
          pdf.setTextColor(0, 0, 0);
          pdf.setDrawColor(0, 0, 0);
        }
      };
      
      // Add pagination function - only for letter content pages
      const addPagination = (pageNum: number) => {
        if (showPagination && letterPages > 1 && pageNum <= letterPages) {
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          
          // Position: 4.23mm above footer (272mm), 20mm from right edge
          const paginationY = 272 - 4.23; // 267.77mm from top
          const paginationX = pageWidth - 20; // 20mm from right edge
          
          const paginationText = `Seite ${pageNum} von ${letterPages}`;
          const textWidth = pdf.getTextWidth(paginationText);
          
          pdf.text(paginationText, paginationX - textWidth, paginationY);
        }
      };
      
      // Render content text with proper width on all pages  
      const startY = letter.subject || letter.title ? contentTop + 11 : contentTop + 3; // 8mm after subject
      let contentYPos = renderContentText(contentText, startY);
      
      // Handle attachments - now append actual files to PDF
      if (attachments && attachments.length > 0) {
        // Add attachments list to the letter first
        if (contentYPos > pageHeight - 70) {
          addPagination(currentPage);
          pdf.addPage();
          currentPage++;
          addDebugMargins(currentPage);
          contentYPos = currentPage === 1 ? contentTop + 3 : 25 + 3;
        }
        
        contentYPos += 10; // Space before attachments
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Anlagen:', leftMargin, contentYPos);
        contentYPos += 6;
        
        pdf.setFont('helvetica', 'normal');
        for (const attachment of attachments) {
          if (contentYPos > pageHeight - 30) {
            addPagination(currentPage);
            pdf.addPage();
            currentPage++;
            addDebugMargins(currentPage);
            contentYPos = currentPage === 1 ? contentTop + 3 : 25 + 3;
          }
          
          // Use display_name if available, otherwise use file_name
          const displayName = attachment.display_name || attachment.file_name;
          pdf.text(`• ${displayName}`, leftMargin, contentYPos);
          contentYPos += 4;
        }
        
        // Add final pagination for letter pages
        addPagination(currentPage);
        
        // Now append actual attachment files to the PDF as simple info pages
        for (const attachment of attachments) {
          // Use display_name if available, otherwise use file_name
          const displayName = attachment.display_name || attachment.file_name;
          
          try {
            // Download attachment file from Supabase storage to get file info
            const { data: fileData, error } = await supabase.storage
              .from('attachments')
              .download(attachment.file_path);
            
            let fileSize = 0;
            if (!error && fileData) {
              const arrayBuffer = await fileData.arrayBuffer();
              fileSize = arrayBuffer.byteLength;
            }
            
            // Add new page for attachment
            pdf.addPage();
            currentPage++;
            
            // Add attachment page content
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Anlage', leftMargin, 50);
            
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'normal');
            pdf.text(displayName, leftMargin, 70);
            
            pdf.setFontSize(10);
            pdf.text(`Dateityp: ${attachment.file_type || 'Unbekannt'}`, leftMargin, 90);
            
            if (fileSize > 0) {
              const sizeText = fileSize > 1024 * 1024 
                ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
                : `${Math.round(fileSize / 1024)} KB`;
              pdf.text(`Dateigröße: ${sizeText}`, leftMargin, 105);
            }
            
            pdf.text('Diese Anlage ist dem Brief beigefügt.', leftMargin, 120);
            
            // Add a simple border around the attachment info
            pdf.setLineWidth(0.5);
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(leftMargin, 40, pageWidth - leftMargin - rightMargin, 90);
            
          } catch (error) {
            console.warn(`Error processing attachment ${attachment.file_name}:`, error);
            
            // Add error page
            pdf.addPage();
            currentPage++;
            
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Anlage (Fehler)', leftMargin, 50);
            
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'normal');
            pdf.text(displayName, leftMargin, 70);
            
            pdf.setFontSize(10);
            pdf.text('Diese Anlage konnte nicht geladen werden.', leftMargin, 90);
          }
        }
      } else {
        // Add final pagination for letter if no attachments
        addPagination(currentPage);
      }
      
      // Generate filename
      const letterDate = letter.letter_date 
        ? new Date(letter.letter_date).toLocaleDateString('de-DE')
        : new Date(letter.created_at).toLocaleDateString('de-DE');
      const fileName = `Brief_DIN5008_${(letter.subject || letter.title || 'Ohne_Titel').replace(/[^a-zA-Z0-9]/g, '_')}_${letterDate.replace(/\./g, '-')}.pdf`;
      
      // Save the PDF
      pdf.save(fileName);
      
      toast({
        title: "PDF exportiert",
        description: `Der Brief wurde als durchsuchbares DIN 5008 PDF gespeichert: ${fileName}`,
      });

    } catch (error) {
      console.error('Error in DIN 5008 PDF export:', error);
      
      // Fallback to simple PDF export
      await exportWithoutTemplate();
    }
  };

  const exportWithTemplate = async () => {
    // Create a temporary container for rendering
    const container = document.createElement('div');
    container.style.width = '794px'; // A4 width in pixels at 96 DPI
    container.style.background = 'white';
    container.style.padding = '40px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';

    // Apply template styles
    const styleElement = document.createElement('style');
    styleElement.textContent = template!.letterhead_css;
    container.appendChild(styleElement);

    // Create the letter content with template
    const contentDiv = document.createElement('div');
    
    // Add letterhead
    const letterheadDiv = document.createElement('div');
    letterheadDiv.innerHTML = template!.letterhead_html;
    contentDiv.appendChild(letterheadDiv);

    // Add recipient information
    if (letter.recipient_name || letter.recipient_address) {
      const recipientDiv = document.createElement('div');
      recipientDiv.style.marginTop = '30px';
      recipientDiv.style.marginBottom = '30px';
      
      if (letter.recipient_name) {
        const nameP = document.createElement('p');
        nameP.textContent = letter.recipient_name;
        nameP.style.fontWeight = 'bold';
        nameP.style.margin = '0 0 5px 0';
        recipientDiv.appendChild(nameP);
      }
      
      if (letter.recipient_address) {
        const addressDiv = document.createElement('div');
        addressDiv.style.whiteSpace = 'pre-line';
        addressDiv.textContent = letter.recipient_address;
        recipientDiv.appendChild(addressDiv);
      }
      
      contentDiv.appendChild(recipientDiv);
    }

    // Add letter title/subject
    const titleDiv = document.createElement('div');
    titleDiv.style.marginTop = '30px';
    titleDiv.style.marginBottom = '20px';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.fontSize = '18px';
    titleDiv.textContent = letter.subject || letter.title;
    contentDiv.appendChild(titleDiv);

    // Add letter content
    const letterContentDiv = document.createElement('div');
    letterContentDiv.style.marginTop = '20px';
    letterContentDiv.style.lineHeight = '1.6';
    
    if (letter.content_html) {
      letterContentDiv.innerHTML = letter.content_html;
    } else {
      letterContentDiv.style.whiteSpace = 'pre-line';
      letterContentDiv.textContent = letter.content;
    }
    contentDiv.appendChild(letterContentDiv);

    container.appendChild(contentDiv);
    document.body.appendChild(container);

    try {
      // Convert to canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff'
      });

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      // Generate filename
      const date = new Date(letter.created_at).toLocaleDateString('de-DE');
      const fileName = `Brief_${(letter.subject || letter.title).replace(/[^a-zA-Z0-9]/g, '_')}_${date.replace(/\./g, '-')}.pdf`;
      
      // Save the PDF
      pdf.save(fileName);

      toast({
        title: "PDF exportiert",
        description: `Der Brief wurde als PDF gespeichert: ${fileName}`,
      });

    } finally {
      // Clean up
      document.body.removeChild(container);
    }
  };

  const exportWithoutTemplate = async () => {
    const doc = new jsPDF();
    
    // PDF configuration
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    
    let currentY = margin;
    
    // Helper function to add text with automatic line wrapping
    const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      const lines = doc.splitTextToSize(text, maxWidth);
      const lineHeight = fontSize * 0.4;
      
      // Check if we need a new page
      if (currentY + (lines.length * lineHeight) > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
      }
      
      lines.forEach((line: string) => {
        doc.text(line, margin, currentY);
        currentY += lineHeight;
      });
      
      currentY += 5; // Add some space after text
    };
    
    // Header
    addText(`BRIEF - ${letter.title}`, 16, true);
    currentY += 5;
    
    // Date
    const date = new Date(letter.created_at).toLocaleDateString('de-DE');
    addText(`Datum: ${date}`, 10);
    currentY += 10;
    
    // Recipient
    if (letter.recipient_name) {
      addText('EMPFÄNGER:', 12, true);
      addText(letter.recipient_name, 12);
      
      if (letter.recipient_address) {
        const addressLines = letter.recipient_address.split('\n');
        addressLines.forEach(line => {
          if (line.trim()) {
            addText(line.trim(), 12);
          }
        });
      }
      currentY += 10;
    }
    
    // Status
    const statusLabels: { [key: string]: string } = {
      draft: 'Entwurf',
      review: 'Zur Prüfung',
      approved: 'Genehmigt',
      sent: 'Versendet'
    };
    addText(`Status: ${statusLabels[letter.status] || letter.status}`, 10);
    currentY += 15;
    
    // Content
    addText('INHALT:', 12, true);
    currentY += 5;
    
    // Convert content to text
    const contentText = letter.content_html 
      ? convertHtmlToText(letter.content_html)
      : letter.content;
    
    if (contentText) {
      // Split content into paragraphs
      const paragraphs = contentText.split('\n\n');
      
      paragraphs.forEach((paragraph, index) => {
        if (paragraph.trim()) {
          addText(paragraph.trim(), 11);
          if (index < paragraphs.length - 1) {
            currentY += 5; // Extra space between paragraphs
          }
        }
      });
    } else {
      addText('[Kein Inhalt vorhanden]', 11);
    }
    
    // Footer
    currentY = pageHeight - 30;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')}`, margin, currentY);
    
    // Generate filename
    const fileName = `Brief_${letter.title.replace(/[^a-zA-Z0-9]/g, '_')}_${date.replace(/\./g, '-')}.pdf`;
    
    // Save the PDF
    doc.save(fileName);
    
    toast({
      title: "PDF exportiert",
      description: `Der Brief wurde als PDF gespeichert: ${fileName}`,
    });
  };

  return (
    <Button
      onClick={exportToPDF}
      disabled={disabled}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      PDF Export
    </Button>
  );
};

export default LetterPDFExport;