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
}

const LetterPDFExport: React.FC<LetterPDFExportProps> = ({
  letter,
  disabled = false,
  debugMode = false
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
      const leftMargin = 24.1;
      const rightMargin = 20;
      const headerHeight = 45;
      const addressFieldTop = 105;
      const addressFieldLeft = leftMargin;
      const addressFieldWidth = 85;
      const addressFieldHeight = 40;
      const infoBlockLeft = 119.1;
      const infoBlockWidth = 75;
      const contentTop = 169;
      
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
        pdf.text("Adressfeld: 85×40mm @ Position 105mm/24.1mm", addressFieldLeft, addressFieldTop - 3);
        
        // Address field inner measurements
        pdf.setDrawColor(255, 100, 100);
        pdf.setLineWidth(0.1);
        pdf.rect(addressFieldLeft + 5, addressFieldTop + 5, addressFieldWidth - 10, addressFieldHeight - 10);
        pdf.setFontSize(6);
        pdf.text("Innenbereich: 5mm Abstand", addressFieldLeft + 6, addressFieldTop + 8);
        
        // Info block
        pdf.setDrawColor(0, 0, 255); // Blue
        pdf.setLineWidth(0.2);
        pdf.rect(infoBlockLeft, addressFieldTop, infoBlockWidth, addressFieldHeight);
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 255);
        pdf.text("Info-Block: 75×40mm @ 119.1mm", infoBlockLeft, addressFieldTop - 3);
        
        // Content start line (169mm)
        pdf.setDrawColor(0, 255, 0); // Green
        pdf.line(leftMargin, contentTop, pageWidth - rightMargin, contentTop);
        pdf.setTextColor(0, 255, 0);
        pdf.text("169mm - Inhaltsbeginn (DIN 5008)", leftMargin, contentTop - 3);
        
        // Left margin guide
        pdf.setDrawColor(255, 165, 0); // Orange
        pdf.line(leftMargin, 0, leftMargin, pageHeight);
        pdf.setTextColor(255, 165, 0);
        pdf.text("Linker Rand:", leftMargin + 2, 15);
        pdf.text("24.1mm", leftMargin + 2, 20);
        
        // Right margin guide
        pdf.line(pageWidth - rightMargin, 0, pageWidth - rightMargin, pageHeight);
        pdf.text("Rechter Rand:", pageWidth - rightMargin - 25, 15);
        pdf.text("20mm", pageWidth - rightMargin - 15, 20);
        
        // Bottom margin guide
        pdf.setDrawColor(128, 0, 128); // Purple
        pdf.line(0, pageHeight - 16.9, pageWidth, pageHeight - 16.9);
        pdf.setTextColor(128, 0, 128);
        pdf.text("Unterer Rand: 16.9mm", 5, pageHeight - 16.9 - 2);
        
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
        pdf.text("105mm", 2, addressFieldTop + 2);
        
        // Content position arrows  
        pdf.setDrawColor(0, 255, 0);
        pdf.line(0, contentTop, leftMargin - 2, contentTop);
        pdf.text("169mm", 2, contentTop + 2);
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
      
      // Return address line in address field
      let addressYPos = addressFieldTop + 8;
      if (senderInfo?.return_address_line) {
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(senderInfo.return_address_line, addressFieldLeft + 5, addressYPos);
        
        // Underline for return address
        const textWidth = pdf.getTextWidth(senderInfo.return_address_line);
        pdf.line(addressFieldLeft + 5, addressYPos + 1, addressFieldLeft + 5 + textWidth, addressYPos + 1);
        addressYPos += 8;
      }
      
      // Recipient address
      if (letter.recipient_name || letter.recipient_address) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        
        if (letter.recipient_name) {
          pdf.text(letter.recipient_name, addressFieldLeft + 5, addressYPos);
          addressYPos += 4;
        }
        
        if (letter.recipient_address) {
          const addressLines = letter.recipient_address.split('\n').filter(line => line.trim());
          addressLines.forEach(line => {
            if (addressYPos < addressFieldTop + addressFieldHeight - 5) {
              pdf.text(line.trim(), addressFieldLeft + 5, addressYPos);
              addressYPos += 4;
            }
          });
        }
      }
      
      // Information block
      let infoYPos = addressFieldTop + 8;
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
      
      // Letter date
      if (letter.letter_date && !informationBlock) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Datum', infoBlockLeft, infoYPos);
        infoYPos += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.text(new Date(letter.letter_date).toLocaleDateString('de-DE'), infoBlockLeft, infoYPos);
      }
      
      // Subject line
      let contentYPos = contentTop;
      if (letter.subject || letter.title) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        const subjectText = letter.subject || letter.title;
        pdf.text(subjectText, leftMargin, contentYPos);
        contentYPos += 8;
      }
      
      // Letter content
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      const contentText = letter.content_html ? convertHtmlToText(letter.content_html) : letter.content;
      const maxWidth = pageWidth - leftMargin - rightMargin;
      
      // Split content into lines that fit the page width
      const contentLines = pdf.splitTextToSize(contentText, maxWidth);
      const lineHeight = 4.5;
      
      contentLines.forEach((line: string) => {
        // Check if we need a new page
        if (contentYPos > pageHeight - 30) {
          pdf.addPage();
          contentYPos = 20;
        }
        
        pdf.text(line, leftMargin, contentYPos);
        contentYPos += lineHeight;
      });
      
      // Attachments
      if (attachments && attachments.length > 0) {
        contentYPos += 8;
        
        if (contentYPos > pageHeight - 30) {
          pdf.addPage();
          contentYPos = 20;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Anlagen:', leftMargin, contentYPos);
        contentYPos += 5;
        
        pdf.setFont('helvetica', 'normal');
        attachments.forEach(attachment => {
          if (contentYPos > pageHeight - 30) {
            pdf.addPage();
            contentYPos = 20;
          }
          
          pdf.text(`- ${attachment.file_name}`, leftMargin + 5, contentYPos);
          contentYPos += 4;
        });
      }
      
      // Sender information at bottom
      if (senderInfo) {
        const footerY = pageHeight - 25;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(102, 102, 102); // Gray color
        
        let footerText = '';
        if (senderInfo.organization) footerText += senderInfo.organization;
        if (senderInfo.name) footerText += (footerText ? ' • ' : '') + senderInfo.name;
        if (senderInfo.street && senderInfo.house_number) {
          footerText += (footerText ? ' • ' : '') + `${senderInfo.street} ${senderInfo.house_number}`;
        }
        if (senderInfo.postal_code && senderInfo.city) {
          footerText += (footerText ? ' • ' : '') + `${senderInfo.postal_code} ${senderInfo.city}`;
        }
        
        pdf.text(footerText, leftMargin, footerY);
        
        let contactY = footerY + 4;
        if (senderInfo.phone) {
          pdf.text(`Tel: ${senderInfo.phone}`, leftMargin, contactY);
          contactY += 4;
        }
        if (senderInfo.email) {
          pdf.text(`E-Mail: ${senderInfo.email}`, leftMargin, contactY);
          contactY += 4;
        }
        if (senderInfo.website) {
          pdf.text(`Web: ${senderInfo.website}`, leftMargin, contactY);
        }
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