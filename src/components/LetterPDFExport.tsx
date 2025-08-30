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
}

const LetterPDFExport: React.FC<LetterPDFExportProps> = ({
  letter,
  disabled = false
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
    
    // Header with sender info
    if (senderInfo) {
      addText(`${senderInfo.name}`, 14, true);
      if (senderInfo.organization) {
        addText(senderInfo.organization, 12);
      }
      if (senderInfo.address) {
        addText(senderInfo.address, 10);
      }
      currentY += 10;
    }
    
    // Information block
    if (informationBlock && informationBlock.block_data) {
      addText(informationBlock.label, 10, true);
      const blockData = informationBlock.block_data;
      Object.entries(blockData).forEach(([key, value]: [string, any]) => {
        if (value && typeof value === 'string') {
          addText(`${key}: ${value}`, 9);
        }
      });
      currentY += 10;
    }
    
    // Date
    const letterDate = letter.letter_date 
      ? new Date(letter.letter_date).toLocaleDateString('de-DE')
      : new Date(letter.created_at).toLocaleDateString('de-DE');
    addText(`Datum: ${letterDate}`, 10);
    currentY += 10;
    
    // Reference number
    if (letter.reference_number) {
      addText(`Aktenzeichen: ${letter.reference_number}`, 10);
      currentY += 5;
    }
    
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
      currentY += 15;
    }
    
    // Subject
    if (letter.subject) {
      addText(`Betreff: ${letter.subject}`, 14, true);
      currentY += 10;
    } else if (letter.title) {
      addText(`Betreff: ${letter.title}`, 14, true);
      currentY += 10;
    }
    
    // Content
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
    
    // Attachments
    if (attachments.length > 0) {
      currentY += 10;
      addText('ANLAGEN:', 12, true);
      attachments.forEach(attachment => {
        addText(`• ${attachment.file_name}`, 10);
      });
    }
    
    // Footer
    currentY = pageHeight - 30;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE')}`, margin, currentY);
    
    // Generate filename
    const fileName = `Brief_DIN5008_${(letter.subject || letter.title || 'Ohne_Titel').replace(/[^a-zA-Z0-9]/g, '_')}_${letterDate.replace(/\./g, '-')}.pdf`;
    
    // Save the PDF
    doc.save(fileName);
    
    toast({
      title: "PDF exportiert",
      description: `Der Brief wurde als PDF gespeichert: ${fileName}`,
    });
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