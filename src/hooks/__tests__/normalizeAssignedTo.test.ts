import { describe, it, expect } from 'vitest';

// Extracted from useMyWorkTasksData for testability
const normalizeAssignedTo = (assignedTo: string | null | undefined) => {
  if (!assignedTo) return [];
  return assignedTo
    .replace(/[{}]/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

describe('normalizeAssignedTo', () => {
  it('returns empty array for null', () => {
    expect(normalizeAssignedTo(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(normalizeAssignedTo(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(normalizeAssignedTo('')).toEqual([]);
  });

  it('parses a single UUID', () => {
    expect(normalizeAssignedTo('abc-123')).toEqual(['abc-123']);
  });

  it('parses Postgres array format {uuid1,uuid2}', () => {
    expect(normalizeAssignedTo('{abc-123,def-456}')).toEqual(['abc-123', 'def-456']);
  });

  it('handles spaces in comma-separated values', () => {
    expect(normalizeAssignedTo('{ abc-123 , def-456 }')).toEqual(['abc-123', 'def-456']);
  });

  it('filters out empty segments', () => {
    expect(normalizeAssignedTo('{abc,,def}')).toEqual(['abc', 'def']);
  });
});
