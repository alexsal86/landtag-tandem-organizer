import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArchiveSettings {
  user_id: string;
  tenant_id: string;
  auto_archive_days: number | null;
  auto_delete_after_days: number | null;
}

interface Decision {
  id: string;
  created_by: string;
  tenant_id: string;
  title: string;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting auto-archive-decisions job...');

    // 1. Hole alle Archivierungseinstellungen
    const { data: settings, error: settingsError } = await supabase
      .from('decision_archive_settings')
      .select('*')
      .or('auto_archive_days.not.is.null,auto_delete_after_days.not.is.null');

    if (settingsError) {
      throw settingsError;
    }

    console.log(`Found ${settings?.length || 0} archive settings to process`);

    let archivedCount = 0;
    let deletedCount = 0;
    let warningsSent = 0;

    // 2. Für jede Einstellung: Verarbeite Archivierung und Löschung
    for (const setting of settings as ArchiveSettings[]) {
      console.log(`Processing settings for user ${setting.user_id} in tenant ${setting.tenant_id}`);

      // 2.1 Verzögerte Archivierung (nur wenn auto_archive_days gesetzt ist)
      if (setting.auto_archive_days) {
        const archiveThreshold = new Date();
        archiveThreshold.setDate(archiveThreshold.getDate() - setting.auto_archive_days);

        // Finde vollständig beantwortete Entscheidungen, die archiviert werden sollen
        const { data: decisionsToArchive, error: decisionsError } = await supabase
          .from('task_decisions')
          .select(`
            id,
            created_by,
            tenant_id,
            title,
            status,
            created_at,
            task_decision_participants!inner(id),
            task_decision_responses!inner(id, participant_id, response_type, creator_response, created_at)
          `)
          .eq('created_by', setting.user_id)
          .eq('tenant_id', setting.tenant_id)
          .in('status', ['active', 'open'])
          .lt('created_at', archiveThreshold.toISOString());

        if (decisionsError) {
          console.error('Error fetching decisions to archive:', decisionsError);
          continue;
        }

        console.log(`Found ${decisionsToArchive?.length || 0} potential decisions to archive`);

        // Prüfe jede Entscheidung auf Vollständigkeit
        for (const decision of decisionsToArchive || []) {
          const participants = (decision as any).task_decision_participants || [];
          const responses = (decision as any).task_decision_responses || [];

          const totalParticipants = participants.length;
          const uniqueResponses = new Set(responses.map((r: any) => r.participant_id)).size;
          const openQuestions = responses.filter((r: any) => 
            r.response_type === 'question' && 
            (!r.creator_response || r.creator_response === '')
          ).length;

          // Wenn alle geantwortet haben und keine offenen Fragen
          if (totalParticipants > 0 && totalParticipants === uniqueResponses && openQuestions === 0) {
            // Finde die letzte Antwort
            const lastResponseDate = new Date(
              Math.max(...responses.map((r: any) => new Date(r.created_at).getTime()))
            );
            
            const daysSinceLastResponse = Math.floor(
              (Date.now() - lastResponseDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysSinceLastResponse >= setting.auto_archive_days) {
              // Archiviere die Entscheidung
              const { error: archiveError } = await supabase
                .from('task_decisions')
                .update({
                  status: 'archived',
                  archived_at: new Date().toISOString(),
                  archived_by: decision.created_by,
                  updated_at: new Date().toISOString()
                })
                .eq('id', decision.id);

              if (archiveError) {
                console.error(`Error archiving decision ${decision.id}:`, archiveError);
              } else {
                console.log(`Archived decision ${decision.id}`);
                archivedCount++;

                // Sende Notification
                await supabase.rpc('create_notification', {
                  user_id_param: decision.created_by,
                  type_name: 'decision_archived',
                  title_param: 'Entscheidung automatisch archiviert',
                  message_param: `Ihre Entscheidungsanfrage "${decision.title}" wurde nach ${setting.auto_archive_days} Tagen automatisch archiviert.`,
                  data_param: {
                    decision_id: decision.id,
                    auto_archived: true,
                    days: setting.auto_archive_days
                  },
                  priority_param: 'low'
                });
              }
            } else {
              // Warnung senden, wenn in 3 Tagen archiviert wird
              const daysUntilArchive = setting.auto_archive_days - daysSinceLastResponse;
              if (daysUntilArchive === 3) {
                await supabase.rpc('create_notification', {
                  user_id_param: decision.created_by,
                  type_name: 'decision_archived',
                  title_param: 'Entscheidung wird bald archiviert',
                  message_param: `Ihre Entscheidungsanfrage "${decision.title}" wird in 3 Tagen automatisch archiviert.`,
                  data_param: {
                    decision_id: decision.id,
                    days_until_archive: 3
                  },
                  priority_param: 'medium'
                });
                warningsSent++;
              }
            }
          }
        }
      }

      // 2.2 Auto-Löschung (nur wenn auto_delete_after_days gesetzt ist)
      if (setting.auto_delete_after_days) {
        const deleteThreshold = new Date();
        deleteThreshold.setDate(deleteThreshold.getDate() - setting.auto_delete_after_days);

        const { data: decisionsToDelete, error: deleteError } = await supabase
          .from('task_decisions')
          .delete()
          .eq('created_by', setting.user_id)
          .eq('tenant_id', setting.tenant_id)
          .eq('status', 'archived')
          .lt('archived_at', deleteThreshold.toISOString())
          .select('id, title');

        if (deleteError) {
          console.error('Error deleting archived decisions:', deleteError);
        } else {
          const deleteCount = decisionsToDelete?.length || 0;
          deletedCount += deleteCount;
          console.log(`Deleted ${deleteCount} archived decisions for user ${setting.user_id}`);

          // Sende Notification bei Löschung
          if (deleteCount > 0) {
            await supabase.rpc('create_notification', {
              user_id_param: setting.user_id,
              type_name: 'decision_archived',
              title_param: 'Archivierte Entscheidungen gelöscht',
              message_param: `${deleteCount} archivierte Entscheidungsanfrage(n) wurden nach ${setting.auto_delete_after_days} Tagen automatisch gelöscht.`,
              data_param: {
                deleted_count: deleteCount,
                days: setting.auto_delete_after_days
              },
              priority_param: 'low'
            });
          }
        }
      }
    }

    console.log(`Job completed: ${archivedCount} archived, ${deletedCount} deleted, ${warningsSent} warnings sent`);

    return new Response(
      JSON.stringify({
        success: true,
        archivedCount,
        deletedCount,
        warningsSent,
        message: 'Auto-archive job completed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error in auto-archive-decisions:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
