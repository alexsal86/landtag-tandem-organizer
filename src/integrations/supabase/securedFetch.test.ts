// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createSecuredFetch, securedSelect } from './securedFetch';
const base = 'https://example.supabase.co';
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
describe('secured Supabase transport', () => {
  it('preserves aliases on embedded protected relationships', () => {
    expect(securedSelect('id,person:contacts!contact_id(id,name),letters(id)')).toBe('id,person:contacts_secured(id,name),letters:letters_secured(id)');
  });
  it('routes count/filter/range through the masked reader with authentication', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    await createSecuredFetch(base, send)(`${base}/rest/v1/contacts?tenant_id=eq.office&select=id&email=eq.secret`, { method: 'HEAD', headers: { Authorization: 'Bearer test', Range: '0-19', Prefer: 'count=exact' } });
    const [input, init] = send.mock.calls[0]; const url = new URL(String(input));
    expect(url.pathname).toBe('/rest/v1/rpc/read_secured_contacts');
    expect(url.searchParams.get('_tenant_id')).toBe('office');
    expect(url.searchParams.get('email')).toBe('eq.secret');
    expect(init?.method).toBe('HEAD'); expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test');
  });
  it('updates only IDs read through caller policies and returns masked selected data', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(json([{ id: 'one' }])).mockResolvedValueOnce(json([{ id: 'one' }])).mockResolvedValueOnce(json({ id: 'one', email: null }));
    const response = await createSecuredFetch(base, send)(`${base}/rest/v1/contacts?id=eq.one&select=id,email`, { method: 'PATCH', headers: { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' }, body: JSON.stringify({ name: 'New', email: null }) });
    expect(JSON.parse(String(send.mock.calls[1][1]?.body))).toMatchObject({ _ids: ['one'], _method: 'PATCH', _data: { name: 'New', email: null } });
    expect(await response.json()).toEqual({ id: 'one', email: null });
  });
  it('rejects writes larger than the atomic server limit before mutation', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(json(Array.from({ length: 501 }, (_, id) => ({ id }))));
    const result = await createSecuredFetch(base, send)(`${base}/rest/v1/contacts`, { method: 'DELETE' });
    expect(result.status).toBe(400); expect(send).toHaveBeenCalledOnce();
  });
  it('preserves the body of an unrelated Request', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    await createSecuredFetch(base, send)(new Request(`${base}/rest/v1/tasks`, { method: 'POST', body: '{"title":"hello"}' }));
    expect(await (send.mock.calls[0][0] as Request).text()).toBe('{"title":"hello"}');
  });
});

import { includeFilteredColumns } from './securedFetch';
import { it as it2, expect as expect2 } from 'vitest';
it2('adds filtered and sorted columns to a partial RPC select', () => {
  const url = new URL('https://x/rest/v1/rpc/read_secured_contacts?select=id,name&category=eq.citizen&order=last_name.asc&or=(retention_review_date.lte.2026-01-01,retention_status.eq.review)');
  includeFilteredColumns(url);
  expect2(url.searchParams.get('select')).toBe('id,name,category,last_name,retention_review_date,retention_status');
});
