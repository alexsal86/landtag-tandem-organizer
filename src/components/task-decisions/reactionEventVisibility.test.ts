import { describe, expect, it } from 'vitest';
import { shouldHandleReactionEvent } from './reactionEventVisibility';

describe('shouldHandleReactionEvent', () => {
  it('returns true when comment id is visible', () => {
    const visibleSet = new Set(['comment-1', 'comment-2']);

    expect(shouldHandleReactionEvent('comment-1', visibleSet)).toBe(true);
  });

  it('returns false when comment id is missing in visible set', () => {
    const visibleSet = new Set(['comment-1']);

    expect(shouldHandleReactionEvent('comment-3', visibleSet)).toBe(false);
  });

  it('returns false for empty ids', () => {
    const visibleSet = new Set(['comment-1']);

    expect(shouldHandleReactionEvent(undefined, visibleSet)).toBe(false);
    expect(shouldHandleReactionEvent(null, visibleSet)).toBe(false);
    expect(shouldHandleReactionEvent('', visibleSet)).toBe(false);
  });
});
