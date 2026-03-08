import { describe, it, expect } from 'vitest';
import { extractStoragePathFromUrl, normalizeImageItem, createDefaultAttachmentElements } from '../types';

describe('extractStoragePathFromUrl', () => {
  it('returns null for falsy input', () => {
    expect(extractStoragePathFromUrl(null)).toBeNull();
    expect(extractStoragePathFromUrl(undefined)).toBeNull();
    expect(extractStoragePathFromUrl('')).toBeNull();
  });

  it('returns path directly for non-URL strings', () => {
    expect(extractStoragePathFromUrl('some/path/file.png')).toBe('some/path/file.png');
  });

  it('extracts path from public storage URL', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/letter-assets/tenant/logo.png';
    expect(extractStoragePathFromUrl(url)).toBe('tenant/logo.png');
  });

  it('extracts path from signed storage URL', () => {
    const url = 'https://example.supabase.co/storage/v1/object/sign/letter-assets/images/header.jpg';
    expect(extractStoragePathFromUrl(url)).toBe('images/header.jpg');
  });

  it('returns null for non-storage URLs', () => {
    expect(extractStoragePathFromUrl('https://example.com/image.png')).toBeNull();
  });
});

describe('normalizeImageItem', () => {
  it('returns non-image items unchanged', () => {
    const item = { type: 'text', content: 'Hello' };
    expect(normalizeImageItem(item)).toEqual(item);
  });

  it('returns null/undefined unchanged', () => {
    expect(normalizeImageItem(null)).toBeNull();
    expect(normalizeImageItem(undefined)).toBeUndefined();
  });
});

describe('createDefaultAttachmentElements', () => {
  it('returns an array with one text element', () => {
    const elements = createDefaultAttachmentElements();
    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({
      type: 'text',
      content: '{{anlagen_liste}}',
      isVariable: true,
    });
  });

  it('generates IDs with expected prefix', () => {
    const elements = createDefaultAttachmentElements();
    expect(elements[0].id).toMatch(/^attachments-default-\d+$/);
  });
});
