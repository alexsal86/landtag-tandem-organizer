import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsPDF } from 'jspdf';

const fontBytes = (fileName: string): ArrayBuffer => {
  const file = readFileSync(`${process.cwd()}/public/fonts/${fileName}`);
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
};

const loadFreshModule = async () => {
  vi.resetModules();
  return import('./carlitoFont');
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('registerHeaderTextFont', () => {
  it('registers the bundled subsets and exposes Carlito for drawing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const fileName = url.split('/').pop() ?? '';
      return new Response(fontBytes(fileName), { status: 200 });
    }));
    const { HEADER_FONT_FAMILY, registerHeaderTextFont } = await loadFreshModule();
    const pdf = new jsPDF('p', 'mm', 'a4');

    await expect(registerHeaderTextFont(pdf)).resolves.toBe(HEADER_FONT_FAMILY);

    pdf.setFont(HEADER_FONT_FAMILY, 'bold');
    pdf.setFontSize(13);
    expect(pdf.getTextWidth('Landtagswahlgesetz')).toBeGreaterThan(0);
  });

  it('falls back to Helvetica when the font files are unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    const { registerHeaderTextFont } = await loadFreshModule();
    const pdf = new jsPDF('p', 'mm', 'a4');

    await expect(registerHeaderTextFont(pdf)).resolves.toBe('helvetica');
  });
});
