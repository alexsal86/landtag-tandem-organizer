const TABLES = new Set(['contacts', 'letters']);
export function securedSelect(select: string): string {
  return select.replace(/(?:([\w]+):)?(contacts|letters)(?:![\w]+)?\(/g, (_, alias: string | undefined, table: string) => `${alias ?? table}:${table}_secured(`);
}
function readerArguments(url: URL) {
  const tenant = url.searchParams.get('tenant_id');
  if (tenant?.startsWith('eq.')) { url.searchParams.set('_tenant_id', tenant.slice(3)); url.searchParams.delete('tenant_id'); }
  const id = url.searchParams.get('id');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = id?.startsWith('eq.') ? [id.slice(3)] : id?.startsWith('in.(') && id.endsWith(')') ? id.slice(4,-1).split(',') : [];
  if (ids.length && ids.every(value => uuid.test(value))) { url.searchParams.set('_ids', `{${ids.join(',')}}`); url.searchParams.delete('id'); }
  includeFilteredColumns(url);
}
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or', 'and', 'not.or', 'not.and']);
/** PostgREST filters RPC results after projection, so filtered/sorted columns must be selected. */
export function includeFilteredColumns(url: URL) {
  const select = url.searchParams.get('select');
  if (!select || select.split(',').some(part => part.trim() === '*')) return;
  const columns = new Set<string>();
  for (const [key, value] of url.searchParams) {
    if (key.startsWith('_')) continue;
    if (key === 'order') value.split(',').forEach(part => columns.add(part.split('.')[0]));
    else if (/^(not\.)?(or|and)$/.test(key)) for (const m of value.matchAll(/(?:^|[(,])(?:not\.)?([a-z_][\w]*)\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|fts|plfts|phfts|wfts|match|imatch)\b/gi)) columns.add(m[1]);
    else if (!RESERVED.has(key) && !key.includes('.')) columns.add(key);
  }
  const top = new Set(select.split(',').map(part => part.trim().split(':').pop()!.split('(')[0]));
  const missing = [...columns].filter(col => /^[a-z_]\w*$/i.test(col) && !top.has(col));
  if (missing.length) url.searchParams.set('select', `${select},${missing.join(',')}`);
}
function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ message, code: 'SECURED_API', details: null, hint: null }), { status, headers: { 'Content-Type': 'application/json' } });
}

/** All browser reads use the invoker RPCs; raw REST remains protected by RLS.
 * The write bridge applies existing RLS/triggers and never writes masked placeholders.
 */
export function createSecuredFetch(baseUrl: string, send: typeof fetch = globalThis.fetch.bind(globalThis)): typeof fetch {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const original = input instanceof Request ? input : null;
    const url = new URL(original?.url ?? String(input));
    const base = new URL(baseUrl);
    if (url.origin !== base.origin || !url.pathname.startsWith('/rest/v1/')) return send(input, init);
    const headers = new Headers(init.headers ?? original?.headers);
    const method = (init.method ?? original?.method ?? 'GET').toUpperCase();
    const table = url.pathname.slice('/rest/v1/'.length);
    const select = url.searchParams.get('select');
    if (select) url.searchParams.set('select', securedSelect(select));
    if (!TABLES.has(table)) return send(original ? new Request(url, original) : url, { ...init, headers });
    if (method === 'GET' || method === 'HEAD') {
      url.pathname = `/rest/v1/rpc/read_secured_${table}`;
      readerArguments(url);
      return send(url, { ...init, method, headers });
    }
    if (!['POST', 'PATCH', 'DELETE'].includes(method)) return errorResponse('Nicht unterstützte Schreibmethode');
    let payload: Record<string, unknown> | Array<Record<string, unknown>>;
    try {
      const body = init.body ?? (original ? await original.clone().text() : '{}');
      payload = typeof body === 'string' ? JSON.parse(body || '{}') : {};
      if (!payload || typeof payload !== 'object') return errorResponse('Ungültige Daten');
    } catch { return errorResponse('Ungültige Daten'); }
    const upsert = headers.get('Prefer')?.includes('resolution=merge-duplicates') ?? false;
    const representation = headers.get('Prefer')?.includes('return=representation') ?? false;
    let ids: string[] = [];
    if (method === 'POST') {
      const rows = Array.isArray(payload) ? payload : [payload];
      if (rows.length > 500 || rows.some(row => !row || typeof row !== 'object')) return errorResponse('Maximal 500 Datensätze pro Schreibvorgang');
      if (upsert && (url.searchParams.get('on_conflict') && url.searchParams.get('on_conflict') !== 'id' || rows.some(row => !row.id))) return errorResponse('Upsert benötigt explizite IDs');
      for (const row of rows) { row.id ??= crypto.randomUUID(); ids.push(String(row.id)); }
    } else {
      const preflight = new URL(url);
      preflight.pathname = `/rest/v1/rpc/read_secured_${table}`;
      readerArguments(preflight);
      preflight.searchParams.set('select', 'id');
      preflight.searchParams.set('limit', '501');
      const readHeaders = new Headers(headers); readHeaders.set('Accept', 'application/json'); readHeaders.delete('Content-Type'); readHeaders.delete('Prefer');
      const response = await send(preflight, { method: 'GET', headers: readHeaders, signal: init.signal });
      if (!response.ok) return response;
      ids = (await response.json() as Array<{ id: string }>).map(row => row.id);
      if (ids.length > 500) return errorResponse('Maximal 500 Datensätze pro Schreibvorgang');
    }
    const rpcHeaders = new Headers(headers);
    rpcHeaders.set('Content-Type', 'application/json'); rpcHeaders.set('Accept', 'application/json');
    rpcHeaders.delete('Prefer'); rpcHeaders.delete('Range'); rpcHeaders.delete('Range-Unit');
    const response = await send(`${base.origin}/rest/v1/rpc/mutate_secured_records`, {
      method: 'POST', headers: rpcHeaders, signal: init.signal,
      body: JSON.stringify({ _table: table, _method: method, _ids: ids, _data: payload, _upsert: upsert }),
    });
    if (!response.ok) return response;
    if (!representation) return new Response(null, { status: 204 });
    const data = await response.json() as Array<Record<string, unknown>>;
    if (method === 'DELETE') return new Response(JSON.stringify(headers.get('Accept')?.includes('object+json') ? data[0] ?? null : data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const returned = new URL(`${base.origin}/rest/v1/rpc/read_secured_${table}`);
    returned.searchParams.set('id', `in.(${data.map(row => row.id).join(',')})`);
    readerArguments(returned);
    returned.searchParams.set('select', select ? securedSelect(select) : '*');
    const returnedHeaders = new Headers(headers); returnedHeaders.delete('Range'); returnedHeaders.delete('Range-Unit');
    return send(returned, { method: 'GET', headers: returnedHeaders, signal: init.signal });
  };
}
