import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DecisionEmailRequest {
  decisionId: string;
  taskId: string;
  participantIds: string[];
  decisionTitle: string;
  decisionDescription?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      decisionId, 
      taskId,
      participantIds, 
      decisionTitle, 
      decisionDescription 
    }: DecisionEmailRequest = await req.json();

    console.log("=== SEND DECISION EMAIL DEBUG ===");
    console.log("Decision ID:", decisionId);
    console.log("Task ID:", taskId);
    console.log("Participant IDs:", participantIds);
    console.log("Decision title:", decisionTitle);
    console.log("=== END DEBUG INFO ===");

    // Get email template
    const { data: template, error: templateError } = await supabase
      .from('decision_email_templates')
      .select('*')
      .maybeSingle();

    if (templateError) {
      console.error("Error getting email template:", templateError);
      return new Response(
        JSON.stringify({ error: "Failed to get email template" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Use default template if none exists
    const emailTemplate = template || {
      subject: 'Entscheidungsanfrage',
      greeting: 'Hallo {participant_name},',
      introduction: 'Sie wurden zu einer Entscheidung bezüglich einer Aufgabe eingeladen.',
      instruction: 'Bitte wählen Sie eine der folgenden Optionen:',
      question_prompt: 'Falls Sie Fragen haben, können Sie diese hier stellen:',
      closing: 'Vielen Dank für Ihre Teilnahme!',
      signature: 'Ihr Team'
    };

    // Get creator info
    const { data: creatorProfile, error: creatorError } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .single();

    const creatorName = creatorProfile?.display_name || 'Ein Teammitglied';

    // Get task info
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('title')
      .eq('id', taskId)
      .single();

    const taskTitle = taskData?.title || 'Aufgabe';

    const emailResults = [];

    // Send emails to participants
    for (const participantId of participantIds) {
      try {
        // Get participant info and token
        const { data: participant, error: participantError } = await supabase
          .from('task_decision_participants')
          .select(`
            id,
            token,
            user_id,
            profiles!inner(display_name, user_id)
          `)
          .eq('decision_id', decisionId)
          .eq('user_id', participantId)
          .single();

        if (participantError) {
          console.error("Error getting participant:", participantError);
          emailResults.push({ participantId, success: false, error: "Participant not found" });
          continue;
        }

        // Get user email from auth.users (we need service role for this)
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(participantId);
        
        if (authError || !authUser.user?.email) {
          console.error("Error getting user email:", authError);
          emailResults.push({ participantId, success: false, error: "User email not found" });
          continue;
        }

        const participantName = participant.profiles.display_name || 'Team-Mitglied';
        const participantEmail = authUser.user.email;
        const participantToken = participant.token;

        // Get current domain dynamically
        const origin = req.headers.get('origin') || req.headers.get('referer');
        const domain = origin ? new URL(origin).origin : 'https://wawofclbehbkebjivdte.supabase.co';
        
        // Generate response URLs
        const baseUrl = `${domain}/decision-response/${participant.id}?token=${participantToken}`;
        const yesUrl = `${baseUrl}&response=yes`;
        const noUrl = `${baseUrl}&response=no`;
        const questionUrl = `${baseUrl}&response=question`;

        console.log("About to send email to:", participantEmail, "for participant:", participantName);

        // Prepare email content
        const greeting = emailTemplate.greeting.replace('{participant_name}', participantName);
        
        // Send decision email
        const emailResponse = await resend.emails.send({
          from: "Entscheidungsanfrage <noreply@alexander-salomon.de>",
          to: [participantEmail],
          subject: emailTemplate.subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333; font-size: 24px;">${emailTemplate.subject}</h1>
              <p style="color: #666; font-size: 16px;">${greeting}</p>
              <p style="color: #666; font-size: 16px;">
                ${creatorName} ${emailTemplate.introduction}
              </p>
              <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
                <h3 style="margin: 0 0 8px 0; color: #333;">Aufgabe: ${taskTitle}</h3>
                <h4 style="margin: 0 0 8px 0; color: #333;">Entscheidung: ${decisionTitle}</h4>
                ${decisionDescription ? `<p style="margin: 0; color: #666;">${decisionDescription}</p>` : ''}
              </div>
              <p style="color: #666; font-size: 16px;">
                ${emailTemplate.instruction}
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${yesUrl}" 
                   style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 5px;">
                  ✓ Ja
                </a>
                <a href="${questionUrl}" 
                   style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 5px;">
                  ? Frage
                </a>
                <a href="${noUrl}" 
                   style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 5px;">
                  ✗ Nein
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                ${emailTemplate.question_prompt}
              </p>
              <p style="color: #666; font-size: 16px;">
                ${emailTemplate.closing}
              </p>
              <p style="color: #666; font-size: 16px;">
                ${emailTemplate.signature}
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">
                Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
              </p>
            </div>
          `,
        });

        if (emailResponse.error) {
          console.error("Email send error:", emailResponse.error);
          const isTestModeError = emailResponse.error && 
            (emailResponse.error.toString().includes('testing emails') || 
             emailResponse.error.toString().includes('verify a domain'));
          
          if (isTestModeError) {
            emailResults.push({ 
              participantId, 
              success: false, 
              error: "Domain nicht verifiziert - E-Mails können nur an verifizierte Adressen gesendet werden" 
            });
          } else {
            emailResults.push({ participantId, success: false, error: emailResponse.error });
          }
        } else {
          console.log("Email sent successfully to:", participantEmail, "ID:", emailResponse.data?.id);
          emailResults.push({ participantId, success: true, messageId: emailResponse.data?.id });
        }

      } catch (emailError) {
        console.error("Error sending email to participant", participantId, ":", emailError);
        emailResults.push({ participantId, success: false, error: emailError.message || "Unknown error" });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    console.log("=== EMAIL RESULTS SUMMARY ===");
    console.log(`Sent ${successCount}/${emailResults.length} emails successfully`);
    console.log("Results:", JSON.stringify(emailResults, null, 2));
    console.log("=== END SUMMARY ===");

    return new Response(
      JSON.stringify({ 
        success: successCount > 0, 
        message: `${successCount}/${emailResults.length} E-Mails erfolgreich versendet`,
        results: emailResults
      }),
      {
        status: successCount > 0 ? 200 : 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in send-decision-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);