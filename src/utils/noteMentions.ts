export const extractMentionedUserIds = (...htmlInputs: Array<string | null | undefined>) => {
  const mentionRegex = /data-lexical-mention-user-id="([^"]+)"/g;
  const userIds = new Set<string>();

  for (const html of htmlInputs) {
    if (!html) continue;

    let match: RegExpExecArray | null = mentionRegex.exec(html);
    while (match) {
      const userId = match[1]?.trim();
      if (userId) {
        userIds.add(userId);
      }
      match = mentionRegex.exec(html);
    }

    mentionRegex.lastIndex = 0;
  }

  return Array.from(userIds);
};

