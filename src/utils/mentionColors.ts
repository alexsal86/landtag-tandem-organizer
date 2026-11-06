const HEX = /^#[0-9a-f]{3,8}$/i;

/** Inline style for a mention chip in the mentioned user's colour. */
export function mentionStyle(color: string | null | undefined): string {
  const c = color && HEX.test(color) ? color : "#3b82f6";
  return `background-color: color-mix(in srgb, ${c} 18%, transparent); color: color-mix(in srgb, ${c} 75%, black); font-weight: 600; padding: 2px 8px; margin: 0 1px; border-radius: 9999px;`;
}

/** Re-applies user colours to already rendered mention spans (older notes stored a fixed amber style). */
export function applyMentionColors(root: HTMLElement | null): void {
  if (!root) return;
  root.querySelectorAll<HTMLElement>('span[data-lexical-mention="true"]').forEach((el) => {
    el.style.cssText = mentionStyle(el.getAttribute("data-lexical-mention-color"));
  });
}
