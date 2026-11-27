import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSecurityEventFetch } from "./securityEventFetch";
import { setActiveTenantScope } from "./tenantScope";

const BASE = "https://project.supabase.co";

const calls = () => send.mock.calls.map(([url, init]) => ({
  url: String(url),
  body: init?.body ? JSON.parse(String(init.body)) : null,
  method: init?.method ?? "GET",
}));

let send: ReturnType<typeof vi.fn>;

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const denied = () => respond(403, { code: "42501", message: "new row violates row-level security policy" });

beforeEach(() => {
  send = vi.fn();
  setActiveTenantScope({ userId: "user-1", tenantId: "tenant-1" });
});

afterEach(() => {
  setActiveTenantScope(null);
});

const init = { method: "POST", headers: { Authorization: "Bearer token", apikey: "anon" } };

describe("createSecurityEventFetch", () => {
  it("meldet eine beobachtete 42501-Ablehnung als Sicherheitsereignis", async () => {
    send.mockResolvedValueOnce(denied()).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const fetchLayer = createSecurityEventFetch(BASE, send as unknown as typeof fetch);

    const response = await fetchLayer(`${BASE}/rest/v1/contacts`, init);

    expect(response.status).toBe(403);
    const [report] = calls().slice(1);
    expect(report.url).toBe(`${BASE}/rest/v1/rpc/record_audit_entry`);
    expect(report.body).toMatchObject({
      _action: "security.access_denied",
      _tenant_id: "tenant-1",
      _payload: { resource: "contacts", method: "POST", code: "42501" },
    });
  });

  it("meldet eine Ablehnung nur einmal je Ressource und Methode", async () => {
    send.mockImplementation(() => Promise.resolve(denied()));
    const fetchLayer = createSecurityEventFetch(BASE, send as unknown as typeof fetch, {
      now: () => 1_000,
    });

    await fetchLayer(`${BASE}/rest/v1/contacts`, init);
    await fetchLayer(`${BASE}/rest/v1/contacts`, init);

    expect(calls().filter((call) => call.url.includes("record_audit_entry"))).toHaveLength(1);
  });

  it("ignoriert Fehler, die keine Berechtigungsablehnung sind", async () => {
    send.mockResolvedValue(respond(404, { code: "PGRST116", message: "not found" }));
    const fetchLayer = createSecurityEventFetch(BASE, send as unknown as typeof fetch);

    await fetchLayer(`${BASE}/rest/v1/contacts`, init);

    expect(calls()).toHaveLength(1);
  });

  it("meldet ohne aktives Büro nicht, weil record_audit_entry es ablehnen würde", async () => {
    setActiveTenantScope(null);
    send.mockImplementation(() => Promise.resolve(denied()));
    const fetchLayer = createSecurityEventFetch(BASE, send as unknown as typeof fetch);

    await fetchLayer(`${BASE}/rest/v1/contacts`, init);

    expect(calls()).toHaveLength(1);
  });
});
