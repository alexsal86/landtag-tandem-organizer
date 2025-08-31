import React, { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

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
      const addressFieldTop = 46;
      const addressFieldLeft = leftMargin;
      const addressFieldWidth = 85;
      const addressFieldHeight = 40;
      const infoBlockTop = 50;
      const infoBlockLeft = 125;
      const infoBlockWidth = 75;
      const contentTop = 98.46;
      
      // Reset colors for content
      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(0, 0, 0);
      
      // Template letterhead (if available)
      if (template?.letterhead_html) {
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
          
          // Split paragraph into lines that fit the current page width
          const lines = pdf.splitTextToSize(paragraph.trim(), currentMaxWidth);
          
          lines.forEach((line, lineIndex) => {
            // Check if we need a new page
            if (currentY + lineHeight > pageHeight - 40) { // Leave 40mm for footer
              pdf.addPage();
              letterPages++;
              currentPage++;
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
      
      // Add attachments as embedded files
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
            
            // Add a new page for each attachment
            pdf.addPage();
            letterPages++;
            currentPage++;
            
            // Add header for this attachment
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Anlage ${i + 1}: ${attachment.file_name}`, leftMargin, 30);
            
            // Convert file to data URL for embedding
            const reader = new FileReader();
            await new Promise((resolve) => {
              reader.onload = function() {
                try {
                  if (attachment.file_type?.startsWith('image/')) {
                    // For images, embed directly
                    const imgData = reader.result as string;
                    pdf.addImage(imgData, 'JPEG', leftMargin, 40, pageWidth - leftMargin - rightMargin, 200);
                  } else if (attachment.file_type === 'application/pdf') {
                    // For PDFs, show information page
                    pdf.setFontSize(11);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text('PDF-Dokument eingebettet:', leftMargin, 50);
                    pdf.text(`Dateiname: ${attachment.file_name}`, leftMargin, 65);
                    pdf.text(`Größe: ${attachment.file_size ? Math.round(attachment.file_size / 1024) + ' KB' : 'Unbekannt'}`, leftMargin, 80);
                    
                    // Add visual representation
                    pdf.setDrawColor(200, 200, 200);
                    pdf.rect(leftMargin, 90, pageWidth - leftMargin - rightMargin, 150);
                    pdf.setFontSize(24);
                    pdf.setTextColor(150, 150, 150);
                    pdf.text('PDF', leftMargin + 80, 170);
                    pdf.setTextColor(0, 0, 0);
                  } else {
                    // For other file types, show file info
                    pdf.setFontSize(11);
                    pdf.setFont('helvetica', 'normal');
                    pdf.text(`Dateiname: ${attachment.file_name}`, leftMargin, 50);
                    pdf.text(`Dateityp: ${attachment.file_type || 'Unbekannt'}`, leftMargin, 65);
                    pdf.text(`Größe: ${attachment.file_size ? Math.round(attachment.file_size / 1024) + ' KB' : 'Unbekannt'}`, leftMargin, 80);
                    
                    // Add visual representation
                    pdf.setDrawColor(200, 200, 200);
                    pdf.rect(leftMargin, 90, pageWidth - leftMargin - rightMargin, 100);
                    pdf.setFontSize(16);
                    pdf.setTextColor(100, 100, 100);
                    pdf.text('DATEI', leftMargin + 70, 145);
                    pdf.setTextColor(0, 0, 0);
                  }
                } catch (error) {
                  console.error('Error embedding attachment:', error);
                  pdf.setFontSize(11);
                  pdf.setFont('helvetica', 'normal');
                  pdf.text('Anhang konnte nicht eingebettet werden', leftMargin, 50);
                }
                resolve(null);
              };
              reader.readAsDataURL(fileData);
            });
          } catch (error) {
            console.error('Error processing attachment:', error);
            // Add error page
            pdf.addPage();
            letterPages++;
            currentPage++;
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Anlage ${i + 1}: ${attachment.file_name}`, leftMargin, 30);
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Fehler beim Laden der Anlage', leftMargin, 50);
          }
        }
      }
      
      // Add pagination to all pages
      const totalPages = letterPages;
      for (let page = 1; page <= totalPages; page++) {
        pdf.setPage(page);
        
        // Add page number at bottom
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        const pageText = `Seite ${page} von ${totalPages}`;
        const pageTextWidth = pdf.getTextWidth(pageText);
        pdf.text(pageText, pageWidth - rightMargin - pageTextWidth, pageHeight - 10);
        pdf.setTextColor(0, 0, 0);
      }
      
      // Save the PDF
      const fileName = `${letter.title || 'Brief'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "PDF erstellt",
        description: `Der Brief wurde als PDF gespeichert: ${fileName}`,
      });
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
      size="sm"
      onClick={exportToPDF}
      disabled={disabled}
      className="flex items-center gap-2"
    >
      <Download className="h-4 w-4" />
      {disabled ? 'Export...' : 'PDF'}
    </Button>
  );
};

export default LetterPDFExport;