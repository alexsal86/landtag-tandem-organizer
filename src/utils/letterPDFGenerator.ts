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

// Utility function to convert HTML to text (exact copy from LetterPDFExport)
const convertHtmlToText = (html: string): string => {
  if (typeof document === 'undefined') return html; // Server-side fallback
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
};

export const generateLetterPDF = async (letter: Letter): Promise<{ blob: Blob; filename: string } | null> => {
  try {
    // Fetch all required data (simplified for speed)
    const [templateResult, senderResult, blockResult] = await Promise.all([
      letter.template_id ? supabase.from('letter_templates').select('*').eq('id', letter.template_id).single() : { data: null },
      letter.sender_info_id ? supabase.from('sender_information').select('*').eq('id', letter.sender_info_id).single() : { data: null },
      letter.information_block_ids?.[0] ? supabase.from('information_blocks').select('*').eq('id', letter.information_block_ids[0]).single() : { data: null }
    ]);

    const template = templateResult.data;
    const senderInfo = senderResult.data;
    const informationBlock = blockResult.data;

    // Generate PDF using jsPDF (same as LetterPDFExport component)
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // DIN 5008 layout settings
    const pageWidth = 210;
    const leftMargin = 25;
    const rightMargin = 20;
    const addressFieldTop = 46;
    const addressFieldLeft = leftMargin;
    const contentTop = 98.46;

    // Add letterhead if available
    if (template?.letterhead_html) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(template.name || 'Briefkopf', leftMargin, 20);
    }

    // Add recipient address
    let addressYPos = addressFieldTop + 17.7;
    if (senderInfo?.return_address_line) {
      pdf.setFontSize(7);
      pdf.text(senderInfo.return_address_line, addressFieldLeft, addressYPos - 2);
      addressYPos += 3;
    }

    if (letter.recipient_name) {
      pdf.setFontSize(9);
      pdf.text(letter.recipient_name, addressFieldLeft, addressYPos);
      addressYPos += 4;
    }

    if (letter.recipient_address) {
      const addressLines = letter.recipient_address.split('\n');
      addressLines.forEach(line => {
        pdf.text(line.trim(), addressFieldLeft, addressYPos);
        addressYPos += 4;
      });
    }

    // Add information block
    if (informationBlock) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text(informationBlock.label || 'Information', 125, 53);
    }

    // Add subject
    if (letter.subject || letter.title) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(letter.subject || letter.title, leftMargin, contentTop + 3);
    }

    // Add content
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    const contentText = letter.content_html ? convertHtmlToText(letter.content_html) : letter.content;
    const lines = pdf.splitTextToSize(contentText, pageWidth - leftMargin - rightMargin);
    
    let yPos = contentTop + 15;
    lines.forEach((line: string) => {
      if (yPos > 250) {
        pdf.addPage();
        yPos = 30;
      }
      pdf.text(line, leftMargin, yPos);
      yPos += 4.5;
    });

    // Add footer
    pdf.setFontSize(8);
    pdf.text("Fraktion GRÜNE im Landtag von Baden-Württemberg", leftMargin, 275);

    const fileName = `${letter.title || 'Brief'}_${new Date().toISOString().split('T')[0]}.pdf`;
    const pdfBlob = pdf.output('blob');
    
    return { blob: pdfBlob, filename: fileName };

  } catch (error) {
    console.error('Error generating PDF:', error);
    return null;
  }
};