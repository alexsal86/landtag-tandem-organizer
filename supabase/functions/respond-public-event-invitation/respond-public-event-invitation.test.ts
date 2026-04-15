import { describe, expect, it, vi } from "vitest";
import {
  handleRespondPublicEventInvitation,
  MAX_COMMENT_LENGTH,
  RATE_LIMIT_MAX_INVALID_REQUESTS,
  RATE_LIMIT_MAX_REQUESTS,
} from "./respond-public-event-invitation.ts";

function createMockClient(overrides?: {
  publicLink?: any;
  rsvp?: any;
  event?: any;
  updateErrors?: Record<string, unknown>;
  updates?: Array<{
    table: string;
    values: Record<string, unknown>;
    eq: [string, string];
  }>;
}) {
  const updates = overrides?.updates ?? [];

  return {
    from(table: string) {
      return {
        select() {
          return {
            eq(_column: string, value: string) {
              return {
                maybeSingle: async () => {
                  if (table === "event_rsvp_public_links")
                    return { data: overrides?.publicLink ?? null, error: null };
                  if (table === "event_rsvps")
                    return { data: overrides?.rsvp ?? null, error: null };
                  if (table === "event_plannings")
                    return { data: overrides?.event ?? null, error: null };
                  throw new Error(
                    `Unexpected select table ${table} for ${value}`,
                  );
                },
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          return {
            async eq(column: string, value: string) {
              updates.push({ table, values, eq: [column, value] });
              return { error: overrides?.updateErrors?.[table] ?? null };
            },
          };
        },
      };
    },
  };
}

describe("respond-public-event-invitation", () => {
  it("rejects malformed public write requests", async () => {
    const response = await handleRespondPublicEventInvitation(
      new Request(
        "http://localhost/functions/v1/respond-public-event-invitation",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ public_code: "short", status: "accepted" }),
        },
      ),
      {
        createServiceRoleClient: () => createMockClient(),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
    });
  });

  it("rejects inactive invitations and overlong comments", async () => {
    const expiredResponse = await handleRespondPublicEventInvitation(
      new Request(
        "http://localhost/functions/v1/respond-public-event-invitation",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            public_code: "a".repeat(32),
            status: "accepted",
          }),
        },
      ),
      {
        createServiceRoleClient: () =>
          createMockClient({
            publicLink: {
              id: "link-1",
              event_rsvp_id: "rsvp-1",
              revoked_at: null,
              expires_at: "2020-01-01T00:00:00.000Z",
              response_count: 0,
            },
          }),
        now: () => Date.parse("2026-03-20T12:00:00.000Z"),
      },
    );

    expect(expiredResponse.status).toBe(410);

    const commentResponse = await handleRespondPublicEventInvitation(
      new Request(
        "http://localhost/functions/v1/respond-public-event-invitation",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            public_code: "b".repeat(32),
            status: "accepted",
            comment: "x".repeat(MAX_COMMENT_LENGTH + 1),
          }),
        },
      ),
      {
        createServiceRoleClient: () => createMockClient(),
      },
    );

    expect(commentResponse.status).toBe(400);
    await expect(commentResponse.json()).resolves.toMatchObject({
      code: "comment_too_long",
    });
  });

  it("updates RSVP and public link metadata for a valid response", async () => {
    const updates: Array<{
      table: string;
      values: Record<string, unknown>;
      eq: [string, string];
    }> = [];
    const auditLog = vi.fn();
    const response = await handleRespondPublicEventInvitation(
      new Request(
        "http://localhost/functions/v1/respond-public-event-invitation",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.7",
            "user-agent": "Vitest",
          },
          body: JSON.stringify({
            public_code: "c".repeat(32),
            status: "tentative",
            comment: " Komme etwas später ",
          }),
        },
      ),
      {
        createServiceRoleClient: () =>
          createMockClient({
            publicLink: {
              id: "link-1",
              event_rsvp_id: "rsvp-1",
              revoked_at: null,
              expires_at: "2026-03-21T00:00:00.000Z",
              response_count: 2,
            },
            rsvp: {
              id: "rsvp-1",
              event_planning_id: "event-1",
              name: "Max Mustermann",
              status: "invited",
            },
            event: {
              title: "Abendtermin",
              is_archived: false,
              archived_at: null,
            },
            updates,
          }),
        auditLog,
        now: () => Date.parse("2026-03-20T12:00:00.000Z"),
        hashText: async () => "hashed-ip",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      response: {
        status: "tentative",
        comment: "Komme etwas später",
        guest_display_name: "Max Mustermann",
        event_title: "Abendtermin",
        response_policy: "latest_wins",
        allow_response_updates: true,
      },
    });

    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      table: "event_rsvps",
      eq: ["id", "rsvp-1"],
      values: {
        status: "tentative",
        comment: "Komme etwas später",
      },
    });
    expect(updates[1]).toMatchObject({
      table: "event_rsvp_public_links",
      eq: ["id", "link-1"],
      values: {
        response_count: 3,
        last_response_ip_hash: "hashed-ip",
        last_response_user_agent: "Vitest",
        last_response_source: "public_website",
      },
    });
    expect(auditLog).toHaveBeenCalledWith("success", expect.any(Object));
  });

  it("supports future captcha enforcement without changing the request contract", async () => {
    const response = await handleRespondPublicEventInvitation(
      new Request(
        "http://localhost/functions/v1/respond-public-event-invitation",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            public_code: "e".repeat(32),
            status: "accepted",
            captcha_token: "captcha-token",
            captcha_provider: "turnstile",
          }),
        },
      ),
      {
        createServiceRoleClient: () =>
          createMockClient({
            publicLink: {
              id: "link-1",
              event_rsvp_id: "rsvp-1",
              revoked_at: null,
              expires_at: "2026-03-21T00:00:00.000Z",
              response_count: 0,
            },
            rsvp: {
              id: "rsvp-1",
              event_planning_id: "event-1",
              name: "Max Mustermann",
              status: "invited",
            },
            event: {
              title: "Abendtermin",
              is_archived: false,
              archived_at: null,
            },
          }),
        now: () => Date.parse("2026-03-20T12:00:00.000Z"),
        hashText: async () => "hashed-ip",
        verifyCaptcha: vi.fn(async () => ({
          verified: true,
          required: false,
          provider: "turnstile" as const,
          siteKey: null as string | null,
        })),
      },
    );

    expect(response.status).toBe(200);
  });

  it("rate limits repeated invalid writes from the same ip sooner than valid traffic", async () => {
    const store = new Map<string, { count: number; resetAt: number }>();
    let latest: Response | null = null;

    for (
      let index = 0;
      index < RATE_LIMIT_MAX_INVALID_REQUESTS + 1;
      index += 1
    ) {
      latest = await handleRespondPublicEventInvitation(
        new Request(
          "http://localhost/functions/v1/respond-public-event-invitation",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-forwarded-for": "198.51.100.44",
            },
            body: JSON.stringify({ public_code: "short", status: "accepted" }),
          },
        ),
        {
          createServiceRoleClient: () => createMockClient(),
          invalidRateLimitStore: store,
        },
      );
    }

    expect(latest?.status).toBe(429);
  });

  it("rate limits repeated responses from the same ip", async () => {
    const store = new Map<string, { count: number; resetAt: number }>();
    const createServiceRoleClient = () => createMockClient();

    let latest: Response | null = null;
    for (let index = 0; index < RATE_LIMIT_MAX_REQUESTS + 1; index += 1) {
      latest = await handleRespondPublicEventInvitation(
        new Request(
          "http://localhost/functions/v1/respond-public-event-invitation",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-forwarded-for": "198.51.100.22",
            },
            body: JSON.stringify({
              public_code: "d".repeat(32),
              status: "accepted",
            }),
          },
        ),
        {
          createServiceRoleClient,
          rateLimitStore: store,
        },
      );
    }

    expect(latest?.status).toBe(429);
  });
});
