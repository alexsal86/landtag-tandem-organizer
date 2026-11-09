// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { fetchPublicFeed, feedUrl, publicAddress } from '../../../../supabase/functions/_shared/feed-fetch';
it.each(['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','100.64.0.1','::1','fc00::1','::ffff:127.0.0.1','2001:db8::1'])('rejects reserved address %s', value => expect(publicAddress(value)).toBe(false));
it.each(['https://user:password@example.org','file:///etc/passwd','http://localhost','http://example.org:8080'])('rejects unsafe URL %s', value => expect(() => feedUrl(value)).toThrow());
it('rejects mixed public/private DNS before a request', async () => {
  const fetch = vi.fn();
  await expect(fetchPublicFeed('https://example.org', { resolve: async () => ['8.8.8.8','10.1.1.1'], fetch })).rejects.toThrow('Interne'); expect(fetch).not.toHaveBeenCalled();
});
it('revalidates redirects and blocks private destinations', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1' } }));
  await expect(fetchPublicFeed('https://example.org', { resolve: async () => ['8.8.8.8'], fetch })).rejects.toThrow('Interne'); expect(fetch).toHaveBeenCalledOnce();
});
it('limits streamed bytes even without a content-length header', async () => {
  await expect(fetchPublicFeed('https://example.org', { resolve: async () => ['8.8.8.8'], fetch: vi.fn().mockResolvedValue(new Response('12345')) }, 100, 4)).rejects.toThrow('groß');
});
it('times out stalled DNS', async () => {
  await expect(fetchPublicFeed('https://example.org', { resolve: () => new Promise(() => {}), fetch: vi.fn() }, 5)).rejects.toThrow('Zeitlimit');
});
it('accepts a bounded public feed response', async () => {
  expect(await fetchPublicFeed('https://example.org', { resolve: async () => ['2606:4700:4700::1111'], fetch: vi.fn().mockResolvedValue(new Response('<rss/>')) })).toBe('<rss/>');
});
