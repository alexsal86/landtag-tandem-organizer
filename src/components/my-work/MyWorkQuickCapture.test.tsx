import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeyboardEventHandler, ReactNode } from "react";
import { MyWorkQuickCapture } from "./MyWorkQuickCapture";

const save = vi.hoisted(() => vi.fn());
const saveTask = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: "tenant" } }) }));
vi.mock("@/components/my-work/hooks/useQuickCaptureActions", () => ({ useQuickCaptureActions: () => ({ handleSaveNote: save, handleSaveAsTask: saveTask, saving: false, savingAsTask: false, mentionedUsers: [] }) }));
vi.mock("@/components/my-work/useNoteColorPalette", () => ({ useNoteColorPalette: () => ({ palette: [] }), colorLabel: () => "" }));
vi.mock("@/components/shared/MentionSharePromptDialog", () => ({ MentionSharePromptDialog: () => null }));
vi.mock("@/components/ui/SimpleRichTextEditor", () => ({
  default: ({ placeholder, initialContent, onChange, onKeyDown, autoFocus, toolbarExtras }: {
    toolbarExtras?: ReactNode; autoFocus?: boolean; placeholder: string; initialContent: string; onChange: (value: string) => void;
    onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  }) => <div onKeyDown={onKeyDown}><textarea autoFocus={autoFocus} aria-label={placeholder} defaultValue={initialContent} onChange={e => onChange(e.target.value)} />{toolbarExtras}</div>,
}));

beforeEach(() => { localStorage.clear(); save.mockClear(); saveTask.mockClear(); });
describe("quick capture keyboard", () => {
  it("keeps Enter for writing and saves with Ctrl/Cmd + Enter in both editors", () => {
    render(<MyWorkQuickCapture />);
    fireEvent.click(screen.getByRole("button", { name: "Notiz erfassen…" }));
    const editors = screen.getAllByRole("textbox");
    expect(editors[1]).toHaveFocus();
    expect(editors[0]).toHaveAccessibleName("Titel");
    expect(screen.getByRole("button", { name: "Als Aufgabe" })).toBeDisabled();
    fireEvent.change(editors[0], { target: { value: "Mein Titel" } });
    for (const editor of editors) {
      expect(fireEvent.keyDown(editor, { key: "Enter" })).toBe(true);
      expect(save).not.toHaveBeenCalled();
    }
    for (const editor of editors) {
      expect(fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true })).toBe(false);
      expect(fireEvent.keyDown(editor, { key: "Enter", metaKey: true })).toBe(false);
    }
    expect(save).toHaveBeenCalledTimes(4);
    fireEvent.keyDown(editors[1], { key: "Enter", ctrlKey: true, isComposing: true });
    expect(save).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("button", { name: "Notiz speichern" })).toBeEnabled();
    fireEvent.change(editors[1], { target: { value: "Bitte Rückruf erledigen" } });
    fireEvent.click(screen.getByRole("button", { name: "Als Aufgabe" }));
    expect(saveTask).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Notiz speichern" })).toHaveClass("bg-primary");
    expect(screen.queryByText("Quick Notes")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    fireEvent.click(screen.getByRole("button", { name: "Entwurf fortsetzen…" }));
    expect(screen.getByRole("textbox", { name: "Titel" })).toHaveValue("<p>Mein Titel</p>");
    expect(screen.getByRole("textbox", { name: "Gedanke, Notiz oder Anliegen…" })).toHaveFocus();
  });
});
