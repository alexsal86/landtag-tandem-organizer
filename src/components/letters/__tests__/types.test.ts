import { describe, it, expect } from 'vitest';
import {
  getNextStatus,
  canTransitionStatus,
  findFontFamilyInLexicalNode,
  extractFontFamilyFromContentNodes,
  formatContactAddress,
  STATUS_FLOW,
  ALLOWED_TRANSITIONS,
} from '../types';

describe('getNextStatus', () => {
  it('returns correct next status for each state', () => {
    expect(getNextStatus('draft')).toBe('pending_approval');
    expect(getNextStatus('pending_approval')).toBe('approved');
    expect(getNextStatus('revision_requested')).toBe('pending_approval');
    expect(getNextStatus('approved')).toBe('sent');
  });

  it('returns undefined for terminal/unknown status', () => {
    expect(getNextStatus('sent')).toBeUndefined();
    expect(getNextStatus('unknown')).toBeUndefined();
  });
});

describe('canTransitionStatus', () => {
  it('allows valid transitions', () => {
    expect(canTransitionStatus('draft', 'pending_approval')).toBe(true);
    expect(canTransitionStatus('pending_approval', 'approved')).toBe(true);
    expect(canTransitionStatus('pending_approval', 'revision_requested')).toBe(true);
    expect(canTransitionStatus('approved', 'sent')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransitionStatus('draft', 'sent')).toBe(false);
    expect(canTransitionStatus('sent', 'draft')).toBe(false);
    expect(canTransitionStatus('approved', 'draft')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(canTransitionStatus('nonexistent', 'draft')).toBe(false);
  });
});

describe('findFontFamilyInLexicalNode', () => {
  it('returns null for null/undefined input', () => {
    expect(findFontFamilyInLexicalNode(null)).toBeNull();
    expect(findFontFamilyInLexicalNode(undefined)).toBeNull();
  });

  it('extracts font-family from style string', () => {
    const node = { style: 'font-family: Arial; font-size: 12px' };
    expect(findFontFamilyInLexicalNode(node)).toBe('Arial');
  });

  it('searches children recursively', () => {
    const node = {
      children: [
        { text: 'plain' },
        { style: 'font-family: "Times New Roman"' },
      ],
    };
    expect(findFontFamilyInLexicalNode(node)).toBe('"Times New Roman"');
  });

  it('returns null when no font-family found', () => {
    const node = { style: 'color: red', children: [{ text: 'hi' }] };
    expect(findFontFamilyInLexicalNode(node)).toBeNull();
  });
});

describe('extractFontFamilyFromContentNodes', () => {
  it('returns null for falsy input', () => {
    expect(extractFontFamilyFromContentNodes(null)).toBeNull();
    expect(extractFontFamilyFromContentNodes(undefined)).toBeNull();
  });

  it('parses JSON string input', () => {
    const json = JSON.stringify({
      root: { children: [{ style: 'font-family: Verdana' }] },
    });
    expect(extractFontFamilyFromContentNodes(json)).toBe('Verdana');
  });

  it('handles object input directly', () => {
    const obj = { root: { children: [{ style: 'font-family: Calibri' }] } };
    expect(extractFontFamilyFromContentNodes(obj)).toBe('Calibri');
  });

  it('returns null for invalid JSON string', () => {
    expect(extractFontFamilyFromContentNodes('not-json')).toBeNull();
  });
});

describe('formatContactAddress', () => {
  const contact = {
    id: '1',
    name: 'Max Mustermann',
    organization: 'ACME GmbH',
    business_street: 'Businesspark',
    business_house_number: '1',
    business_postal_code: '10115',
    business_city: 'Berlin',
    business_country: 'Deutschland',
  };

  it('formats business address', () => {
    const result = formatContactAddress(contact);
    expect(result).toContain('ACME GmbH');
    expect(result).toContain('Businesspark 1');
    expect(result).toContain('10115 Berlin');
  });

  it('handles missing fields gracefully', () => {
    const minimal = { id: '2', name: 'Test' };
    const result = formatContactAddress(minimal);
    expect(result).toBe('Test');
  });
});
