import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createServiceRoleClient();

    const {
      eventPlanningId,
      eventTitle,
      rsvpIds,
      type = "invitation",
      customMessage,
    } = await req.json();

    console.log("Processing event email:", {
      eventPlanningId,
      eventTitle,
      rsvpIds,
      type,
    });

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("event_plannings")
      .select("title, description, confirmed_date, location, user_id")
      .eq("id", eventPlanningId)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    // Get creator name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", event.user_id)
      .single();

    const creatorName = profile?.display_name || "Unbekannt";

    // Get RSVPs that should receive public invitation links
    const { data: rsvps, error: rsvpError } = await supabase
      .from("event_rsvps")
      .select("id, email, name")
      .in("id", rsvpIds);

    if (rsvpError) throw rsvpError;

    const getSubject = (rsvpName: string) => {
      switch (type) {
        case "reminder":
          return `Erinnerung: ${event.title}`;
        case "note":
          return `Hinweis: ${event.title}`;
        default:
          return `Einladung: ${event.title}`;
      }
    };

    const getEmailHtml = (rsvp: { name: string }, invitationUrl: string) => {
      const personalizedMessage = customMessage
        ? customMessage
            .replace(/\{name\}/g, rsvp.name)
            .replace(/\{eventTitle\}/g, event.title)
            .replace(/\n/g, "<br/>")
        : "";

      if (type === "note") {
        // Simple note email - no RSVP link needed
        return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333; font-size: 24px;">Hinweis zur Veranstaltung</h1>
            <p style="color: #666;">Hallo ${rsvp.name},</p>
            <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; color: #333;">${event.title}</h3>
              ${personalizedMessage ? `<p style="color: #666; margin: 8px 0;">${personalizedMessage}</p>` : ""}
            </div>
            <p style="color: #666;">Absender: ${creatorName}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">Diese E-Mail wurde automatisch generiert.</p>
          </div>
        `;
      }

      if (type === "reminder") {
        return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333; font-size: 24px;">Erinnerung</h1>
            <p style="color: #666;">Hallo ${rsvp.name},</p>
            ${
              personalizedMessage
                ? `<p style="color: #666;">${personalizedMessage}</p>`
                : `<p style="color: #666;">${creatorName} erinnert Sie an die folgende Veranstaltung:</p>`
            }
            <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; color: #333;">${event.title}</h3>
              ${event.description ? `<p style="margin: 0 0 4px 0; color: #666;">${event.description}</p>` : ""}
              ${event.confirmed_date ? `<p style="margin: 0 0 4px 0; color: #666;">📅 ${event.confirmed_date}</p>` : ""}
              ${event.location ? `<p style="margin: 0; color: #666;">📍 ${event.location}</p>` : ""}
            </div>
            <p style="color: #666;">Bitte teilen Sie uns mit, ob Sie teilnehmen können:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Zu-/Absage mitteilen
              </a>
            </div>
            <p style="color: #999; font-size: 14px;"><a href="${invitationUrl}" style="color: #3b82f6;">${invitationUrl}</a></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">Diese E-Mail wurde automatisch generiert.</p>
          </div>
        `;
      }

      // Default: invitation
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; font-size: 24px;">Einladung zur Veranstaltung</h1>
          <p style="color: #666;">Hallo ${rsvp.name},</p>
          ${
            personalizedMessage
              ? `<p style="color: #666;">${personalizedMessage}</p>`
              : `<p style="color: #666;">${creatorName} lädt Sie herzlich ein:</p>`
          }
          <div style="background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
            <h3 style="margin: 0 0 8px 0; color: #333;">${event.title}</h3>
            ${event.description ? `<p style="margin: 0 0 4px 0; color: #666;">${event.description}</p>` : ""}
            ${event.confirmed_date ? `<p style="margin: 0 0 4px 0; color: #666;">📅 ${event.confirmed_date}</p>` : ""}
            ${event.location ? `<p style="margin: 0; color: #666;">📍 ${event.location}</p>` : ""}
          </div>
          <p style="color: #666;">Bitte teilen Sie uns mit, ob Sie teilnehmen können:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Zu-/Absage mitteilen
            </a>
          </div>
          <p style="color: #999; font-size: 14px;"><a href="${invitationUrl}" style="color: #3b82f6;">${invitationUrl}</a></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">Diese E-Mail wurde automatisch generiert.</p>
        </div>
      `;
    };

    const results = await Promise.all(
      (rsvps || []).map(async (rsvp) => {
        const { data: existingLink, error: existingLinkError } = await supabase
          .from("event_rsvp_public_links")
          .select("id, public_code")
          .eq("event_rsvp_id", rsvp.id)
          .is("revoked_at", null)
          .maybeSingle();

        if (existingLinkError) throw existingLinkError;

        let publicLink = existingLink;

        // Public invitations and reminders are bound only to the stable public domain
        // and public_code, not to the old platform-specific event-rsvp route.
        if (!publicLink) {
          const { data: insertedLink, error: insertedLinkError } =
            await supabase
              .from("event_rsvp_public_links")
              .insert({ event_rsvp_id: rsvp.id })
              .select("id, public_code")
              .single();

          if (insertedLinkError) throw insertedLinkError;
          publicLink = insertedLink;
        }

        if (!publicLink?.public_code) {
          throw new Error(`Missing public RSVP code for ${rsvp.id}`);
        }

        const invitationUrl = `https://www.alexander-salomon.de/einladung/${publicLink.public_code}`;

        try {
          const emailResponse = await resend.emails.send({
            from: "Veranstaltung <noreply@alexander-salomon.de>",
            to: [rsvp.email],
            subject: getSubject(rsvp.name),
            html: getEmailHtml(rsvp, invitationUrl),
          });

          console.log(`Email sent to ${rsvp.email}:`, emailResponse);
          return { email: rsvp.email, success: true };
        } catch (error) {
          console.error(`Error sending to ${rsvp.email}:`, error);
          return { email: rsvp.email, success: false, error: String(error) };
        }
      }),
    );

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-event-invitation:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
