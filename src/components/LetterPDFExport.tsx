import React from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface Letter {
  id: string;
  title: string;
  content: string;
  content_html?: string;
  recipient_name?: string;
  recipient_address?: string;
  status: string;
  sent_date?: string;
  created_at: string;
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
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export-Fehler",
        description: "Der Brief konnte nicht als PDF exportiert werden.",
        variant: "destructive",
      });
    }
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