import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The markup GlobalCreateMenu used before the fix: Button nested inside the trigger.
function OldPattern() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Old pattern trigger" title="Erstellen">
          <span>+</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem>Schnelle Notiz</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe("old nested-button trigger pattern", () => {
  it("renders and opens without an update-depth crash", () => {
    render(<OldPattern />);
    const trigger = screen.getByRole("button", { name: /Old pattern trigger/i });
    expect(trigger.tagName).toBe("BUTTON");
    fireEvent(
      trigger,
      new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 })
    );
    expect(screen.getByRole("menuitem", { name: /Schnelle Notiz/i })).toBeInTheDocument();
    cleanup();
  });
});
