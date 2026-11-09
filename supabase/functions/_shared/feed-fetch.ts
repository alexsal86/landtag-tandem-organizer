export function publicAddress(ip: string): boolean {
  if (ip.includes(':')) {
    const value = ip.toLowerCase().replace(/^\[|\]$/g, '');
    const [first, second] = value.split(':').map(part => Number.parseInt(part, 16));
    return /^[23][0-9a-f]{3}:[0-9a-f:]+$/.test(value) && first !== 0x2002 && !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8));
  }
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a,b,c] = octets;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}
export function feedUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
    /(^localhost$|\.(localhost|local|internal|invalid|test)$)/i.test(url.hostname)) throw new Error('Nur öffentliche HTTP(S)-Feed-URLs ohne Zugangsdaten und Sonderports sind erlaubt.');
  url.hash = '';
  return url;
}
export async function fetchPublicFeed(
  raw: string,
  dependencies: { resolve: (host: string) => Promise<string[]>; fetch: typeof fetch },
  timeout = 8000,
  maxBytes = 512 * 1024,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Zeitlimit für Feed erreicht')), timeout);
  const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true }));
  void aborted.catch(() => {});
  try {
    let url = feedUrl(raw);
    for (let redirect = 0; redirect <= 3; redirect++) {
      controller.signal.throwIfAborted();
      const literal = url.hostname.replace(/^\[|\]$/g, '');
      const addresses = /^[\d.]+$/.test(literal) || literal.includes(':') ? [literal] : await Promise.race([dependencies.resolve(literal), aborted]);
      if (!addresses.length || addresses.some(ip => !publicAddress(ip))) throw new Error('Interne oder reservierte Netzwerkadressen sind nicht erlaubt.');
      const response = await Promise.race([dependencies.fetch(url, { signal: controller.signal, redirect: 'manual', headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'LandtagsOS Feed Test' } }), aborted]);
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location'); await response.body?.cancel();
        if (!location || redirect === 3) throw new Error('Zu viele oder ungültige Weiterleitungen.');
        url = feedUrl(new URL(location, url).href); continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Feed antwortet mit HTTP ${response.status}`); }
      if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel(); throw new Error('Feed ist zu groß.'); }
      const reader = response.body?.getReader(); if (!reader) throw new Error('Leere Feed-Antwort.');
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const part = await Promise.race([reader.read(), aborted]);
          if (part.done) break;
          size += part.value.byteLength;
          if (size > maxBytes) throw new Error('Feed ist zu groß.');
          chunks.push(part.value);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      const joined = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
      return new TextDecoder().decode(joined);
    }
    throw new Error('Feed konnte nicht geladen werden.');
  } finally { clearTimeout(timer); controller.abort(); }
}
