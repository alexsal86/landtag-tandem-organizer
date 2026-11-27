import { getActiveTenantScope } from "./tenantScope";

/** Postgres-Code für verweigerte Berechtigung (RLS, Rollenprüfung, Policy). */
const ACCESS_DENIED = "42501";
const REPORT_WINDOW_MS = 60_000;
const MAX_REPORTS = 10;

type Throttle = Map<string, number>;

export interface SecurityEventOptions {
  /** Meldungen je Laufzeit begrenzen; im Test abschaltbar. */
  maxReports?: number;
  now?: () => number;
}

async function deniedCode(response: Response): Promise<string | null> {
  // Fehlerkörper von PostgREST sind klein; Klon nur für 401/403 lesen.
  try {
    const body = (await response.clone().json()) as { code?: unknown };
    return typeof body?.code === "string" ? body.code : null;
  } catch {
    return null;
  }
}

function authHeaders(source: HeadersInit | undefined): Headers | null {
  const headers = new Headers(source);
  const authorization = headers.get("authorization") ?? headers.get("Authorization");
  if (!authorization) return null;
  const apikey = headers.get("apikey") ?? headers.get("Apikey");
  const result = new Headers({ "Content-Type": "application/json", Authorization: authorization });
  if (apikey) result.set("apikey", apikey);
  return result;
}

/**
 * Meldet serverseitig verweigerte Zugriffe (Postgres 42501) einmalig als
 * Sicherheitsereignis. Die Ablehnung selbst wird mit ihrem Statement
 * zurückgerollt; protokollierbar ist nur die Beobachtung des Clients. Deshalb
 * schreibt record_audit_entry ausschließlich `security.*`-Aktionen für das
 * aktive Büro und den angemeldeten Nutzer.
 *
 * Meldungen sind best-effort: Fehler dürfen die eigentliche Anfrage nie stören.
 */
export function createSecurityEventFetch(
  baseUrl: string,
  send: typeof fetch = globalThis.fetch.bind(globalThis),
  options: SecurityEventOptions = {},
): typeof fetch {
  const maxReports = options.maxReports ?? MAX_REPORTS;
  const now = options.now ?? Date.now;
  const reported: Throttle = new Map();
  let total = 0;

  const report = (target: string, method: string, headers: Headers) => {
    const scope = getActiveTenantScope();
    if (!scope) return;
    const stamp = now();
    const last = reported.get(`${target}|${method}`);
    if (last !== undefined && stamp - last < REPORT_WINDOW_MS) return;
    if (total >= maxReports) return;
    reported.set(`${target}|${method}`, stamp);
    total += 1;

    void send(`${baseUrl}/rest/v1/rpc/record_audit_entry`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        _action: "security.access_denied",
        _tenant_id: scope.tenantId,
        _payload: { resource: target, method, code: ACCESS_DENIED },
      }),
    }).catch(() => undefined);
  };

  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const original = input instanceof Request ? input : null;
    const url = new URL(original?.url ?? String(input));
    const response = await send(input, init);

    if (url.origin !== new URL(baseUrl).origin) return response;
    if (!url.pathname.startsWith("/rest/v1/")) return response;
    if (response.status !== 401 && response.status !== 403) return response;
    if (url.pathname.endsWith("/rpc/record_audit_entry")) return response;

    const code = await deniedCode(response);
    if (code !== ACCESS_DENIED) return response;

    const headers = authHeaders(init.headers ?? original?.headers);
    if (!headers) return response;

    report(url.pathname.slice("/rest/v1/".length), (init.method ?? original?.method ?? "GET").toUpperCase(), headers);
    return response;
  };
}
