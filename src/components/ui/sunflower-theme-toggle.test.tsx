import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, useTheme } from "next-themes";
import { describe, expect, it, vi } from "vitest";
import { SunflowerThemeToggle } from "./sunflower-theme-toggle";

function ThemeSelection() {
  const { setTheme } = useTheme();
  return <button onClick={() => setTheme("system")}>System</button>;
}

function renderToggle(defaultTheme = "system") {
  return render(<ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem>
    <SunflowerThemeToggle /><ThemeSelection />
  </ThemeProvider>);
}

describe("SunflowerThemeToggle with the existing theme provider", () => {
  it("updates the whole app and persists the choice across remounts", async () => {
    const view = renderToggle("light");
    const toggle = screen.getByRole("switch", { name: "Dunkelmodus" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    view.unmount();
    renderToggle();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(document.documentElement).toHaveClass("light"));
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("resolves and follows system preference until the user selects a theme", async () => {
    let dark = true;
    let listener: (() => void) | undefined;
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(query => ({
      matches: dark, media: query, onchange: null,
      addListener: callback => { listener = () => callback({ matches: dark } as MediaQueryListEvent); }, removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: () => true,
    }));
    try {
      renderToggle();
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
      dark = false;
      act(() => listener?.());
      await waitFor(() => expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false"));
      fireEvent.click(screen.getByRole("switch"));
      expect(localStorage.getItem("theme")).toBe("dark");
      fireEvent.click(screen.getByRole("button", { name: "System" }));
      expect(localStorage.getItem("theme")).toBe("system");
      await waitFor(() => expect(document.documentElement).toHaveClass("light"));
    } finally {
      matchMedia.mockRestore();
    }
  });

  it("renders fourteen petals and unique SVG references for multiple instances", () => {
    const { container } = render(<ThemeProvider attribute="class"><SunflowerThemeToggle /><SunflowerThemeToggle /></ThemeProvider>);
    expect(container.querySelectorAll(".sunflower-petal")).toHaveLength(28);
    const clips = Array.from(container.querySelectorAll("clipPath"), clip => clip.id);
    expect(new Set(clips).size).toBe(2);
    expect(screen.getAllByRole("switch")[0]).toHaveAttribute("type", "button");
  });
});
