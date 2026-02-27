import React, { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { HeaderRenderer } from '@/services/headerRenderer';
import { buildFooterBlocksFromStored, resolveBlockWidthMm } from '@/components/letters/footerBlockUtils';

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
  show_pagination?: boolean;
}

interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
  header_layout_type?: any;
  header_text_elements?: any;
  footer_blocks?: any;
}

interface LetterPDFExportProps {
  letter: Letter;
  disabled?: boolean;
  debugMode?: boolean;
  showPagination?: boolean;
  variant?: 'default' | 'icon-only';
  size?: 'sm' | 'default';
  onPDFGenerated?: (pdfBlob: Blob, filename: string) => void;
}

const LetterPDFExport: React.FC<LetterPDFExportProps> = ({
  letter,
  disabled = false,
  debugMode = false,
  showPagination = false,
  variant = 'default',
  size = 'default',
  onPDFGenerated
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
      await exportWithDIN5008Features();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export-Fehler",
        description: "Der Brief konnte nicht als PDF exportiert werden.",
        variant: "destructive",
      });
    }
  };

  // New function to generate PDF and return it instead of downloading
  const generatePDFBlob = async (): Promise<{ blob: Blob; filename: string }> => {
    const result = await exportWithDIN5008Features(true);
    if (!result) {
      throw new Error('PDF generation failed');
    }
    return result;
  };

  const exportWithDIN5008Features = async (returnBlob: boolean = false): Promise<{ blob: Blob; filename: string } | void> => {
    try {
      // Create PDF with DIN 5008 compliant layout using text
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
      const footerTop = 272;
      const paginationGap = 4.23;
      const paginationHeight = 4;
      
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
        const paginationY = footerTop - paginationGap - paginationHeight;
        pdf.setDrawColor(255, 0, 255); // Magenta
        pdf.rect(leftMargin, paginationY - 2, pageWidth - leftMargin - rightMargin, 4);
        pdf.setTextColor(255, 0, 255);
        pdf.setFontSize(6);
        pdf.text("Paginierung: Unterkante 4.23mm über Fußzeile", leftMargin + 2, paginationY + 1);
        
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
      if (true) { // Force debug mode ON
        drawDebugGuides(1);
        
      // Footer content from template
      const renderFooterBlocks = () => {
        if (!template?.footer_blocks) return;
        
        const footerY = 272 + 3;
        const availableWidth = 165; // 210mm - 25mm left - 20mm right margin
        let currentX = leftMargin;
        
        const sortedBlocks = buildFooterBlocksFromStored(template.footer_blocks);
        
        sortedBlocks.forEach((block: any) => {
          const blockContent = Array.isArray(block.lines)
            ? block.lines.map((line: any) => line.type === 'spacer' ? '' : (line.type === 'label-value' ? `${line.label || ''} ${line.value || ''}`.trim() : (line.value || ''))).join('\n')
            : (block.content || '');
          if (!blockContent) return;
          
          // Calculate width in mm from percentage
          const blockWidth = resolveBlockWidthMm(block.widthUnit || 'percent', Number(block.widthValue) || 25, availableWidth);
          
          // Set font properties with proper size handling
          const fontSize = Math.max(6, Math.min(14, block.fontSize || 8)); // Clamp font size
          // For tight spacing in footer, use minimal line height
          const lineHeightMultiplier = block.lineHeight || 0.8;
          // Direct calculation: tight spacing should be around 3-4pt for 8pt font
          const lineHeight = lineHeightMultiplier <= 0.8 ? fontSize * 0.4 : fontSize * lineHeightMultiplier * 0.5;
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
          
          // Render block title with highlighting support
          if (block.title) {
            if (block.titleHighlight) {
              // Use highlighted title settings
              const titleFontSize = Math.max(8, Math.min(20, block.titleFontSize || 13));
              const titleFontWeight = block.titleFontWeight || 'bold';
              const titleColor = block.titleColor || '#107030';
              
              pdf.setFont('helvetica', titleFontWeight);
              pdf.setFontSize(titleFontSize);
              
              // Set title color
              if (titleColor.startsWith('#')) {
                try {
                  const hex = titleColor.substring(1);
                  const r = parseInt(hex.substr(0, 2), 16);
                  const g = parseInt(hex.substr(2, 2), 16);
                  const b = parseInt(hex.substr(4, 2), 16);
                  pdf.setTextColor(r, g, b);
                } catch (e) {
                  pdf.setTextColor(16, 112, 48); // Fallback to RGB 16,112,48
                }
              } else {
                pdf.setTextColor(16, 112, 48);
              }
              
              const wrappedTitle = pdf.splitTextToSize(block.title, blockWidth - 2);
              const titleLineHeight = titleFontSize * 0.4; // Tight spacing for title
              wrappedTitle.forEach((titleLine: string) => {
                if (blockY <= 290) {
                  pdf.text(titleLine, currentX + 1, blockY);
                  blockY += titleLineHeight;
                }
              });
              blockY += 2; // Extra gap after highlighted title
              
              // Reset font size and color for content
              pdf.setFontSize(fontSize);
              pdf.setTextColor(0, 0, 0);
            } else {
              // Regular title formatting
              pdf.setFont('helvetica', 'bold');
              const wrappedTitle = pdf.splitTextToSize(block.title, blockWidth - 2);
              wrappedTitle.forEach((titleLine: string) => {
                if (blockY <= 290) {
                  pdf.text(titleLine, currentX + 1, blockY);
                  blockY += lineHeight;
                }
              });
              blockY += 1; // Small gap after title
            }
            
            // Reset to original font weight for content
            pdf.setFont('helvetica', fontWeight);
          }
          
          // Split content into lines and render within block width
          const lines = blockContent.split('\n');
          
          lines.forEach((line: string) => {
            if (blockY > 290) return; // Don't go beyond page bounds
            
            // Apply footer formatting rules
            let formattedLine = line;
            
            // Remove "Tel: " prefix from phone numbers
            if (formattedLine.startsWith('Tel: ')) {
              formattedLine = formattedLine.replace('Tel: ', '');
            }
            
            // Remove "Web: " prefix and clean website URLs
            if (formattedLine.startsWith('Web: ')) {
              formattedLine = formattedLine.replace('Web: ', '').replace(/^https?:\/\/(www\.)?/, '');
            }
            
            // Add line break after @ in email addresses
            if (formattedLine.includes('@') && !formattedLine.startsWith('@')) {
              formattedLine = formattedLine.replace('@', '@\n');
            }
            
            // Replace social media text with @ symbol
            if (formattedLine.startsWith('Instagram: ')) {
              formattedLine = formattedLine.replace('Instagram: ', '@ ');
            }
            if (formattedLine.startsWith('Facebook: ')) {
              formattedLine = formattedLine.replace('Facebook: ', '@ ');
            }
            
            // Use jsPDF's text wrapping for better word breaks
            const wrappedLines = pdf.splitTextToSize(formattedLine, blockWidth - 2);
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
      }
      
      // Reset colors for content
      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(0, 0, 0);
      
      // Template letterhead (if available)
      console.log('=== PDF TEMPLATE RENDERING ===');
      console.log('Template data:', template);
      console.log('Template header_layout_type:', template?.header_layout_type);
      console.log('Template header_text_elements:', template?.header_text_elements);
      
      if (template) {
        const headerRenderer = new HeaderRenderer(pdf, leftMargin);
        await headerRenderer.renderHeader(template);
        console.log('Header renderer called with template');
      } else {
        console.log('No template available for header rendering');
      }
      
      // Return address line in address field - 17.7mm height
      let addressYPos = addressFieldTop + 17.7;
      if (senderInfo?.return_address_line) {
        const returnAddressFontSize = 7;
        const returnAddressMaxWidth = Math.max(10, addressFieldWidth - 10);

        pdf.setFontSize(returnAddressFontSize);
        pdf.setFont('helvetica', 'normal');

        const returnAddressLines = pdf.splitTextToSize(senderInfo.return_address_line, returnAddressMaxWidth);
        const returnAddressStartY = addressYPos - 2;
        const lineHeightMm = (pdf.getLineHeightFactor() * returnAddressFontSize) / pdf.internal.scaleFactor;
        const lastLineBaselineY = returnAddressStartY + (returnAddressLines.length - 1) * lineHeightMm;

        pdf.text(returnAddressLines, addressFieldLeft, returnAddressStartY);
        
        // Underline as long as the last rendered line of the return address
        const lastLine = returnAddressLines[returnAddressLines.length - 1] || '';
        const lastLineWidth = pdf.getTextWidth(lastLine);
        const underlineY = lastLineBaselineY + 0.6;
        pdf.line(addressFieldLeft, underlineY, addressFieldLeft + lastLineWidth, underlineY);

        addressYPos = underlineY + 2.2;
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
            const formatDate = (date: Date, formatString: string) => {
              switch (formatString) {
                case 'dd.mm.yyyy': return format(date, 'd. MMMM yyyy', { locale: de });
                case 'dd.mm.yy': return date.toLocaleDateString('de-DE', { year: '2-digit', month: '2-digit', day: '2-digit' });
                case 'yyyy-mm-dd': return date.toISOString().split('T')[0];
                default: return format(date, 'd. MMMM yyyy', { locale: de });
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
            if (informationBlock.block_data?.custom_content || informationBlock.block_data?.custom_lines) {
              const customLines = Array.isArray(informationBlock.block_data?.custom_lines)
                ? informationBlock.block_data.custom_lines
                : String(informationBlock.block_data?.custom_content || '').split('\n');

              customLines
                .map((line: string) => line.trim())
                .filter((line: string) => line.length > 0)
                .forEach((line: string) => {
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
            const formattedDate = format(new Date(letter.letter_date), 'd. MMMM yyyy', { locale: de });
            pdf.text(formattedDate, infoBlockLeft, infoYPos);
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
        const shouldShowPagination = showPagination || letter.show_pagination;
        
        console.log('=== PDF PAGINATION SETTINGS ===');
        console.log('showPagination prop:', showPagination);
        console.log('letter.show_pagination:', letter.show_pagination);
        console.log('shouldShowPagination:', shouldShowPagination);
        
        const paragraphs = text.split('\n\n').filter(p => p.trim());
        
        paragraphs.forEach((paragraph, paragIndex) => {
          // Calculate available width for current page (full width for all pages)
          const currentMaxWidth = pageWidth - leftMargin - rightMargin;
          
          // Split paragraph into lines that fit the current page width
          const lines = pdf.splitTextToSize(paragraph.trim(), currentMaxWidth);
          
          lines.forEach((line, lineIndex) => {
            // Check if we need a new page - DIN 5008 content end depends on pagination
            const paginationTop = footerTop - paginationGap - paginationHeight;
            const contentBottom = shouldShowPagination
              ? paginationTop - paginationGap
              : Math.min(contentTop + 165, footerTop - paginationGap);
            
            if (currentY + lineHeight > contentBottom) {
              pdf.addPage();
              letterPages++;
              currentPage++;
              
              // Draw debug guides for new pages
              if (true) { // Force debug mode ON
                drawDebugGuides(currentPage);
                
        // Footer content for continuation pages
        const renderFooterBlocks = () => {
          if (!template?.footer_blocks) return;
          
          const footerY = 272 + 3;
          const availableWidth = 165; // 210mm - 25mm left - 20mm right margin
          let currentX = leftMargin;
          
          const sortedBlocks = buildFooterBlocksFromStored(template.footer_blocks);
          
          sortedBlocks.forEach((block: any) => {
            const blockContent = Array.isArray(block.lines)
            ? block.lines.map((line: any) => line.type === 'spacer' ? '' : (line.type === 'label-value' ? `${line.label || ''} ${line.value || ''}`.trim() : (line.value || ''))).join('\n')
            : (block.content || '');
          if (!blockContent) return;
            
            // Calculate width in mm from percentage
            const blockWidth = resolveBlockWidthMm(block.widthUnit || 'percent', Number(block.widthValue) || 25, availableWidth);
            
            // Set font properties with proper size handling
            const fontSize = Math.max(6, Math.min(14, block.fontSize || 8)); // Clamp font size
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
            
            // Split content into lines and render within block width
            const lines = blockContent.split('\n');
            let blockY = footerY;
            
            lines.forEach((line: string) => {
              if (blockY > 290) return; // Don't go beyond page bounds
              
              // Simple text wrapping: if text is too wide, try to break it
              const textWidth = pdf.getTextWidth(line);
              if (textWidth <= blockWidth - 2) {
                pdf.text(line, currentX + 1, blockY);
                blockY += fontSize; // Line spacing = 1 (font size) // Line height based on font size
              } else {
                // Simple word wrap for long lines
                const words = line.split(' ');
                let currentLine = '';
                
                words.forEach((word: string) => {
                  const testLine = currentLine ? currentLine + ' ' + word : word;
                  const testWidth = pdf.getTextWidth(testLine);
                  
                  if (testWidth <= blockWidth - 2) {
                    currentLine = testLine;
                  } else {
                    if (currentLine) {
                      pdf.text(currentLine, currentX + 1, blockY);
                blockY += fontSize; // Line spacing = 1 (font size)
                    }
                    currentLine = word;
                  }
                });
                
                if (currentLine && blockY <= 290) {
                  pdf.text(currentLine, currentX + 1, blockY);
                    blockY += fontSize; // Line spacing = 1 (font size)
                }
              }
            });
            
            currentX += blockWidth;
          });
          
          // Reset text color
          pdf.setTextColor(0, 0, 0);
        };
        
        renderFooterBlocks();
              }
              
              currentY = 30; // Start new page at 30mm from top
              
              // Ensure correct font for continuation pages
              pdf.setFontSize(11);
              pdf.setFont('helvetica', 'normal');
            }
            
            pdf.text(line, leftMargin, currentY);
            currentY += lineHeight;
          });
          
          // Add extra space between paragraphs
          if (paragIndex < paragraphs.length - 1) {
            currentY += lineHeight / 2;
          }
        });
      };
      
      // Render the content
      renderContentText(contentText, contentTop + 10);
      
      // Add attachments as embedded files (not counted in letter pagination)
      if (attachments && attachments.length > 0) {
        for (let i = 0; i < attachments.length; i++) {
          const attachment = attachments[i];
          
          try {
            // Fetch the attachment file
            const { data: fileData, error: fileError } = await supabase.storage
              .from('documents')
              .download(attachment.file_path);
            
            if (fileError) {
              console.error('Error downloading attachment:', fileError);
              continue;
            }
            
            // Add a new page for each attachment (separate from letter pages)
            pdf.addPage();
            currentPage++;
            
            // Debug mode for attachments - 20mm margins
            const attachmentMargin = 20;
            if (true) { // Debug mode always on
              pdf.setLineWidth(0.2);
              pdf.setDrawColor(255, 0, 255); // Magenta for attachment margins
              
              // Top margin line
              pdf.line(0, attachmentMargin, pageWidth, attachmentMargin);
              pdf.setFontSize(8);
              pdf.setTextColor(255, 0, 255);
              pdf.text("20mm - Anlage Oberrand", 5, attachmentMargin - 3);
              
              // Bottom margin line
              pdf.line(0, pageHeight - attachmentMargin, pageWidth, pageHeight - attachmentMargin);
              pdf.text("20mm - Anlage Unterrand", 5, pageHeight - attachmentMargin + 10);
              
              // Left margin line
              pdf.line(attachmentMargin, 0, attachmentMargin, pageHeight);
              pdf.text("20mm", attachmentMargin + 2, 15);
              pdf.text("Linker", attachmentMargin + 2, 20);
              pdf.text("Anlage-Rand", attachmentMargin + 2, 25);
              
              // Right margin line
              pdf.line(pageWidth - attachmentMargin, 0, pageWidth - attachmentMargin, pageHeight);
              pdf.text("20mm Rechter Anlage-Rand", pageWidth - attachmentMargin - 45, 15);
              
              // Attachment area box
              pdf.setDrawColor(200, 0, 200);
              pdf.rect(attachmentMargin, attachmentMargin, pageWidth - 2 * attachmentMargin, pageHeight - 2 * attachmentMargin);
              
              pdf.setTextColor(0, 0, 0);
              pdf.setDrawColor(0, 0, 0);
            }
            
            // Add header for this attachment with custom title
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            const attachmentTitle = attachment.title || attachment.file_name;
            pdf.text(`Anlage ${i + 1}: ${attachmentTitle}`, attachmentMargin, attachmentMargin + 10);
            
            // Convert file to data URL for embedding
            const reader = new FileReader();
            await new Promise((resolve) => {
              reader.onload = function() {
                try {
                  if (attachment.file_type?.startsWith('image/')) {
                    // For images, embed directly within attachment margins
                    const imgData = reader.result as string;
                    const availableWidth = pageWidth - 2 * attachmentMargin;
                    const availableHeight = pageHeight - 2 * attachmentMargin - 30; // Reserve space for title
                    pdf.addImage(imgData, 'JPEG', attachmentMargin, attachmentMargin + 20, availableWidth, Math.min(200, availableHeight));
                  } else if (attachment.file_type === 'application/pdf') {
                    // For PDFs, show information page within margins
                    pdf.setFontSize(11);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text('PDF-Dokument eingebettet:', attachmentMargin, attachmentMargin + 30);
                    pdf.text(`Dateiname: ${attachment.file_name}`, attachmentMargin, attachmentMargin + 45);
                    pdf.text(`Größe: ${attachment.file_size ? Math.round(attachment.file_size / 1024) + ' KB' : 'Unbekannt'}`, attachmentMargin, attachmentMargin + 60);
                    
                    // Add visual representation within margins
                    const boxWidth = pageWidth - 2 * attachmentMargin;
                    const boxHeight = 150;
                    pdf.setDrawColor(200, 200, 200);
                    pdf.rect(attachmentMargin, attachmentMargin + 70, boxWidth, boxHeight);
                    pdf.setFontSize(24);
                    pdf.setTextColor(150, 150, 150);
                    pdf.text('PDF', attachmentMargin + boxWidth/2 - 15, attachmentMargin + 70 + boxHeight/2);
                    pdf.setTextColor(0, 0, 0);
                  } else {
                    // For other file types, show file info within margins
                    pdf.setFontSize(11);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(`Dateiname: ${attachment.file_name}`, attachmentMargin, attachmentMargin + 30);
                    pdf.text(`Dateityp: ${attachment.file_type || 'Unbekannt'}`, attachmentMargin, attachmentMargin + 45);
                    pdf.text(`Größe: ${attachment.file_size ? Math.round(attachment.file_size / 1024) + ' KB' : 'Unbekannt'}`, attachmentMargin, attachmentMargin + 60);
                    
                    // Add visual representation within margins
                    const boxWidth = pageWidth - 2 * attachmentMargin;
                    const boxHeight = 100;
                    pdf.setDrawColor(200, 200, 200);
                    pdf.rect(attachmentMargin, attachmentMargin + 70, boxWidth, boxHeight);
                    pdf.setFontSize(16);
                    pdf.setTextColor(100, 100, 100);
                    pdf.text('DATEI', attachmentMargin + boxWidth/2 - 15, attachmentMargin + 70 + boxHeight/2);
                    pdf.setTextColor(0, 0, 0);
                  }
                } catch (error) {
                  console.error('Error embedding attachment:', error);
                  pdf.setFontSize(11);
                  pdf.setFont('helvetica', 'normal');
                  pdf.text('Anhang konnte nicht eingebettet werden', attachmentMargin, attachmentMargin + 30);
                }
                resolve(null);
              };
              reader.readAsDataURL(fileData);
            });
          } catch (error) {
            console.error('Error processing attachment:', error);
            // Add error page
            pdf.addPage();
            currentPage++;
            
            // Define attachment margin for error page too
            const attachmentMargin = 20;
            
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            const attachmentTitle = attachment.title || attachment.file_name;
            pdf.text(`Anlage ${i + 1}: ${attachmentTitle}`, attachmentMargin, attachmentMargin + 10);
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Fehler beim Laden der Anlage', attachmentMargin, attachmentMargin + 30);
          }
        }
      }
      
      // Add pagination only to letter pages (not attachment pages) and only if enabled
      const shouldShowPagination = showPagination || letter.show_pagination;
      const totalLetterPages = letterPages;
      
      if (shouldShowPagination) {
        for (let page = 1; page <= totalLetterPages; page++) {
        pdf.setPage(page);
        
        // Pagination top so that its bottom edge is 4.23mm above footer (272mm - 8.23mm = 263.77mm)
        const paginationY = footerTop - paginationGap - paginationHeight;
        
        // Debug box around pagination
        if (true) { // Force debug mode ON
          pdf.setDrawColor(255, 0, 255); // Magenta
          pdf.setLineWidth(0.1);
          const pageText = `Seite ${page} von ${totalLetterPages}`;
          const pageTextWidth = pdf.getTextWidth(pageText);
          const pageTextX = (pageWidth - pageTextWidth) / 2;
          pdf.rect(pageTextX - 2, paginationY - 3, pageTextWidth + 4, 5);
          pdf.setTextColor(255, 0, 255);
          pdf.setFontSize(6);
          pdf.text("Pagination: Unterkante 4.23mm über Fußzeile", pageTextX, paginationY - 4);
        }
        
        // Add page number at right edge with 9pt font size
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        const pageText = `Seite ${page} von ${totalLetterPages}`;
        const pageTextWidth = pdf.getTextWidth(pageText);
        const pageTextX = pageWidth - rightMargin - pageTextWidth; // Right aligned
        pdf.text(pageText, pageTextX, paginationY);
        pdf.setTextColor(0, 0, 0);
        }
      }
      
      // Save the PDF or return blob
      const fileName = `${letter.title || 'Brief'}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      if (returnBlob) {
        // Return blob for archiving
        const pdfBlob = pdf.output('blob');
        return { blob: pdfBlob, filename: fileName };
      } else {
        // Download normally
        pdf.save(fileName);
        
        toast({
          title: "PDF erstellt",
          description: `Der Brief wurde als PDF gespeichert: ${fileName}`,
        });
        
        // Call onPDFGenerated callback if provided
        if (onPDFGenerated) {
          const pdfBlob = pdf.output('blob');
          onPDFGenerated(pdfBlob, fileName);
        }
      }
    } catch (error) {
      console.error('Error creating PDF:', error);
      toast({
        title: "Export-Fehler",
        description: "Der Brief konnte nicht als PDF exportiert werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={exportToPDF}
      disabled={disabled}
      className={variant === 'icon-only' ? "" : "flex items-center gap-2"}
    >
      <Download className="h-4 w-4" />
      {variant === 'default' && (disabled ? 'Export...' : 'PDF')}
    </Button>
  );
};

export default LetterPDFExport;

// Export the function for external use
export { LetterPDFExport };
