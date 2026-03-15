export const shouldHandleReactionEvent = (
  commentId: string | null | undefined,
  visibleCommentIds: ReadonlySet<string>,
): commentId is string => {
  if (!commentId) {
    return false;
  }

  return visibleCommentIds.has(commentId);
};
