import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeGetItem, safeSetItem, safeRemoveItem, safeParse, safeStringify } from '../storage';

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('safeGetItem', () => {
    it('gibt den gespeicherten Wert zurück', () => {
      localStorage.setItem('key', 'value');
      expect(safeGetItem('key')).toBe('value');
    });

    it('gibt null zurück wenn Schlüssel nicht existiert', () => {
      expect(safeGetItem('nonexistent')).toBeNull();
    });

    it('gibt null zurück wenn localStorage wirft', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled'); });
      expect(safeGetItem('key')).toBeNull();
    });
  });

  describe('safeSetItem', () => {
    it('speichert den Wert', () => {
      safeSetItem('key', 'value');
      expect(localStorage.getItem('key')).toBe('value');
    });

    it('wirft nicht wenn localStorage blockiert ist', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage disabled'); });
      expect(() => safeSetItem('key', 'value')).not.toThrow();
    });
  });

  describe('safeRemoveItem', () => {
    it('entfernt den Schlüssel', () => {
      localStorage.setItem('key', 'value');
      safeRemoveItem('key');
      expect(localStorage.getItem('key')).toBeNull();
    });

    it('wirft nicht wenn localStorage blockiert ist', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage disabled'); });
      expect(() => safeRemoveItem('key')).not.toThrow();
    });
  });

  describe('safeParse', () => {
    it('parst gültigen JSON-Wert', () => {
      localStorage.setItem('user', JSON.stringify({ id: 1 }));
      expect(safeParse<{ id: number }>('user', { id: 0 })).toEqual({ id: 1 });
    });

    it('gibt Fallback zurück wenn Schlüssel nicht existiert', () => {
      expect(safeParse('missing', 'default')).toBe('default');
    });

    it('gibt Fallback zurück bei ungültigem JSON', () => {
      localStorage.setItem('bad', 'not-json{');
      expect(safeParse('bad', 42)).toBe(42);
    });

    it('gibt Fallback zurück wenn localStorage wirft', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled'); });
      expect(safeParse('key', 'fallback')).toBe('fallback');
    });
  });

  describe('safeStringify', () => {
    it('serialisiert und speichert den Wert', () => {
      safeStringify('obj', { a: 1 });
      expect(localStorage.getItem('obj')).toBe('{"a":1}');
    });

    it('wirft nicht bei Serialisierungsfehlern', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(() => safeStringify('circular', circular)).not.toThrow();
    });
  });
});
