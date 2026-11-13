import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactListTable } from "./ContactListTable";

vi.mock("./hooks/useContactsViewState", () => ({ getGenderLabel: () => "" }));

describe("contact column switches", () => {
  it("renders one button per switch and persists each option independently", () => {
    const { container, unmount } = render(<ContactListTable
      contacts={[]} sortColumn={null} sortDirection="asc"
      onSort={vi.fn()} onContactClick={vi.fn()} onToggleFavorite={vi.fn()}
      isSelectionMode={false} selectedContactIds={new Set()} onToggleSelection={vi.fn()}
    />);
    expect(container.querySelector("button button")).toBeNull();
    const options = [
      ["Vor-/Nachname aufteilen", "contacts-split-name"],
      ["Anrede inline anzeigen", "contacts-show-salutation"],
      ["Organisation als eigene Spalte", "contacts-org-column"],
    ];
    for (const [name, key] of options) {
      const control = screen.getByRole("switch", { name });
      expect(control.tagName).toBe("BUTTON");
      expect(control).toHaveAttribute("aria-checked", "false");
      fireEvent.click(control);
      expect(control).toHaveAttribute("aria-checked", "true");
      expect(localStorage.getItem(key)).toBe("true");
    }
    expect(screen.getByRole("columnheader", { name: /Vorname/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Organisation" })).toBeInTheDocument();
    unmount();
  });
});
