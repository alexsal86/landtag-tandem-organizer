export const PORTRAIT_SIZE = { width: 480, height: 640, maxBytes: 102_400 } as const;
export const PORTRAIT_LARGE = { width: 1200, height: 1600, maxBytes: 409_600 } as const;
export const PORTRAIT_THUMB = { width: 96, height: 128, maxBytes: 12_288 } as const;
export const PORTRAIT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PortraitSource = { label: string; url: string; author: string; license: string };
export type DeputyPortrait = {
  schemaVersion: 1; connectionId: string; version: string; image: string; thumbnail: string; largeImage?: string;
  source: PortraitSource; updatedAt: string;
};

export function portraitSource(value: unknown): PortraitSource | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (['label', 'url', 'author', 'license'].some(key => typeof v[key] !== 'string' || (v[key] as string).length > (key === 'url' ? 2048 : 500))) return null;
  const source = Object.fromEntries(['label', 'url', 'author', 'license'].map(key => [key, (v[key] as string).trim()])) as PortraitSource;
  if (source.url) {
    try { const url = new URL(source.url); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null; source.url = url.href; }
    catch { return null; }
  }
  return source;
}

export function isDeputyPortrait(value: unknown, connectionId: string): value is DeputyPortrait {
  if (!value || typeof value !== 'object') return false;
  const v = value as DeputyPortrait;
  return v.schemaVersion === 1 && v.connectionId === connectionId && PORTRAIT_ID.test(v.version)
    && /^portrait-[a-f0-9]{16}\.webp$/.test(v.image) && /^thumb-[a-f0-9]{16}\.webp$/.test(v.thumbnail)
    && (v.largeImage === undefined || /^large-[a-f0-9]{16}\.webp$/.test(v.largeImage))
    && !!portraitSource(v.source) && typeof v.updatedAt === 'string';
}

/** Rectangular crop shared by preview/export; image always covers the entire 3:4 frame. */
export function portraitCrop(width: number, height: number, zoom: number, x: number, y: number) {
  const scale = Math.max(240 / width, 320 / height) * Math.max(1, Math.min(4, zoom));
  const maxX = Math.max(0, (width * scale - 240) / 2);
  const maxY = Math.max(0, (height * scale - 320) / 2);
  const offsetX = Math.max(-maxX, Math.min(maxX, x));
  const offsetY = Math.max(-maxY, Math.min(maxY, y));
  return { scale, offsetX, offsetY, sourceX: (width - 240 / scale) / 2 - offsetX / scale,
    sourceY: (height - 320 / scale) / 2 - offsetY / scale, sourceWidth: 240 / scale, sourceHeight: 320 / scale };
}

/** Verify WebP signature, declared size and dimensions, including VP8/VP8L/VP8X. */
export function validPortraitWebp(bytes: Uint8Array, thumbnail: boolean | 'large' = false): boolean {
  const limits = thumbnail === 'large' ? PORTRAIT_LARGE : thumbnail ? PORTRAIT_THUMB : PORTRAIT_SIZE;
  if (bytes.length < 30 || bytes.length > limits.maxBytes) return false;
  const ascii = (start: number, count: number) => String.fromCharCode(...bytes.slice(start, start + count));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP' || view.getUint32(4, true) + 8 !== bytes.length) return false;
  let width = 0; let height = 0;
  const kind = ascii(12, 4);
  if (kind === 'VP8X') {
    width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
  } else if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
  } else if (kind === 'VP8L' && bytes[20] === 0x2f) {
    const bits = view.getUint32(21, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
  }
  return width === limits.width && height === limits.height;
}
