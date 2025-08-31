import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { letterId } = await req.json()

    if (!letterId) {
      return new Response(
        JSON.stringify({ error: 'Letter ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Starting archive process for letter ID: ${letterId}`)

    // Get letter data
    const { data: letter, error: letterError } = await supabase
      .from('letters')
      .select('*')
      .eq('id', letterId)
      .single()

    if (letterError) {
      console.error('Error fetching letter:', letterError)
      throw letterError
    }

    if (!letter) {
      return new Response(
        JSON.stringify({ error: 'Letter not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Found letter: ${letter.title}`)

    // Build workflow history
    const workflowHistory = {
      created_at: letter.created_at,
      created_by: letter.created_by,
      submitted_for_review_at: letter.submitted_for_review_at,
      submitted_for_review_by: letter.submitted_for_review_by,
      submitted_to_user: letter.submitted_to_user,
      approved_at: letter.approved_at,
      approved_by: letter.approved_by,
      sent_at: letter.sent_at,
      sent_by: letter.sent_by,
      sent_method: letter.sent_method,
      workflow_locked: letter.workflow_locked
    }

    // No attachments for now - can be enhanced later
    const archivedAttachments = []

    // Create document record for archived letter
    const documentData = {
      title: `[ARCHIV] ${letter.title}`,
      description: `Archivierter Brief - Empfänger: ${letter.recipient_name || 'Unbekannt'}`,
      file_name: `brief_${letter.id}.pdf`,
      file_path: `archived-letters/${letter.tenant_id}/${letter.id}/brief_${letter.id}.pdf`,
      file_type: 'application/pdf',
      category: 'correspondence',
      tags: ['archiviert', 'brief', 'versendet'],
      status: 'archived',
      user_id: letter.created_by,
      tenant_id: letter.tenant_id,
      document_type: 'archived_letter',
      source_letter_id: letter.id,
      workflow_history: workflowHistory,
      archived_attachments: archivedAttachments
    }

    // Insert document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single()

    if (docError) {
      console.error('Error creating document record:', docError)
      throw docError
    }

    console.log(`Created document record: ${document.id}`)

    // Update letter with archived document reference
    const { error: updateError } = await supabase
      .from('letters')
      .update({ 
        archived_document_id: document.id,
        workflow_locked: true 
      })
      .eq('id', letterId)

    if (updateError) {
      console.error('Error updating letter:', updateError)
      throw updateError
    }

    console.log(`Letter ${letterId} successfully archived as document ${document.id}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        documentId: document.id,
        message: 'Letter archived successfully' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Archive function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})