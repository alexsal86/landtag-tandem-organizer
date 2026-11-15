// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSecuredFetch } from "./securedFetch";
import { setActiveTenantScope } from "./tenantScope";
import { createTenantScopeFetch } from "./tenantScopeFetch";

const base = "https://example.supabase.co";
const scope = { userId: "user-1", tenantId: "tenant-a" };
const json = (data: unknown) => new Response(JSON.stringify(data), {
  headers: { "Content-Type": "application/json" },
});

async function errorCode(response: Response): Promise<string> {
  return (await response.json() as { code: string }).code;
}

describe("active tenant transport boundary", () => {
  beforeEach(() => setActiveTenantScope(null));

  it("passes the active office to Edge Functions without leaking it to other origins", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json({}));
    const scopedFetch = createTenantScopeFetch(base, send);
    await scopedFetch(`${base}/functions/v1/send-document-email`, { method: "POST", headers: { "x-tenant-id": "tenant-b" }, body: "{}" });
    expect(new Headers(send.mock.calls[0][1]?.headers).get("x-tenant-id")).toBe("tenant-a");
    await scopedFetch("https://other.example/functions/v1/test");
    expect(send.mock.calls[1][1]?.headers).toBeUndefined();
  });

  it("rejects a late function response after switching offices", async () => {
    setActiveTenantScope(scope);
    let finish: ((response: Response) => void) | undefined;
    const send = vi.fn<typeof fetch>().mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const pending = createTenantScopeFetch(base, send)(`${base}/functions/v1/test`);
    setActiveTenantScope({ ...scope, tenantId: "tenant-b" });
    finish?.(json({ result: "old-office" }));
    expect((await pending).status).toBe(409);
  });

  it("preserves legacy global endpoint CORS compatibility", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json({}));
    await createTenantScopeFetch(base, send)(`${base}/functions/v1/register-mobile-push-token`, { method: "POST" });
    expect(new Headers(send.mock.calls[0][1]?.headers).has("x-tenant-id")).toBe(false);
  });

  it("adds a missing active-tenant filter to direct table reads", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    await createTenantScopeFetch(base, send)(`${base}/rest/v1/tasks?select=id,title`);
    const url = new URL(String(send.mock.calls[0][0]));
    expect(url.searchParams.get("tenant_id")).toBe("eq.tenant-a");
    expect(url.searchParams.get("select")).toBe("id,title");
  });

  it("intersects IN filters with the active tenant and rejects foreign filters", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    const scopedFetch = createTenantScopeFetch(base, send);
    await scopedFetch(`${base}/rest/v1/tasks?tenant_id=in.(tenant-a,tenant-b)`);
    expect(new URL(String(send.mock.calls[0][0])).searchParams.get("tenant_id")).toBe("eq.tenant-a");

    const response = await scopedFetch(`${base}/rest/v1/tasks?tenant_id=eq.tenant-b`);
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("TENANT_SCOPE_CONFLICT");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("allows only the explicit active-or-global fallback for app settings", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    const scopedFetch = createTenantScopeFetch(base, send);
    await scopedFetch(`${base}/rest/v1/app_settings?or=(tenant_id.eq.tenant-a,tenant_id.is.null)`);
    expect(new URL(String(send.mock.calls[0][0])).searchParams.get("tenant_id")).toBeNull();

    const response = await scopedFetch(`${base}/rest/v1/tasks?or=(tenant_id.eq.tenant-a,tenant_id.is.null)`);
    expect(response.status).toBe(403);
  });

  it("adds the active tenant to inserts and rejects cross-tenant writes", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    const scopedFetch = createTenantScopeFetch(base, send);
    await scopedFetch(`${base}/rest/v1/tasks`, { method: "POST", body: JSON.stringify({ title: "A" }) });
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual({ title: "A", tenant_id: "tenant-a" });

    const response = await scopedFetch(`${base}/rest/v1/tasks`, {
      method: "POST", body: JSON.stringify({ title: "B", tenant_id: "tenant-b" }),
    });
    expect(response.status).toBe(403);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("preserves an explicit global app-setting write", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    await createTenantScopeFetch(base, send)(`${base}/rest/v1/app_settings`, {
      method: "POST", body: JSON.stringify({ setting_key: "app_name", tenant_id: null }),
    });
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toMatchObject({ tenant_id: null });
  });

  it("rejects foreign tenant RPC arguments", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    const response = await createTenantScopeFetch(base, send)(`${base}/rest/v1/rpc/example`, {
      method: "POST", body: JSON.stringify({ _tenant_id: "tenant-b" }),
    });
    expect(response.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("leaves membership discovery available before selecting a tenant", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    await createTenantScopeFetch(base, send)(`${base}/rest/v1/user_tenant_memberships?user_id=eq.user-1`);
    expect(new URL(String(send.mock.calls[0][0])).searchParams.get("tenant_id")).toBeNull();
  });

  it("feeds the secured contacts reader with the active tenant", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    const scopedFetch = createTenantScopeFetch(base, createSecuredFetch(base, send));
    await scopedFetch(`${base}/rest/v1/contacts?select=id,name`);
    const url = new URL(String(send.mock.calls[0][0]));
    expect(url.pathname).toBe("/rest/v1/rpc/read_secured_contacts");
    expect(url.searchParams.get("_tenant_id")).toBe("tenant-a");
    expect(url.searchParams.get("tenant_id")).toBeNull();
  });

  it("discards a response that arrives after a tenant switch", async () => {
    setActiveTenantScope(scope);
    let resolveResponse: ((response: Response) => void) | undefined;
    const send = vi.fn<typeof fetch>().mockReturnValue(new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    const pending = createTenantScopeFetch(base, send)(`${base}/rest/v1/tasks?select=id`);
    setActiveTenantScope({ ...scope, tenantId: "tenant-b" });
    resolveResponse?.(json([{ id: "old-tenant-row" }]));
    const response = await pending;
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("TENANT_SCOPE_CHANGED");
  });

  it("rewrites a Request body without losing its method", async () => {
    setActiveTenantScope(scope);
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    await createTenantScopeFetch(base, send)(new Request(`${base}/rest/v1/tasks`, {
      method: "POST", body: JSON.stringify({ title: "Request" }),
    }));
    const request = send.mock.calls[0][0] as Request;
    expect(request.method).toBe("POST");
    expect(await request.text()).toBe(JSON.stringify({ title: "Request", tenant_id: "tenant-a" }));
  });
});
