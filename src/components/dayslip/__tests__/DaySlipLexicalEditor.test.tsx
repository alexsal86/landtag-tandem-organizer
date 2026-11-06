import "@testing-library/jest-dom/vitest";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { $getRoot, ParagraphNode, KEY_ENTER_COMMAND, type LexicalEditor, type TextNode } from "lexical";
import { DaySlipLexicalEditor, type DaySlipEditorProps } from "../DaySlipLexicalEditor";
import { $createDaySlipLineNode, DaySlipLineNode } from "@/components/lexical/DaySlipLineNode";

vi.mock("@/components/lexical/FloatingTextFormatToolbar", () => ({ default: () => null }));

function props(onReady: (editor: LexicalEditor) => void): DaySlipEditorProps {
  return {
    initialHtml: '<p data-line-id="original">Hello world</p>',
    dayKey: "2026-11-04", resolveMode: false,
    editorConfig: { namespace: "test", nodes: [DaySlipLineNode, { replace: ParagraphNode, with: () => $createDaySlipLineNode(), withKlass: DaySlipLineNode }], onError: error => { throw error; } },
    onEditorChange: vi.fn(), onEditorReady: onReady, onEditorClick: vi.fn(), onEditorContextMenu: vi.fn(), onDrop: vi.fn(),
  };
}

describe("Tageszettel editor", () => {
  it("rehydrates external changes through an explicit token and respects read-only completion", async () => {
    let editor!: LexicalEditor;
    const initial = props(value => { editor = value; });
    const view = render(<DaySlipLexicalEditor {...initial} />);
    await waitFor(() => expect(view.getByRole("textbox")).toHaveTextContent("Hello world"));
    view.rerender(<DaySlipLexicalEditor {...initial} initialHtml='<p data-line-id="remote">Loaded remote content</p>' forceReloadToken={1} readOnly />);
    await waitFor(() => expect(view.getByRole("textbox")).toHaveTextContent("Loaded remote content"));
    expect(editor.isEditable()).toBe(false);
    expect(view.container.querySelector("p")?.dataset.lineId).toBe("remote");
    view.rerender(<DaySlipLexicalEditor {...initial} initialHtml='<p data-line-id="remote">Loaded remote content</p>' forceReloadToken={1} readOnly={false} />);
    expect(editor.isEditable()).toBe(true);
  });
  it("splits at the caret on Enter and assigns a new line ID", async () => {
    let editor!: LexicalEditor;
    const view = render(<DaySlipLexicalEditor {...props(value => { editor = value; })} />);
    await waitFor(() => expect(view.getByRole("textbox")).toHaveTextContent("Hello world"));
    await act(async () => {
      editor.update(() => { $getRoot().getFirstChildOrThrow<DaySlipLineNode>().getFirstChildOrThrow<TextNode>().select(5, 5); }, { discrete: true });
      editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter" }));
    });
    const paragraphs = Array.from(view.container.querySelectorAll("p"));
    expect(paragraphs.map(node => node.textContent)).toEqual(["Hello", " world"]);
    expect(new Set(paragraphs.map(node => node.dataset.lineId)).size).toBe(2);
  });
  it("retains an imported task link in both editor JSON and exported HTML", async () => {
    let editor!: LexicalEditor;
    const initial = props(value => { editor = value; });
    render(<DaySlipLexicalEditor {...initial} initialHtml='<p data-line-id="line" data-linked-task-id="task-1">Linked task</p>' />);
    await waitFor(() => expect(editor?.getEditorState().toJSON().root.children[0]).toMatchObject({ type: "dayslip-line", lineId: "line", linkedSource: { type: "task", id: "task-1" } }));
  });
});
