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


/** Mention labels already exist in the editor HTML; capture must not wait on a
 * profile request before confirming a durable offline save. */
export const extractMentionedUsers = (...inputs: Array<string | null | undefined>) => {
  const users = new Map<string, { id: string; displayName: string }>();
  for (const html of inputs) {
    const document = new DOMParser().parseFromString(html ?? "", "text/html");
    for (const node of document.querySelectorAll("[data-lexical-mention-user-id]")) {
      const id = node.getAttribute("data-lexical-mention-user-id")?.trim();
      if (id) users.set(id, { id, displayName: node.textContent?.replace(/^@/, "").trim() || "Erwähnte Person" });
    }
  }
  return [...users.values()];
};
