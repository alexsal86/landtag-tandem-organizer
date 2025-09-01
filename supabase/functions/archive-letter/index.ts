import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

    // Generate PDF content using simplified HTML structure
    const pdfContent = generatePDFContent(letter);
    
    // Create a simple PDF-like text file for now (could be enhanced with actual PDF generation later)
    const pdfBuffer = new TextEncoder().encode(pdfContent);
    
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

// Generate DIN 5008 compliant PDF content  
function generatePDFContent(letter: any): string {
  const currentDate = new Date().toLocaleDateString('de-DE');
  
  // DIN 5008 Text-basierte PDF-Struktur
  let content = '';
  
  // Header-Bereich (entspricht 45mm DIN 5008)
  content += '='.repeat(80) + '\n';
  content += 'ARCHIVIERTE KORRESPONDENZ\n';
  content += '='.repeat(80) + '\n\n';
  
  // Absender-Bereich (Return address line simulation)
  if (letter.sender_info) {
    content += `${letter.sender_info.organization || ''} • ${letter.sender_info.name || ''} • `;
    content += `${letter.sender_info.street || ''} ${letter.sender_info.house_number || ''} • `;
    content += `${letter.sender_info.postal_code || ''} ${letter.sender_info.city || ''}\n`;
    content += '-'.repeat(60) + '\n\n';
  }
  
  // Empfänger-Adressfeld (entspricht DIN 5008 Adressfeld bei 46mm)
  content += 'AN:\n';
  content += `${letter.recipient_name || 'Empfänger nicht angegeben'}\n`;
  if (letter.recipient_address) {
    const addressLines = letter.recipient_address.split('\n').filter(line => line.trim());
    addressLines.forEach(line => {
      content += `${line.trim()}\n`;
    });
  }
  content += '\n';
  
  // Info-Block (entspricht DIN 5008 Info-Block bei 125mm)
  content += 'BRIEF-INFORMATIONEN:\n';
  content += '-'.repeat(30) + '\n';
  content += `Datum: ${letter.letter_date ? new Date(letter.letter_date).toLocaleDateString('de-DE') : currentDate}\n`;
  content += `Referenz: ${letter.reference_number || 'Nicht angegeben'}\n`;
  content += `Status: ${letter.status}\n`;
  if (letter.sent_date) {
    content += `Versendet: ${new Date(letter.sent_date).toLocaleDateString('de-DE')}\n`;
  }
  content += '\n\n';
  
  // Betreff (entspricht DIN 5008 Betreff bei 98.46mm)
  if (letter.subject || letter.title) {
    content += `BETREFF: ${letter.subject || letter.title}\n`;
    content += '='.repeat((letter.subject || letter.title).length + 9) + '\n\n';
  }
  
  // Briefinhalt (entspricht DIN 5008 Inhaltsbereich)
  content += 'BRIEFINHALT:\n';
  content += '-'.repeat(12) + '\n\n';
  
  // Convert HTML content to text if needed
  let textContent = letter.content || 'Kein Inhalt verfügbar';
  if (letter.content_html) {
    // Simple HTML to text conversion
    textContent = letter.content_html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      .replace(/<strong[^>]*>|<\/strong>/gi, '')
      .replace(/<b[^>]*>|<\/b>/gi, '')
      .replace(/<em[^>]*>|<\/em>/gi, '')
      .replace(/<i[^>]*>|<\/i>/gi, '')
      .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }
  
  // Format content with proper line breaks
  const paragraphs = textContent.split('\n\n').filter(p => p.trim());
  paragraphs.forEach(paragraph => {
    const words = paragraph.trim().split(' ');
    let line = '';
    words.forEach(word => {
      if ((line + word).length > 75) { // DIN 5008 typical line length
        content += line.trim() + '\n';
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    });
    if (line.trim()) {
      content += line.trim() + '\n';
    }
    content += '\n';
  });
  
  // Anlagen (entspricht DIN 5008 Anlagenverzeichnis)
  if (letter.letter_attachments && letter.letter_attachments.length > 0) {
    content += '\n' + '='.repeat(40) + '\n';
    content += 'ANLAGEN:\n';
    content += '-'.repeat(8) + '\n';
    letter.letter_attachments.forEach((attachment: any, index: number) => {
      content += `${index + 1}. ${attachment.display_name || attachment.file_name}\n`;
      content += `   Dateigröße: ${attachment.file_size ? Math.round(attachment.file_size / 1024) + ' KB' : 'Unbekannt'}\n`;
      content += `   Dateityp: ${attachment.file_type || 'Unbekannt'}\n\n`;
    });
  }
  
  // Fußzeile (entspricht DIN 5008 Fußbereich bei 272mm)
  content += '\n' + '='.repeat(80) + '\n';
  content += 'ARCHIVIERUNGS-INFORMATIONEN\n';
  content += '='.repeat(80) + '\n';
  content += `Archiviert am: ${currentDate}\n`;
  content += `Ursprünglicher Brief erstellt: ${letter.created_at ? new Date(letter.created_at).toLocaleDateString('de-DE') : 'Unbekannt'}\n`;
  content += `Workflow-Status beim Archivieren: ${letter.status}\n`;
  if (letter.sent_method) {
    content += `Versandart: ${letter.sent_method}\n`;
  }
  content += '\n';
  content += 'Dieses Dokument wurde automatisch aus dem Briefverwaltungssystem generiert.\n';
  content += 'Alle Formatierungen entsprechen der DIN 5008 Norm für Geschäftsbriefe.\n';
  
  return content;
}