import { useState, type ComponentProps } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgendaEditorPanel } from "../AgendaEditorPanel";
import type { AgendaItem } from "../types";
vi.mock("../PendingJourFixeNotes", () => ({
  PendingJourFixeNotes: () => null,
}));
vi.mock("../PendingJourFixeCaseItems", () => ({
  PendingJourFixeCaseItems: () => null,
}));
vi.mock("@/features/appointment-requests/JourFixeRequestsCard", () => ({
  JourFixeRequestsCard: () => null,
}));
vi.mock("../UpcomingAppointmentsSection", () => ({
  UpcomingAppointmentsSection: () => null,
}));
vi.mock("../PlatformAgendaSection", () => ({
  PlatformAgendaSection: () => null,
}));
vi.mock("../BirthdayAgendaItem", () => ({ BirthdayAgendaItem: () => null }));
const base: AgendaItem = {
  id: "a",
  title: "Begrüßung",
  order_index: 0,
  is_completed: false,
  is_recurring: false,
  duration_minutes: 10,
};
function setup(patch: Partial<ComponentProps<typeof AgendaEditorPanel>> = {}) {
  const update = vi.fn();
  const add = vi.fn();
  const sub = vi.fn();
  function Harness() {
    const [items, setItems] = useState<AgendaItem[]>(
      patch.agendaItems ?? [base],
    );
    return (
      <AgendaEditorPanel
        selectedMeeting={{
          id: "meeting",
          title: "Jour fixe",
          meeting_date: "2026-11-08",
          meeting_time: "10:00",
          status: "planned",
        }}
        agendaItems={items}
        profiles={[]}
        tasks={[]}
        taskDocuments={{}}
        agendaDocuments={{}}
        linkedQuickNotes={[]}
        hasEditPermission
        showTaskSelector={null}
        onSetShowTaskSelector={vi.fn()}
        onAddAgendaItem={add}
        onAddSystemAgendaItem={vi.fn()}
        onUpdateAgendaItem={(index, field, value) => {
          update(index, field, value);
          setItems((prev) =>
            prev.map((item, i) =>
              i === index ? { ...item, [field]: value } : item,
            ),
          );
        }}
        onSaveAgendaItems={async () => true}
        onAddTaskToAgenda={vi.fn()}
        onAddSubItem={sub}
        onDeleteAgendaItem={vi.fn()}
        onToggleVisibility={vi.fn()}
        onDragEnd={vi.fn()}
        onUploadAgendaDocument={async () => null}
        onDeleteAgendaDocument={vi.fn()}
        onSetAgendaItems={setItems}
        meetingLinkedTasks={[]}
        meetingLinkedCaseItems={[]}
        meetingRelevantDecisions={[]}
        {...patch}
      />
    );
  }
  render(<Harness />);
  return { update, add, sub };
}
describe("agenda editor", () => {
  it("selects a main point and edits its details, duration and carryover through existing callbacks", async () => {
    const { update } = setup();
    expect(screen.queryByText("Ungespeicherte Änderungen")).toBeNull();
    fireEvent.focus(screen.getByLabelText("Titel des Agenda-Punkts"));
    fireEvent.change(screen.getByLabelText("Dauer in Minuten"), {
      target: { value: "15" },
    });
    expect(update).toHaveBeenCalledWith(0, "duration_minutes", 15);
    expect(screen.getByText("10:15")).toBeTruthy();
    fireEvent.click(screen.getByText("Beschreibung hinzufügen"));
    fireEvent.change(screen.getByLabelText("Beschreibung"), {
      target: { value: "Bericht" },
    });
    expect(update).toHaveBeenCalledWith(0, "description", "Bericht");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Auf nächstes Meeting übertragen" }),
    );
    expect(update).toHaveBeenCalledWith(0, "carry_over_to_next", true);
    expect(screen.getByText("↩ Übertragen")).toBeTruthy();
    expect(screen.getByText("Ungespeicherte Änderungen")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() =>
      expect(screen.queryByText("Ungespeicherte Änderungen")).toBeNull(),
    );
  });
  it("preserves title shortcuts and lets Shift+Tab navigate backwards", () => {
    const { add, sub } = setup();
    const title = screen.getByLabelText("Titel des Agenda-Punkts");
    fireEvent.keyDown(title, { key: "Tab", shiftKey: true });
    expect(sub).not.toHaveBeenCalled();
    fireEvent.keyDown(title, { key: "Tab" });
    expect(sub).toHaveBeenCalledWith(base, "");
    fireEvent.keyDown(title, { key: "Enter" });
    expect(add).toHaveBeenCalled();
  });
  it("collapses system previews and hides empty modules without losing nonempty ones", async () => {
    setup({
      agendaItems: [
        { ...base, system_type: "tasks" },
        {
          ...base,
          id: "n",
          title: "Notizen",
          system_type: "quick_notes",
          order_index: 1,
        },
      ],
      meetingLinkedTasks: [
        {
          id: "task",
          title: "Offene Aufgabe",
          priority: "normal",
          status: "todo",
          user_id: "user",
        },
      ],
    });
    const toggles = screen.getAllByRole("button", {
      name: "Baustein-Vorschau ein- oder ausklappen",
    });
    expect(toggles[0].getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggles[0]);
    expect(toggles[0].getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Leere Bausteine ausblenden" }),
    );
    await waitFor(() =>
      expect(screen.getAllByLabelText("Titel des Bausteins").length).toBe(2),
    );
    expect(
      screen
        .getAllByLabelText("Titel des Bausteins")[1]
        .closest("[data-rfd-draggable-id]")?.className,
    ).toContain("hidden");
    expect(screen.getByText("Offene Aufgabe")).toBeTruthy();
  });
  it("keeps read-only inspection from invoking edits", () => {
    const { update } = setup({ hasEditPermission: false });
    fireEvent.focus(screen.getByLabelText("Titel des Agenda-Punkts"));
    expect(
      screen.getByLabelText("Dauer in Minuten").hasAttribute("readonly"),
    ).toBe(true);
    expect(
      screen
        .getByRole("checkbox", { name: "Auf nächstes Meeting übertragen" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Speichern" })).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
  it("keeps unsaved changes visible after a failed save", async () => {
    setup({ onSaveAgendaItems: async () => false });
    fireEvent.change(screen.getByLabelText("Titel des Agenda-Punkts"), {
      target: { value: "Geändert" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() =>
      expect(screen.getByText("Ungespeicherte Änderungen")).toBeTruthy(),
    );
  });
});
