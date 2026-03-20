import { corsHeaders, withSafeHandler } from "../_shared/security.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

type AuditStatus =
  | "success"
  | "invalid_code"
  | "revoked"
  | "expired"
  | "missing_rsvp"
  | "missing_event"
  | "rate_limited"
  | "bad_request";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
}

function auditLog(status: AuditStatus, details: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      audit_type: "public_event_invitation_lookup",
      status,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

function rateLimit(ipAddress: string) {
  const now = Date.now();
  const current = rateLimitStore.get(ipAddress);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(ipAddress, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  rateLimitStore.set(ipAddress, current);

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - current.count,
    resetAt: current.resetAt,
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

Deno.serve(
  withSafeHandler("get-public-event-invitation", async (req) => {
    if (req.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed" },
        405,
        { Allow: "POST" },
      );
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";
    const limit = rateLimit(ipAddress);
    const rateLimitHeaders = {
      "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-RateLimit-Reset": new Date(limit.resetAt).toISOString(),
    };

    if (!limit.allowed) {
      auditLog("rate_limited", {
        ipAddress,
        userAgent,
        resetAt: new Date(limit.resetAt).toISOString(),
      });
      return jsonResponse(
        { error: "Too many requests" },
        429,
        {
          ...rateLimitHeaders,
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000)),
          ),
        },
      );
    }

    const { public_code: publicCode } = await req.json();

    if (typeof publicCode !== "string" || publicCode.trim().length < 16) {
      auditLog("bad_request", {
        ipAddress,
        userAgent,
        reason: "invalid_public_code_shape",
      });
      return jsonResponse(
        { error: "Invalid code", code: "invalid_code" },
        400,
        rateLimitHeaders,
      );
    }

    const supabase = createServiceRoleClient();
    const normalizedCode = publicCode.trim();

    const { data: publicLink, error: publicLinkError } = await supabase
      .from("event_rsvp_public_links")
      .select("id, event_rsvp_id, expires_at, revoked_at")
      .eq("public_code", normalizedCode)
      .maybeSingle();

    if (publicLinkError) throw publicLinkError;

    if (!publicLink) {
      auditLog("invalid_code", {
        ipAddress,
        userAgent,
        publicCodePrefix: normalizedCode.slice(0, 8),
      });
      return jsonResponse(
        { error: "Invalid code", code: "invalid_code" },
        404,
        rateLimitHeaders,
      );
    }

    if (publicLink.revoked_at) {
      auditLog("revoked", {
        ipAddress,
        userAgent,
        publicLinkId: publicLink.id,
      });
      return jsonResponse(
        { error: "Invitation revoked", code: "revoked_invitation" },
        410,
        rateLimitHeaders,
      );
    }

    if (
      publicLink.expires_at &&
      new Date(publicLink.expires_at).getTime() <= Date.now()
    ) {
      auditLog("expired", {
        ipAddress,
        userAgent,
        publicLinkId: publicLink.id,
        expiresAt: publicLink.expires_at,
      });
      return jsonResponse(
        { error: "Invitation expired", code: "expired_invitation" },
        410,
        rateLimitHeaders,
      );
    }

    const { data: rsvp, error: rsvpError } = await supabase
      .from("event_rsvps")
      .select("event_planning_id, name, status, comment")
      .eq("id", publicLink.event_rsvp_id)
      .maybeSingle();

    if (rsvpError) throw rsvpError;

    if (!rsvp) {
      auditLog("missing_rsvp", {
        ipAddress,
        userAgent,
        publicLinkId: publicLink.id,
      });
      return jsonResponse(
        { error: "Invitation unavailable", code: "invitation_unavailable" },
        404,
        rateLimitHeaders,
      );
    }

    const { data: event, error: eventError } = await supabase
      .from("event_plannings")
      .select(
        "title, description, confirmed_date, location, is_archived, archived_at",
      )
      .eq("id", rsvp.event_planning_id)
      .maybeSingle();

    if (eventError) throw eventError;

    if (!event || event.is_archived || event.archived_at) {
      auditLog("missing_event", {
        ipAddress,
        userAgent,
        publicLinkId: publicLink.id,
        eventPlanningId: rsvp.event_planning_id,
      });
      return jsonResponse(
        { error: "Event unavailable", code: "event_unavailable" },
        404,
        rateLimitHeaders,
      );
    }

    const { error: touchError } = await supabase
      .from("event_rsvp_public_links")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", publicLink.id);

    if (touchError) {
      console.error(
        "Failed to update last_used_at for public invitation",
        touchError,
      );
    }

    auditLog("success", {
      ipAddress,
      userAgent,
      publicLinkId: publicLink.id,
      eventPlanningId: rsvp.event_planning_id,
      responseStatus: rsvp.status,
    });

    return jsonResponse(
      {
        invitation: {
          event_title: event.title,
          event_description: event.description,
          event_date: event.confirmed_date,
          event_location: event.location,
          guest_display_name: rsvp.name,
          rsvp_status: rsvp.status,
          comment: rsvp.comment,
        },
      },
      200,
      rateLimitHeaders,
    );
  }),
);
