import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";

vi.mock("@/components/plugins/MentionsPlugin", () => ({ MentionsPlugin: () => null }));
vi.mock("@/components/shared/SpeechCommandsDialog", () => ({ SpeechCommandsDialog: () => null }));
vi.mock("@/components/shared/SpeechSessionStats", () => ({ SpeechSessionStats: () => null }));
// Nur die Aufnahme wird ersetzt, die übrigen Exporte bleiben die echten. Der
// Editor liest aus demselben Modul auch SPEECH_INTERIM_UPDATE_TAG; ein
// unvollständiger Mock lässt Vitest beim Zugriff darauf werfen, der
// Update-Listener bricht ab und es kommt keine onChange-Meldung mehr an.
vi.mock("@/hooks/useSpeechDictation", async importOriginal => ({
  ...(await importOriginal<typeof import("@/hooks/useSpeechDictation")>()),
  useSpeechDictation: () => ({ speechSupported: false }),
}));

describe("Lexical checklist editing", () => {
  it("does not rebuild the editor DOM when its own exported checklist HTML is fed back", async () => {
    const onChange = vi.fn();
    const initial = '<ul data-note-checklist="true"><li role="checkbox" aria-checked="false">Akten</li></ul>';
    const view = render(<SimpleRichTextEditor enableChecklists initialContent={initial} onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const item = view.container.querySelector('li');
    expect(item?.getAttribute('role')).toBe('checkbox');
    const html = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(html).toContain('data-note-checklist="true"');
    await act(async () => {
      view.rerender(<SimpleRichTextEditor enableChecklists initialContent={html} onChange={onChange} />);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(view.container.querySelector('li')).toBe(item);
    await act(async () => { view.rerender(<SimpleRichTextEditor enableChecklists disabled initialContent={html} onChange={onChange} />); });
    expect(view.container.querySelector('[contenteditable]')?.getAttribute('contenteditable')).toBe('false');
  });
});
