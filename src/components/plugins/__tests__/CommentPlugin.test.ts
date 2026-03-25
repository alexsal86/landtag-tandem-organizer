import { describe, expect, it } from 'vitest';

import { CommentMarkNode } from '@/components/plugins/CommentPlugin';

describe('CommentMarkNode serialization', () => {
  it('exports and imports commentId with typed JSON payload', () => {
    const node = new CommentMarkNode('comment-42');

    const serialized = node.exportJSON();

    expect(serialized.type).toBe('comment-mark');
    expect(serialized.version).toBe(1);
    expect(serialized.commentId).toBe('comment-42');

    const imported = CommentMarkNode.importJSON(serialized);
    expect(imported.getCommentId()).toBe('comment-42');
  });
});
