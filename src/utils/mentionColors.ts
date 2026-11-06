/** Keep each employee's hue and derive a darker text color for light chips. */
export function mentionColors(badgeColor: string | null) {
  const input = badgeColor?.trim() ?? '';
  const hex = /^#[\da-f]{6}$/i.test(input) ? input
    : /^#[\da-f]{3}$/i.test(input) ? `#${[...input.slice(1)].map(c => c + c).join('')}`
    : '#3b82f6';
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const text = `#${channels.map(channel => Math.round(channel * 0.45).toString(16).padStart(2, '0')).join('')}`;
  return { background: `${hex}33`, text };
}

/** Shared by the editor, HTML export and already saved mentions. */
export function mentionStyle(badgeColor: string | null | undefined): string {
  const colors = mentionColors(badgeColor ?? null);
  return `background-color: ${colors.background}; color: ${colors.text}; font-weight: 600; padding: 2px 8px; margin: 0 1px; border-radius: 9999px;`;
}

export function styleMention(element: HTMLElement, badgeColor: string | null) {
  element.style.cssText = mentionStyle(badgeColor);
}

export function applyMentionColors(root: HTMLElement | null): void {
  root?.querySelectorAll<HTMLElement>('span[data-lexical-mention="true"]').forEach(element => {
    styleMention(element, element.getAttribute('data-lexical-mention-color'));
  });
}
