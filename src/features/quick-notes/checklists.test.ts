import { describe, expect, it } from "vitest";
import { normalizeChecklistHtml, exportChecklistHtml, countChecklist, renderChecklistHtml, toggleChecklistItem } from "./checklists";
import { sanitizeRichHtml } from "@/utils/htmlSanitizer";
import { isNoteStale } from "@/components/shared/quickNoteBoard";
import type { QuickNote } from "./types";

describe("structured and legacy checklists", () => {
  it("converts legacy line markers to Lexical lists without losing rich text", () => {
    const html = normalizeChecklistHtml('<p>[ ] <strong>Akten</strong></p><p>[x] Laptop</p>');
    expect(html).toContain('__lexicallisttype="check"');
    expect(html).toContain('<strong>Akten</strong>');
    expect(countChecklist(html)).toEqual({ done: 1, total: 2 });
  });
  it("keeps list type and checked state across sanitizing and editor re-import", () => {
    const initial = '<ul __lexicallisttype="check"><li role="checkbox" aria-checked="true">Erledigt</li><li role="checkbox" aria-checked="false">Offen</li></ul>';
    const safe = sanitizeRichHtml(exportChecklistHtml(initial));
    expect(safe).toContain('data-note-checklist="true"');
    expect(countChecklist(normalizeChecklistHtml(safe))).toEqual({ done: 1, total: 2 });
    expect(countChecklist(toggleChecklistItem(safe, 1))).toEqual({ done: 2, total: 2 });
    const rendered = renderChecklistHtml(safe.replace('<li role=', '<li class="note-editor-check" role='));
    expect(rendered).not.toContain('class="note-editor-check"');
    expect(rendered).toContain('note-check-item--done');
  });
  it("does not rewrite markers inside HTML attributes and disables read-only checkboxes", () => {
    const safe = '<p title="[ ] kein Punkt">[ ] Echter Punkt</p>';
    const rendered = renderChecklistHtml(safe, false);
    const dom = new DOMParser().parseFromString(rendered, 'text/html');
    expect(dom.querySelectorAll('button')).toHaveLength(1);
    expect(dom.querySelector('button')?.disabled).toBe(true);
    expect(dom.querySelector('p')?.title).toBe('[ ] kein Punkt');
  });
});
describe("notes unchanged for 30 days", () => {
  const note: QuickNote = { id: "note", title: null, content: "", color: null, is_pinned: false, created_at: "2026-09-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z" };
  const now = new Date('2026-11-04T12:00:00Z');
  it("uses the last edit and excludes scheduled future follow-ups and unsynced notes", () => {
    expect(isNoteStale(note, now)).toBe(true);
    expect(isNoteStale({ ...note, updated_at: '2026-10-05T12:00:00Z' }, now)).toBe(false);
    expect(isNoteStale({ ...note, follow_up_date: '2026-11-05T12:00:00Z' }, now)).toBe(false);
    expect(isNoteStale({ ...note, sync_status: 'pending' }, now)).toBe(false);
    expect(isNoteStale({ ...note, updated_at: 'invalid' }, now)).toBe(false);
  });
});
