import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GdprDeclarationDialog } from "./GdprDeclarationDialog";
import { canConfirmGdpr, hasReadToEnd } from "./gdpr";

afterEach(cleanup);
const open = () => fireEvent.click(screen.getByRole("button", { name: "DSGVO-Verpflichtung öffnen" }));
const scroll = (top: number) => {
  const region = screen.getByRole("region");
  Object.defineProperties(region, { clientHeight: { value: 300, configurable: true }, scrollHeight: { value: 1200, configurable: true }, scrollTop: { value: top, configurable: true } });
  fireEvent.scroll(region);
};
it("requires the text end, retains a failed confirmation, and resets on reopening", async () => {
  const confirm = vi.fn().mockResolvedValue(false);
  render(<GdprDeclarationDialog busy={false} completed={false} canConfirm onConfirm={confirm} />);
  open();
  const button = screen.getByRole("button", { name: /Gelesen und verstanden/ });
  expect(button).toBeDisabled();
  scroll(500);
  expect(button).toBeDisabled();
  scroll(900);
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  open();
  expect(screen.getByRole("button", { name: /Gelesen und verstanden/ })).toBeDisabled();
});
it("does not offer confirmation to other viewers", () => {
  render(<GdprDeclarationDialog busy={false} completed={false} canConfirm={false} onConfirm={vi.fn()} />);
  open(); scroll(900);
  expect(screen.queryByRole("button", { name: /Gelesen und verstanden/ })).not.toBeInTheDocument();
  expect(canConfirmGdpr("lead", "staff", true)).toBe(false);
  expect(canConfirmGdpr("staff", "staff", false)).toBe(false);
  expect(canConfirmGdpr("staff", "staff", true)).toBe(true);
  expect(hasReadToEnd(0, 0, 0)).toBe(false);
});
it("displays the saved declaration rather than a newer text", () => {
  render(<GdprDeclarationDialog busy={false} completed canConfirm={false} onConfirm={vi.fn()} declarationText="Historisch bestätigter Wortlaut" declarationVersion="alt" />);
  open();
  expect(screen.getByText("Historisch bestätigter Wortlaut")).toBeInTheDocument();
  expect(screen.getByText(/Version alt/)).toBeInTheDocument();
});

it("confirms the version actually opened even if the current text changes", async () => {
  const confirm = vi.fn().mockResolvedValue(true);
  const { rerender } = render(<GdprDeclarationDialog busy={false} completed={false} canConfirm onConfirm={confirm} currentDeclaration={{ version: "v1", text: "Erste Fassung" }} />);
  open(); scroll(900);
  rerender(<GdprDeclarationDialog busy={false} completed={false} canConfirm onConfirm={confirm} currentDeclaration={{ version: "v2", text: "Zweite Fassung" }} />);
  expect(screen.getByText("Erste Fassung")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Gelesen und verstanden/ }));
  await waitFor(() => expect(confirm).toHaveBeenCalledWith("v1"));
});
