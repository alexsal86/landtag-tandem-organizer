import { AVAILABLE_COLORS } from './userColors';

/** Resolve current and legacy employee colors to the shared 200/950 palette. */
export function mentionColors(badgeColor: string | null) {
  const input = badgeColor?.trim().toLowerCase() ?? '';
  const hex = /^#[\da-f]{3}$/i.test(input)
    ? `#${[...input.slice(1)].map(c => c + c).join('')}` : input;
  let palette = AVAILABLE_COLORS.find(color =>
    [color.hex, color.baseHex, color.value, color.classes.split(' ')[0]].includes(hex));
  if (!palette && /^#[\da-f]{6}$/i.test(hex)) {
    // Custom employee colors use the closest family in the agreed palette.
    const distance = (base: string) => [1, 3, 5].reduce((sum, offset) =>
      sum + (parseInt(base.slice(offset, offset + 2), 16) - parseInt(hex.slice(offset, offset + 2), 16)) ** 2, 0);
    palette = AVAILABLE_COLORS.reduce((best, color) => distance(color.baseHex) < distance(best.baseHex) ? color : best);
  }
  palette ??= AVAILABLE_COLORS[0];
  return { background: palette.hex, text: palette.text };
}

/** Shared by the editor, HTML export and already saved mentions. */
export function mentionStyle(badgeColor: string | null | undefined): string {
  const colors = mentionColors(badgeColor ?? null);
  return `background-color: ${colors.background}; color: ${colors.text}; font-weight: 600; padding: 3px 9px; margin: 0 1px; border-radius: 9999px;`;
}

export function styleMention(element: HTMLElement, badgeColor: string | null) {
  element.style.cssText = mentionStyle(badgeColor);
}

export function applyMentionColors(root: HTMLElement | null): void {
  root?.querySelectorAll<HTMLElement>('span[data-lexical-mention="true"]').forEach(element => {
    styleMention(element, element.getAttribute('data-lexical-mention-color'));
  });
}
