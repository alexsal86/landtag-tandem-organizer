import { corsHeaders } from "../_shared/security.ts";

/**
 * @owner team-platform
 * @secondary-owner team-office
 * @feature public-event-rsvp
 * @security-model public-webhook
 */
export const ALLOWED_STATUSES = ["accepted", "declined", "tentative"] as const;
export const MAX_COMMENT_LENGTH = 500;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 20;
export const RATE_LIMIT_MAX_INVALID_REQUESTS = 8;
export const DEFAULT_RESPONSE_POLICY = "latest_wins" as const;

export type AllowedStatus = (typeof ALLOWED_STATUSES)[number];
export type AuditStatus =
  | "success"
  | "invalid_code"
  | "revoked"
  | "expired"
  | "missing_rsvp"
  | "missing_event"
  | "bad_request"
  | "rate_limited";

export type PublicLinkRecord = {
  id: string;
  event_rsvp_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  response_count: number | null;
};

export type RsvpRecord = {
  id: string;
  event_planning_id: string;
  name: string;
  status: string;
};

export type EventRecord = {
  title: string;
  is_archived: boolean | null;
  archived_at: string | null;
};

// deno-lint-ignore no-explicit-any
export type ServiceClient = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<{ data: any; error: unknown }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: unknown }>;
    };
  };
};

export type HandlerDependencies = {
  createServiceRoleClient: () => ServiceClient;
  rateLimitStore?: Map<string, { count: number; resetAt: number }>;
  now?: () => number;
  hashText?: (value: string) => Promise<string>;
  auditLog?: (status: AuditStatus, details: Record<string, unknown>) => void;
  verifyCaptcha?: (payload: {
    token?: string;
    provider?: "turnstile" | "hcaptcha";
    ipAddress: string;
    userAgent: string;
  }) => Promise<{
    verified: boolean;
    required: boolean;
    provider: "turnstile" | "hcaptcha" | null;
    siteKey: string | null;
    error?: string;
  }>;
  invalidRateLimitStore?: Map<string, { count: number; resetAt: number }>;
};

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

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function validatePublicCodeShape(
  publicCode: unknown,
): publicCode is string {
  return typeof publicCode === "string" && publicCode.trim().length >= 16;
}

export function validateStatus(status: unknown): status is AllowedStatus {
  return (
    typeof status === "string" &&
    (ALLOWED_STATUSES as readonly string[]).includes(status)
  );
}

export function validateComment(
  comment: unknown,
): comment is string | undefined {
  return (
    comment === undefined || comment === null || typeof comment === "string"
  );
}

export function rateLimit(
  ipAddress: string,
  store: Map<string, { count: number; resetAt: number }>,
  now = Date.now(),
  maxRequests = RATE_LIMIT_MAX_REQUESTS,
) {
  const current = store.get(ipAddress);

  if (!current || current.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    store.set(ipAddress, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  store.set(ipAddress, current);
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    resetAt: current.resetAt,
  };
}

export async function defaultHashText(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function defaultAuditLog(
  status: AuditStatus,
  details: Record<string, unknown>,
) {
  console.log(
    JSON.stringify({
      audit_type: "public_event_invitation_response",
      status,
      timestamp: new Date().toISOString(),
      endpoint: "respond-public-event-invitation",
      ...details,
    }),
  );
}

export async function handleRespondPublicEventInvitation(
  req: Request,
  deps: HandlerDependencies,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, {
      Allow: "POST",
    });
  }

  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";
  const now = deps.now ?? Date.now;
  const currentNow = now();
  const limit = rateLimit(
    ipAddress,
    deps.rateLimitStore ?? new Map(),
    currentNow,
  );
  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(limit.remaining),
    "X-RateLimit-Reset": new Date(limit.resetAt).toISOString(),
  };
  const auditLog = deps.auditLog ?? defaultAuditLog;

  if (!limit.allowed) {
    auditLog("rate_limited", {
      ipAddress,
      userAgent,
      resetAt: new Date(limit.resetAt).toISOString(),
    });
    return jsonResponse({ error: "Too many requests" }, 429, {
      ...rateLimitHeaders,
      "Retry-After": String(
        Math.max(1, Math.ceil((limit.resetAt - currentNow) / 1000)),
      ),
    });
  }

  const invalidRateLimitStore = deps.invalidRateLimitStore ?? new Map();
  const readInvalidLimit = () =>
    rateLimit(
      ipAddress,
      invalidRateLimitStore,
      currentNow,
      RATE_LIMIT_MAX_INVALID_REQUESTS,
    );
  const currentInvalidLimit = invalidRateLimitStore.get(ipAddress);
  const body = await req.json().catch(() => null);
  const publicCode = body?.public_code;
  const status = body?.status;
  const commentInput = body?.comment;
  const captchaToken =
    typeof body?.captcha_token === "string"
      ? body.captcha_token.trim()
      : undefined;
  const captchaProvider =
    body?.captcha_provider === "turnstile" ||
    body?.captcha_provider === "hcaptcha"
      ? body.captcha_provider
      : undefined;

  if (
    currentInvalidLimit &&
    currentInvalidLimit.count >= RATE_LIMIT_MAX_INVALID_REQUESTS &&
    currentInvalidLimit.resetAt > currentNow
  ) {
    auditLog("rate_limited", {
      ipAddress,
      userAgent,
      strategy: "invalid_attempts",
      resetAt: new Date(currentInvalidLimit.resetAt).toISOString(),
    });
    return jsonResponse(
      { error: "Too many invalid requests", code: "rate_limited_invalid" },
      429,
      {
        ...rateLimitHeaders,
        "Retry-After": String(
          Math.max(
            1,
            Math.ceil((currentInvalidLimit.resetAt - currentNow) / 1000),
          ),
        ),
      },
    );
  }

  if (
    !validatePublicCodeShape(publicCode) ||
    !validateStatus(status) ||
    !validateComment(commentInput)
  ) {
    const invalidLimit = readInvalidLimit();
    auditLog("bad_request", {
      ipAddress,
      userAgent,
      reason: "invalid_payload_shape",
      invalidAttemptCount:
        RATE_LIMIT_MAX_INVALID_REQUESTS - invalidLimit.remaining,
    });
    return jsonResponse(
      { error: "Invalid request", code: "invalid_request" },
      400,
      rateLimitHeaders,
    );
  }

  const normalizedCode = publicCode.trim();
  const normalizedComment =
    typeof commentInput === "string" ? commentInput.trim() : "";
  const captchaResult = await (
    deps.verifyCaptcha ??
    (async ({ provider }: { provider?: "turnstile" | "hcaptcha" }) => ({
      verified: true,
      required: false,
      provider: provider ?? null,
      siteKey: null,
    }))
  )({
    token: captchaToken,
    provider: captchaProvider,
    ipAddress,
    userAgent,
  });

  if (!captchaResult.verified) {
    auditLog("bad_request", {
      ipAddress,
      userAgent,
      reason: "captcha_failed",
      captchaProvider: captchaResult.provider,
      captchaRequired: captchaResult.required,
    });
    return jsonResponse(
      {
        error: captchaResult.error ?? "Captcha verification failed",
        code: "captcha_failed",
        captcha_required: captchaResult.required,
      },
      400,
      rateLimitHeaders,
    );
  }

  if (normalizedComment.length > MAX_COMMENT_LENGTH) {
    auditLog("bad_request", {
      ipAddress,
      userAgent,
      reason: "comment_too_long",
    });
    return jsonResponse(
      {
        error: "Comment too long",
        code: "comment_too_long",
        max_comment_length: MAX_COMMENT_LENGTH,
      },
      400,
      rateLimitHeaders,
    );
  }

  const supabase = deps.createServiceRoleClient();
  const { data: publicLink, error: publicLinkError } = (await supabase
    .from("event_rsvp_public_links")
    .select("id, event_rsvp_id, expires_at, revoked_at, response_count")
    .eq("public_code", normalizedCode)
    .maybeSingle()) as { data: PublicLinkRecord | null; error: unknown };

  if (publicLinkError) throw publicLinkError;

  if (!publicLink) {
    auditLog("invalid_code", {
      ipAddress,
      userAgent,
      publicCodePrefix: normalizedCode.slice(0, 8),
      failure_reason: "unknown_code",
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
      failure_reason: "revoked_code",
    });
    return jsonResponse(
      { error: "Invitation revoked", code: "revoked_invitation" },
      410,
      rateLimitHeaders,
    );
  }

  if (
    publicLink.expires_at &&
    new Date(publicLink.expires_at).getTime() <= currentNow
  ) {
    auditLog("expired", {
      ipAddress,
      userAgent,
      publicLinkId: publicLink.id,
      expiresAt: publicLink.expires_at,
      failure_reason: "expired_code",
    });
    return jsonResponse(
      { error: "Invitation expired", code: "expired_invitation" },
      410,
      rateLimitHeaders,
    );
  }

  const { data: rsvp, error: rsvpError } = (await supabase
    .from("event_rsvps")
    .select("id, event_planning_id, name, status")
    .eq("id", publicLink.event_rsvp_id)
    .maybeSingle()) as { data: RsvpRecord | null; error: unknown };

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

  const { data: event, error: eventError } = (await supabase
    .from("event_plannings")
    .select("title, is_archived, archived_at")
    .eq("id", rsvp.event_planning_id)
    .maybeSingle()) as { data: EventRecord | null; error: unknown };

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

  const respondedAt = new Date(currentNow).toISOString();
  const hashedIp = await (deps.hashText ?? defaultHashText)(ipAddress);

  const { error: updateRsvpError } = await supabase
    .from("event_rsvps")
    .update({
      status,
      comment: normalizedComment || null,
      responded_at: respondedAt,
    })
    .eq("id", rsvp.id);

  if (updateRsvpError) throw updateRsvpError;

  const { error: updateLinkError } = await supabase
    .from("event_rsvp_public_links")
    .update({
      last_used_at: respondedAt,
      response_count: (publicLink.response_count ?? 0) + 1,
      last_response_ip_hash: hashedIp,
      last_response_user_agent: userAgent.slice(0, 512),
      last_response_source: "public_website",
    })
    .eq("id", publicLink.id);

  if (updateLinkError) throw updateLinkError;

  auditLog("success", {
    ipAddress,
    userAgent,
    publicLinkId: publicLink.id,
    eventPlanningId: rsvp.event_planning_id,
    responseStatus: status,
  });

  return jsonResponse(
    {
      success: true,
      response: {
        status,
        comment: normalizedComment || null,
        responded_at: respondedAt,
        guest_display_name: rsvp.name,
        event_title: event.title,
        response_policy: DEFAULT_RESPONSE_POLICY,
        allow_response_updates: true,
      },
    },
    200,
    rateLimitHeaders,
  );
}
