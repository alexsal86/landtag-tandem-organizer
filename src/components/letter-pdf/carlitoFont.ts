import type jsPDF from 'jspdf';

/**
 * Carlito is metric-compatible with Calibri, the first font in the DIN preview
 * stack. Embedding it makes the PDF wrap the letter head exactly like the
 * preview instead of using Helvetica's wider metrics.
 */
export const HEADER_FONT_FAMILY = 'Carlito';
const FALLBACK_FONT_FAMILY = 'helvetica';

interface FontSource {
  path: string;
  style: 'normal' | 'bold';
}

/** Subset files (see scripts/build-carlito-subset.sh), so the PDF only grows by a few KB. */
const FONT_SOURCES: FontSource[] = [
  { path: '/fonts/Carlito-Regular.ttf', style: 'normal' },
  { path: '/fonts/Carlito-Bold.ttf', style: 'bold' },
];

const base64Cache = new Map<string, string>();

const encodeBase64 = (bytes: ArrayBuffer): string =>
  btoa(Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join(''));

async function loadFontBase64(path: string): Promise<string | null> {
  const cached = base64Cache.get(path);
  if (cached) return cached;
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const base64 = encodeBase64(await response.arrayBuffer());
    base64Cache.set(path, base64);
    return base64;
  } catch {
    return null;
  }
}

/**
 * Registers the Carlito subsets (regular + bold) in the document and returns the
 * family to draw the letter head with. If a file is unavailable the export keeps
 * working with Helvetica instead of failing.
 */
export async function registerHeaderTextFont(pdf: jsPDF): Promise<string> {
  const fonts = await Promise.all(
    FONT_SOURCES.map(async (source) => ({ ...source, base64: await loadFontBase64(source.path) })),
  );

  if (fonts.some((font) => !font.base64)) return FALLBACK_FONT_FAMILY;

  try {
    for (const font of fonts) {
      const vfsName = font.path.split('/').pop() ?? 'carlito.ttf';
      pdf.addFileToVFS(vfsName, font.base64 as string);
      pdf.addFont(vfsName, HEADER_FONT_FAMILY, font.style);
    }
    return HEADER_FONT_FAMILY;
  } catch {
    return FALLBACK_FONT_FAMILY;
  }
}
