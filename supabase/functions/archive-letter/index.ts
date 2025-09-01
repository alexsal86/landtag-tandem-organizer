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

    // Fetch letter with all details
    const { data: letter, error: letterError } = await supabase
      .from('letters')
      .select(`
        *,
        letter_templates(*),
        sender_information(*),
        information_blocks(*),
        letter_attachments(*)
      `)
      .eq('id', letterId)
      .single();

    if (letterError || !letter) {
      console.error('Error fetching letter:', letterError);
      throw new Error('Letter not found');
    }

    console.log('Letter fetched:', letter.title);

    // Generate PDF content using simplified HTML structure
    const pdfContent = generatePDFContent(letter);
    
    // Create document record with PDF content
    const documentFileName = `letter_${letter.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert({
        user_id: letter.created_by,
        tenant_id: letter.tenant_id,
        title: `Brief: ${letter.title}`,
        description: `Archivierte Version des Briefes "${letter.title}"`,
        file_name: documentFileName,
        file_path: `archived_letters/${documentFileName}`,
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

    // Update letter with archived document reference
    const { error: updateError } = await supabase
      .from('letters')
      .update({
        archived_document_id: document.id,
        status: 'archived',
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

function generatePDFContent(letter: any): string {
  // Generate simplified PDF content representation
  return `
    Brief: ${letter.title}
    
    Erstellt am: ${new Date(letter.created_at).toLocaleDateString('de-DE')}
    Empfänger: ${letter.recipient_name || 'Nicht angegeben'}
    ${letter.recipient_address ? `Adresse: ${letter.recipient_address}` : ''}
    
    Inhalt:
    ${letter.content || letter.content_html || 'Kein Inhalt'}
    
    Status: ${letter.status}
    ${letter.sent_date ? `Versendet am: ${letter.sent_date}` : ''}
    ${letter.sent_method ? `Versandart: ${letter.sent_method}` : ''}
    
    Anlagen: ${letter.letter_attachments?.length || 0}
    ${letter.letter_attachments?.map((att: any) => `- ${att.display_name || att.file_name}`).join('\n') || ''}
  `;
}