import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LetterToArchive {
  id: string;
  title: string;
  content: string;
  tenant_id: string;
  created_by: string;
  sent_at: string;
}

interface ArchiveSettings {
  user_id: string;
  auto_archive_days: number;
  show_sent_letters: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto-archive-letters function');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all archive settings where auto archiving is enabled
    const { data: archiveSettings, error: settingsError } = await supabase
      .from('letter_archive_settings')
      .select('*')
      .gt('auto_archive_days', 0);

    if (settingsError) {
      console.error('Error fetching archive settings:', settingsError);
      throw settingsError;
    }

    console.log(`Found ${archiveSettings?.length || 0} users with auto-archive settings`);

    let totalArchived = 0;

    // Process each user's settings
    for (const settings of archiveSettings || []) {
      try {
        await processUserArchiving(supabase, settings);
        totalArchived++;
      } catch (userError) {
        console.error(`Error processing archiving for user ${settings.user_id}:`, userError);
      }
    }

    console.log(`Auto-archiving completed. Processed ${totalArchived} users.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Auto-archiving completed for ${totalArchived} users`,
        processed: totalArchived
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in auto-archive-letters function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process auto-archiving',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function processUserArchiving(supabase: any, settings: ArchiveSettings) {
  console.log(`Processing auto-archiving for user ${settings.user_id}`);
  
  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - settings.auto_archive_days);
  const cutoffDateStr = cutoffDate.toISOString();

  // Get sent letters that are older than the cutoff date and not yet archived
  const { data: lettersToArchive, error: lettersError } = await supabase
    .from('letters')
    .select('*')
    .eq('status', 'sent')
    .eq('created_by', settings.user_id)
    .lt('sent_at', cutoffDateStr)
    .is('archived_document_id', null);

  if (lettersError) {
    console.error('Error fetching letters to archive:', lettersError);
    throw lettersError;
  }

  console.log(`Found ${lettersToArchive?.length || 0} letters to archive for user ${settings.user_id}`);

  // Archive each letter
  for (const letter of lettersToArchive || []) {
    try {
      console.log(`Archiving letter ${letter.id}: ${letter.title}`);
      
      // Call the archive-letter function
      const { data: archiveResult, error: archiveError } = await supabase.functions
        .invoke('archive-letter', {
          body: { 
            letterId: letter.id,
            isAutoArchive: true 
          }
        });

      if (archiveError) {
        console.error(`Error archiving letter ${letter.id}:`, archiveError);
        continue;
      }

      console.log(`Successfully archived letter ${letter.id}`);
      
    } catch (letterError) {
      console.error(`Error processing letter ${letter.id}:`, letterError);
    }
  }
}