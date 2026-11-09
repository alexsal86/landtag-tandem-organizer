import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Parser from 'npm:rss-parser@3.13.0';
import { requireTenantAccess } from '../_shared/tenant-access.ts';
import { getCorsHeaders, withSafeHandler } from '../_shared/security.ts';
import { fetchPublicFeed } from '../_shared/feed-fetch.ts';

export const handler = async (req: Request): Promise<Response> => {
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST erforderlich' }), { status: 405, headers });
  const body = await req.json();
  if (typeof body.url !== 'string' || body.url.length > 2048 || typeof body.tenant_id !== 'string') return new Response(JSON.stringify({ error: 'URL und Büro erforderlich' }), { status: 400, headers });
  const access = await requireTenantAccess({ req, functionName: 'test-rss-feed', requestedTenantId: body.tenant_id });
  if ('response' in access) return access.response;
  if (!['abgeordneter', 'bueroleitung'].includes(access.membership.role ?? '')) return new Response(JSON.stringify({ error: 'Büro-Adminrolle erforderlich' }), { status: 403, headers });
  try {
    const xml = await fetchPublicFeed(body.url, {
      resolve: async host => {
        const results = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')]);
        return results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      }, fetch,
    });
    const feed = await new Parser().parseString(xml);
    return new Response(JSON.stringify({ valid: true, title: feed.title ?? '', items: feed.items.length }), { headers });
  } catch {
    return new Response(JSON.stringify({ valid: false, error: 'Feed konnte nicht geprüft werden: öffentliche URL, Erreichbarkeit, Zeit-/Größenlimit und gültiges RSS/Atom prüfen.' }), { status: 422, headers });
  }
};
if (import.meta.main) serve(withSafeHandler('test-rss-feed', handler));
