export const SHOW_RECENT_PREF_KEY = "sidebar_show_recent_v1";
export const SIDEBAR_MODE_PREF_KEY = "sidebar_mode_v1";
export const COMPACT_SIDEBAR_WIDTH = 48;
export type SidebarMode = "normal" | "compact" | "ghost";

export function sidebarMode(value: unknown): SidebarMode {
  return value === "compact" || value === "ghost" ? value : "normal";
}

export function isSidebarToggleShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.shiftKey) return false;
  if (event.target instanceof Element && event.target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="menu"]',
  )) return false;
  return (event.metaKey && !event.ctrlKey && (event.key === "\\" || event.code === "Backslash")) ||
    (event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "b");
}
