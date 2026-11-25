export const OPEN_GLOBAL_QUICK_NOTE = "openGlobalQuickNote";
export const QUICK_NOTE_SHORTCUT = "Strg/⌘ + .";

/** Opens the global quick-note dialog from any page. */
export function openGlobalQuickNote() {
  window.dispatchEvent(new Event(OPEN_GLOBAL_QUICK_NOTE));
}
