import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MyWorkEmptyState } from "@/components/my-work/MyWorkEmptyState";
import { Calendar } from "lucide-react";

describe("MyWorkEmptyState", () => {
  it("renders title and description", () => {
    render(<MyWorkEmptyState title="Keine Termine" description="Heute ist nichts geplant." />);
    expect(screen.getByText("Keine Termine")).toBeInTheDocument();
    expect(screen.getByText("Heute ist nichts geplant.")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    const { container } = render(
      <MyWorkEmptyState icon={Calendar} title="Leer" />
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("calls onAction when action button clicked", () => {
    const handler = vi.fn();
    render(
      <MyWorkEmptyState title="Leer" actionLabel="Erstellen" onAction={handler} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Erstellen/i }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("hides action button when no handler is provided", () => {
    render(<MyWorkEmptyState title="Leer" actionLabel="Erstellen" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("applies compact spacing modifiers", () => {
    const { container } = render(<MyWorkEmptyState title="Leer" compact />);
    expect(container.firstChild).toHaveClass("py-6");
  });
});
