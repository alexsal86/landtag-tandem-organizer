import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
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
  tenantId?: string;
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
      decisionDescription,
      tenantId
    }: DecisionEmailRequest = await req.json();

    console.log("=== SEND DECISION EMAIL DEBUG ===");
    console.log("Decision ID:", decisionId);
    console.log("Task ID:", taskId);
    console.log("Participant IDs:", participantIds);
    console.log("Decision title:", decisionTitle);
    console.log("Tenant ID:", tenantId);
    console.log("=== END DEBUG INFO ===");

    // Get email template from administration settings - filter by tenant_id if provided
    let templateQuery = supabase
      .from('decision_email_templates')
      .select('*');
    
    if (tenantId) {
      templateQuery = templateQuery.eq('tenant_id', tenantId);
    }
    
    const { data: templates, error: templateError } = await templateQuery
      .order('created_at', { ascending: false })
      .limit(1);

    const template = templates && templates.length > 0 ? templates[0] : null;

    if (templateError) {
      console.error("Error getting email template:", templateError);
    }

    // Use template from administration or fallback to defaults
    const emailTemplate = template || {
      subject: 'Entscheidungsanfrage',
      greeting: 'Hallo {participant_name},',
      introduction: 'Sie wurden zu einer Entscheidung bezüglich einer Aufgabe eingeladen.',
      instruction: 'Bitte wählen Sie eine der folgenden Optionen:',
      question_prompt: 'Falls Sie Fragen haben, können Sie diese hier stellen:',
      closing: 'Vielen Dank für Ihre Teilnahme!',
      signature: 'Ihr Team'
    };

    console.log("Using email template:", {
      subject: emailTemplate.subject,
      hasCustomTemplate: !!template
    });

    // Get task info
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('title, user_id')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) {
      console.error("Error getting task data:", taskError);
    }

    const taskTitle = taskData?.title || 'Aufgabe';
    const creatorUserId = taskData?.user_id;

    // Get creator info
    let creatorName = 'Ein Teammitglied';
    if (creatorUserId) {
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', creatorUserId)
        .maybeSingle();
      
      creatorName = creatorProfile?.display_name || 'Ein Teammitglied';
    }

    const emailResults = [];

    // Send emails to participants
    for (const participantId of participantIds) {
      try {
        console.log("Processing participant:", participantId);

        // Get participant info and token
        const { data: participant, error: participantError } = await supabase
          .from('task_decision_participants')
          .select(`
            id,
            token,
            user_id
          `)
          .eq('decision_id', decisionId)
          .eq('user_id', participantId)
          .maybeSingle();

        if (participantError) {
          console.error("Error getting participant:", participantError);
          emailResults.push({ participantId, success: false, error: "Teilnehmer nicht gefunden" });
          continue;
        }

        if (!participant) {
          console.error("Participant not found for user ID:", participantId);
          emailResults.push({ participantId, success: false, error: "Teilnehmer nicht in Datenbank gefunden" });
          continue;
        }

        if (!participant.token) {
          console.error("No token found for participant:", participantId);
          emailResults.push({ participantId, success: false, error: "Kein Token gefunden" });
          continue;
        }

        // Get participant profile info
        const { data: participantProfile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', participantId)
          .maybeSingle();

        if (profileError) {
          console.error("Error getting participant profile:", profileError);
        }

        // Get user email from auth.users (we need service role for this)
        const { data: authUserData, error: authError } = await supabase.auth.admin.getUserById(participantId);
        
        if (authError || !authUserData.user?.email) {
          console.error("Error getting user email:", authError);
          emailResults.push({ participantId, success: false, error: "E-Mail-Adresse nicht gefunden" });
          continue;
        }

        const participantName = participantProfile?.display_name || 'Team-Mitglied';
        const participantEmail = authUserData.user.email;
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

        // Helper function to replace all template variables
        const replaceVariables = (text: string) => {
          return text
            .replace(/{participant_name}/g, participantName)
            .replace(/{creator_name}/g, creatorName)
            .replace(/{decision_title}/g, decisionTitle)
            .replace(/{task_title}/g, taskTitle)
            .replace(/{decision_description}/g, decisionDescription || '');
        };

        // Prepare email content using template from administration with all variables
        const greeting = replaceVariables(emailTemplate.greeting);
        const introduction = replaceVariables(emailTemplate.introduction);
        const instruction = replaceVariables(emailTemplate.instruction);
        const questionPrompt = replaceVariables(emailTemplate.question_prompt);
        const closing = replaceVariables(emailTemplate.closing);
        const signature = replaceVariables(emailTemplate.signature);
        const subject = replaceVariables(emailTemplate.subject);
        
        // Send decision email with customized template
        const emailResponse = await resend.emails.send({
          from: "Entscheidungsanfrage <noreply@alexander-salomon.de>",
          to: [participantEmail],
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">${emailTemplate.subject}</h1>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 16px;">${greeting}</p>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                ${creatorName} ${introduction}
              </p>
              
              <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px;">Aufgabe: ${taskTitle}</h3>
                <h4 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">Entscheidung: ${decisionTitle}</h4>
                ${decisionDescription ? `<p style="margin: 0; color: #666; font-size: 14px;">${decisionDescription}</p>` : ''}
              </div>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
                ${instruction}
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${yesUrl}" 
                   style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 5px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.2);">
                  ✓ Ja
                </a>
                <a href="${questionUrl}" 
                   style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 5px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);">
                  ? Frage
                </a>
                <a href="${noUrl}" 
                   style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin: 0 5px; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);">
                  ✗ Nein
                </a>
              </div>
              
              <div style="background: #fafafa; padding: 16px; border-radius: 4px; margin: 20px 0;">
                <p style="color: #666; font-size: 14px; margin: 0; font-style: italic;">
                  ${questionPrompt}
                </p>
              </div>
              
              <p style="color: #666; font-size: 16px; margin-bottom: 10px;">
                ${closing}
              </p>
              
              <p style="color: #666; font-size: 16px; font-weight: 500;">
                ${signature}
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
          const errorMessage = emailResponse.error.toString();
          const isTestModeError = errorMessage.includes('testing emails') || 
                                 errorMessage.includes('verify a domain') ||
                                 errorMessage.includes('Domain not found');
          
          if (isTestModeError) {
            emailResults.push({ 
              participantId, 
              success: false, 
              error: "Domain nicht verifiziert - E-Mails können nur an verifizierte Adressen gesendet werden" 
            });
          } else {
            emailResults.push({ participantId, success: false, error: errorMessage });
          }
        } else {
          console.log("Email sent successfully to:", participantEmail, "ID:", emailResponse.data?.id);
          emailResults.push({ participantId, success: true, messageId: emailResponse.data?.id });
        }

      } catch (emailError: any) {
        console.error("Error sending email to participant", participantId, ":", emailError);
        emailResults.push({ participantId, success: false, error: emailError.message || "Unbekannter Fehler" });
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
        status: 200, // Always return 200 for better debugging
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in send-decision-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        success: false,
        message: "Fehler beim E-Mail-Versand"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);