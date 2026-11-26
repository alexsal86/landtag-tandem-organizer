import {
  GLOBAL_TENANT_OPTIONAL_TABLES,
  isTenantScopedTable,
} from "./tenantScopedTables";
import {
  getActiveTenantScope,
  getTenantScopeRevision,
  type ActiveTenantScope,
} from "./tenantScope";

const TENANT_ARGUMENTS = new Set([
  "tenant_id",
  "_tenant_id",
  "p_tenant_id",
  "_tenant",
  "p_tenant",
]);

export class TenantScopeError extends Error {
  constructor(
    message: string,
    readonly code: "TENANT_SCOPE_CONFLICT" | "TENANT_SCOPE_CHANGED" | "TENANT_SCOPE_INVALID",
    readonly status: number,
  ) {
    super(message);
    this.name = "TenantScopeError";
  }
}

function conflict(message = "Die Anfrage gehört nicht zum aktiven Arbeitsbereich."): TenantScopeError {
  return new TenantScopeError(message, "TENANT_SCOPE_CONFLICT", 403);
}

function nestedTenantFilters(url: URL): Array<[string, string]> {
  return ["or", "and", "not.or", "not.and"]
    .flatMap((key) => url.searchParams.getAll(key).map((value): [string, string] => [key, value]))
    .filter(([, value]) => /(?:^|[(,])(?:not\.)?tenant_id\./i.test(value));
}

function isGlobalFallbackFilter(key: string, value: string, tenantId: string): boolean {
  if (key !== "or") return false;
  const normalized = value.replace(/\s/g, "");
  return normalized === `(tenant_id.eq.${tenantId},tenant_id.is.null)`
    || normalized === `(tenant_id.is.null,tenant_id.eq.${tenantId})`;
}

/** Applies the active tenant as an AND condition without weakening other filters. */
export function scopeTenantUrl(url: URL, table: string, scope: ActiveTenantScope | null): void {
  if (!scope || !isTenantScopedTable(table)) return;

  const allowsGlobal = GLOBAL_TENANT_OPTIONAL_TABLES.has(table);
  const nested = nestedTenantFilters(url);
  if (nested.some(([key, value]) => !allowsGlobal || !isGlobalFallbackFilter(key, value, scope.tenantId))) {
    throw conflict("Mandantenfilter in verschachtelten Bedingungen sind nicht zulässig.");
  }

  const direct = url.searchParams.getAll("tenant_id");
  if (direct.length > 1) throw conflict("Mehrere Mandantenfilter sind nicht zulässig.");

  if (direct.length === 0) {
    if (nested.length === 0) url.searchParams.set("tenant_id", `eq.${scope.tenantId}`);
    return;
  }

  const filter = direct[0];
  if (filter === `eq.${scope.tenantId}`) return;
  if (filter === "is.null" && allowsGlobal) return;

  const inMatch = /^in\.\(([^)]*)\)$/i.exec(filter);
  if (inMatch) {
    const tenantIds = inMatch[1].split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
    if (tenantIds.includes(scope.tenantId)) {
      // Intersect an existing IN filter with the active tenant instead of widening it.
      url.searchParams.set("tenant_id", `eq.${scope.tenantId}`);
      return;
    }
  }

  throw conflict();
}

/**
 * Lesefunktionen, deren Mandantenargument nur ein Filter ist: RLS und die
 * Funktionen selbst liefern für fremde Büros keine Zeilen oder weisen sie
 * ab. Der Selbsttest prüft genau diese Trennung am Server und darf dafür
 * nicht am Client-Guard scheitern. Schreibende RPCs bleiben unverändert
 * fail-closed.
 */
const READ_ONLY_TENANT_RPCS = new Set([
  "knowledge_qa_list",
  "read_secured_contacts",
  "read_secured_letters",
  // Beide prüfen die aktive Mitgliedschaft selbst und antworten sonst nur mit
  // einem Fehler.
  "get_poll_availability",
  "find_contact_duplicates_trgm",
]);

function validateTenantArguments(payload: Record<string, unknown>, scope: ActiveTenantScope): void {
  for (const key of TENANT_ARGUMENTS) {
    const value = payload[key];
    if (typeof value === "string" && value !== scope.tenantId) throw conflict();
  }
}

/** Adds a missing tenant on inserts and prevents tenant reassignment on writes. */
export function scopeTenantPayload(
  payload: unknown,
  table: string,
  method: string,
  scope: ActiveTenantScope | null,
): unknown {
  if (!scope || !payload || typeof payload !== "object") return payload;
  if (!isTenantScopedTable(table)) {
    if (table.startsWith("rpc/") && !READ_ONLY_TENANT_RPCS.has(table.slice("rpc/".length))) {
      validateTenantArguments(payload as Record<string, unknown>, scope);
    }
    return payload;
  }

  const rows = Array.isArray(payload) ? payload : [payload];
  if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new TenantScopeError("Ungültige Schreibdaten.", "TENANT_SCOPE_INVALID", 400);
  }

  for (const row of rows as Array<Record<string, unknown>>) {
    const tenantId = row.tenant_id;
    if (tenantId === undefined && method === "POST") {
      row.tenant_id = scope.tenantId;
    } else if (tenantId !== undefined && tenantId !== scope.tenantId) {
      const isGlobalSetting = tenantId === null && GLOBAL_TENANT_OPTIONAL_TABLES.has(table);
      if (!isGlobalSetting) throw conflict();
    }
  }
  return payload;
}

function errorResponse(error: TenantScopeError): Response {
  return new Response(JSON.stringify({
    message: error.message,
    code: error.code,
    details: null,
    hint: error.code === "TENANT_SCOPE_CHANGED" ? "Bitte die Anzeige im neuen Arbeitsbereich erneut laden." : null,
  }), { status: error.status, headers: { "Content-Type": "application/json" } });
}

/**
 * Fail-closed browser boundary for direct tenant-bearing tables/views and tenant RPC arguments.
 * Server RLS remains authoritative; this prevents accidental cross-tenant UI queries.
 */
export function createTenantScopeFetch(
  baseUrl: string,
  send: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const original = input instanceof Request ? input : null;
    const url = new URL(original?.url ?? String(input));
    const base = new URL(baseUrl);
    if (url.origin !== base.origin) return send(input, init);
    if (url.pathname.startsWith("/functions/v1/")) {
      const scope = getActiveTenantScope();
      const revision = getTenantScopeRevision();
      const headers = new Headers(init.headers ?? original?.headers);
      // Only deployed endpoints with tenant-header CORS support receive this header.
      const scopedEndpoints = new Set([
        "archive-letter", "geocode-contact-address", "batch-geocode-contacts",
        "fetch-rss-feeds", "send-news-email", "send-document-email", "send-decision-email",
        "force-resync-calendar", "sync-external-calendar", "workflow-dispatcher",
        "test-rss-feed", "run-automation-rule", "matrix-decision-handler",
        "send-event-invitation", "send-appointment-invitation", "manage-tenant-user",
      ]);
      if (scope && scopedEndpoints.has(url.pathname.split("/").pop() ?? "")) headers.set("x-tenant-id", scope.tenantId);
      const response = await send(input, { ...init, headers });
      if (revision !== getTenantScopeRevision()) return errorResponse(new TenantScopeError(
        "Der Arbeitsbereich wurde während der Anfrage gewechselt.", "TENANT_SCOPE_CHANGED", 409,
      ));
      return response;
    }
    if (!url.pathname.startsWith("/rest/v1/")) return send(input, init);

    const method = (init.method ?? original?.method ?? "GET").toUpperCase();
    const table = url.pathname.slice("/rest/v1/".length);
    const guarded = isTenantScopedTable(table) || table.startsWith("rpc/");
    const scope = getActiveTenantScope();
    const revision = getTenantScopeRevision();
    let rewrittenBody: string | undefined;

    try {
      scopeTenantUrl(url, table, scope);
      if (scope && guarded && ["POST", "PATCH"].includes(method)) {
        const rawBody = init.body ?? (original ? await original.clone().text() : undefined);
        if (rawBody !== undefined) {
          const text = typeof rawBody === "string" ? rawBody : "";
          if (!text) throw new TenantScopeError("Ungültige Schreibdaten.", "TENANT_SCOPE_INVALID", 400);
          const payload: unknown = JSON.parse(text);
          rewrittenBody = JSON.stringify(scopeTenantPayload(payload, table, method, scope));
        }
      }
    } catch (error) {
      if (error instanceof TenantScopeError) return errorResponse(error);
      return errorResponse(new TenantScopeError("Ungültige Schreibdaten.", "TENANT_SCOPE_INVALID", 400));
    }

    const headers = new Headers(init.headers ?? original?.headers);
    let response: Response;
    if (original) {
      const request = rewrittenBody !== undefined
        ? new Request(url, { method, headers, body: rewrittenBody, signal: init.signal ?? original.signal })
        : new Request(new Request(url, original), { ...init, headers });
      response = await send(request);
    } else {
      response = await send(url, { ...init, headers, ...(rewrittenBody !== undefined ? { body: rewrittenBody } : {}) });
    }

    if (guarded && revision !== getTenantScopeRevision()) {
      return errorResponse(new TenantScopeError(
        "Der Arbeitsbereich wurde während der Anfrage gewechselt.",
        "TENANT_SCOPE_CHANGED",
        409,
      ));
    }
    return response;
  };
}
